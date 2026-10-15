const express = require('express');
const router = express.Router();
const Joi = require('joi');
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createTransactionSchema } = require('../schemas/transaction');

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'declined', 'flagged', 'blocked', 'reversed'),
  reviewStatus: Joi.string().valid('pending_review', 'under_review', 'reviewed', 'escalated'),
  notes: Joi.string(),
}).min(1);

router.use(authenticate);

router.get('/', transactionController.getTransactions);
router.post('/', validate(createTransactionSchema), transactionController.createTransaction);
router.get('/customer/:customerId', transactionController.getTransactionsByCustomer);
router.get('/:id', transactionController.getTransaction);
router.patch('/:id/status', validate(updateStatusSchema), transactionController.updateTransactionStatus);

module.exports = router;
