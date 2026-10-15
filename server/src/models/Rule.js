const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, enum: ['amount', 'velocity', 'pattern', 'device', 'behavioral'], required: true },
  isActive: { type: Boolean, default: true },
  weight: { type: Number, required: true, min: 0, max: 100 },
  threshold: { type: Number },
  thresholdUnit: { type: String },
  parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  triggerCount: { type: Number, default: 0 },
  lastTriggeredAt: { type: Date },
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Rule', ruleSchema);
