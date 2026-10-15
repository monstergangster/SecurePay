const express = require('express');
const router = express.Router();
const ruleController = require('../controllers/ruleController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const updateRuleSchema = Joi.object({
  isActive: Joi.boolean(),
  weight: Joi.number().min(0).max(100),
  threshold: Joi.number(),
  parameters: Joi.object(),
  description: Joi.string(),
}).min(1);

router.use(authenticate);

router.get('/', ruleController.getRules);
router.get('/:id', ruleController.getRule);
router.patch('/:id', authorize('admin'), validate(updateRuleSchema), ruleController.updateRule);
router.put('/:id', authorize('admin'), validate(updateRuleSchema), ruleController.updateRule);

module.exports = router;
