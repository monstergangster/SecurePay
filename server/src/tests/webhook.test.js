const crypto = require('crypto');
const mongoose = require('mongoose');
const { getAdapter, SecurePayStandardAdapter } = require('../utils/webhookAdapter');
const WebhookEvent = require('../models/WebhookEvent');

describe('Secure Webhook Signature, Idempotency & Stale Recovery Tests', () => {
  const validSecret = 'test_webhook_signing_key_strictly_32_chars_ok';
  const weakSecret = 'too_short_key_123';
  const adapter = getAdapter('simulator');

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/securepay_test';
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      }
    } catch (e) {
      // If MongoDB is offline, DB-dependent integration tests will handle gracefully
    }
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await WebhookEvent.deleteMany({ eventId: /^EVT-UNIT-TEST/ });
        await mongoose.disconnect();
      }
    } catch (e) {}
  });

  describe('Webhook Secret Strength & Replay Protection Policy', () => {
    it('should accept valid HMAC-SHA256 signature with matching timestamp and strong secret', () => {
      const rawPayload = JSON.stringify({
        eventId: 'EVT-TEST-100',
        eventType: 'payment.completed',
        data: {
          transactionId: 'TXN-WB-1',
          customerId: 'CUST-001',
          amount: 250.0,
        },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', validSecret)
        .update(`${timestamp}.${rawPayload}`)
        .digest('hex');

      const headers = {
        'x-securepay-signature': `t=${timestamp},v1=${signature}`,
      };

      const res = adapter.verifySignature(rawPayload, headers, validSecret);
      expect(res.valid).toBe(true);
    });

    it('should reject webhook signing secret that fails strength requirements (< 32 chars)', () => {
      const rawPayload = JSON.stringify({ eventId: 'EVT-TEST-WEAK' });
      const timestamp = Math.floor(Date.now() / 1000);
      const headers = {
        'x-securepay-signature': `t=${timestamp},v1=somehash`,
      };

      const res = adapter.verifySignature(rawPayload, headers, weakSecret);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/insufficient strength|minimum 32 characters/i);
    });

    it('should reject missing secret configuration', () => {
      const rawPayload = JSON.stringify({ eventId: 'EVT-NO-SECRET' });
      const res = adapter.verifySignature(rawPayload, { 'x-securepay-signature': 'sig' }, null);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/unconfigured|insufficient/i);
    });

    it('should reject signatures missing timestamp for replay protection', () => {
      const rawPayload = JSON.stringify({ eventId: 'EVT-NO-TIMESTAMP' });
      const headers = {
        'x-securepay-signature': 'v1=deadbeef1234567890abcdefdeadbeef',
      };

      const res = adapter.verifySignature(rawPayload, headers, validSecret);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/Missing timestamp for replay/i);
    });

    it('should reject invalid or tampered signatures', () => {
      const rawPayload = JSON.stringify({ eventId: 'EVT-TEST-101' });
      const timestamp = Math.floor(Date.now() / 1000);
      const headers = {
        'x-securepay-signature': `t=${timestamp},v1=deadbeef1234567890abcdefdeadbeef`,
      };

      const res = adapter.verifySignature(rawPayload, headers, validSecret);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/mismatch/i);
    });

    it('should reject expired timestamps outside replay attack tolerance window', () => {
      const rawPayload = JSON.stringify({ eventId: 'EVT-TEST-REPLAY' });
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const signature = crypto
        .createHmac('sha256', validSecret)
        .update(`${expiredTimestamp}.${rawPayload}`)
        .digest('hex');

      const headers = {
        'x-securepay-signature': `t=${expiredTimestamp},v1=${signature}`,
      };

      const res = adapter.verifySignature(rawPayload, headers, validSecret);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/expired|tolerance/i);
    });

    it('should reject unknown provider names and never fall back to simulator', () => {
      expect(() => getAdapter('unknown_stripe_fake')).toThrow(/Unknown webhook provider/i);
      expect(() => getAdapter('')).toThrow(/Provider name is required/i);
      expect(() => getAdapter(null)).toThrow(/Provider name is required/i);
    });

    it('should validate required event schema attributes', () => {
      expect(() => adapter.parseEvent(null)).toThrow(/malformed/i);
      expect(() => adapter.parseEvent({ eventType: 'test' })).toThrow(/missing unique eventid/i);
      expect(() => adapter.parseEvent({ eventId: '1', eventType: 'payment.completed', data: { transactionId: 'TX1', customerId: 'C1', amount: -10 } })).toThrow(/positive number/i);
      expect(adapter.parseEvent({
        eventId: 'EVT-INR-VALID',
        eventType: 'payment.completed',
        data: { transactionId: 'TX-INR-1', customerId: 'C1', amount: 500, currency: 'INR' },
      }).transaction.currency).toBe('INR');
      expect(() => adapter.parseEvent({
        eventId: 'EVT-UNSUPPORTED-CURRENCY',
        eventType: 'payment.completed',
        data: { transactionId: 'TX-USD-1', customerId: 'C1', amount: 500, currency: 'USD' },
      })).toThrow(/only INR is supported/i);
      expect(() => adapter.parseEvent({
        eventId: 'EVT-INVALID-PRECISION',
        eventType: 'payment.completed',
        data: { transactionId: 'TX-PRECISION-1', customerId: 'C1', amount: 1.001, currency: 'INR' },
      })).toThrow(/two decimal places/i);
    });
  });

  describe('Stale Processing Event Recovery & Idempotency State Machine', () => {
    it('should atomically recover a stale event stuck in processing state', async () => {
      if (mongoose.connection.readyState !== 1) return; // Skip if Mongo disconnected

      const staleEventId = 'EVT-UNIT-TEST-STALE-001';
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // Seed a stale event left in 'processing' state 10 minutes ago
      await WebhookEvent.deleteOne({ eventId: staleEventId });
      await WebhookEvent.create({
        eventId: staleEventId,
        provider: 'simulator',
        eventType: 'payment.completed',
        status: 'processing',
        transactionId: 'TXN-STALE-1',
        processingStartedAt: tenMinutesAgo,
        updatedAt: tenMinutesAgo,
        createdAt: tenMinutesAgo,
      });

      // Simulate recovery worker attempting atomic recovery with 5 min stale threshold
      const STALE_TIMEOUT_MS = 5 * 60 * 1000;
      const staleCutoff = new Date(Date.now() - STALE_TIMEOUT_MS);

      const recoveredEvent = await WebhookEvent.findOneAndUpdate(
        {
          eventId: staleEventId,
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

      expect(recoveredEvent).toBeDefined();
      expect(recoveredEvent.recoveryCount).toBe(1);
      expect(recoveredEvent.status).toBe('processing');
    });

    it('should reject recovery when another worker is currently in active processing (< timeout)', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const activeEventId = 'EVT-UNIT-TEST-ACTIVE-002';
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

      await WebhookEvent.deleteOne({ eventId: activeEventId });
      await WebhookEvent.create({
        eventId: activeEventId,
        provider: 'simulator',
        eventType: 'payment.completed',
        status: 'processing',
        transactionId: 'TXN-ACTIVE-1',
        processingStartedAt: thirtySecondsAgo,
      });

      const STALE_TIMEOUT_MS = 5 * 60 * 1000;
      const staleCutoff = new Date(Date.now() - STALE_TIMEOUT_MS);

      // Attempting atomic recovery on non-stale active event must fail to acquire lock
      const lockAttempt = await WebhookEvent.findOneAndUpdate(
        {
          eventId: activeEventId,
          $or: [
            { status: 'failed' },
            { status: 'processing', processingStartedAt: { $lte: staleCutoff } },
          ],
        },
        {
          $set: { status: 'processing', processingStartedAt: new Date() },
          $inc: { recoveryCount: 1 },
        },
        { new: true }
      );

      expect(lockAttempt).toBeNull();
    });

    it('should safely retry failed events and clear previous error message', async () => {
      if (mongoose.connection.readyState !== 1) return;

      const failedEventId = 'EVT-UNIT-TEST-FAILED-003';
      await WebhookEvent.deleteOne({ eventId: failedEventId });
      await WebhookEvent.create({
        eventId: failedEventId,
        provider: 'simulator',
        eventType: 'payment.completed',
        status: 'failed',
        errorMessage: 'Network timeout during risk assessment',
      });

      const recovered = await WebhookEvent.findOneAndUpdate(
        {
          eventId: failedEventId,
          $or: [{ status: 'failed' }, { status: 'processing' }],
        },
        {
          $set: {
            status: 'processing',
            processingStartedAt: new Date(),
            errorMessage: null,
          },
          $inc: { recoveryCount: 1 },
        },
        { new: true }
      );

      expect(recovered).toBeDefined();
      expect(recovered.status).toBe('processing');
      expect(recovered.errorMessage).toBeNull();
      expect(recovered.recoveryCount).toBe(1);
    });
  });
});
