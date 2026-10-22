const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { success } = require('../utils/response');
const logger = require('../config/logger');

router.get('/', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
  let mlStatus = 'unavailable';
  try {
    const r = await axios.get(`${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/health`, { timeout: 3000 });
    if (r.data?.status === 'operational') mlStatus = 'connected';
    else if (r.data) mlStatus = 'degraded';
  } catch (err) {
    logger.warn(`ML service health check failed: ${err.message}`);
    mlStatus = 'unavailable';
  }
  const mlRequired = (process.env.ML_AVAILABILITY_POLICY || 'optional').toLowerCase() === 'mandatory';
  const databaseAvailable = dbState === 1;
  const requiredServicesAvailable = databaseAvailable && (!mlRequired || mlStatus === 'connected');
  const status = !databaseAvailable ? 'unavailable' : mlStatus === 'connected' ? 'operational' : 'degraded';
  const data = {
    status,
    timestamp: new Date().toISOString(),
    services: { api: 'operational', database: dbStatus, mlService: mlStatus },
    version: '1.0.0',
  };
  if (!requiredServicesAvailable) {
    return res.status(503).json({ success: false, message: 'One or more required services are unavailable', data });
  }
  return success(res, data, status === 'operational' ? 'Health check successful' : 'API is available with degraded optional services');
});

module.exports = router;
