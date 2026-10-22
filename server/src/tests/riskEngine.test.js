process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_jest_min_32_chars_long';
const { getRiskLevel, RISK_LEVEL_THRESHOLDS, fullAssessment } = require('../utils/riskEngine');
const Rule = require('../models/Rule');
const Transaction = require('../models/Transaction');

describe('Phase 1: Risk Engine Failure Handling & Resilience Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Transaction, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([
        { amount: 150, currency: 'INR', channel: 'card', timestamp: new Date(Date.now() - 86400000) },
        { amount: 150, currency: 'INR', channel: 'card', timestamp: new Date(Date.now() - 172800000) },
        { amount: 150, currency: 'INR', channel: 'card', timestamp: new Date(Date.now() - 259200000) },
        { amount: 150, currency: 'INR', channel: 'card', timestamp: new Date(Date.now() - 345600000) },
      ]),
    });
    jest.spyOn(Transaction, 'countDocuments').mockResolvedValue(0);
  });

  describe('Risk Level Classification', () => {
    it('should correctly classify risk levels based on thresholds', () => {
      expect(getRiskLevel(0)).toBe('low');
      expect(getRiskLevel(24)).toBe('low');
      expect(getRiskLevel(25)).toBe('medium');
      expect(getRiskLevel(54)).toBe('medium');
      expect(getRiskLevel(55)).toBe('high');
      expect(getRiskLevel(79)).toBe('high');
      expect(getRiskLevel(80)).toBe('critical');
      expect(getRiskLevel(100)).toBe('critical');
    });

    it('should return "unassessed" for null, undefined, or NaN scores (never defaulting to low risk)', () => {
      expect(getRiskLevel(null)).toBe('unassessed');
      expect(getRiskLevel(undefined)).toBe('unassessed');
      expect(getRiskLevel(NaN)).toBe('unassessed');
    });

    it('should verify defined risk thresholds structure', () => {
      expect(RISK_LEVEL_THRESHOLDS.low).toBe(0);
      expect(RISK_LEVEL_THRESHOLDS.medium).toBe(25);
      expect(RISK_LEVEL_THRESHOLDS.high).toBe(55);
      expect(RISK_LEVEL_THRESHOLDS.critical).toBe(80);
    });
  });

  describe('Assessment Execution & Rule Evaluation', () => {
    it('should successfully evaluate rules on valid transaction', async () => {
      jest.spyOn(Rule, 'find').mockImplementation(() =>
        Promise.resolve([
          {
            ruleId: 'RULE_HIGH_AMOUNT',
            weight: 30,
            threshold: 10000,
            parameters: { amountThreshold: 10000 },
            isActive: true,
          },
        ])
      );
      jest.spyOn(Rule, 'findOneAndUpdate').mockImplementation(() => Promise.resolve({}));

      const normalTx = {
        transactionId: 'TXN-TEST-1',
        customerId: 'CUST-TEST',
        amount: 150.0,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date('2026-10-13T12:00:00Z'),
      };

      const assessment = await fullAssessment(normalTx, { enableBehavioral: false });
      expect(assessment.success).toBe(true);
      expect(assessment.status).toBe('completed');
      expect(assessment.score).toBe(0);
      expect(assessment.level).toBe('low');
      expect(assessment.triggeredRules).toHaveLength(0);

      const highTx = {
        transactionId: 'TXN-TEST-2',
        customerId: 'CUST-TEST',
        amount: 15000.0,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date('2026-10-13T12:00:00Z'),
      };

      const highAssessment = await fullAssessment(highTx, { enableBehavioral: false });
      expect(highAssessment.success).toBe(true);
      expect(highAssessment.status).toBe('completed');
      expect(highAssessment.score).toBe(30);
      expect(highAssessment.level).toBe('medium');
      expect(highAssessment.triggeredRules).toHaveLength(1);
      expect(highAssessment.triggeredRules[0].rule).toBe('RULE_HIGH_AMOUNT');
    });
  });

  describe('Malformed Inputs & Boundary Safety', () => {
    it('should reject null or non-object transaction inputs without crashing', async () => {
      const resNull = await fullAssessment(null);
      expect(resNull.success).toBe(false);
      expect(resNull.status).toBe('failed');
      expect(resNull.score).toBeNull();
      expect(resNull.level).toBe('unassessed');
      expect(resNull.error).toMatch(/malformed/i);

      const resString = await fullAssessment('not-a-tx');
      expect(resString.success).toBe(false);
      expect(resString.status).toBe('failed');
      expect(resString.level).toBe('unassessed');
    });

    it('should reject non-positive or NaN transaction amounts', async () => {
      const resZero = await fullAssessment({ amount: 0 });
      expect(resZero.success).toBe(false);
      expect(resZero.status).toBe('failed');
      expect(resZero.score).toBeNull();
      expect(resZero.level).toBe('unassessed');

      const resNegative = await fullAssessment({ amount: -50 });
      expect(resNegative.success).toBe(false);
      expect(resNegative.status).toBe('failed');

      const resNaN = await fullAssessment({ amount: NaN });
      expect(resNaN.success).toBe(false);
      expect(resNaN.status).toBe('failed');
    });
  });

  describe('Database Errors & Failure Handling (No Silent Low-Risk Substitution)', () => {
    it('should hold assessment when customer history cannot be read', async () => {
      jest.spyOn(Rule, 'find').mockResolvedValue([]);
      jest.spyOn(Transaction, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockRejectedValue(new Error('History database unavailable')),
      });

      const result = await fullAssessment({
        transactionId: 'TXN-HISTORY-FAIL',
        customerId: 'CUST-HISTORY-FAIL',
        amount: 500,
        currency: 'INR',
        timestamp: new Date(),
      }, { retries: 0, enableMl: false, retryDelayMs: 1 });

      expect(result.success).toBe(false);
      expect(result.score).toBeNull();
      expect(result.level).toBe('unassessed');
      expect(result.error).toBeDefined();
    });

    it('should NOT return score: 0 or level: "low" when database query throws fatal error', async () => {
      jest.spyOn(Rule, 'find').mockImplementation(() => {
        throw new Error('Fatal MongoDB connection disconnect');
      });

      const tx = {
        transactionId: 'TXN-DB-FAIL',
        customerId: 'CUST-TEST',
        amount: 500,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(),
      };

      const result = await fullAssessment(tx, { retries: 1, retryDelayMs: 10 });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.score).toBeNull(); // Strictly null, NEVER 0
      expect(result.level).toBe('unassessed'); // Strictly unassessed, NEVER 'low'
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(2);
    });

    it('should retry transient database errors and succeed if connection recovers', async () => {
      let callCount = 0;
      jest.spyOn(Rule, 'find').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Transient socket timeout'));
        }
        return Promise.resolve([
          {
            ruleId: 'RULE_HIGH_AMOUNT',
            weight: 30,
            threshold: 10000,
            parameters: { amountThreshold: 10000 },
            isActive: true,
          },
        ]);
      });

      const tx = {
        transactionId: 'TXN-RETRY-OK',
        customerId: 'CUST-TEST',
        amount: 250,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(),
      };

      const result = await fullAssessment(tx, { retries: 2, retryDelayMs: 10, enableBehavioral: false, enableMl: false });

      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.attempts).toBe(2);
    });
  });

  describe('Priority 3: Machine Learning Service Integration Tests', () => {
    it('should combine rule score and ML anomaly score using documented hybrid policy', async () => {
      jest.spyOn(Rule, 'find').mockResolvedValue([
        {
          ruleId: 'RULE_HIGH_AMOUNT',
          weight: 30,
          threshold: 10000,
          parameters: { amountThreshold: 10000 },
          isActive: true,
        },
      ]);
      jest.spyOn(Rule, 'findOneAndUpdate').mockResolvedValue({});

      // Mock axios post to return ML score
      const axios = require('axios');
      jest.spyOn(axios, 'post').mockResolvedValue({
        data: {
          transaction_id: 'TXN-ML-1',
          ml_score: 75.0,
          is_anomaly: true,
          model_version: '1.0.0',
          explanation: ['Elevated feature anomaly in high dimensional space'],
          features: { amount_normalized: 1.2 },
        },
      });

      process.env.ML_SERVICE_URL = 'http://localhost:8001';

      const tx = {
        transactionId: 'TXN-ML-1',
        customerId: 'CUST-TEST',
        amount: 15000.0, // Rule score: 30
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(),
      };

      const result = await fullAssessment(tx, { enableBehavioral: false, enableMl: true });

      expect(result.success).toBe(true);
      expect(result.ruleScore).toBe(30);
      expect(result.mlScore).toBe(75);
      expect(result.mlDecision).toBe('anomalous');
      expect(result.analysisSource).toBe('hybrid');
      expect(result.modelVersion).toBe('1.0.0');
      // combined = 0.65 * 30 + 0.35 * 75 = 19.5 + 26.25 = 45.75 -> 46, but isAnomaly elevates to 55
      expect(result.score).toBeGreaterThanOrEqual(55);
      expect(result.level).toBe('high');
    });

    it('should gracefully degrade to rules_engine when ML service fails or times out without classifying as unassessed', async () => {
      jest.spyOn(Rule, 'find').mockResolvedValue([
        {
          ruleId: 'RULE_HIGH_AMOUNT',
          weight: 30,
          threshold: 10000,
          parameters: { amountThreshold: 10000 },
          isActive: true,
        },
      ]);

      const axios = require('axios');
      jest.spyOn(axios, 'post').mockRejectedValue(new Error('Connection refused at http://localhost:8001/analyze'));

      process.env.ML_SERVICE_URL = 'http://localhost:8001';

      const tx = {
        transactionId: 'TXN-ML-DOWN',
        customerId: 'CUST-TEST',
        amount: 12000.0,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(),
      };

      const result = await fullAssessment(tx, { enableBehavioral: false, enableMl: true });

      expect(result.success).toBe(true);
      expect(result.ruleScore).toBe(30);
      expect(result.mlScore).toBeNull();
      expect(result.mlDecision).toBe('unavailable');
      expect(result.analysisSource).toBe('rules_engine');
      expect(result.score).toBe(30);
      expect(result.level).toBe('medium');
    });

    it('should distinguish low-risk transaction with ML normal classification', async () => {
      jest.spyOn(Rule, 'find').mockResolvedValue([]);

      const axios = require('axios');
      jest.spyOn(axios, 'post').mockResolvedValue({
        data: {
          transaction_id: 'TXN-ML-NORMAL',
          ml_score: 12.0,
          is_anomaly: false,
          model_version: '1.0.0',
          explanation: ['Normal transaction pattern'],
        },
      });

      const tx = {
        transactionId: 'TXN-ML-NORMAL',
        customerId: 'CUST-TEST',
        amount: 50.0,
        currency: 'INR',
        channel: 'card',
        timestamp: new Date(),
      };

      const result = await fullAssessment(tx, { enableBehavioral: false, enableMl: true });

      expect(result.success).toBe(true);
      expect(result.ruleScore).toBe(0);
      expect(result.mlScore).toBe(12);
      expect(result.mlDecision).toBe('normal');
      expect(result.analysisSource).toBe('hybrid');
      expect(result.level).toBe('low');
    });

    describe('Configurable ML Availability Policies (rules_only, optional, mandatory)', () => {
      it('should enforce rules_only mode by bypassing ML and recording policy reason', async () => {
        jest.spyOn(Rule, 'find').mockResolvedValue([
          { ruleId: 'RULE_HIGH_AMOUNT', weight: 40, threshold: 5000, parameters: { amountThreshold: 5000 }, isActive: true }
        ]);

        const axios = require('axios');
        const postSpy = jest.spyOn(axios, 'post');

        const tx = {
          transactionId: 'TXN-RULES-ONLY',
          customerId: 'CUST-TEST',
          amount: 6000.0,
          currency: 'INR',
          channel: 'card',
          timestamp: new Date(),
        };

        const result = await fullAssessment(tx, {
          enableBehavioral: false,
          mlPolicy: 'rules_only',
        });

        expect(result.success).toBe(true);
        expect(result.mlPolicy).toBe('rules_only');
        expect(result.mlPolicyReason).toMatch(/rules_only policy active/i);
        expect(result.analysisSource).toBe('rules_engine');
        expect(result.mlScore).toBeNull();
        expect(result.mlDecision).toBe('disabled_by_policy');
        expect(result.score).toBe(40);
        // Ensure axios.post was NOT called in rules_only mode
        expect(postSpy).not.toHaveBeenCalled();
      });

      it('should hold transaction for review under mandatory ML mode when ML service fails', async () => {
        jest.spyOn(Rule, 'find').mockResolvedValue([]);

        const axios = require('axios');
        jest.spyOn(axios, 'post').mockRejectedValue(new Error('ML connection refused'));

        const tx = {
          transactionId: 'TXN-MANDATORY-FAIL',
          customerId: 'CUST-TEST',
          amount: 250.0,
          currency: 'INR',
          channel: 'card',
          timestamp: new Date(),
        };

        const result = await fullAssessment(tx, {
          enableBehavioral: false,
          mlPolicy: 'mandatory',
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.score).toBeNull();
        expect(result.level).toBe('unassessed');
        expect(result.mlPolicy).toBe('mandatory');
        expect(result.error).toMatch(/ML service mandatory but unavailable/i);
        expect(result.mlPolicyReason).toMatch(/held for review/i);
      });

      it('should successfully complete assessment under mandatory ML mode when ML service succeeds', async () => {
        jest.spyOn(Rule, 'find').mockResolvedValue([]);

        const axios = require('axios');
        jest.spyOn(axios, 'post').mockResolvedValue({
          data: {
            transaction_id: 'TXN-MANDATORY-OK',
            ml_score: 18.0,
            is_anomaly: false,
            model_version: '1.0.0',
            explanation: ['Normal baseline'],
          },
        });

        const tx = {
          transactionId: 'TXN-MANDATORY-OK',
          customerId: 'CUST-TEST',
          amount: 100.0,
          currency: 'INR',
          channel: 'card',
          timestamp: new Date(),
        };

        const result = await fullAssessment(tx, {
          enableBehavioral: false,
          mlPolicy: 'mandatory',
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe('completed');
        expect(result.mlPolicy).toBe('mandatory');
        expect(result.analysisSource).toBe('hybrid');
        expect(result.mlScore).toBe(18);
        expect(result.level).toBe('low');
      });
    });
  });
});
