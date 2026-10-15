const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const Case = require('../models/Case');
const Rule = require('../models/Rule');
const { success, error } = require('../utils/response');

router.use(authenticate);

router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalTx,
      flaggedTx,
      blockedTx,
      approvedTx,
      heldReviewTx,
      unassessedTx,
      openAlerts,
      criticalAlerts,
      openCases,
      resolvedCases,
      financialAgg,
      nonINRTransactionCount,
      activeThreats,
    ] = await Promise.all([
      Transaction.countDocuments(),
      Transaction.countDocuments({ status: 'flagged' }),
      Transaction.countDocuments({ status: 'blocked' }),
      Transaction.countDocuments({ status: 'approved' }),
      Transaction.countDocuments({ status: 'held_for_review' }),
      Transaction.countDocuments({ assessmentStatus: { $in: ['failed', 'pending'] } }),
      Alert.countDocuments({ status: 'open' }),
      Alert.countDocuments({ status: 'open', severity: 'critical' }),
      Case.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      Case.countDocuments({ status: 'resolved' }),
      Transaction.aggregate([
        {
          $group: {
            _id: null,
            totalVolume: { $sum: { $cond: [{ $eq: ['$currency', 'INR'] }, '$amount', 0] } },
            moneyAtRisk: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$currency', 'INR'] }, { $or: [{ $eq: ['$status', 'flagged'] }, { $in: ['$riskLevel', ['high', 'critical']] }] }] },
                  '$amount',
                  0,
                ],
              },
            },
            moneyProtected: {
              $sum: {
                $cond: [{ $and: [{ $eq: ['$currency', 'INR'] }, { $eq: ['$status', 'blocked'] }] }, '$amount', 0],
              },
            },
            avgRiskScore: {
              $avg: {
                $cond: [{ $ne: ['$riskScore', null] }, '$riskScore', null],
              },
            },
          },
        },
      ]),
      Transaction.countDocuments({ currency: { $ne: 'INR' } }),
      Alert.find({ status: { $in: ['open', 'in_review'] } })
        .sort({ severity: 1, createdAt: -1 })
        .limit(6)
        .populate('transactionId')
        .populate('assignedTo', 'name email'),
    ]);

    const fin = financialAgg?.[0] || { totalVolume: 0, moneyAtRisk: 0, moneyProtected: 0, avgRiskScore: 0 };
    const avgScore = Math.round(fin.avgRiskScore || 0);

    let systemThreatLevel = 'LOW';
    if (criticalAlerts >= 3 || avgScore >= 60 || flaggedTx >= 15) {
      systemThreatLevel = 'CRITICAL';
    } else if (criticalAlerts >= 1 || avgScore >= 45 || flaggedTx >= 8) {
      systemThreatLevel = 'HIGH';
    } else if (openAlerts >= 3 || avgScore >= 25 || flaggedTx >= 3) {
      systemThreatLevel = 'MEDIUM';
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    let volumeData = await Transaction.aggregate([
      { $match: { timestamp: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
          amount: { $sum: { $cond: [{ $eq: ['$currency', 'INR'] }, '$amount', 0] } },
          flagged: {
            $sum: {
              $cond: [{ $in: ['$status', ['flagged', 'blocked', 'held_for_review']] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    if (nonINRTransactionCount) {
      volumeData = volumeData.map(day => ({ ...day, amount: null }));
    }

    const riskDistribution = await Transaction.aggregate([
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
    ]);

    const alertStatusBreakdown = await Alert.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const recentAlerts = await Alert.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('transactionId', 'transactionId amount currency');

    const recentHighRiskTx = await Transaction.find({
      $or: [
        { riskLevel: { $in: ['high', 'critical'] } },
        { status: 'held_for_review' },
        { assessmentStatus: 'failed' },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(6);

    return success(
      res,
      {
        summary: {
          currency: 'INR',
          totalTx,
          flaggedTx,
          blockedTx,
          approvedTx,
          heldReviewTx,
          unassessedTx,
          openAlerts,
          criticalAlerts,
          openCases,
          resolvedCases,
          totalVolume: nonINRTransactionCount ? null : Math.round(fin.totalVolume || 0),
          moneyAtRisk: nonINRTransactionCount ? null : Math.round(fin.moneyAtRisk || 0),
          moneyProtected: nonINRTransactionCount ? null : Math.round(fin.moneyProtected || 0),
          currencyMigrationRequired: nonINRTransactionCount > 0,
          nonINRTransactionCount,
          avgRiskScore: avgScore,
          systemThreatLevel,
        },
        currency: 'INR',
        volumeData,
        riskDistribution,
        alertStatusBreakdown,
        recentAlerts,
        recentHighRiskTx,
        activeThreats,
      },
      'Dashboard stats retrieved'
    );
  } catch (err) {
    return error(res, 'Failed to retrieve dashboard stats', 500);
  }
});

router.get('/risk', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [riskTrend, channelRisk, topRulesTriggered] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
            riskScore: { $ne: null },
            assessmentStatus: 'completed',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            avgRisk: { $avg: '$riskScore' },
            highRiskCount: {
              $sum: { $cond: [{ $in: ['$riskLevel', ['high', 'critical']] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: '$channel',
            count: { $sum: 1 },
            avgRisk: {
              $avg: { $cond: [{ $eq: ['$assessmentStatus', 'completed'] }, '$riskScore', null] },
            },
            flagged: {
              $sum: { $cond: [{ $in: ['$status', ['flagged', 'blocked', 'held_for_review']] }, 1, 0] },
            },
          },
        },
      ]),
      Rule.find().sort({ triggerCount: -1 }).limit(10).select('name ruleId triggerCount category'),
    ]);

    return success(res, { currency: 'INR', riskTrend, channelRisk, topRulesTriggered }, 'Risk analytics retrieved');
  } catch (err) {
    return error(res, 'Failed to retrieve risk analytics', 500);
  }
});

router.get('/cases', async (req, res) => {
  try {
    const [casesByStatus, casesByOutcome, casesByPriority] = await Promise.all([
      Case.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Case.aggregate([{ $match: { outcome: { $ne: null } } }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    ]);
    return success(res, { casesByStatus, casesByOutcome, casesByPriority }, 'Case stats retrieved');
  } catch (err) {
    return error(res, 'Failed to retrieve case stats', 500);
  }
});

module.exports = router;
