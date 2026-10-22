const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createCaseSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(2000).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  alertId: objectId.optional(),
  transactionIds: Joi.array().items(objectId).optional(),
  assignedTo: Joi.alternatives().try(objectId, Joi.valid(null, '')).optional(),
});

const updateCaseSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'escalated', 'resolved', 'closed'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  assignedTo: Joi.alternatives().try(objectId, Joi.valid(null, '')),
  outcome: Joi.string().valid('confirmed_fraud', 'legitimate', 'inconclusive'),
  resolutionNote: Joi.string().max(2000),
}).min(1);

const noteSchema = Joi.object({
  text: Joi.string().trim().min(1).max(4000).required(),
  isInternal: Joi.boolean().default(false),
});

const linkTransactionSchema = Joi.object({
  transactionId: objectId.required(),
});

router.use(authenticate);

router.get('/', caseController.getCases);
router.post('/', validate(createCaseSchema), caseController.createCase);
router.get('/:id', caseController.getCase);
router.put('/:id', validate(updateCaseSchema), caseController.updateCase);
router.patch('/:id', validate(updateCaseSchema), caseController.updateCase);
router.post('/:id/notes', validate(noteSchema), caseController.addNote);
router.post('/:id/link-transaction', validate(linkTransactionSchema), caseController.linkTransaction);

module.exports = router;
