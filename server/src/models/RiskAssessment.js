const mongoose = require('mongoose');

const riskAssessmentSchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  score: { type: Number, min: 0, max: 100 },
  level: { type: String, enum: ['low', 'medium', 'high', 'critical', 'unassessed'], required: true },
  assessmentStatus: { type: String, enum: ['completed', 'failed'], default: 'completed' },
  errorMessage: { type: String },
  triggeredRules: [{ rule: String, score: Number, description: String }],
  ruleVersion: { type: String },
  analysisSource: { type: String, enum: ['rules_engine', 'ml_service', 'hybrid', 'manual'], default: 'rules_engine' },
  mlScore: { type: Number, min: 0, max: 100, default: null },
  mlServiceUsed: { type: Boolean, default: false },
  featuresExtracted: { type: mongoose.Schema.Types.Mixed },
  assessedAt: { type: Date, default: Date.now },
}, { timestamps: true });

riskAssessmentSchema.index({ transactionId: 1 });
riskAssessmentSchema.index({ assessmentStatus: 1 });

module.exports = mongoose.model('RiskAssessment', riskAssessmentSchema);
