const Case = require('../models/Case');
const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { success, error } = require('../utils/response');
const { getPagination, paginationMeta } = require('../utils/pagination');
const auditLogger = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

exports.getCases = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
    const [cases, total] = await Promise.all([
      Case.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .populate('transactions', 'transactionId'),
      Case.countDocuments(filter),
    ]);
    return success(res, cases, 'Cases retrieved', 200, paginationMeta(total, page, limit));
  } catch (err) { return error(res, 'Failed to retrieve cases', 500); }
};

exports.getCase = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id).populate('assignedTo', 'name email').populate('createdBy', 'name email').populate('transactions').populate('alerts').populate('notes.author', 'name email').populate('timeline.actor', 'name email');
    if (!caseDoc) return error(res, 'Case not found', 404);
    return success(res, caseDoc, 'Case retrieved');
  } catch (err) { return error(res, 'Failed to retrieve case', 500); }
};

exports.createCase = async (req, res) => {
  try {
    const { title, description, priority, alertId, transactionIds, assignedTo } = req.body;
    if (alertId) {
      const alert = await Alert.findById(alertId).select('caseId');
      if (!alert) return error(res, 'Alert not found', 404);
      if (alert.caseId) return error(res, 'An investigation case is already linked to this alert', 409);
    }
    if (transactionIds?.length) {
      const existingTransactions = await Transaction.countDocuments({ _id: { $in: transactionIds } });
      if (existingTransactions !== new Set(transactionIds).size) {
        return error(res, 'One or more transactions were not found', 400);
      }
    }
    if (assignedTo) {
      const assignee = await User.findOne({ _id: assignedTo, isActive: true }).select('_id');
      if (!assignee) return error(res, 'Assigned user was not found or is inactive', 400);
    }
    const caseId = `CASE-${uuidv4().substring(0, 8).toUpperCase()}`;
    const caseDoc = await Case.create({
      caseId, title, description,
      priority: priority || 'medium',
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      transactions: transactionIds || [],
      alerts: alertId ? [alertId] : [],
      timeline: [{ event: 'Case created', actor: req.user._id, timestamp: new Date(), details: { title } }],
    });
    if (alertId) {
      let linkedAlert;
      try {
        linkedAlert = await Alert.findOneAndUpdate(
          { _id: alertId, $or: [{ caseId: { $exists: false } }, { caseId: null }] },
          { $set: { caseId: caseDoc._id } },
          { new: true }
        );
      } catch (linkError) {
        await Case.deleteOne({ _id: caseDoc._id });
        throw linkError;
      }
      if (!linkedAlert) {
        await Case.deleteOne({ _id: caseDoc._id });
        return error(res, 'An investigation case is already linked to this alert', 409);
      }
    }
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'CASE_CREATED', entity: 'Case', entityId: caseDoc.caseId, details: { title, priority }, ipAddress: req.ip });
    return success(res, caseDoc, 'Case created', 201);
  } catch (err) { return error(res, 'Failed to create case', 500); }
};

