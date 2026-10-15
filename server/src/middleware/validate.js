const Joi = require('joi');
const { error } = require('../utils/response');

const validate = (schema, source = 'body') => (req, res, next) => {
  const { error: validationError } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (validationError) {
    const errors = validationError.details.map(d => ({ field: d.path.join('.'), message: d.message }));
    return error(res, 'Validation failed', 400, errors);
  }
  next();
};

module.exports = validate;
