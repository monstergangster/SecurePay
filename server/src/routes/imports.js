const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { importLimiter } = require('../middleware/rateLimiter');
const { parse } = require('csv-parse/sync');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const Alert = require('../models/Alert');
const RiskAssessment = require('../models/RiskAssessment');
const { fullAssessment } = require('../utils/riskEngine');
const { success, error } = require('../utils/response');
const auditLogger = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { formatINR, normalizeAmount, normalizeCurrency } = require('../utils/currency');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const REQUIRED_FIELDS = ['transactionId', 'customerId', 'amount', 'currency', 'timestamp'];
const VALID_CHANNELS = ['card', 'bank_transfer', 'upi', 'wallet', 'crypto', 'other'];
const MAX_ROWS = 5000;

router.use(authenticate);

router.post('/csv', authorize('admin', 'analyst'), importLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return error(res, 'No file uploaded', 400);
  if (req.file.size > 10 * 1024 * 1024) return error(res, 'File size exceeds 10MB limit', 400);
  const batchId = uuidv4();
  const summary = { total: 0, accepted: 0, rejected: 0, duplicates: 0, invalid: 0, errors: [] };
  try {
    let records;
    try {
      records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (parseErr) {
      return error(res, `CSV parse error: ${parseErr.message}`, 400);
    }
    if (!records.length) return error(res, 'CSV file is empty', 400);
    if (records.length > MAX_ROWS) return error(res, `CSV exceeds ${MAX_ROWS} row limit`, 400);
    summary.total = records.length;

    const headers = Object.keys(records[0]);
    const missingFields = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
    if (missingFields.length) return error(res, `Missing required columns: ${missingFields.join(', ')}`, 400);

    const toInsert = [];
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;
      const rowErrors = [];
      for (const field of REQUIRED_FIELDS) {
        if (!row[field] || !String(row[field]).trim()) rowErrors.push(`Missing field: ${field}`);
      }
      let amount;
      try {
        amount = normalizeAmount(row.amount);
      } catch (amountErr) {
        rowErrors.push(amountErr.message);
      }
      const timestamp = new Date(row.timestamp);
      if (isNaN(timestamp.getTime())) rowErrors.push('Invalid timestamp');
      let currency;
      try {
        currency = normalizeCurrency(row.currency);
      } catch (currencyErr) {
        rowErrors.push(currencyErr.message);
      }
      if (row.channel && !VALID_CHANNELS.includes(row.channel)) rowErrors.push(`Invalid channel: ${row.channel}`);

      if (rowErrors.length) {
        summary.invalid++;
        summary.rejected++;
        summary.errors.push({ row: rowNum, transactionId: row.transactionId, errors: rowErrors });
        continue;
      }

      const exists = await Transaction.findOne({ transactionId: String(row.transactionId).trim() });
      if (exists) {
        summary.duplicates++;
        summary.rejected++;
        summary.errors.push({ row: rowNum, transactionId: row.transactionId, errors: ['Duplicate transaction ID'] });
        continue;
      }

      toInsert.push({
        sourceRow: rowNum,
        transactionId: String(row.transactionId).trim(),
        externalRef: row.externalRef || undefined,
        customerId: String(row.customerId).trim(),
        amount,
        currency,
        timestamp,
        channel: row.channel || 'other',
        merchantId: row.merchantId || undefined,
        merchantCategory: row.merchantCategory || undefined,
        status: 'pending',
        assessmentStatus: 'pending',
        ingestionSource: 'csv_import',
        importBatch: batchId,
      });
    }

    for (const txData of toInsert) {
      const { sourceRow, ...transactionData } = txData;
      let tx;
      let assessmentSaved = false;
      try {
        tx = await Transaction.create(transactionData);
        const assessment = await fullAssessment(tx);

        if (assessment.success) {
          tx.riskScore = assessment.score;
          tx.riskLevel = assessment.level;
          tx.riskReasons = assessment.triggeredRules;
          tx.riskAssessedAt = assessment.assessedAt;
          tx.assessmentStatus = 'completed';
          tx.mlScore = assessment.mlScore;
          tx.mlDecision = assessment.mlDecision;
          tx.mlExplanation = assessment.mlExplanation || [];
          tx.assessmentSource = assessment.analysisSource || 'rules_engine';
          tx.status = assessment.score >= 80 ? 'blocked' : assessment.score >= 25 ? 'flagged' : 'approved';
        } else {
          tx.riskScore = null;
          tx.riskLevel = 'unassessed';
          tx.assessmentStatus = 'failed';
          tx.assessmentError = assessment.error;
          tx.mlScore = null;
          tx.mlDecision = 'unavailable';
          tx.mlExplanation = [];
          tx.assessmentSource = 'unassessed';
          tx.status = 'held_for_review';
        }

        await tx.save();

        await RiskAssessment.create({
          transactionId: tx._id,
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
        assessmentSaved = true;

        const suspicious = ['flagged', 'blocked', 'held_for_review'].includes(tx.status);
        await Customer.findOneAndUpdate(
          { customerId: tx.customerId },
          {
            $inc: {
              transactionCount: 1,
              totalTransactionAmount: tx.amount,
              flaggedTransactionCount: suspicious ? 1 : 0,
            },
            $set: {
              currency: 'INR',
              lastTransactionAt: tx.timestamp,
              riskScore: tx.riskScore,
              riskLevel: tx.riskLevel || 'unassessed',
            },
            $min: { firstTransactionAt: tx.timestamp },
          },
          { upsert: true }
        );

        // Trigger deduplicated alert if high risk or failure
        if (!assessment.success || assessment.score >= 55) {
          const sev = assessment.level === 'unassessed' ? 'high' : assessment.level;
          const deduplicationKey = `${tx.transactionId}-risk-${sev}`;
          const existingAlert = await Alert.findOne({ deduplicationKey });
          if (!existingAlert) {
            await Alert.create({
              alertId: `ALERT-${uuidv4().substring(0, 8).toUpperCase()}`,
              title: `${sev.toUpperCase()} Risk Alert: ${tx.transactionId}`,
              description: assessment.success
                ? `Imported transaction of ${formatINR(tx.amount)} flagged by detection rules.`
                : `Assessment failed for imported transaction: ${assessment.error}. Held for review.`,
              severity: sev,
              transactionId: tx._id,
              triggeredRules: assessment.triggeredRules || [],
              deduplicationKey,
            });
          }
        }

        summary.accepted++;
      } catch (e) {
        if (e.code === 11000 && !tx) {
          summary.duplicates++;
          summary.rejected++;
          summary.errors.push({ row: sourceRow, transactionId: txData.transactionId, errors: ['Duplicate transaction ID'] });
        } else {
          logger.error('Import row processing failed', { transactionId: txData.transactionId, error: e.message });
          if (tx) {
            if (!assessmentSaved) {
              tx.riskScore = null;
              tx.riskLevel = 'unassessed';
              tx.assessmentStatus = 'failed';
              tx.assessmentError = 'Transaction assessment or persistence failed';
              tx.status = 'held_for_review';
              await tx.save().catch((saveErr) => {
                logger.error('Unable to mark imported transaction for review', { transactionId: txData.transactionId, error: saveErr.message });
              });
            }
            summary.accepted++;
            summary.errors.push({
              row: sourceRow,
              transactionId: txData.transactionId,
              errors: ['Transaction was stored, but a follow-up processing step failed. Review it before operational use.'],
            });
          } else {
            summary.invalid++;
            summary.rejected++;
            summary.errors.push({ row: sourceRow, transactionId: txData.transactionId, errors: ['Transaction could not be stored.'] });
          }
        }
      }
    }

    await auditLogger.log({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'TRANSACTION_IMPORT',
      entity: 'Transaction',
      details: { batchId, summary },
      ipAddress: req.ip,
    });

    return success(res, { batchId, summary }, 'Import completed');
  } catch (err) {
    logger.error('Import error:', err.message);
    return error(res, 'Import failed', 500);
  }
});

module.exports = router;
