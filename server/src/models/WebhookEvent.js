const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    provider: { type: String, required: true, default: 'simulator' },
    eventType: { type: String, required: true },
    payloadHash: { type: String },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'failed', 'duplicate'],
      default: 'received',
    },
    transactionId: { type: String },
    errorMessage: { type: String },
    ipAddress: { type: String },
    processedAt: { type: Date },
    processingStartedAt: { type: Date, default: Date.now },
    recoveryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, createdAt: -1 });
webhookEventSchema.index({ status: 1, processingStartedAt: 1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
