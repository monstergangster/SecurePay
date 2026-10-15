const User = require('../models/User');
const { success, error } = require('../utils/response');
const { getPagination, paginationMeta } = require('../utils/pagination');
const auditLogger = require('../utils/auditLogger');

exports.getUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const [users, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
    return success(res, users.map(u => u.toSafeObject()), 'Users retrieved', 200, paginationMeta(total, page, limit));
  } catch (err) { return error(res, 'Failed to retrieve users', 500); }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return error(res, 'Email already in use', 409);
    const user = await User.create({ name, email, password, role: role || 'analyst', createdBy: req.user._id });
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'USER_CREATED', entity: 'User', entityId: user._id.toString(), details: { name, email, role: user.role }, ipAddress: req.ip });
    return success(res, user.toSafeObject(), 'User created successfully', 201);
  } catch (err) { return error(res, 'Failed to create user', 500); }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, role, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    if (name) user.name = name;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'USER_UPDATED', entity: 'User', entityId: user._id.toString(), details: { name, role, isActive }, ipAddress: req.ip });
    return success(res, user.toSafeObject(), 'User updated successfully');
  } catch (err) { return error(res, 'Failed to update user', 500); }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    if (user._id.toString() === req.user._id.toString()) return error(res, 'Cannot deactivate your own account', 400);
    user.isActive = false;
    await user.save();
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'USER_DEACTIVATED', entity: 'User', entityId: user._id.toString(), details: {}, ipAddress: req.ip });
    return success(res, null, 'User deactivated');
  } catch (err) { return error(res, 'Failed to deactivate user', 500); }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    return success(res, user.toSafeObject(), 'User retrieved');
  } catch (err) { return error(res, 'Failed to retrieve user', 500); }
};
