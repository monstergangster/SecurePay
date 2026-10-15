const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: 'Too many authentication attempts. Please wait 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 200,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true, legacyHeaders: false,
});

const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20,
  message: { success: false, message: 'Too many import requests. Please wait.' },
  standardHeaders: true, legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter, importLimiter };
