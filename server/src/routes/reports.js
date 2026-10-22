const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const Case = require('../models/Case');
const { success, error } = require('../utils/response');
const auditLogger = require('../utils/auditLogger');
const { escapeCsvCell } = require('../utils/csv');

router.use(authenticate);

router.get('/transactions', async (req, res) => {
  try {
    const { dateFrom, dateTo, status } = req.query;
    const filter = {};
    if (dateFrom || dateTo) { filter.timestamp = {}; if (dateFrom) filter.timestamp.$gte = new Date(dateFrom); if (dateTo) filter.timestamp.$lte = new Date(dateTo); }
    if (status) filter.status = status;
    const [transactions, nonINRTransactionCount] = await Promise.all([
      Transaction.find(filter).sort({ timestamp: -1 }).limit(5000),
      Transaction.countDocuments({ ...filter, currency: { $ne: 'INR' } }),
    ]);
    const stats = {
      currency: 'INR',
      total: transactions.length,
      approved: transactions.filter(t => t.status === 'approved').length,
      flagged: transactions.filter(t => t.status === 'flagged').length,
      blocked: transactions.filter(t => t.status === 'blocked').length,
      totalAmount: nonINRTransactionCount ? null : transactions.reduce((sum, t) => sum + t.amount, 0),
      currencyMigrationRequired: nonINRTransactionCount > 0,
      nonINRTransactionCount,
    };
    return success(res, { currency: 'INR', transactions, stats }, 'Transaction report retrieved');
  } catch (err) { return error(res, 'Failed to generate report', 500); }
});

router.get('/transactions/export', async (req, res) => {
  try {
    const { dateFrom, dateTo, status, riskLevel } = req.query;
    const filter = {};
    if (dateFrom || dateTo) { filter.timestamp = {}; if (dateFrom) filter.timestamp.$gte = new Date(dateFrom); if (dateTo) filter.timestamp.$lte = new Date(dateTo); }
    if (status) filter.status = status;
    if (riskLevel) filter.riskLevel = riskLevel;
    const transactions = await Transaction.find(filter).sort({ timestamp: -1 }).limit(10000);
    const csvRows = [
      ['Transaction ID', 'Customer ID', 'Amount', 'Currency', 'Channel', 'Status', 'Risk Level', 'Risk Score', 'Timestamp', 'Merchant'].map(escapeCsvCell).join(','),
      ...transactions.map(t => [
        t.transactionId,
        t.customerId,
        t.amount,
        t.currency,
        t.channel,
        t.status,
        t.riskLevel,
        t.riskScore,
        t.timestamp.toISOString(),
        t.merchantId || '',
      ].map(escapeCsvCell).join(','))
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.csv`);
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'REPORT_EXPORTED', entity: 'Transaction', details: { format: 'csv', count: transactions.length }, ipAddress: req.ip });
    return res.send(csvRows.join('\n'));
  } catch (err) { return error(res, 'Failed to export CSV', 500); }
});

router.get('/analytics', async (req, res) => {
  try {
    const [alertStats, caseResolution, totalConfirmed, totalFalsePositive] = await Promise.all([
      Alert.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Case.aggregate([{ $match: { outcome: { $ne: null } } }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
      Case.countDocuments({ outcome: 'confirmed_fraud' }),
      Case.countDocuments({ outcome: 'legitimate' }),
    ]);
    return success(res, { alertStats, caseResolution, summary: { totalConfirmed, totalFalsePositive } }, 'Analytics report retrieved');
  } catch (err) { return error(res, 'Failed to generate analytics report', 500); }
});

module.exports = router;
