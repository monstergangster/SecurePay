const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { success, error } = require('../utils/response');
const auditLogger = require('../utils/auditLogger');
const logger = require('../config/logger');

const generateToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.isActive) {
      await auditLogger.log({ action: 'LOGIN_FAILED', entity: 'User', details: { email, reason: 'Not found or inactive' }, ipAddress: req.ip });
      return error(res, 'Invalid email or password', 401);
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await auditLogger.log({ action: 'LOGIN_FAILED', entity: 'User', entityId: user._id.toString(), details: { email, reason: 'Wrong password' }, ipAddress: req.ip });
      return error(res, 'Invalid email or password', 401);
    }
    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user._id);
    await auditLogger.log({ actor: user._id, actorRole: user.role, action: 'LOGIN_SUCCESS', entity: 'User', entityId: user._id.toString(), details: { email }, ipAddress: req.ip });
    return success(res, { token, user: user.toSafeObject() }, 'Login successful');
  } catch (err) {
    logger.error('Login error:', err.message);
    return error(res, 'Authentication service error', 500);
  }
};

exports.me = async (req, res) => success(res, req.user, 'User profile retrieved');

exports.logout = async (req, res) => {
  await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'LOGOUT', entity: 'User', entityId: req.user._id.toString(), ipAddress: req.ip });
  return success(res, null, 'Logged out successfully');
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return error(res, 'Current password is incorrect', 400);
    user.password = newPassword;
    await user.save();
    await auditLogger.log({ actor: req.user._id, actorRole: req.user.role, action: 'PASSWORD_CHANGED', entity: 'User', entityId: req.user._id.toString(), ipAddress: req.ip });
    return success(res, null, 'Password changed successfully');
  } catch (err) {
    return error(res, 'Failed to change password', 500);
  }
};
