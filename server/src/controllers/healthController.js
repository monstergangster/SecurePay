const mongoose = require('mongoose');
const axios = require('axios');
const { success } = require('../utils/response');

exports.health = async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
  let mlStatus = 'unavailable';
  try {
    const response = await axios.get(`${process.env.ML_SERVICE_URL}/health`, { timeout: 3000 });
    if (response.data) mlStatus = 'connected';
  } catch { mlStatus = 'unavailable'; }
  return success(res, {
    status: 'operational',
    timestamp: new Date().toISOString(),
    services: { api: 'operational', database: dbStatus, mlService: mlStatus },
    version: '1.0.0',
  }, 'Health check successful');
};
