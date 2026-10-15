const crypto = require('crypto');
const logger = require('../config/logger');
const { normalizeAmount, normalizeCurrency } = require('./currency');

/**
 * Provider adapter interface for webhook payload parsing and signature validation.
 */
class ProviderAdapter {
  constructor(name) {
    this.name = name;
  }

  verifySignature(rawBody, headers, secret) {
    throw new Error('verifySignature must be implemented by adapter subclass');
  }

  parseEvent(body) {
    throw new Error('parseEvent must be implemented by adapter subclass');
  }
}

/**
 * SecurePay Simulator / Standard HMAC-SHA256 Adapter.
 * Header format: X-SecurePay-Signature = "t={timestamp},v1={hex_hash}"
 */
class SecurePayStandardAdapter extends ProviderAdapter {
  constructor() {
    super('securepay_standard');
  }

  verifySignature(rawBody, headers, secret) {
    if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
      logger.error('Webhook signing secret not configured or fails strength requirements (minimum 32 characters)');
      return { valid: false, reason: 'Webhook signing secret not configured or insufficient strength (minimum 32 characters)' };
    }

    const sigHeader = headers['x-securepay-signature'] || headers['x-signature'];
    if (!sigHeader) {
      return { valid: false, reason: 'Missing signature header' };
    }

    // Support standard header format "t=123,v1=abc"
    let timestamp = null;
    let signatureHex = sigHeader;

    if (sigHeader.includes('v1=')) {
      const parts = sigHeader.split(',');
      for (const part of parts) {
        const [k, v] = part.trim().split('=');
        if (k === 't') timestamp = v;
        if (k === 'v1') signatureHex = v;
      }
    }

    // Enforce mandatory timestamp for replay attack protection
    if (!timestamp) {
      return { valid: false, reason: 'Missing timestamp for replay attack protection' };
    }

    const tsNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(tsNum) || Math.abs(now - tsNum) > 300) {
      return { valid: false, reason: 'Webhook timestamp expired or outside replay tolerance window (300s)' };
    }

    const payloadToSign = timestamp ? `${timestamp}.${rawBody}` : rawBody;
    const computedSig = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

    try {
      const a = Buffer.from(computedSig, 'hex');
      const b = Buffer.from(signatureHex, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'Signature mismatch' };
      }
    } catch (e) {
      return { valid: false, reason: 'Signature encoding invalid' };
    }

    return { valid: true };
  }

  parseEvent(body) {
    if (!body || typeof body !== 'object') {
      throw new Error('Webhook body is malformed or empty');
    }

    const eventId = body.eventId || body.id;
    const eventType = body.eventType || body.type;
    const data = body.data || body;

    if (!eventId) throw new Error('Missing unique eventId in webhook payload');
    if (!eventType) throw new Error('Missing eventType in webhook payload');

    const transaction = {
      transactionId: data.transactionId || data.id,
      customerId: data.customerId || data.customer,
      amount: normalizeAmount(data.amount),
      currency: normalizeCurrency(data.currency || 'INR'),
      channel: data.channel || 'other',
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      merchantId: data.merchantId,
      merchantCategory: data.merchantCategory,
      deviceMetadata: data.deviceMetadata,
      ingestionSource: 'webhook',
    };

    if (!transaction.transactionId) throw new Error('Missing transactionId in webhook data');
    if (!transaction.customerId) throw new Error('Missing customerId in webhook data');
    return {
      eventId,
      eventType,
      transaction,
    };
  }
}

const adapters = {
  securepay: new SecurePayStandardAdapter(),
  simulator: new SecurePayStandardAdapter(),
};

/** List of supported provider names for external reference */
const SUPPORTED_PROVIDERS = Object.keys(adapters);

/**
 * Returns the adapter for the given provider name.
 * Throws an error for unknown providers — never silently falls back to the simulator.
 */
const getAdapter = (providerName) => {
  if (!providerName) {
    throw new Error('Provider name is required');
  }
  const key = providerName.toLowerCase();
  const adapter = adapters[key];
  if (!adapter) {
    throw new Error(`Unknown webhook provider: '${providerName}'. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }
  return adapter;
};

module.exports = {
  ProviderAdapter,
  SecurePayStandardAdapter,
  getAdapter,
  SUPPORTED_PROVIDERS,
};
