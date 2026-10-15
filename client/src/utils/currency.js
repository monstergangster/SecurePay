const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatINR = (amount, currency = 'INR') => {
  if (typeof currency !== 'string' || currency.trim().toUpperCase() !== 'INR' || amount === null || amount === undefined) {
    return 'INR conversion required';
  }
  const numericAmount = Number(amount);
  return inrFormatter.format(Number.isFinite(numericAmount) ? numericAmount : 0);
};
