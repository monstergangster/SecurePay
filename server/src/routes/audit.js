const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const { success, error } = require('../utils/response');
const { getPagination, paginationMeta } = require('../utils/pagination');

router.use(authenticate);

router.get('/', authorize('admin'), async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };
    if (req.query.actor) filter.actor = req.query.actor;
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
    }
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email'),
      AuditLog.countDocuments(filter),
    ]);
    return success(res, logs, 'Audit logs retrieved', 200, paginationMeta(total, page, limit));
  } catch (err) { return error(res, 'Failed to retrieve audit logs', 500); }
});

module.exports = router;
