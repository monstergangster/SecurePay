const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const RiskAssessment = require('../models/RiskAssessment');
const WebhookEvent = require('../models/WebhookEvent');
const Customer = require('../models/Customer');
const { fullAssessment } = require('../utils/riskEngine');
const { getAdapter } = require('../utils/webhookAdapter');
const { success, error } = require('../utils/response');
const auditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const { formatINR } = require('../utils/currency');

const MIN_SECRET_LENGTH = 32;
const STALE_PROCESSING_TIMEOUT_MS = parseInt(process.env.WEBHOOK_STALE_TIMEOUT_MS, 10) || 5 * 60 * 1000; // 5 minutes default

/**
 * Resolves the webhook signing secret with strict validation.
 * In production/deployed environments, WEBHOOK_SECRET must be explicitly set and >= 32 characters.
 * In development/test/demo environments, WEBHOOK_SECRET or DEV_WEBHOOK_SECRET must be explicitly set and >= 32 characters.
 * No hardcoded implicit fallback keys are permitted.
 * Returns null if secret is unconfigured or fails minimum length requirement.
 */
const getWebhookSecret = () => {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  const isDevOrDemo = env === 'development' || env === 'test' || env === 'demo';

  let candidate = process.env.WEBHOOK_SECRET;
  if (!candidate && isDevOrDemo) {
    candidate = process.env.DEV_WEBHOOK_SECRET;
  }

  if (!candidate || typeof candidate !== 'string') {
    logger.error('Webhook secret configuration error: no explicit signing secret set');
    return null;
  }

  const trimmed = candidate.trim();
  if (trimmed.length < MIN_SECRET_LENGTH) {
    logger.error(`Webhook secret configuration error: signing secret fails minimum length requirement (${trimmed.length} < ${MIN_SECRET_LENGTH})`);
    return null;
  }

  return trimmed;
};

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
          riskScore: transaction.riskScore !== null ? transaction.riskScore : 0,
          riskLevel: transaction.riskLevel || 'unassessed',
        },
        $min: { firstTransactionAt: transaction.timestamp },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    logger.error('Customer stats update error:', err.message);
  }
};

const createAlertForTransaction = async (transaction, assessment) => {
  try {
    const sev = assessment.level === 'unassessed' ? 'high' : assessment.level;
    const deduplicationKey = `${transaction.transactionId}-risk-${sev}`;
    const existing = await Alert.findOne({ deduplicationKey });
    if (existing) return;

    await Alert.create({
      alertId: `ALERT-${uuidv4().substring(0, 8).toUpperCase()}`,
      title: `${sev.toUpperCase()} Risk Alert: ${transaction.transactionId}`,
      description: assessment.success
        ? `Webhook-ingested transaction of ${formatINR(transaction.amount)} flagged by rules engine.`
        : `Assessment error for webhook transaction: ${assessment.error}. Held for review.`,
      severity: sev,
      transactionId: transaction._id,
      triggeredRules: assessment.triggeredRules || [],
      deduplicationKey,
      isDemo: transaction.isDemo,
    });
  } catch (err) {
    logger.error('Alert creation error:', err.message);
  }
};

/**
 * Public Secure Inbound Webhook Endpoint
 * Enforces cryptographic signature verification, replay protection, idempotency,
 * transaction persistence, and risk assessment pipeline execution.
 */
