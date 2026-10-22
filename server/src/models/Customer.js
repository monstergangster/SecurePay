const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  displayName: { type: String },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical', 'unassessed'], default: 'unassessed' },
  riskScore: { type: Number, min: 0, max: 100, default: null },
  transactionCount: { type: Number, default: 0 },
  totalTransactionAmount: { type: Number, default: 0 },
  avgTransactionAmount: { type: Number, default: 0 },
  lastTransactionAt: { type: Date },
  firstTransactionAt: { type: Date },
  flaggedTransactionCount: { type: Number, default: 0 },
  activeAlertCount: { type: Number, default: 0 },
  notes: { type: String },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
