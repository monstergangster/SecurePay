const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const updateAlertSchema = Joi.object({
  status: Joi.string().valid('open', 'in_review', 'escalated', 'resolved', 'false_positive'),
  assignedTo: Joi.string().allow(null, ''),
}).min(1);

const bulkUpdateSchema = Joi.object({
  alertIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
  status: Joi.string().valid('open', 'in_review', 'escalated', 'resolved', 'false_positive'),
  assignedTo: Joi.string().allow(null, ''),
}).min(2);

router.use(authenticate);

router.get('/', alertController.getAlerts);
router.post('/bulk', validate(bulkUpdateSchema), alertController.bulkUpdateAlerts);
router.get('/:id', alertController.getAlert);
router.patch('/:id', validate(updateAlertSchema), alertController.updateAlert);
router.put('/:id', validate(updateAlertSchema), alertController.updateAlert);
router.post('/:id/comments', alertController.addComment);

module.exports = router;