router.post('/receive', apiLimiter, async (req, res) => {
  const providerHeader = req.headers['x-provider'];
  if (!providerHeader || !providerHeader.trim()) {
    return error(res, "Missing required 'X-Provider' header", 400);
  }
  const provider = providerHeader.trim().toLowerCase();

  // 0. Resolve webhook secret with strict validation (no implicit defaults)
  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) {
    logger.error('Webhook rejected: WEBHOOK_SECRET not configured or fails strength requirements');
    return error(res, 'Webhook signing secret not configured or fails strength requirements', 503);
  }

  // 1. Resolve adapter — rejects unknown providers (never silently falls back)
  let adapter;
  try {
    adapter = getAdapter(provider);
  } catch (adapterErr) {
    logger.warn(`Rejected webhook from unknown provider '${provider}': ${adapterErr.message}`);
    return error(res, adapterErr.message, 400);
  }

  // 2. Signature Verification (with mandatory timestamp replay protection)
  const rawBodyString = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  const sigResult = adapter.verifySignature(rawBodyString, req.headers, webhookSecret);

  if (!sigResult.valid) {
    logger.warn(`Rejected unauthorized webhook: ${sigResult.reason} from IP ${req.ip}`);
    return error(res, `Webhook signature verification failed: ${sigResult.reason}`, 401);
  }

  // 3. Event Parsing & Schema Validation
  let parsedEvent;
  try {
    parsedEvent = adapter.parseEvent(req.body);
  } catch (parseErr) {
    logger.warn(`Malformed webhook payload: ${parseErr.message}`);
    return error(res, `Malformed payload: ${parseErr.message}`, 400);
  }

  const { eventId, eventType, transaction: txData } = parsedEvent;

  // 4. Database Idempotency, Concurrency Control & Stale Processing Recovery
  try {
    const existingEvent = await WebhookEvent.findOne({ eventId });
    if (existingEvent) {
      if (existingEvent.status === 'processed') {
        logger.info(`Idempotent webhook deduplication triggered for eventId: ${eventId}`);
        return success(
          res,
          { eventId, status: 'duplicate', message: 'Event already received and processed' },
          'Duplicate event ignored',
          200
        );
      }

      if (existingEvent.status === 'processing') {
        const startedAt = existingEvent.processingStartedAt || existingEvent.updatedAt || existingEvent.createdAt;
        const isStale = (Date.now() - new Date(startedAt).getTime()) > STALE_PROCESSING_TIMEOUT_MS;

        if (!isStale) {
          logger.info(`Event ${eventId} is currently in active processing, rejecting concurrent retry`);
          return res.status(409).json({
            success: false,
            message: 'Event is currently being processed by another worker',
            data: { eventId, status: 'processing' },
          });
        }

        logger.warn(`Stale processing detected for event ${eventId} (started at ${startedAt}). Attempting atomic recovery.`);
      }

      // Safe recovery for failed or stale events using atomic update
      const staleCutoff = new Date(Date.now() - STALE_PROCESSING_TIMEOUT_MS);
      const acquiredLock = await WebhookEvent.findOneAndUpdate(
        {
          eventId,
          $or: [
            { status: 'failed' },
            { status: 'processing', processingStartedAt: { $lte: staleCutoff } },
            { status: 'processing', updatedAt: { $lte: staleCutoff } },
          ],
        },
        {
          $set: {
            status: 'processing',
            processingStartedAt: new Date(),
            errorMessage: null,
            processedAt: null,
          },
          $inc: { recoveryCount: 1 },
        },
        { new: true }
      );

      if (!acquiredLock) {
        logger.info(`Concurrent worker already claimed recovery or processed event ${eventId}`);
        return res.status(409).json({
          success: false,
          message: 'Event is currently being processed by another worker',
          data: { eventId, status: 'processing' },
        });
      }
    } else {
      // Record receipt of new event with atomic insert and race protection
      try {
        await WebhookEvent.create({
          eventId,
          provider: provider || 'simulator',
          eventType,
          status: 'processing',
          transactionId: txData.transactionId,
          ipAddress: req.ip,
          processingStartedAt: new Date(),
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          logger.info(`Concurrent duplicate event race detected for eventId: ${eventId}`);
          return res.status(409).json({
            success: false,
            message: 'Concurrent duplicate event received',
            data: { eventId, status: 'processing' },
          });
        }
        throw createErr;
      }
    }
  } catch (dbErr) {
    logger.error(`Webhook idempotency storage error: ${dbErr.message}`);
    return error(res, 'Internal webhook processing error', 500);
  }

  // 5. Check if transaction already exists (either from this event's prior attempt or duplicate)
  let transaction = await Transaction.findOne({ transactionId: txData.transactionId });
  
  if (transaction && transaction.assessmentStatus === 'completed') {
    // Transaction exists and was already assessed — just update WebhookEvent and return
    await WebhookEvent.findOneAndUpdate({ eventId }, { status: 'processed', processedAt: new Date() });
    return success(
      res,
      { eventId, transactionId: transaction.transactionId, status: 'duplicate_transaction' },
      'Transaction already recorded and assessed',
      200
    );
  }

  // 6. Persist Transaction (if new) or resume assessment (if prior attempt was interrupted)
  try {
    if (!transaction) {
      transaction = await Transaction.create({
        ...txData,
        status: 'pending',
        assessmentStatus: 'pending',
      });
    }

    const assessment = await fullAssessment(transaction);

    if (assessment.success) {
      transaction.riskScore = assessment.score;
      transaction.riskLevel = assessment.level;
      transaction.riskReasons = assessment.triggeredRules;
      transaction.riskAssessedAt = assessment.assessedAt;
      transaction.assessmentStatus = 'completed';
      transaction.mlScore = assessment.mlScore;
      transaction.mlDecision = assessment.mlDecision;
      transaction.mlExplanation = assessment.mlExplanation || [];
      transaction.assessmentSource = assessment.analysisSource || 'rules_engine';
      transaction.status = assessment.score >= 80 ? 'blocked' : assessment.score >= 25 ? 'flagged' : 'approved';
    } else {
      transaction.riskScore = null;
      transaction.riskLevel = 'unassessed';
      transaction.assessmentStatus = 'failed';
      transaction.assessmentError = assessment.error;
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

    if (!assessment.success || assessment.score >= 55) {
      await createAlertForTransaction(transaction, assessment);
    }

    await WebhookEvent.findOneAndUpdate(
      { eventId },
      {
        status: assessment.success ? 'processed' : 'failed',
        errorMessage: assessment.success ? null : assessment.error,
        processedAt: assessment.success ? new Date() : null,
      }
    );

    return success(
      res,
      {
        eventId,
        transactionId: transaction.transactionId,
        currency: 'INR',
        riskScore: transaction.riskScore,
        riskLevel: transaction.riskLevel,
        status: transaction.status,
      },
      assessment.success ? 'Webhook processed and transaction assessed' : 'Transaction held for review due to assessment failure',
      201
    );
  } catch (processErr) {
    logger.error(`Webhook pipeline error: ${processErr.message}`);
    await WebhookEvent.findOneAndUpdate(
      { eventId },
      { status: 'failed', errorMessage: processErr.message }
    ).catch(e => logger.error(`Failed to update event status: ${e.message}`));
    return error(res, 'Failed to process webhook transaction', 500);
  }
});

/**
 * Authenticated Developer Webhook Simulator
 * Dispatches cryptographically signed events against local webhook receiver.
 */
router.post('/simulate', authenticate, authorize('admin', 'analyst'), apiLimiter, async (req, res) => {
  try {
    const webhookSecret = getWebhookSecret();
    if (!webhookSecret) {
      return error(res, 'Webhook signing secret not configured', 503);
    }

    const count = Math.min(parseInt(req.body.count, 10) || 1, 20);
    const results = [];
    const customers = ['CUST-001', 'CUST-002', 'CUST-003', 'CUST-004', 'CUST-005'];
    const channels = ['card', 'bank_transfer', 'upi', 'wallet', 'crypto'];

    for (let i = 0; i < count; i++) {
      const eventId = `EVT-${uuidv4().substring(0, 10).toUpperCase()}`;
      const txId = `TXN-SIM-${uuidv4().substring(0, 8).toUpperCase()}`;
      const amount = Math.round((Math.random() * 12000 + 15) * 100) / 100;
      const customerId = customers[Math.floor(Math.random() * customers.length)];
      const channel = channels[Math.floor(Math.random() * channels.length)];

      const payload = {
        eventId,
        eventType: 'payment.completed',
        data: {
          transactionId: txId,
          customerId,
          amount,
          currency: 'INR',
          channel,
          timestamp: new Date().toISOString(),
          merchantId: `MERCH-${Math.floor(Math.random() * 50) + 1}`,
        },
      };

      // Generate HMAC-SHA256 signature
      const rawString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureHex = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${rawString}`)
        .digest('hex');

      const sigHeader = `t=${timestamp},v1=${signatureHex}`;

      // Execute internal call through standard handler logic
      const adapter = getAdapter('simulator');
      const sigVerify = adapter.verifySignature(rawString, { 'x-securepay-signature': sigHeader }, webhookSecret);

      if (sigVerify.valid) {
        const tx = await Transaction.create({
          ...payload.data,
          status: 'pending',
          assessmentStatus: 'pending',
          ingestionSource: 'webhook',
          isDemo: true,
        });

        const assessment = await fullAssessment(tx);
        if (assessment.success) {
          tx.riskScore = assessment.score;
          tx.riskLevel = assessment.level;
          tx.riskReasons = assessment.triggeredRules;
          tx.riskAssessedAt = assessment.assessedAt;
          tx.assessmentStatus = 'completed';
          tx.status = assessment.score >= 80 ? 'blocked' : assessment.score >= 25 ? 'flagged' : 'approved';
        } else {
          tx.riskScore = null;
          tx.riskLevel = 'unassessed';
          tx.assessmentStatus = 'failed';
          tx.assessmentError = assessment.error;
          tx.status = 'held_for_review';
        }

        await tx.save();

        await RiskAssessment.create({
          transactionId: tx._id,
          score: assessment.score,
          level: assessment.level,
          triggeredRules: assessment.triggeredRules || [],
          ruleVersion: '1.0',
          assessedAt: assessment.assessedAt,
        });

        await updateCustomerStats(tx);

        if (!assessment.success || assessment.score >= 55) {
          await createAlertForTransaction(tx, assessment);
        }

        await WebhookEvent.create({
          eventId,
          provider: 'simulator',
          eventType: 'payment.completed',
          status: 'processed',
          transactionId: tx.transactionId,
          processedAt: new Date(),
        });

        results.push({
          eventId,
          transactionId: tx.transactionId,
          amount,
          riskScore: tx.riskScore,
          riskLevel: tx.riskLevel,
          status: tx.status,
        });
      }
    }

    await auditLogger.log({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'SIMULATE_TRANSACTIONS',
      entity: 'Webhook',
      details: { count: results.length },
      ipAddress: req.ip,
    });

    return success(res, results, `${results.length} webhook events successfully simulated and assessed`, 201);
  } catch (err) {
    logger.error('Webhook simulator error:', err.message);
    return error(res, 'Simulation pipeline execution failed', 500);
  }
});

module.exports = router;