exports.updateCase = async (req, res) => {
  try {
    const { status, priority, assignedTo, outcome, resolutionNote } = req.body;
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return error(res, 'Case not found', 404);

    const VALID_TRANSITIONS = {
      open: ['in_progress', 'escalated', 'resolved', 'closed'],
      in_progress: ['escalated', 'resolved', 'closed', 'open'],
      escalated: ['in_progress', 'resolved', 'closed'],
      resolved: ['in_progress', 'closed', 'open'], // Allows controlled reopening
      closed: ['open'], // Reopening closed cases
    };

    if (status && status !== caseDoc.status) {
      const allowed = VALID_TRANSITIONS[caseDoc.status] || [];
      if (!allowed.includes(status)) {
        return error(res, `Invalid state transition from '${caseDoc.status}' to '${status}'`, 400);
      }
    }

    if (outcome && !['resolved', 'closed'].includes(status || caseDoc.status)) {
      return error(res, 'Outcome can only be recorded when resolving or closing a case', 400);
    }

    if (outcome && (!resolutionNote || !resolutionNote.trim())) {
      return error(res, 'A detailed resolution note is required when recording an investigation outcome', 400);
    }

    const timelineEvent = { actor: req.user._id, timestamp: new Date(), details: {} };
    if (status && status !== caseDoc.status) {
      timelineEvent.event = `Status transitioned from ${caseDoc.status} to ${status}`;
      if (['resolved', 'closed'].includes(caseDoc.status) && ['open', 'in_progress'].includes(status)) {
        timelineEvent.event = `Case reopened: status set to ${status}`;
      }
      caseDoc.status = status;
    }
    if (priority) caseDoc.priority = priority;
    if (assignedTo !== undefined) {
      const requestedAssignee = assignedTo
        ? await User.findOne({ _id: assignedTo, isActive: true }).select('_id name')
        : null;
      if (assignedTo && !requestedAssignee) {
        return error(res, 'Assigned user was not found or is inactive', 400);
      }

      const currentAssigneeId = caseDoc.assignedTo?.toString() || '';
      const requestedAssigneeId = requestedAssignee?._id.toString() || '';
      if (currentAssigneeId !== requestedAssigneeId) {
        caseDoc.assignedTo = requestedAssignee?._id || null;
        const assignmentEvent = requestedAssignee
          ? `Case assigned to ${requestedAssignee.name}`
          : 'Case assignment cleared';
        timelineEvent.event = [timelineEvent.event, assignmentEvent].filter(Boolean).join(' | ');
      }
    }
    if (outcome) {
      caseDoc.outcome = outcome;
      caseDoc.resolutionNote = resolutionNote.trim();
      caseDoc.resolvedAt = new Date();
      timelineEvent.event = `${timelineEvent.event ? timelineEvent.event + ' | ' : ''}Outcome recorded: ${outcome}`;
    }
    if (timelineEvent.event) caseDoc.timeline.push(timelineEvent);
    await caseDoc.save();
    await auditLogger.log({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'CASE_UPDATED',
      entity: 'Case',
      entityId: caseDoc.caseId,
      details: { status: caseDoc.status, outcome: caseDoc.outcome, assignedTo: caseDoc.assignedTo },
      ipAddress: req.ip,
    });
    return success(res, caseDoc, 'Case updated successfully');
  } catch (err) {
    return error(res, 'Failed to update case', 500);
  }
};

exports.addNote = async (req, res) => {
  try {
    const { text, isInternal } = req.body;
    if (!text) return error(res, 'Note text required', 400);
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return error(res, 'Case not found', 404);
    caseDoc.notes.push({ author: req.user._id, text, isInternal: isInternal || false, createdAt: new Date() });
    caseDoc.timeline.push({ event: 'Note added', actor: req.user._id, timestamp: new Date() });
    await caseDoc.save();
    await caseDoc.populate('notes.author', 'name email');
    await auditLogger.log({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'CASE_NOTE_ADDED',
      entity: 'Case',
      entityId: caseDoc.caseId,
      details: { isInternal: Boolean(isInternal) },
      ipAddress: req.ip,
    });
    return success(res, caseDoc, 'Note added');
  } catch (err) { return error(res, 'Failed to add note', 500); }
};

exports.linkTransaction = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return error(res, 'Case not found', 404);
    const transaction = await Transaction.findById(transactionId).select('_id');
    if (!transaction) return error(res, 'Transaction not found', 404);
    const txIdStr = transaction._id.toString();
    if (!caseDoc.transactions.map(t => t.toString()).includes(txIdStr)) {
      caseDoc.transactions.push(transaction._id);
      caseDoc.timeline.push({ event: 'Transaction linked', actor: req.user._id, timestamp: new Date() });
      await caseDoc.save();
      await auditLogger.log({
        actor: req.user._id,
        actorRole: req.user.role,
        action: 'CASE_TRANSACTION_LINKED',
        entity: 'Case',
        entityId: caseDoc.caseId,
        details: { transactionId: transaction._id.toString() },
        ipAddress: req.ip,
      });
    }
    return success(res, caseDoc, 'Transaction linked to case');
  } catch (err) { return error(res, 'Failed to link transaction', 500); }
};
