const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('admin', 'analyst').default('analyst'),
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  role: Joi.string().valid('admin', 'analyst'),
  isActive: Joi.boolean(),
}).min(1);

router.use(authenticate);

router.get('/', authorize('admin'), userController.getUsers);
router.post('/', authorize('admin'), validate(createUserSchema), userController.createUser);
router.get('/:id', authorize('admin'), userController.getUser);
router.put('/:id', authorize('admin'), validate(updateUserSchema), userController.updateUser);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
