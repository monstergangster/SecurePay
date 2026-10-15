const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  externalRef: { type: String },
  customerId: { type: String, required: true, index: true },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Transaction amount must be positive.'],
    validate: {
      validator: (amount) => Number.isFinite(amount) && Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-7,
      message: 'Transaction amount must be finite and have no more than two decimal places.',
    },
  },
  currency: { type: String, required: true, enum: ['INR'], default: 'INR', uppercase: true },
  currencyConversion: {
    fromCurrency: String,
    originalAmount: Number,
    rateToINR: Number,
    convertedAt: Date,
  },
  timestamp: { type: Date, required: true, default: Date.now },
  channel: { type: String, enum: ['card', 'bank_transfer', 'upi', 'wallet', 'crypto', 'other'], default: 'other' },
  merchantId: { type: String },
  merchantCategory: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'declined', 'flagged', 'blocked', 'reversed', 'held_for_review'], default: 'pending' },
  deviceMetadata: {
    deviceId: String,
    ipAddress: String,
    userAgent: String,
    location: { country: String, city: String },
  },
  ingestionSource: { type: String, enum: ['csv_import', 'api', 'webhook', 'manual', 'demo'], default: 'api' },
  assessmentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'retrying'], default: 'pending', index: true },
  assessmentError: { type: String },
  assessmentAttempts: { type: Number, default: 0 },
  riskScore: { type: Number, min: 0, max: 100, default: null },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical', 'unassessed'], default: 'unassessed' },
  riskReasons: [{ rule: String, score: Number, description: String }],
  riskAssessedAt: { type: Date },
  mlScore: { type: Number, min: 0, max: 100, default: null },
  mlDecision: { type: String, enum: ['normal', 'anomalous', 'unavailable'], default: 'unavailable' },
  mlExplanation: [{ type: String }],
  assessmentSource: { type: String, enum: ['rules_engine', 'ml_service', 'hybrid', 'manual', 'unassessed'], default: 'unassessed' },
  reviewStatus: { type: String, enum: ['pending_review', 'under_review', 'reviewed', 'escalated'], default: 'pending_review' },
  importBatch: { type: String },
  notes: { type: String },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ riskScore: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ riskLevel: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
