require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const Case = require('../models/Case');
const Customer = require('../models/Customer');
const Rule = require('../models/Rule');
const RiskAssessment = require('../models/RiskAssessment');
const { formatINR } = require('../utils/currency');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/securepay';

const DEFAULT_RULES = [
  { ruleId: 'RULE_HIGH_AMOUNT', name: 'High-Value Transaction', description: 'Flags transactions exceeding the configured high-value threshold.', category: 'amount', weight: 30, threshold: 10000, thresholdUnit: 'INR', parameters: { amountThreshold: 10000 }, isActive: true },
  { ruleId: 'RULE_VELOCITY_RAPID', name: 'Rapid Transaction Velocity', description: 'Flags customers with multiple transactions in a short time window.', category: 'velocity', weight: 35, threshold: 5, thresholdUnit: 'count/hour', parameters: { windowMinutes: 60, maxCount: 5 }, isActive: true },
  { ruleId: 'RULE_SUSPICIOUS_CHANNEL', name: 'Monitored Payment Channel', description: 'Flags transactions via channels with elevated risk profiles.', category: 'pattern', weight: 20, parameters: { flaggedChannels: ['crypto'] }, isActive: true },
  { ruleId: 'RULE_ROUND_AMOUNT', name: 'Round-Number Transaction', description: 'Flags suspiciously round transaction amounts.', category: 'pattern', weight: 15, parameters: { minAmount: 1000 }, isActive: true },
  { ruleId: 'RULE_NIGHT_TRANSACTION', name: 'Unusual-Hour Transaction', description: 'Flags transactions processed during unusual hours (01:00–05:00 UTC).', category: 'behavioral', weight: 15, parameters: { startHour: 1, endHour: 5 }, isActive: true },
  { ruleId: 'RULE_FOREIGN_CURRENCY', name: 'Unsupported Currency Transaction', description: 'Flags transactions not denominated in INR.', category: 'pattern', weight: 10, parameters: { baseCurrency: 'INR' }, isActive: true },
];

