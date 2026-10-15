const Transaction = require('../models/Transaction');
const logger = require('../config/logger');
const { formatINR } = require('./currency');

/**
 * Computes standard statistical summary (mean, median, std) for numerical arrays.
 */
const computeStats = (values) => {
  if (!values || !values.length) {
    return { mean: 0, median: 0, std: 0, min: 0, max: 0, count: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;

  let median;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
  const std = Math.sqrt(variance);

  return {
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    std: Math.round(std * 100) / 100,
    min: sorted[0],
    max: sorted[count - 1],
    count,
  };
};

/**
 * Extracts customer behavioural baseline and contextual deviation features.
 * Strictly excludes current transaction to prevent data leakage.
 *
 * @param {Object} currentTx - The transaction being evaluated.
 * @param {Object} options - Configuration parameters.
 * @returns {Promise<Object>} Behavioural profile features.
 */
const extractCustomerBehavioralFeatures = async (currentTx, options = {}) => {
  const customerId = currentTx.customerId;
  const txTimestamp = new Date(currentTx.timestamp || Date.now());
  const lookbackDays = options.lookbackDays || 90;
  const burstWindowMinutes = options.burstWindowMinutes || 15;

  const historyStart = new Date(txTimestamp.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const burstStart = new Date(txTimestamp.getTime() - burstWindowMinutes * 60 * 1000);

  // 1. Fetch strictly prior historical transactions
  const query = {
    customerId,
    currency: 'INR',
    timestamp: { $gte: historyStart, $lt: txTimestamp },
  };

  if (currentTx._id) {
    query._id = { $ne: currentTx._id };
  }
  if (currentTx.transactionId) {
    query.transactionId = { $ne: currentTx.transactionId };
  }

  let priorTxs = [];
  try {
    priorTxs = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .select('amount currency channel timestamp status deviceMetadata');
  } catch (err) {
    logger.warn(`Failed to fetch customer history for ${customerId}: ${err.message}`);
    priorTxs = [];
  }

  // 2. Evaluate historical profile
  const historyCount = priorTxs.length;
  const amounts = priorTxs.map((t) => t.amount);
  const stats = computeStats(amounts);

  // 3. Amount deviation analysis (Z-score & ratio)
  let amountZScore = 0;
  let amountToMeanRatio = 1.0;
  let isNewCustomer = historyCount < 3;

  if (!isNewCustomer && stats.mean > 0) {
    amountToMeanRatio = Math.round((currentTx.amount / stats.mean) * 100) / 100;
    const denominator = stats.std > 0 ? stats.std : stats.mean * 0.25;
    amountZScore = Math.round(((currentTx.amount - stats.mean) / denominator) * 100) / 100;
  }

  // 4. Burst velocity in current window
  const burstTxs = priorTxs.filter((t) => new Date(t.timestamp) >= burstStart);
  const burstCount = burstTxs.length;

  // 5. Channel usage deviation
  const priorChannels = new Set(priorTxs.map((t) => t.channel));
  const isUnusualChannel = !isNewCustomer && !priorChannels.has(currentTx.channel);

  // 6. Hour pattern deviation
  const currentHour = txTimestamp.getUTCHours();
  const priorHours = priorTxs.map((t) => new Date(t.timestamp).getUTCHours());
  const hasTransactedInHourRange = priorHours.some((h) => Math.abs(h - currentHour) <= 2);
  const isUnusualHourForCustomer = !isNewCustomer && historyCount >= 5 && !hasTransactedInHourRange;

  // 7. Recent failure rate
  const recentFailures = priorTxs.slice(0, 5).filter((t) => ['declined', 'blocked', 'flagged'].includes(t.status)).length;

  // 8. Device familiarity
  let isNewDevice = null;
  if (currentTx.deviceMetadata?.deviceId) {
    const knownDevices = new Set(
      priorTxs
        .map((t) => t.deviceMetadata?.deviceId)
        .filter(Boolean)
    );
    isNewDevice = !isNewCustomer && !knownDevices.has(currentTx.deviceMetadata.deviceId);
  }

  // 9. Compute composite behavioral risk signals
  const signals = [];
  let behavioralRiskContribution = 0;

  if (isNewCustomer) {
    signals.push({
      signal: 'NEW_CUSTOMER_BASELINE',
      weight: 5,
      description: `Limited historical baseline (${historyCount} prior transactions recorded)`,
    });
    behavioralRiskContribution += 5;
  } else {
    if (amountZScore >= 3.0 || amountToMeanRatio >= 4.0) {
      signals.push({
        signal: 'AMOUNT_SIGNIFICANT_DEVIATION',
        weight: 35,
        description: `Transaction amount ${formatINR(currentTx.amount)} is ${amountToMeanRatio}x historical mean (${formatINR(stats.mean)}) with Z-score of +${amountZScore}`,
      });
      behavioralRiskContribution += 35;
    } else if (amountZScore >= 2.0 || amountToMeanRatio >= 2.5) {
      signals.push({
        signal: 'AMOUNT_MODERATE_DEVIATION',
        weight: 20,
        description: `Transaction amount exceeds typical range (Z-score: +${amountZScore})`,
      });
      behavioralRiskContribution += 20;
    }

    if (burstCount >= 3) {
      signals.push({
        signal: 'BURST_VELOCITY_ANOMALY',
        weight: 30,
        description: `Rapid succession burst: ${burstCount} transactions within ${burstWindowMinutes} minutes`,
      });
      behavioralRiskContribution += 30;
    }

    if (isUnusualChannel) {
      signals.push({
        signal: 'UNUSUAL_CHANNEL_FOR_CUSTOMER',
        weight: 15,
        description: `Channel '${currentTx.channel}' never observed in previous ${historyCount} transactions`,
      });
      behavioralRiskContribution += 15;
    }

    if (isUnusualHourForCustomer) {
      signals.push({
        signal: 'UNUSUAL_TIME_OF_DAY',
        weight: 10,
        description: `Hour ${currentHour}:00 UTC diverges from customer historical schedule`,
      });
      behavioralRiskContribution += 10;
    }

    if (recentFailures >= 2) {
      signals.push({
        signal: 'RECENT_PAYMENT_FRICTION',
        weight: 20,
        description: `${recentFailures} payment failures/flags recorded in prior 5 attempts`,
      });
      behavioralRiskContribution += 20;
    }

    if (isNewDevice === true) {
      signals.push({
        signal: 'UNRECOGNIZED_DEVICE',
        weight: 15,
        description: `Transaction initiated from an unrecognized device hardware identifier`,
      });
      behavioralRiskContribution += 15;
    }
  }

  return {
    customerId,
    currency: 'INR',
    isNewCustomer,
    historyCount,
    meanAmount: stats.mean,
    medianAmount: stats.median,
    stdAmount: stats.std,
    amountZScore,
    amountToMeanRatio,
    burstCount,
    isUnusualChannel,
    isUnusualHourForCustomer,
    recentFailures,
    isNewDevice,
    behavioralRiskContribution: Math.min(100, behavioralRiskContribution),
    signals,
  };
};

module.exports = {
  extractCustomerBehavioralFeatures,
  computeStats,
};
