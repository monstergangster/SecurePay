const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');
const { success, error } = require('../utils/response');
const { getPagination, paginationMeta } = require('../utils/pagination');
const auditLogger = require('../utils/auditLogger');

exports.getAlerts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    const search = String(req.query.search || '').trim();
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchPattern = new RegExp(escapedSearch, 'i');
      const matchingTransactionIds = await Transaction.distinct('_id', {
        transactionId: searchPattern,
      });
      filter.$or = [
        { title: searchPattern },
        { alertId: searchPattern },
        { transactionId: { $in: matchingTransactionIds } },
      ];
    }
    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('transactionId', 'transactionId amount currency customerId').populate('assignedTo', 'name email'),
      Alert.countDocuments(filter),
    ]);
    return success(res, alerts, 'Alerts retrieved', 200, paginationMeta(total, page, limit));
  } catch (err) { return error(res, 'Failed to retrieve alerts', 500); }
};

exports.getAlert = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return error(res, 'Invalid alert identifier', 400);
    }
    const alert = await Alert.findById(req.params.id).populate('transactionId').populate('assignedTo', 'name email').populate('caseId', 'caseId title status').populate('comments.author', 'name email');
    if (!alert) return error(res, 'Alert not found', 404);
    return success(res, alert, 'Alert retrieved');
  } catch (err) { return error(res, 'Failed to retrieve alert', 500); }
};

exports.updateAlert = async (req, res) => {
  try {
    const { status, assignedTo } = req.body;
    const alert = await Alert.findById(req.params.id);
    if (!alert) return error(res, 'Alert not found', 404);
    if (status) {
      alert.status = status;
      if (['resolved', 'false_positive'].includes(status)) { alert.resolvedAt = new Date(); alert.resolvedBy = req.user._id; }
    }
    if (assignedTo !== undefined) { alert.assignedTo = assignedTo || null; alert.assignedAt = assignedTo ? new Date() : null; }
    await alert.save();
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'ALERT_UPDATED', entity: 'Alert', entityId: alert.alertId, details: { status, assignedTo }, ipAddress: req.ip });
    return success(res, alert, 'Alert updated');
  } catch (err) { return error(res, 'Failed to update alert', 500); }
};

exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return error(res, 'Comment text required', 400);
    const alert = await Alert.findById(req.params.id);
    if (!alert) return error(res, 'Alert not found', 404);
    alert.comments.push({ author: req.user._id, text, createdAt: new Date() });
    await alert.save();
    await alert.populate('comments.author', 'name email');
    return success(res, alert, 'Comment added');
  } catch (err) { return error(res, 'Failed to add comment', 500); }
};

exports.bulkUpdateAlerts = async (req, res) => {
  try {
    const { alertIds, status, assignedTo } = req.body;
    if (!Array.isArray(alertIds) || alertIds.length === 0) return error(res, 'Alert IDs required', 400);
    if (alertIds.length > 50) return error(res, 'Maximum 50 alerts per bulk action', 400);
    const update = {};
    if (status) update.status = status;
    if (assignedTo !== undefined) update.assignedTo = assignedTo || null;
    await Alert.updateMany({ _id: { $in: alertIds } }, { $set: update });
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'ALERTS_BULK_UPDATED', entity: 'Alert', details: { alertIds, status, count: alertIds.length }, ipAddress: req.ip });
    return success(res, { updatedCount: alertIds.length }, 'Alerts updated');
  } catch (err) { return error(res, 'Failed to bulk update alerts', 500); }
};
