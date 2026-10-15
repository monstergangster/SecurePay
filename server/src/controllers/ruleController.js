const Rule = require('../models/Rule');
const { success, error } = require('../utils/response');
const auditLogger = require('../utils/auditLogger');

exports.getRules = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const rules = await Rule.find(filter).sort({ category: 1, name: 1 });
    return success(res, rules, 'Rules retrieved');
  } catch (err) { return error(res, 'Failed to retrieve rules', 500); }
};

exports.updateRule = async (req, res) => {
  try {
    const { isActive, weight, threshold, parameters, description } = req.body;
    const rule = await Rule.findById(req.params.id);
    if (!rule) return error(res, 'Rule not found', 404);
    if (isActive !== undefined) rule.isActive = isActive;
    if (weight !== undefined) rule.weight = weight;
    if (threshold !== undefined) rule.threshold = threshold;
    if (parameters !== undefined) rule.parameters = parameters;
    if (description !== undefined) rule.description = description;
    rule.updatedBy = req.user._id;
    rule.version += 1;
    await rule.save();
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'RULE_UPDATED', entity: 'Rule', entityId: rule.ruleId, details: { isActive, weight, threshold }, ipAddress: req.ip });
    return success(res, rule, 'Rule updated');
  } catch (err) { return error(res, 'Failed to update rule', 500); }
};

exports.getRule = async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id).populate('createdBy', 'name email').populate('updatedBy', 'name email');
    if (!rule) return error(res, 'Rule not found', 404);
    return success(res, rule, 'Rule retrieved');
  } catch (err) { return error(res, 'Failed to retrieve rule', 500); }
};
