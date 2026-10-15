const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { error } = require('../utils/response');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return error(res, 'Authentication token required', 401);
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) return error(res, 'User not found or inactive', 401);
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return error(res, 'Session expired. Please log in again.', 401);
    return error(res, 'Invalid authentication token', 401);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return error(res, 'Authentication required', 401);
  if (!roles.includes(req.user.role)) return error(res, 'Insufficient permissions', 403);
  next();
};

module.exports = { authenticate, authorize };
