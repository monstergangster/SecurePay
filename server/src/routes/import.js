const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const Alert = require('../models/Alert');
const RiskAssessment = require('../models/RiskAssessment');
const { fullAssessment } = require('../utils/riskEngine');
const { authenticate, authorize } = require('../middleware/auth');
const { importLimiter } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');
const auditLogger = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { formatINR, normalizeAmount, normalizeCurrency } = require('../utils/currency');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const parseCSV = (buffer) => new Promise((resolve, reject) => {
  parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: true,
  }, (err, records) => {
    if (err) return reject(err);
    resolve(records);
  });
});

const normalizeRow = (row, batchId) => ({
  transactionId: row.transactionId || row.transaction_id || row.id || `TXN-${uuidv4().substring(0, 8).toUpperCase()}`,
  customerId: String(row.customerId || row.customer_id || row.customerid || ''),
  amount: normalizeAmount(row.amount),
  currency: normalizeCurrency(row.currency),
  timestamp: row.timestamp || row.date || row.created_at ? new Date(row.timestamp || row.date || row.created_at) : new Date(),
  channel: ['card', 'bank_transfer', 'upi', 'wallet', 'crypto', 'other'].includes(row.channel) ? row.channel : 'other',
  merchantId: row.merchantId || row.merchant_id || undefined,
  merchantCategory: row.merchantCategory || row.merchant_category || undefined,
  ingestionSource: 'csv_import',
  importBatch: batchId,
  isDemo: false,
});

router.use(authenticate);

router.post('/csv', importLimiter, authorize('admin', 'analyst'), upload.single('file'), async (req, res) => {
  if (!req.file) return error(res, 'CSV file required', 400);
  const batchId = `BATCH-${uuidv4().substring(0, 8).toUpperCase()}`;
  let records;
  try {
    records = await parseCSV(req.file.buffer);
  } catch (parseErr) {
    return error(res, `CSV parse error: ${parseErr.message}`, 400);
  }

  if (!records.length) return error(res, 'CSV file is empty', 400);
  if (records.length > 5000) return error(res, 'Maximum 5000 rows per import', 400);

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const row of records) {
    try {
      const txData = normalizeRow(row, batchId);
      if (!txData.customerId) { results.errors.push({ row: txData.transactionId, reason: 'Missing customerId' }); results.skipped++; continue; }
      const existing = await Transaction.findOne({ transactionId: txData.transactionId });
      if (existing) { results.skipped++; continue; }

      const transaction = await Transaction.create(txData);
      const assessment = await fullAssessment(transaction);
      transaction.riskScore = assessment.score;
      transaction.riskLevel = assessment.level;
      transaction.riskReasons = assessment.triggeredRules;
      transaction.riskAssessedAt = assessment.assessedAt;
      transaction.status = assessment.score >= 80 ? 'blocked' : assessment.score >= 25 ? 'flagged' : 'approved';
      await transaction.save();

      await RiskAssessment.create({ transactionId: transaction._id, score: assessment.score, level: assessment.level, triggeredRules: assessment.triggeredRules, ruleVersion: assessment.ruleVersion, assessedAt: assessment.assessedAt });

      await Customer.findOneAndUpdate(
        { customerId: transaction.customerId },
        {
          $inc: { transactionCount: 1, totalTransactionAmount: transaction.amount, flaggedTransactionCount: ['flagged', 'blocked'].includes(transaction.status) ? 1 : 0 },
          $set: { currency: 'INR', lastTransactionAt: transaction.timestamp, riskScore: transaction.riskScore, riskLevel: transaction.riskLevel },
          $min: { firstTransactionAt: transaction.timestamp },
        },
        { upsert: true }
      );

      if (assessment.score >= 55) {
        const deduplicationKey = `${transaction.transactionId}-risk-${assessment.level}`;
        const existingAlert = await Alert.findOne({ deduplicationKey });
        if (!existingAlert) {
          await Alert.create({
            alertId: `ALERT-${uuidv4().substring(0, 8).toUpperCase()}`,
            title: `${assessment.level.toUpperCase()} Risk Transaction: ${transaction.transactionId}`,
            description: `CSV import: Transaction of ${formatINR(transaction.amount)} by ${transaction.customerId}`,
            severity: assessment.level,
            transactionId: transaction._id,
            triggeredRules: assessment.triggeredRules,
            deduplicationKey,
          });
        }
      }

      results.imported++;
    } catch (rowErr) {
      logger.error('Row import error:', rowErr.message);
      results.errors.push({ row: row.transactionId || 'unknown', reason: rowErr.message });
      results.skipped++;
    }
  }

  await auditLogger.log({
    actor: req.user._id, actorRole: req.user.role, action: 'CSV_IMPORT', entity: 'Transaction',
    details: { batchId, total: records.length, imported: results.imported, skipped: results.skipped },
    ipAddress: req.ip,
  });

  return success(res, { batchId, total: records.length, ...results }, `Import complete: ${results.imported} imported, ${results.skipped} skipped`);
});

module.exports = router;
