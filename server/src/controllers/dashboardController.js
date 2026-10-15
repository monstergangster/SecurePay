const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const Case = require('../models/Case');
const Customer = require('../models/Customer');
const Rule = require('../models/Rule');
const { success, error } = require('../utils/response');

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalTransactions,
      transactionsLast24h,
      transactionsLast7d,
      flaggedTransactions,
      blockedTransactions,
      openAlerts,
      criticalAlerts,
      highAlerts,
      openCases,
      totalCustomers,
      highRiskCustomers,
      activeRules,
      riskDistribution,
      channelDistribution,
      recentHighRisk,
      financialAgg,
      nonINRTransactionCount,
      activeThreatsAlerts,
    ] = await Promise.all([
      Transaction.countDocuments(),
      Transaction.countDocuments({ timestamp: { $gte: last24h } }),
      Transaction.countDocuments({ timestamp: { $gte: last7d } }),
      Transaction.countDocuments({ status: 'flagged' }),
      Transaction.countDocuments({ status: 'blocked' }),
      Alert.countDocuments({ status: 'open' }),
      Alert.countDocuments({ severity: 'critical', status: { $in: ['open', 'in_review'] } }),
      Alert.countDocuments({ severity: 'high', status: { $in: ['open', 'in_review'] } }),
      Case.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      Customer.countDocuments(),
      Customer.countDocuments({ riskLevel: { $in: ['high', 'critical'] } }),
      Rule.countDocuments({ isActive: true }),
      Transaction.aggregate([
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { timestamp: { $gte: last30d } } },
        { $group: { _id: '$channel', count: { $sum: 1 }, totalAmount: { $sum: { $cond: [{ $eq: ['$currency', 'INR'] }, '$amount', 0] } } } },
      ]),
      Transaction.find({ riskLevel: { $in: ['high', 'critical'] } })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('transactionId customerId amount currency riskScore riskLevel status timestamp channel deviceMetadata riskReasons'),
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

    const riskDist = { low: 0, medium: 0, high: 0, critical: 0 };
    riskDistribution.forEach(r => { if (r._id) riskDist[r._id] = r.count; });

    const fin = financialAgg[0] || { totalVolume: 0, moneyAtRisk: 0, moneyProtected: 0, avgRiskScore: 0 };

    // Deterministic system threat level calculation
    const avgScore = Math.round(fin.avgRiskScore || 0);
    let systemThreatLevel = 'LOW';
    if (criticalAlerts >= 3 || avgScore >= 60 || flaggedTransactions >= 15) {
      systemThreatLevel = 'CRITICAL';
    } else if (criticalAlerts >= 1 || avgScore >= 45 || flaggedTransactions >= 8) {
      systemThreatLevel = 'HIGH';
    } else if (highAlerts >= 2 || avgScore >= 25 || flaggedTransactions >= 3) {
      systemThreatLevel = 'MEDIUM';
    }

    return success(res, {
      overview: {
        currency: 'INR',
        totalTransactions,
        transactionsLast24h,
        transactionsLast7d,
        flaggedTransactions,
        blockedTransactions,
        openAlerts,
        criticalAlerts,
        highAlerts,
        openCases,
        totalCustomers,
        highRiskCustomers,
        activeRules,
        totalVolume: nonINRTransactionCount ? null : Math.round(fin.totalVolume || 0),
        moneyAtRisk: nonINRTransactionCount ? null : Math.round(fin.moneyAtRisk || 0),
        moneyProtected: nonINRTransactionCount ? null : Math.round(fin.moneyProtected || 0),
        currencyMigrationRequired: nonINRTransactionCount > 0,
        nonINRTransactionCount,
        avgRiskScore: avgScore,
        systemThreatLevel,
      },
      riskDistribution: riskDist,
      channelDistribution,
      recentHighRisk,
      activeThreats: activeThreatsAlerts,
    }, 'Dashboard stats retrieved');
  } catch (err) { return error(res, 'Failed to retrieve dashboard stats', 500); }
};

exports.getTrends = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [transactionTrends, alertTrends, nonINRTransactionCount] = await Promise.all([
      Transaction.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
            totalAmount: { $sum: { $cond: [{ $eq: ['$currency', 'INR'] }, '$amount', 0] } },
            flaggedCount: { $sum: { $cond: [{ $in: ['$status', ['flagged', 'blocked']] }, 1, 0] } },
            avgRiskScore: { $avg: '$riskScore' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Alert.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.countDocuments({ currency: { $ne: 'INR' } }),
    ]);

    return success(res, {
      currency: 'INR',
      currencyMigrationRequired: nonINRTransactionCount > 0,
      nonINRTransactionCount,
      transactionTrends: nonINRTransactionCount
        ? transactionTrends.map(trend => ({ ...trend, totalAmount: null }))
        : transactionTrends,
      alertTrends,
      period: { days, startDate },
    }, 'Trends retrieved');
  } catch (err) { return error(res, 'Failed to retrieve trends', 500); }
};
