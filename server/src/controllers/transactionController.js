const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const RiskAssessment = require('../models/RiskAssessment');
const Customer = require('../models/Customer');
const { success, error } = require('../utils/response');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { fullAssessment } = require('../utils/riskEngine');
const auditLogger = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { formatINR } = require('../utils/currency');

const updateCustomerStats = async (transaction) => {
  try {
    const isSuspicious = ['flagged', 'blocked', 'held_for_review'].includes(transaction.status);
    await Customer.findOneAndUpdate(
      { customerId: transaction.customerId },
      {
        $inc: {
          transactionCount: 1,
          totalTransactionAmount: transaction.amount,
          flaggedTransactionCount: isSuspicious ? 1 : 0,
        },
        $set: {
          currency: 'INR',
          lastTransactionAt: transaction.timestamp,
          riskScore: transaction.riskScore,
          riskLevel: transaction.riskLevel || 'unassessed',
        },
        $min: { firstTransactionAt: transaction.timestamp },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    logger.error('Customer update error:', err.message);
  }
};

const createAlertForTransaction = async (transaction, assessment) => {
  try {
    const severity = assessment.level === 'unassessed' ? 'high' : assessment.level;
    const deduplicationKey = `${transaction.transactionId}-risk-${severity}`;
    const existing = await Alert.findOne({ deduplicationKey });
    if (existing) return;

    const desc = assessment.success
      ? `Transaction of ${formatINR(transaction.amount)} by ${transaction.customerId} flagged with ${assessment.triggeredRules.length} rule(s).`
      : `Risk assessment failed for transaction ${transaction.transactionId}: ${assessment.error || 'Internal engine error'}. Marked for manual analyst review.`;

    await Alert.create({
      alertId: `ALERT-${uuidv4().substring(0, 8).toUpperCase()}`,
      title: `${severity.toUpperCase()} Risk Alert: ${transaction.transactionId}`,
      description: desc,
      severity,
      transactionId: transaction._id,
      triggeredRules: assessment.triggeredRules || [],
      deduplicationKey,
      isDemo: transaction.isDemo,
    });
  } catch (err) {
    logger.error('Alert creation error:', err.message);
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.customerId) filter.customerId = { $regex: req.query.customerId, $options: 'i' };
    if (req.query.transactionId) filter.transactionId = { $regex: req.query.transactionId, $options: 'i' };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
    if (req.query.assessmentStatus) filter.assessmentStatus = req.query.assessmentStatus;
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.timestamp = {};
      if (req.query.dateFrom) filter.timestamp.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.timestamp.$lte = new Date(req.query.dateTo);
    }
    if (req.query.amountMin || req.query.amountMax) {
      filter.amount = {};
      if (req.query.amountMin) filter.amount.$gte = parseFloat(req.query.amountMin);
      if (req.query.amountMax) filter.amount.$lte = parseFloat(req.query.amountMax);
    }
    const sortField = req.query.sortBy || 'timestamp';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);
    return success(res, transactions, 'Transactions retrieved', 200, paginationMeta(total, page, limit));
  } catch (err) {
    return error(res, 'Failed to retrieve transactions', 500);
  }
};

exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return error(res, 'Transaction not found', 404);
    const [alerts, assessments] = await Promise.all([
      Alert.find({ transactionId: transaction._id }).populate('assignedTo', 'name email'),
      RiskAssessment.find({ transactionId: transaction._id }).sort({ assessedAt: -1 }).limit(5),
    ]);

    let behavioralProfile = null;
    try {
      const { extractCustomerBehavioralFeatures } = require('../utils/behavioralAnalytics');
      behavioralProfile = await extractCustomerBehavioralFeatures(transaction);
    } catch (bErr) {
      logger.warn(`Behavioral profile extraction error for ${transaction.transactionId}: ${bErr.message}`);
    }

    return success(res, { transaction, alerts, assessments, behavioralProfile }, 'Transaction retrieved');
  } catch (err) {
    return error(res, 'Failed to retrieve transaction', 500);
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const txData = {
      ...req.body,
      transactionId: req.body.transactionId || `TXN-${uuidv4().substring(0, 8).toUpperCase()}`,
      ingestionSource: req.body.ingestionSource || 'manual',
      isDemo: req.body.isDemo || false,
      status: 'pending',
      assessmentStatus: 'pending',
    };

    const existing = await Transaction.findOne({ transactionId: txData.transactionId });
    if (existing) return error(res, 'Transaction ID already exists', 409);

    const transaction = await Transaction.create(txData);

    // Execute risk assessment
    const assessment = await fullAssessment(transaction);

    if (assessment.success) {
      transaction.riskScore = assessment.score;
      transaction.riskLevel = assessment.level;
      transaction.riskReasons = assessment.triggeredRules;
      transaction.riskAssessedAt = assessment.assessedAt;
      transaction.assessmentStatus = 'completed';
      transaction.assessmentAttempts = assessment.attempts || 1;
      transaction.mlScore = assessment.mlScore;
      transaction.mlDecision = assessment.mlDecision;
      transaction.mlExplanation = assessment.mlExplanation || [];
      transaction.assessmentSource = assessment.analysisSource || 'rules_engine';
      transaction.status = assessment.score >= 80 ? 'blocked' : assessment.score >= 25 ? 'flagged' : 'approved';
    } else {
      // Risk assessment failed: NEVER treat as low-risk or auto-approved
      transaction.riskScore = null;
      transaction.riskLevel = 'unassessed';
      transaction.riskReasons = [];
      transaction.assessmentStatus = 'failed';
      transaction.assessmentError = assessment.error || 'Assessment execution failed';
      transaction.assessmentAttempts = assessment.attempts || 1;
      transaction.mlScore = null;
      transaction.mlDecision = 'unavailable';
      transaction.mlExplanation = [];
      transaction.assessmentSource = 'unassessed';
      transaction.status = 'held_for_review';
    }

    await transaction.save();

    await RiskAssessment.create({
      transactionId: transaction._id,
      score: assessment.success ? assessment.score : null,
      level: assessment.success ? assessment.level : 'unassessed',
      assessmentStatus: assessment.success ? 'completed' : 'failed',
      errorMessage: assessment.success ? undefined : assessment.error,
      triggeredRules: assessment.triggeredRules || [],
      ruleVersion: assessment.ruleVersion || '1.0',
      analysisSource: assessment.analysisSource || (assessment.success ? 'rules_engine' : 'manual'),
      mlScore: assessment.mlScore !== undefined ? assessment.mlScore : null,
      mlServiceUsed: Boolean(assessment.mlScore !== null && assessment.mlScore !== undefined),
      featuresExtracted: assessment.mlFeatures || null,
      assessedAt: assessment.assessedAt,
    });

    await updateCustomerStats(transaction);

    // If high risk OR assessment failed, flag alert for manual review
    if (!assessment.success || assessment.score >= 55) {
      await createAlertForTransaction(transaction, assessment);
    }

    await auditLogger.log({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'TRANSACTION_CREATED',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      details: {
        amount: transaction.amount,
        customerId: transaction.customerId,
        riskScore: transaction.riskScore,
        assessmentStatus: transaction.assessmentStatus,
      },
      ipAddress: req.ip,
    });

    return success(res, transaction, 'Transaction created and assessed', 201);
  } catch (err) {
    if (err.code === 11000) return error(res, 'Duplicate transaction ID', 409);
    return error(res, 'Failed to create transaction', 500);
  }
};

exports.updateTransactionStatus = async (req, res) => {
  try {
    const { status, reviewStatus, notes } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return error(res, 'Transaction not found', 404);
    if (status) transaction.status = status;
    if (reviewStatus) transaction.reviewStatus = reviewStatus;
    if (notes) transaction.notes = notes;
    await transaction.save();

    await auditLogger.log({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'TRANSACTION_STATUS_UPDATED',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      details: { status, reviewStatus },
      ipAddress: req.ip,
    });
    return success(res, transaction, 'Transaction updated');
  } catch (err) {
    return error(res, 'Failed to update transaction', 500);
  }
};

exports.getTransactionsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { page, limit, skip } = getPagination(req.query);
    const [transactions, total] = await Promise.all([
      Transaction.find({ customerId }).sort({ timestamp: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments({ customerId }),
    ]);
    return success(res, transactions, 'Customer transactions retrieved', 200, paginationMeta(total, page, limit));
  } catch (err) {
    return error(res, 'Failed to retrieve customer transactions', 500);
  }
};
