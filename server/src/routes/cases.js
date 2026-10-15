const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const createCaseSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(2000).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  alertId: Joi.string().optional(),
  transactionIds: Joi.array().items(Joi.string()).optional(),
  assignedTo: Joi.string().allow(null, '').optional(),
});

const updateCaseSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'escalated', 'resolved', 'closed'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  assignedTo: Joi.string().allow(null, ''),
  outcome: Joi.string().valid('confirmed_fraud', 'legitimate', 'inconclusive'),
  resolutionNote: Joi.string().max(2000),
}).min(1);

router.use(authenticate);

router.get('/', caseController.getCases);
router.post('/', validate(createCaseSchema), caseController.createCase);
router.get('/:id', caseController.getCase);
router.put('/:id', validate(updateCaseSchema), caseController.updateCase);
router.patch('/:id', validate(updateCaseSchema), caseController.updateCase);
router.post('/:id/notes', caseController.addNote);
router.post('/:id/link-transaction', caseController.linkTransaction);

module.exports = router;
