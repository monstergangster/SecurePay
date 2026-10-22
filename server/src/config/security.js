const MIN_SECRET_LENGTH = 32;

const isStrongSecret = (value) => {
  if (typeof value !== 'string') return false;
  const secret = value.trim();
  if (Buffer.byteLength(secret, 'utf8') < MIN_SECRET_LENGTH) return false;
  if (/replace|placeholder|change[_ -]?this|securepay.*(?:secret|signing|key)/i.test(secret)) return false;
  return new Set(secret).size >= 10;
};

const validateSecurityEnvironment = (env = process.env) => {
  if (env.NODE_ENV === 'test') return;

  if (!isStrongSecret(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a unique, non-placeholder secret of at least 32 characters.');
  }

  if (env.NODE_ENV === 'production' && !isStrongSecret(env.WEBHOOK_SECRET)) {
    throw new Error('WEBHOOK_SECRET must be configured as a unique, non-placeholder secret of at least 32 characters in production.');
  }

  if (env.WEBHOOK_SECRET && !isStrongSecret(env.WEBHOOK_SECRET)) {
    throw new Error('WEBHOOK_SECRET must be a unique, non-placeholder secret of at least 32 characters.');
  }
};

const getAllowedOrigins = (env = process.env) => {
  const origins = new Set(
    String(env.FRONTEND_URL || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
};

module.exports = { getAllowedOrigins, isStrongSecret, validateSecurityEnvironment };
