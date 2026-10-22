const axios = require('axios');
const Transaction = require('../models/Transaction');
const Rule = require('../models/Rule');
const logger = require('../config/logger');
const { formatINR, normalizeAmount, normalizeCurrency } = require('./currency');

const RISK_LEVEL_THRESHOLDS = { low: 0, medium: 25, high: 55, critical: 80 };

const getRiskLevel = (score) => {
  if (score === null || score === undefined || isNaN(score)) return 'unassessed';
  if (score >= RISK_LEVEL_THRESHOLDS.critical) return 'critical';
  if (score >= RISK_LEVEL_THRESHOLDS.high) return 'high';
  if (score >= RISK_LEVEL_THRESHOLDS.medium) return 'medium';
  return 'low';
};

/**
 * Evaluates a single rule deterministically against transaction attributes.
 */
const evaluateRule = (rule, transaction) => {
  const params = rule.parameters || {};
  switch (rule.ruleId) {
    case 'RULE_HIGH_AMOUNT': {
      const threshold = params.amountThreshold || rule.threshold || 10000;
      if (transaction.amount >= threshold) {
        return {
          triggered: true,
          score: rule.weight,
          description: `Transaction amount ${formatINR(transaction.amount)} exceeds high-value threshold of ${formatINR(threshold)}`,
        };
      }
      break;
    }
    case 'RULE_SUSPICIOUS_CHANNEL': {
      const flaggedChannels = params.flaggedChannels || ['crypto'];
      if (flaggedChannels.includes(transaction.channel)) {
        return {
          triggered: true,
          score: rule.weight,
          description: `Payment channel '${transaction.channel}' is flagged in monitored channel list`,
        };
      }
      break;
    }
    case 'RULE_ROUND_AMOUNT': {
      const minAmount = params.minAmount || 1000;
      if (transaction.amount >= minAmount && transaction.amount % 1000 === 0) {
        return {
          triggered: true,
          score: rule.weight,
          description: `Round-number transaction of ${formatINR(transaction.amount)} may indicate structuring behavior`,
        };
      }
      break;
    }
    case 'RULE_NIGHT_TRANSACTION': {
      const ts = new Date(transaction.timestamp || Date.now());
      if (isNaN(ts.getTime())) break;
      const hour = ts.getUTCHours();
      const startHour = params.startHour !== undefined ? params.startHour : 1;
      const endHour = params.endHour !== undefined ? params.endHour : 5;
      if (hour >= startHour && hour <= endHour) {
        return {
          triggered: true,
          score: rule.weight,
          description: `Transaction initiated at unusual hour (${hour}:00 UTC window)`,
        };
      }
      break;
    }
    case 'RULE_FOREIGN_CURRENCY': {
      const baseCurrency = (params.baseCurrency || 'INR').toUpperCase();
      const txCurrency = (transaction.currency || '').toUpperCase();
      if (txCurrency && txCurrency !== baseCurrency) {
        return {
          triggered: true,
          score: rule.weight,
          description: `Foreign currency transaction (${txCurrency} vs base ${baseCurrency})`,
        };
      }
      break;
    }
    default:
      break;
  }
  return { triggered: false, score: 0, description: '' };
};

/**
 * Assesses transaction velocity over a configured sliding window.
 */
const assessVelocity = async (transaction, rule) => {
  if (!rule || !rule.isActive) return { triggered: false, score: 0, description: '' };
  const params = rule.parameters || {};
  const windowMinutes = params.windowMinutes || 60;
  const maxCount = params.maxCount || 5;

  const ts = new Date(transaction.timestamp || Date.now());
  if (isNaN(ts.getTime())) {
    throw new Error('Invalid transaction timestamp provided for velocity evaluation');
  }

  const windowStart = new Date(ts.getTime() - windowMinutes * 60 * 1000);
  const count = await Transaction.countDocuments({
    customerId: transaction.customerId,
    _id: { $ne: transaction._id },
    timestamp: { $gte: windowStart, $lt: ts },
  });

  if (count >= maxCount) {
    return {
      triggered: true,
      score: rule.weight,
      description: `Rapid velocity: ${count} transactions recorded in prior ${windowMinutes} minutes (threshold: ${maxCount})`,
    };
  }
  return { triggered: false, score: 0, description: '' };
};

/**
 * Calls FastAPI ML service to analyze transaction features with strict timeout.
 * Returns null if service is unreachable, disabled, or times out.
 */
