const Joi = require('joi');

const createTransactionSchema = Joi.object({
  transactionId: Joi.string().optional(),
  externalRef: Joi.string().optional(),
  customerId: Joi.string().required(),
  amount: Joi.number().positive().custom((amount, helpers) => {
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
      return helpers.error('number.precision');
    }
    return Math.round(amount * 100) / 100;
  }).required(),
  currency: Joi.string().trim().uppercase().valid('INR').default('INR'),
  timestamp: Joi.date().iso().optional(),
  channel: Joi.string().valid('card', 'bank_transfer', 'upi', 'wallet', 'crypto', 'other').default('other'),
  merchantId: Joi.string().optional(),
  merchantCategory: Joi.string().optional(),
  deviceMetadata: Joi.object({
    deviceId: Joi.string(),
    ipAddress: Joi.string(),
    userAgent: Joi.string(),
    location: Joi.object({ country: Joi.string(), city: Joi.string() }),
  }).optional(),
  notes: Joi.string().optional(),
  isDemo: Joi.boolean().default(false),
});

module.exports = { createTransactionSchema };