const customerIds = ['CUST-001', 'CUST-002', 'CUST-003', 'CUST-004', 'CUST-005', 'CUST-006', 'CUST-007', 'CUST-008'];

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // Clear demo data
  await Promise.all([
    Transaction.deleteMany({ isDemo: true }),
    Alert.deleteMany({ isDemo: true }),
    Case.deleteMany({ isDemo: true }),
    Customer.deleteMany({ isDemo: true }),
  ]);
  console.log('✓ Cleared existing demo data');

  // Seed rules (idempotent)
  for (const rule of DEFAULT_RULES) {
    await Rule.findOneAndUpdate({ ruleId: rule.ruleId }, rule, { upsert: true, new: true });
  }
  console.log('✓ Seeded 6 detection rules');

  // Seed users
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@securepay.dev';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@SecurePay2024';
  const analystEmail = process.env.SEED_ANALYST_EMAIL || 'analyst@securepay.dev';
  const analystPassword = process.env.SEED_ANALYST_PASSWORD || 'Analyst@SecurePay2024';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({ name: 'Admin User', email: adminEmail, password: adminPassword, role: 'admin' });
    console.log(`✓ Created admin: ${adminEmail}`);
  } else { console.log(`  Admin already exists: ${adminEmail}`); }

  let analyst = await User.findOne({ email: analystEmail });
  if (!analyst) {
    analyst = await User.create({ name: 'Demo Analyst', email: analystEmail, password: analystPassword, role: 'analyst' });
    console.log(`✓ Created analyst: ${analystEmail}`);
  } else { console.log(`  Analyst already exists: ${analystEmail}`); }

  // Generate transactions
  const txDocs = [];
  const channels = ['card', 'bank_transfer', 'upi', 'wallet', 'crypto'];
  const categories = ['retail', 'food', 'travel', 'tech'];

  // Normal transactions (80)
  for (let i = 0; i < 80; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const ts = new Date(); ts.setDate(ts.getDate() - daysAgo); ts.setHours(Math.floor(Math.random() * 12) + 8);
    const amount = Math.round((Math.random() * 2000 + 50) * 100) / 100;
    txDocs.push({
      transactionId: `TXN-DEMO-${String(i + 1).padStart(4, '0')}`,
      customerId: customerIds[i % customerIds.length],
      amount, currency: 'INR',
      timestamp: ts, channel: channels[i % channels.length],
      merchantId: `MERCH-${Math.floor(Math.random() * 20) + 1}`,
      merchantCategory: categories[i % categories.length],
      ingestionSource: 'demo', isDemo: true, status: 'approved',
      riskScore: Math.floor(Math.random() * 20), riskLevel: 'low',
    });
  }

  // Suspicious transactions
  const suspicious = [
    { customerId: 'CUST-003', amount: 15000, currency: 'INR', channel: 'crypto', riskScore: 90, riskLevel: 'critical', status: 'blocked', hoursBack: 2 },
    { customerId: 'CUST-003', amount: 12000, currency: 'INR', channel: 'bank_transfer', riskScore: 75, riskLevel: 'high', status: 'flagged', hoursBack: 26 },
    { customerId: 'CUST-005', amount: 25000, currency: 'INR', channel: 'wallet', riskScore: 85, riskLevel: 'critical', status: 'blocked', hoursBack: 50 },
    { customerId: 'CUST-002', amount: 8000, currency: 'INR', channel: 'card', riskScore: 60, riskLevel: 'high', status: 'flagged', hoursBack: 74 },
    { customerId: 'CUST-007', amount: 5000, currency: 'INR', channel: 'crypto', riskScore: 70, riskLevel: 'high', status: 'flagged', hoursBack: 98 },
    { customerId: 'CUST-001', amount: 3000, currency: 'INR', channel: 'bank_transfer', riskScore: 45, riskLevel: 'medium', status: 'flagged', hoursBack: 122 },
  ];

  suspicious.forEach((s, idx) => {
    const ts = new Date(); ts.setHours(ts.getHours() - s.hoursBack);
    txDocs.push({
      transactionId: `TXN-SUSP-${String(idx + 1).padStart(3, '0')}`,
      customerId: s.customerId, amount: s.amount, currency: s.currency,
      timestamp: ts, channel: s.channel,
      merchantId: 'MERCH-UNKNOWN', merchantCategory: 'unknown',
      ingestionSource: 'demo', isDemo: true, status: s.status,
      riskScore: s.riskScore, riskLevel: s.riskLevel,
      riskReasons: [
        { rule: 'RULE_HIGH_AMOUNT', score: 30, description: 'Amount exceeds high-value threshold' },
        { rule: 'RULE_NIGHT_TRANSACTION', score: 15, description: 'Transaction at unusual hour (02:00 UTC)' },
      ],
      riskAssessedAt: ts,
      reviewStatus: 'pending_review',
    });
  });

  const insertedTx = await Transaction.insertMany(txDocs);
  console.log(`✓ Seeded ${insertedTx.length} demo transactions`);

  // Seed customers
  for (const customerId of customerIds) {
    const txs = insertedTx.filter(t => t.customerId === customerId);
    const totalAmount = txs.reduce((s, t) => s + t.amount, 0);
    const flaggedCount = txs.filter(t => ['flagged', 'blocked'].includes(t.status)).length;
    const maxRisk = txs.length ? Math.max(...txs.map(t => t.riskScore)) : 0;
    const riskLevel = maxRisk >= 80 ? 'critical' : maxRisk >= 55 ? 'high' : maxRisk >= 25 ? 'medium' : 'low';
    const sorted = [...txs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    await Customer.findOneAndUpdate({ customerId }, {
      customerId, displayName: `Customer ${customerId}`, currency: 'INR',
      transactionCount: txs.length,
      totalTransactionAmount: totalAmount,
      avgTransactionAmount: txs.length ? totalAmount / txs.length : 0,
      flaggedTransactionCount: flaggedCount,
      riskScore: maxRisk, riskLevel,
      lastTransactionAt: sorted[0]?.timestamp || null,
      firstTransactionAt: sorted[sorted.length - 1]?.timestamp || null,
      isDemo: true,
    }, { upsert: true });
  }
  console.log('✓ Seeded 8 customer profiles');

  // Seed alerts
  const suspTxs = insertedTx.filter(t => t.transactionId.startsWith('TXN-SUSP'));
  const alertStatuses = ['open', 'open', 'in_review', 'in_review', 'resolved', 'false_positive'];
  const alertDocs = suspTxs.map((tx, idx) => ({
    alertId: `ALERT-DEMO-${String(idx + 1).padStart(3, '0')}`,
    title: `${tx.riskLevel.toUpperCase()} Risk Transaction: ${tx.transactionId}`,
    description: `Demo alert: ${formatINR(tx.amount)} transaction by ${tx.customerId} triggered detection rules.`,
    severity: tx.riskLevel, status: alertStatuses[idx],
    transactionId: tx._id,
    triggeredRules: tx.riskReasons || [],
    deduplicationKey: `${tx.transactionId}-risk-${tx.riskLevel}`,
    assignedTo: idx < 4 ? analyst._id : null,
    assignedAt: idx < 4 ? new Date() : null,
    resolvedAt: idx >= 4 ? new Date() : null,
    resolvedBy: idx >= 4 ? analyst._id : null,
    isDemo: true,
  }));
  const insertedAlerts = await Alert.insertMany(alertDocs);
  console.log(`✓ Seeded ${insertedAlerts.length} demo alerts`);

  // Seed cases
  const caseDocs = [
    {
      caseId: 'CASE-DEMO-001',
      title: 'Suspected Account Takeover — CUST-003',
      description: 'Multiple high-value transactions via crypto channel following unusual pattern. Customer activity shows significant deviation.',
      priority: 'critical', status: 'in_progress', outcome: null,
      assignedTo: analyst._id, createdBy: admin._id,
      transactions: insertedTx.filter(t => t.customerId === 'CUST-003').slice(0, 3).map(t => t._id),
      alerts: insertedAlerts.slice(0, 2).map(a => a._id),
      notes: [{ author: analyst._id, text: 'Initial review: Customer activity shows significant deviation from historical pattern. Escalating for further investigation.', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }],
      timeline: [
        { event: 'Case created', actor: admin._id, timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
        { event: 'Assigned to analyst', actor: admin._id, timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000) },
        { event: 'Status changed to in_progress', actor: analyst._id, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      ],
      isDemo: true,
    },
    {
      caseId: 'CASE-DEMO-002',
      title: 'Large Transfer Investigation — CUST-005',
      description: `Transaction of ${formatINR(25000)} flagged by multiple detection rules. Customer contacted for verification.`,
      priority: 'high', status: 'resolved', outcome: 'legitimate',
      resolutionNote: 'Transaction confirmed as legitimate business payment after verifying documentation directly with customer.',
      assignedTo: analyst._id, createdBy: admin._id,
      transactions: insertedTx.filter(t => t.customerId === 'CUST-005').slice(0, 1).map(t => t._id),
      alerts: insertedAlerts.slice(2, 3).map(a => a._id),
      notes: [{ author: analyst._id, text: 'Contacted customer. Transaction confirmed as payroll transfer. Closing case as legitimate.', createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) }],
      timeline: [
        { event: 'Case created', actor: admin._id, timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) },
        { event: 'Status changed to resolved', actor: analyst._id, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
        { event: 'Case resolved: legitimate', actor: analyst._id, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
      ],
      resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      isDemo: true,
    },
  ];
  await Case.insertMany(caseDocs);
  console.log('✓ Seeded 2 demo investigation cases');

  console.log('\n========== SEED COMPLETE ==========');
  console.log(`Admin login:    ${adminEmail} / ${adminPassword}`);
  console.log(`Analyst login:  ${analystEmail} / ${analystPassword}`);
  console.log('All demo data is labeled isDemo: true');
  console.log('====================================\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
