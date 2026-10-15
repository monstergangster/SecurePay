const { CURRENCY, formatINR, normalizeAmount, normalizeCurrency } = require('../utils/currency');
const { createTransactionSchema } = require('../schemas/transaction');

describe('INR transaction currency policy', () => {
  it('formats amounts with Indian grouping and INR metadata', () => {
    expect(CURRENCY).toBe('INR');
    expect(formatINR(500)).toContain('500');
    expect(formatINR(25000)).toContain('25,000');
    expect(formatINR(100000)).toContain('1,00,000');
    expect(formatINR(10000000)).toContain('1,00,00,000');
  });

  it('accepts INR only and rejects non-finite, non-positive, or over-precision amounts', () => {
    expect(normalizeCurrency()).toBe('INR');
    expect(normalizeCurrency('inr')).toBe('INR');
    expect(() => normalizeCurrency('USD')).toThrow(/only INR is supported/i);
    expect(normalizeAmount('500.25')).toBe(500.25);
    expect(() => normalizeAmount('1,000')).toThrow(/finite positive number/i);
    expect(() => normalizeAmount(Infinity)).toThrow(/finite positive number/i);
    expect(() => normalizeAmount(1.001)).toThrow(/two decimal places/i);
    expect(() => normalizeAmount(0)).toThrow(/finite positive number/i);
  });

  it('defaults new transactions to INR and rejects unsupported currencies', () => {
    const valid = createTransactionSchema.validate({ customerId: 'CUST-1', amount: 500 });
    expect(valid.error).toBeUndefined();
    expect(valid.value.currency).toBe('INR');
    expect(createTransactionSchema.validate({ customerId: 'CUST-1', amount: 500, currency: 'USD' }).error).toBeDefined();
    expect(createTransactionSchema.validate({ customerId: 'CUST-1', amount: 1.001, currency: 'INR' }).error).toBeDefined();
    expect(createTransactionSchema.validate({ customerId: 'CUST-1', amount: Infinity }).error).toBeDefined();
  });
});
