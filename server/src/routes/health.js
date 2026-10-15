const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const mongoose = require('mongoose');
const axios = require('axios');
const { success } = require('../utils/response');

router.get('/', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
  let mlStatus = 'unavailable';
  try {
    const r = await axios.get(`${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/health`, { timeout: 3000 });
    if (r.data) mlStatus = 'connected';
  } catch { mlStatus = 'unavailable'; }
  return success(res, {
    status: 'operational',
    timestamp: new Date().toISOString(),
    services: { api: 'operational', database: dbStatus, mlService: mlStatus },
    version: '1.0.0',
  }, 'Health check successful');
});

module.exports = router;
