const CURRENCY = 'INR';
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatINR = (value) => {
  const amount = Number(value);
  return inrFormatter.format(Number.isFinite(amount) ? amount : 0);
};

const normalizeCurrency = (currency = CURRENCY) => {
  if (typeof currency !== 'string' || currency.trim().toUpperCase() !== CURRENCY) {
    throw new Error(`Unsupported currency '${currency}'. Only INR is supported.`);
  }
  return CURRENCY;
};

const normalizeAmount = (value) => {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())
      ? Number(value)
      : NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Transaction amount must be a finite positive number.');
  }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    throw new Error('Transaction amount must have no more than two decimal places.');
  }
  return Math.round(amount * 100) / 100;
};

module.exports = { CURRENCY, formatINR, normalizeCurrency, normalizeAmount };