const callMlService = async (transaction, behavioralProfile, timeoutMs = 2500) => {
  const mlServiceUrl = process.env.ML_SERVICE_URL;
  if (!mlServiceUrl) return null;

  try {
    const payload = {
      transaction_id: transaction.transactionId || String(transaction._id || 'TXN-UNKNOWN'),
      customer_id: transaction.customerId,
      amount: transaction.amount,
      currency: transaction.currency || 'INR',
      channel: transaction.channel || 'other',
      timestamp: (transaction.timestamp ? new Date(transaction.timestamp) : new Date()).toISOString(),
      merchant_id: transaction.merchantId || null,
      recent_transaction_count: behavioralProfile ? behavioralProfile.burstCount || 0 : 0,
      avg_customer_amount: behavioralProfile ? behavioralProfile.meanAmount || null : null,
      customer_amount_std: behavioralProfile ? behavioralProfile.stdAmount || null : null,
      failed_attempts: behavioralProfile ? behavioralProfile.recentFailures || 0 : 0,
    };

    const response = await axios.post(`${mlServiceUrl}/analyze`, payload, {
      timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.data && typeof response.data.ml_score === 'number') {
      return {
        mlScore: Math.round(response.data.ml_score * 10) / 10,
        isAnomaly: Boolean(response.data.is_anomaly),
        modelVersion: response.data.model_version || '1.0.0',
        explanation: Array.isArray(response.data.explanation) ? response.data.explanation : [],
        features: response.data.features || null,
      };
    }
    return null;
  } catch (err) {
    logger.warn(`ML Service invocation note (${mlServiceUrl}/analyze): ${err.message}`);
    return null;
  }
};

/**
 * Hybrid Score Combination Policy:
 * - Rule-based risk score (0-100): Heuristic compliance and transaction policies.
 * - ML Anomaly score (0-100): Statistical isolation forest anomaly ranking.
 *
 * Combination Logic:
 * When both are available:
 *   combinedScore = Math.min(100, Math.round(0.65 * ruleScore + 0.35 * mlScore))
 *   If ml.isAnomaly is true AND combinedScore < 55, elevate to at least 55 (high risk review).
 * When ML is unavailable:
 *   combinedScore = ruleScore (graceful degradation, source labeled 'rules_engine')
 */
const combineScores = (ruleScore, mlResult) => {
  if (!mlResult) {
    return {
      finalScore: ruleScore,
      level: getRiskLevel(ruleScore),
      source: 'rules_engine',
    };
  }

  let combined = Math.round(0.65 * ruleScore + 0.35 * mlResult.mlScore);
  if (mlResult.isAnomaly && combined < 55) {
    combined = 55; // Elevate anomalous transactions to at least high-risk review threshold
  }
  const finalScore = Math.min(100, Math.max(0, combined));

  return {
    finalScore,
    level: getRiskLevel(finalScore),
    source: 'hybrid',
  };
};

/**
 * Comprehensive risk assessment with structured error handling, retry support,
 * ML service integration, and strict refusal to silently mask failures as low risk.
 *
 * @param {Object} transaction - The transaction object to assess.
 * @param {Object} options - Options including retries, behavioral, and ML enablement.
 * @returns {Promise<Object>} Assessment outcome.
 */
const fullAssessment = async (transaction, options = {}) => {
  const maxRetries = options.retries !== undefined ? options.retries : 2;
  const retryDelayMs = options.retryDelayMs || 100;

  if (!transaction || typeof transaction !== 'object') {
    return {
      success: false,
      status: 'failed',
      score: null,
      level: 'unassessed',
      ruleScore: null,
      mlScore: null,
      mlDecision: 'unavailable',
      mlExplanation: [],
      analysisSource: 'unassessed',
      triggeredRules: [],
      error: 'Malformed transaction input provided to risk engine',
      assessedAt: new Date(),
    };
  }

  try {
    normalizeCurrency(transaction.currency);
    normalizeAmount(transaction.amount);
  } catch (currencyError) {
    return {
      success: false,
      status: 'failed',
      score: null,
      level: 'unassessed',
      ruleScore: null,
      mlScore: null,
      mlDecision: 'unavailable',
      mlExplanation: [],
      analysisSource: 'unassessed',
      triggeredRules: [],
      error: currencyError.message,
      assessedAt: new Date(),
    };
  }

  if (typeof transaction.amount !== 'number' || !Number.isFinite(transaction.amount) || transaction.amount <= 0) {
    return {
      success: false,
      status: 'failed',
      score: null,
      level: 'unassessed',
      ruleScore: null,
      mlScore: null,
      mlDecision: 'unavailable',
      mlExplanation: [],
      analysisSource: 'unassessed',
      triggeredRules: [],
      error: 'Transaction amount must be a strictly positive number',
      assessedAt: new Date(),
    };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const activeRules = await Rule.find({ isActive: true });
      const velocityRule = activeRules.find((r) => r.ruleId === 'RULE_VELOCITY_RAPID');
      const otherRules = activeRules.filter((r) => r.ruleId !== 'RULE_VELOCITY_RAPID');

      const triggeredRules = [];
      let totalRuleScore = 0;

      for (const rule of otherRules) {
        const result = evaluateRule(rule, transaction);
        if (result.triggered) {
          triggeredRules.push({ rule: rule.ruleId, score: rule.weight, description: result.description });
          totalRuleScore += rule.weight;
        }
      }

      if (velocityRule) {
        const velocityResult = await assessVelocity(transaction, velocityRule);
        if (velocityResult.triggered) {
          triggeredRules.push({
            rule: 'RULE_VELOCITY_RAPID',
            score: velocityResult.score,
            description: velocityResult.description,
          });
          totalRuleScore += velocityResult.score;
        }
      }

      // Incorporate customer-level behavioral context when enabled
      let behavioralProfile = null;
      if (options.enableBehavioral !== false) {
        const { extractCustomerBehavioralFeatures } = require('./behavioralAnalytics');
        behavioralProfile = await extractCustomerBehavioralFeatures(transaction);
        if (behavioralProfile && behavioralProfile.signals) {
          for (const sig of behavioralProfile.signals) {
            triggeredRules.push({
              rule: sig.signal,
              score: sig.weight,
              description: sig.description,
            });
            totalRuleScore += sig.weight;
          }
        }
      }

      const ruleScore = Math.min(100, Math.max(0, Math.round(totalRuleScore)));

      // Asynchronously update rule trigger counters without throwing
      for (const triggered of triggeredRules) {
        Rule.findOneAndUpdate(
          { ruleId: triggered.rule },
          { $inc: { triggerCount: 1 }, $set: { lastTriggeredAt: new Date() } }
        ).catch((err) => logger.warn(`Failed to update rule trigger counter for ${triggered.rule}: ${err.message}`));
      }

      // Configurable ML Availability Policy Evaluation
      const mlPolicy = (options.mlPolicy || process.env.ML_AVAILABILITY_POLICY || process.env.ML_POLICY || 'optional').toLowerCase().trim();
      let mlResult = null;
      let mlPolicyReason = null;

      if (mlPolicy === 'rules_only' || options.enableMl === false) {
        // Explicit rules-only mode: record reason and bypass ML
        mlPolicyReason = 'ML inference bypassed: rules_only policy active';
      } else {
        const timeoutMs = options.mlTimeoutMs || 2500;
        mlResult = await callMlService(transaction, behavioralProfile, timeoutMs);

        if (mlPolicy === 'mandatory' && !mlResult) {
          // Mandatory-ML mode: holding transaction for review when ML inference fails
          logger.warn(`Mandatory ML policy violation: ML inference unavailable for ${transaction.transactionId || 'transaction'}. Holding for review.`);
          return {
            success: false,
            status: 'failed',
            score: null,
            level: 'unassessed',
            ruleScore,
            mlScore: null,
            mlDecision: 'unavailable',
            mlExplanation: [],
            modelVersion: null,
            mlFeatures: null,
            analysisSource: 'unassessed',
            mlPolicy: 'mandatory',
            mlPolicyReason: 'ML service mandatory but unavailable - transaction held for review',
            triggeredRules,
            ruleVersion: '1.0',
            attempts: attempt,
            error: 'ML service mandatory but unavailable - transaction held for review',
            assessedAt: new Date(),
          };
        }

        if (mlResult) {
          mlPolicyReason = 'Hybrid scoring applied: rules engine combined with Isolation Forest ML inference';
        } else {
          mlPolicyReason = 'ML service unavailable: fallback to heuristic rules engine';
        }
      }

      // Combine Rule and ML scores with documented policy
      const combination = combineScores(ruleScore, mlResult);

      return {
        success: true,
        status: 'completed',
        score: combination.finalScore,
        level: combination.level,
        ruleScore,
        mlScore: mlResult ? mlResult.mlScore : null,
        mlDecision: mlResult ? (mlResult.isAnomaly ? 'anomalous' : 'normal') : (mlPolicy === 'rules_only' ? 'disabled_by_policy' : 'unavailable'),
        mlExplanation: mlResult ? mlResult.explanation : [],
        modelVersion: mlResult ? mlResult.modelVersion : null,
        mlFeatures: mlResult ? mlResult.features : null,
        analysisSource: combination.source,
        mlPolicy,
        mlPolicyReason,
        triggeredRules,
        ruleVersion: '1.0',
        attempts: attempt,
        assessedAt: new Date(),
      };
    } catch (err) {
      lastError = err;
      logger.warn(`Risk assessment transient attempt ${attempt} failed: ${err.message}`);
      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  // Under NO circumstances return score: 0 or level: 'low' on catastrophic failure
  logger.error(`Critical: Risk assessment completely failed after ${maxRetries + 1} attempts: ${lastError?.message}`);

  return {
    success: false,
    status: 'failed',
    score: null,
    level: 'unassessed',
    ruleScore: null,
    mlScore: null,
    mlDecision: 'unavailable',
    mlExplanation: [],
    analysisSource: 'unassessed',
    triggeredRules: [],
    ruleVersion: '1.0',
    attempts: maxRetries + 1,
    error: 'Risk assessment service temporarily unavailable or experienced internal error',
    rawError: process.env.NODE_ENV !== 'production' ? lastError?.message : undefined,
    assessedAt: new Date(),
  };
};

const ML_POLICIES = {
  RULES_ONLY: 'rules_only',
  OPTIONAL: 'optional',
  MANDATORY: 'mandatory',
};

module.exports = {
  fullAssessment,
  getRiskLevel,
  evaluateRule,
  assessVelocity,
  callMlService,
  combineScores,
  RISK_LEVEL_THRESHOLDS,
  ML_POLICIES,
};
