const success = (res, data, message = 'Success', statusCode = 200, meta = {}) => {
  return res.status(statusCode).json({ success: true, message, data, meta });
};

const error = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

module.exports = { success, error };
