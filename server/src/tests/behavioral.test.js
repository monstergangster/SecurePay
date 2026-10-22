const { computeStats, extractCustomerBehavioralFeatures } = require('../utils/behavioralAnalytics');
const Transaction = require('../models/Transaction');

describe('Phase 4: Customer Behavioural Analytics Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Statistical Computation Helpers', () => {
    it('should correctly calculate mean, median, min, max, and std deviation', () => {
      const stats = computeStats([10, 20, 30, 40, 50]);
      expect(stats.mean).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.count).toBe(5);
      expect(stats.std).toBeGreaterThan(14);
    });

    it('should gracefully handle empty or invalid arrays', () => {
      const emptyStats = computeStats([]);
      expect(emptyStats.mean).toBe(0);
      expect(emptyStats.median).toBe(0);
      expect(emptyStats.count).toBe(0);
    });
  });

  describe('Behavioral Feature Extraction & Leakage Prevention', () => {
    it('should identify new customers when fewer than 3 historical transactions exist', async () => {
      jest.spyOn(Transaction, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([
          { amount: 50, currency: 'INR', channel: 'card', timestamp: new Date() },
        ]),
      });

      const currentTx = {
        transactionId: 'TXN-CURR-1',
        customerId: 'CUST-NEW-1',
        amount: 100,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(),
      };

      const profile = await extractCustomerBehavioralFeatures(currentTx);
      expect(profile.isNewCustomer).toBe(true);
      expect(profile.historyCount).toBe(1);
      expect(profile.signals.some((s) => s.signal === 'NEW_CUSTOMER_BASELINE')).toBe(true);
    });

    it('should detect significant amount deviation relative to historical baseline', async () => {
      // Historical baseline: 10 transactions around INR 50
      const historicalTxs = Array.from({ length: 10 }).map((_, i) => ({
        amount: 50,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
      }));

      jest.spyOn(Transaction, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(historicalTxs),
      });

      const currentTx = {
        transactionId: 'TXN-DEVIATE',
        customerId: 'CUST-ESTABLISHED',
        amount: 350, // 7x baseline mean
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(),
      };

      const profile = await extractCustomerBehavioralFeatures(currentTx);
      expect(profile.isNewCustomer).toBe(false);
      expect(profile.meanAmount).toBe(50);
      expect(profile.amountToMeanRatio).toBe(7);
      expect(profile.amountZScore).toBeGreaterThanOrEqual(3);
      expect(profile.signals.some((s) => s.signal === 'AMOUNT_SIGNIFICANT_DEVIATION')).toBe(true);
    });

    it('should produce different risk signals for identical amounts if customer histories differ', async () => {
      // Scenario A: Customer accustomed to INR 10,000 transactions
      const richHistory = Array.from({ length: 10 }).map((_, i) => ({
        amount: 10000,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
      }));

      // Scenario B: Customer accustomed to INR 50 transactions
      const regularHistory = Array.from({ length: 10 }).map((_, i) => ({
        amount: 50,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
      }));

      const findSpy = jest.spyOn(Transaction, 'find');

      // Test regular customer with INR 5,000 transaction
      findSpy.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(regularHistory),
      });

      const txRegular = {
        transactionId: 'TXN-A',
        customerId: 'CUST-REGULAR',
        amount: 5000,
        channel: 'card',
        timestamp: new Date(),
      };
      const profileRegular = await extractCustomerBehavioralFeatures(txRegular);

      // Test affluent customer with same INR 5,000 transaction
      findSpy.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(richHistory),
      });

      const txRich = {
        transactionId: 'TXN-B',
        customerId: 'CUST-AFFLUENT',
        amount: 5000,
        channel: 'card',
        timestamp: new Date(),
      };
      const profileRich = await extractCustomerBehavioralFeatures(txRich);

      // Verify that identical amounts receive completely distinct contextual deviations
      expect(profileRegular.signals.some((s) => s.signal.includes('AMOUNT_'))).toBe(true);
      expect(profileRich.signals.some((s) => s.signal.includes('AMOUNT_'))).toBe(false);
      expect(profileRegular.behavioralRiskContribution).toBeGreaterThan(profileRich.behavioralRiskContribution);
    });

    it('should surface history lookup failures instead of treating the customer as new', async () => {
      jest.spyOn(Transaction, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockRejectedValue(new Error('MongoDB unavailable')),
      });

      await expect(extractCustomerBehavioralFeatures({
        customerId: 'CUST-DB-ERROR',
        amount: 100,
        timestamp: new Date(),
      })).rejects.toThrow('MongoDB unavailable');
    });
  });
});
