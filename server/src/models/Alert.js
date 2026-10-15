const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  status: { type: String, enum: ['open', 'in_review', 'escalated', 'resolved', 'false_positive'], default: 'open' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  triggeredRules: [{ rule: String, score: Number, description: String }],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now },
  }],
  deduplicationKey: { type: String, unique: true },
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

alertSchema.index({ status: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ transactionId: 1 });

module.exports = mongoose.model('Alert', alertSchema);
