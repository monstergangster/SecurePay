require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');

const connectDB = require('./config/database');
const logger = require('./config/logger');
const { getAllowedOrigins, validateSecurityEnvironment } = require('./config/security');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5001;
const allowedOrigins = getAllowedOrigins();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

app.use('/api', apiLimiter);

if (process.env.VERCEL) {
  let runtimeConfigValidated = false;
  app.use(async (req, res, next) => {
    try {
      if (!runtimeConfigValidated) {
        validateSecurityEnvironment();
        runtimeConfigValidated = true;
      }
      await connectDB();
      next();
    } catch (error) {
      next(error);
    }
  });
}

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/transactions', require('./routes/transactions'));
app.use('/api/v1/alerts', require('./routes/alerts'));
app.use('/api/v1/cases', require('./routes/cases'));
app.use('/api/v1/customers', require('./routes/customers'));
app.use('/api/v1/rules', require('./routes/rules'));
app.use('/api/v1/analytics', require('./routes/analytics'));
app.use('/api/v1/reports', require('./routes/reports'));
app.use('/api/v1/audit', require('./routes/audit'));
app.use('/api/v1/imports', require('./routes/imports'));
app.use('/api/v1/webhooks', require('./routes/webhooks'));
app.use('/api/v1/health', require('./routes/health'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

const startServer = async () => {
  validateSecurityEnvironment();
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`SecurePay API running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
};

if (require.main === module) {
  startServer().catch((err) => {
    logger.error(`SecurePay startup failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = app;
