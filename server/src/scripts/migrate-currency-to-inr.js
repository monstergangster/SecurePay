require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const Rule = require('../models/Rule');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/securepay';
const applyChanges = process.argv.includes('--apply');
const ratesArgIndex = process.argv.indexOf('--rates');

const loadRates = () => {
  if (ratesArgIndex === -1 || !process.argv[ratesArgIndex + 1]) return {};
  const rates = JSON.parse(fs.readFileSync(process.argv[ratesArgIndex + 1], 'utf8'));
  if (!rates || typeof rates !== 'object' || Array.isArray(rates)) {
    throw new Error('The rates file must contain an object of currency codes to INR rates.');
  }
  return Object.fromEntries(Object.entries(rates).map(([code, rate]) => [code.toUpperCase(), Number(rate)]));
};

const convertToINR = (amount, rate) => Math.round((amount * rate + Number.EPSILON) * 100) / 100;

const run = async () => {
  const rates = loadRates();
  await mongoose.connect(MONGODB_URI);

  const historicalTransactions = await Transaction.find({ currency: { $ne: 'INR' } })
    .select('_id transactionId customerId amount currency')
    .lean();

  if (!historicalTransactions.length) {
    console.log('No non-INR transaction records found. No changes made.');
    return;
  }

  const unsupportedRecords = historicalTransactions.filter((tx) => !tx.currency);
  if (unsupportedRecords.length) {
    throw new Error(
      `${unsupportedRecords.length} transaction(s) have no recorded currency. Their amounts cannot be safely converted; resolve these records manually.`
    );
  }

  const missingRates = [...new Set(historicalTransactions
    .map((tx) => tx.currency.toUpperCase())
    .filter((currency) => !Number.isFinite(rates[currency]) || rates[currency] <= 0))];
  const invalidAmounts = historicalTransactions.filter((tx) => !Number.isFinite(tx.amount) || tx.amount <= 0);

  console.log(`Found ${historicalTransactions.length} non-INR transaction(s):`);
  for (const tx of historicalTransactions) {
    const currency = tx.currency.toUpperCase();
    const rate = rates[currency];
    const convertedAmount = Number.isFinite(rate) && rate > 0 ? convertToINR(tx.amount, rate) : 'rate required';
    console.log(`${tx.transactionId} | ${currency} ${tx.amount} -> INR ${convertedAmount}`);
  }

  if (invalidAmounts.length) {
    throw new Error(`${invalidAmounts.length} historical transaction(s) have invalid amounts. Resolve them before migration.`);
  }
  if (missingRates.length) {
    throw new Error(`Explicit INR conversion rates are required for: ${missingRates.join(', ')}. No records were changed.`);
  }
  if (!applyChanges) {
    console.log('Dry run only. Review the rates and amounts, back up MongoDB, then rerun with --apply.');
    return;
  }

  const convertedAt = new Date();
  for (const tx of historicalTransactions) {
    const originalCurrency = tx.currency.toUpperCase();
    const rateToINR = rates[originalCurrency];
    const convertedAmount = convertToINR(tx.amount, rateToINR);
    const result = await Transaction.updateOne(
      { _id: tx._id, currency: tx.currency },
      {
        $set: {
          amount: convertedAmount,
          currency: 'INR',
          currencyConversion: {
            fromCurrency: originalCurrency,
            originalAmount: tx.amount,
            rateToINR,
            convertedAt,
          },
        },
      }
    );
    if (result.modifiedCount !== 1) {
      throw new Error(`Transaction ${tx.transactionId} changed during conversion; stop and review the migration state.`);
    }
    await AuditLog.create({
      actorRole: 'system',
      action: 'TRANSACTION_CURRENCY_CONVERTED',
      entity: 'Transaction',
      entityId: String(tx._id),
      details: {
        transactionId: tx.transactionId,
        customerId: tx.customerId,
        originalCurrency,
        originalAmount: tx.amount,
        rateToINR,
        convertedAmount,
        convertedAt,
      },
    });
  }

  const customerTotals = await Transaction.aggregate([
    { $group: { _id: '$customerId', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  for (const item of customerTotals) {
    await Customer.updateOne(
      { customerId: item._id },
      {
        $set: {
          currency: 'INR',
          totalTransactionAmount: item.totalAmount,
          avgTransactionAmount: item.count ? item.totalAmount / item.count : 0,
        },
      }
    );
  }

  await Rule.findOneAndUpdate(
    { ruleId: 'RULE_HIGH_AMOUNT' },
    { $set: { threshold: 10000, thresholdUnit: 'INR', 'parameters.amountThreshold': 10000 } }
  );
  await Rule.findOneAndUpdate(
    { ruleId: 'RULE_FOREIGN_CURRENCY' },
    {
      $set: {
        name: 'INR Currency Guard',
        description: 'Flags transactions not denominated in INR.',
        'parameters.baseCurrency': 'INR',
      },
    }
  );

  console.log(`Converted ${historicalTransactions.length} transaction(s) and recomputed customer monetary totals.`);
  console.log('Transaction IDs, relationships, risk assessments, and prior audit history were preserved.');
  console.log('Reassess legacy risk outcomes against INR thresholds before operational use.');
};

run()
  .catch((err) => {
    console.error(`Currency migration failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
