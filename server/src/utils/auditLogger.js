const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

const log = async ({ actor, actorRole, action, entity, entityId, details = {}, ipAddress }) => {
  try {
    await AuditLog.create({ actor, actorRole, action, entity, entityId: entityId ? String(entityId) : undefined, details, ipAddress });
  } catch (err) {
    logger.error('Audit log error:', err.message);
  }
};

module.exports = { log };
