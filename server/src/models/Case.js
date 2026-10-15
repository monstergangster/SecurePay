const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'escalated', 'resolved', 'closed'], default: 'open' },
  outcome: { type: String, enum: ['confirmed_fraud', 'legitimate', 'inconclusive', null], default: null },
  resolutionNote: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  alerts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }],
  notes: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: false },
  }],
  evidence: [{ label: String, url: String, addedAt: Date }],
  timeline: [{
    event: String,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed,
  }],
  resolvedAt: { type: Date },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

caseSchema.index({ status: 1 });
caseSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Case', caseSchema);
