require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');

const connectDB = require('./config/database');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from common dev ports and the configured FRONTEND_URL
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
    ];
    // Allow requests with no origin (like curl, Postman, or server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // In dev mode, allow all origins
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

app.use('/api', apiLimiter);

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
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`SecurePay API running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
