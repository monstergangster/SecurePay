const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', dashboardController.getDashboardStats);
router.get('/trends', dashboardController.getTrends);

module.exports = router;
