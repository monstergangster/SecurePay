require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../index');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');
const Case = require('../models/Case');
const WebhookEvent = require('../models/WebhookEvent');

async function runE2E() {
  console.log('=== STARTING SECUREPAY END-TO-END VERIFICATION ===\n');

  // Step 0: Ensure DB connection
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/securepay';
    console.log(`Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
  }

  // Ensure Admin User exists
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@securepay.dev';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@SecurePay2024';
  let admin = await User.findOne({ email: adminEmail }).select('+password');
  if (!admin) {
    console.log('Creating Admin User for E2E...');
    admin = await User.create({
      name: 'System Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });
  }

  // Step 1: Authentication
  console.log('1. Testing Authentication (/api/v1/auth/login)...');
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: adminEmail, password: adminPassword });

  if (loginRes.status !== 200 || !loginRes.body.data?.token) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.body)}`);
  }
  const token = loginRes.body.data.token;
  console.log('   ✓ Admin login successful. JWT token received.');

  const analystLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: process.env.SEED_ANALYST_EMAIL || 'analyst@securepay.dev',
      password: process.env.SEED_ANALYST_PASSWORD || 'Analyst@SecurePay2024',
    });
  if (analystLogin.status !== 200 || !analystLogin.body.data?.token) {
    throw new Error(`Analyst login failed (${analystLogin.status}).`);
  }
  const analystAdminRoute = await request(app)
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${analystLogin.body.data.token}`);
  if (analystAdminRoute.status !== 403) {
    throw new Error(`Expected analyst access to administrator route to be denied; received ${analystAdminRoute.status}.`);
  }
  console.log('   ✓ Analyst access to administrator-only user management was denied.');

  // Step 2: CSV Batch Ingestion & Risk Assessment
  console.log('\n2. Testing CSV Transaction Ingestion & Assessment (/api/v1/imports/csv)...');
  const testTxIdHigh = `TXN-E2E-HIGH-${Date.now()}`;
  const testTxIdNorm = `TXN-E2E-NORM-${Date.now()}`;
  const csvData = [
    'transactionId,customerId,amount,currency,channel,timestamp',
    `${testTxIdNorm},CUST-E2E-1,150.00,INR,card,2026-10-13T10:00:00Z`,
    `${testTxIdHigh},CUST-E2E-2,25000.00,INR,crypto,2026-10-13T03:30:00Z`,
  ].join('\n');

  const importRes = await request(app)
    .post('/api/v1/imports/csv')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from(csvData), 'e2e_transactions.csv');

  if (importRes.status !== 200 || importRes.body.data?.summary?.accepted < 2) {
    throw new Error(`CSV Import failed (${importRes.status}): ${JSON.stringify(importRes.body)}`);
  }
  console.log(`   ✓ CSV imported successfully: ${importRes.body.data.summary.accepted} transactions accepted.`);

  const retryCsv = [
    'transactionId,customerId,amount,currency,channel,timestamp',
    `${testTxIdNorm},CUST-E2E-1,150.00,INR,card,2026-10-13T10:00:00Z`,
    `TXN-E2E-INVALID-${Date.now()},CUST-E2E-3,1.001,INR,card,2026-10-13T10:00:00Z`,
  ].join('\n');
  const retryImportRes = await request(app)
    .post('/api/v1/imports/csv')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from(retryCsv), 'e2e_retry_transactions.csv');
  const retrySummary = retryImportRes.body.data?.summary;
  if (
    retryImportRes.status !== 200
    || retrySummary?.duplicates !== 1
    || retrySummary?.invalid !== 1
    || retrySummary?.rejected !== 2
    || retrySummary?.errors?.length !== 2
  ) {
    throw new Error(`CSV duplicate and invalid-row handling failed (${retryImportRes.status}).`);
  }
  console.log('   ✓ CSV retry reports duplicate and invalid rows without duplicating data.');

  // Step 3: Verify Transactions & Risk Assessment
  console.log('\n3. Verifying Ingested Transactions in Database...');
  const highTx = await Transaction.findOne({ transactionId: testTxIdHigh });
  if (!highTx) throw new Error('High risk transaction not found in DB');
  console.log(`   ✓ High-risk transaction found: Score=${highTx.riskScore}, Level=${highTx.riskLevel}, Status=${highTx.status}`);
  if (highTx.riskScore < 55) throw new Error(`Expected high risk score (>=55), got ${highTx.riskScore}`);

  const alertSearchRes = await request(app)
    .get(`/api/v1/alerts?search=${encodeURIComponent(testTxIdHigh)}&severity=critical&status=open&page=1&limit=1`)
    .set('Authorization', `Bearer ${token}`);
  if (
    alertSearchRes.status !== 200
    || alertSearchRes.body.data?.length !== 1
    || alertSearchRes.body.meta?.page !== 1
    || alertSearchRes.body.meta?.limit !== 1
  ) {
    throw new Error('Alert search, severity/status filters, or pagination failed.');
  }
  console.log('   ✓ Alert search, severity/status filters, and pagination returned the expected record.');

  const invalidAlertRes = await request(app)
    .get('/api/v1/alerts/not-a-valid-id')
    .set('Authorization', `Bearer ${token}`);
  if (invalidAlertRes.status !== 400) {
    throw new Error(`Expected invalid alert ID to return HTTP 400, received ${invalidAlertRes.status}.`);
  }
  console.log('   ✓ Invalid alert IDs return a client error instead of a server error.');

  // Step 4: Verify Alert Generation
  console.log('\n4. Verifying Alert Generation for Flagged Transaction...');
  const alert = await Alert.findOne({ transactionId: highTx._id });
  if (!alert) throw new Error('Expected alert was not generated for high-risk transaction');
  console.log(`   ✓ Alert found: ID=${alert.alertId}, Severity=${alert.severity}, Title="${alert.title}"`);

  // Step 5: Case Creation & Investigation Workflow
  console.log('\n5. Testing Case Investigation Workflow (/api/v1/cases)...');
  const caseRes = await request(app)
    .post('/api/v1/cases')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Investigation: Suspicious Crypto Velocity for ${highTx.customerId}`,
      description: 'E2E automated investigation case created from high-risk alert',
      priority: 'high',
      alertId: alert._id.toString(),
      transactionIds: [highTx._id.toString()],
    });

  if (caseRes.status !== 201 || !caseRes.body.data?._id) {
    throw new Error(`Case creation failed (${caseRes.status}): ${JSON.stringify(caseRes.body)}`);
  }
  const caseId = caseRes.body.data._id;
  console.log(`   ✓ Case created: ID=${caseRes.body.data.caseId}, Priority=${caseRes.body.data.priority}`);

  // Add Case Note
  const noteRes = await request(app)
    .post(`/api/v1/cases/${caseId}/notes`)
    .set('Authorization', `Bearer ${token}`)
    .send({ text: 'Customer confirmed unauthorized transaction from unusual location.', isInternal: true });
  if (noteRes.status !== 200) throw new Error(`Add note failed: ${JSON.stringify(noteRes.body)}`);
  console.log('   ✓ Analyst investigation note recorded on timeline.');

  // Resolve Case with Confirmed Fraud Outcome
  const resolveRes = await request(app)
    .put(`/api/v1/cases/${caseId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      status: 'resolved',
      outcome: 'confirmed_fraud',
      resolutionNote: 'Card compromised; merchant notified and customer reimbursed.',
    });
  if (resolveRes.status !== 200 || resolveRes.body.data.outcome !== 'confirmed_fraud') {
    throw new Error(`Case resolution failed: ${JSON.stringify(resolveRes.body)}`);
  }
  console.log(`   ✓ Case resolved with outcome "${resolveRes.body.data.outcome}".`);

  // Step 6: CSV Report Export
  console.log('\n6. Testing Report Export (/api/v1/reports/transactions/export)...');
  const exportRes = await request(app)
    .get('/api/v1/reports/transactions/export')
    .set('Authorization', `Bearer ${token}`);

  if (exportRes.status !== 200 || !exportRes.text.includes('"Transaction ID","Customer ID","Amount"')) {
    throw new Error(`Report export failed (${exportRes.status})`);
  }
  console.log(`   ✓ Transaction CSV export successful (${exportRes.text.split('\n').length} rows exported).`);

  // Step 7: Webhook Signature Verification & Stale Event Recovery
  console.log('\n7. Testing Secure Webhook Ingestion & Stale Event Recovery (/api/v1/webhooks/receive)...');
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.DEV_WEBHOOK_SECRET;
  const webhookEventId = `EVT-E2E-${Date.now()}`;
  const webhookPayload = {
    eventId: webhookEventId,
    eventType: 'payment.completed',
    data: {
      transactionId: `TXN-WB-E2E-${Date.now()}`,
      customerId: 'CUST-WB-E2E',
      amount: 12500.0,
      currency: 'INR',
      channel: 'crypto',
      timestamp: new Date().toISOString(),
      merchantId: 'MERCH-99',
    },
  };

  const rawPayload = JSON.stringify(webhookPayload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawPayload}`)
    .digest('hex');

  const webhookRes = await request(app)
    .post('/api/v1/webhooks/receive')
    .set('X-Provider', 'simulator')
    .set('X-SecurePay-Signature', `t=${timestamp},v1=${signature}`)
    .set('Content-Type', 'application/json')
    .send(webhookPayload);

  if (![200, 201].includes(webhookRes.status) || !webhookRes.body.success) {
    throw new Error(`Webhook ingestion failed (${webhookRes.status}): ${JSON.stringify(webhookRes.body)}`);
  }
  console.log(`   ✓ Inbound webhook processed and transaction assessed (HTTP ${webhookRes.status}).`);

  // Test Webhook Deduplication
  const duplicateRes = await request(app)
    .post('/api/v1/webhooks/receive')
    .set('X-Provider', 'simulator')
    .set('X-SecurePay-Signature', `t=${timestamp},v1=${signature}`)
    .set('Content-Type', 'application/json')
    .send(webhookPayload);

  if (duplicateRes.status !== 200 || duplicateRes.body.data?.status !== 'duplicate') {
    throw new Error(`Webhook deduplication failed (${duplicateRes.status}): ${JSON.stringify(duplicateRes.body)}`);
  }
  console.log('   ✓ Idempotent deduplication verified: duplicate webhook safely ignored.');

  const invalidWebhookPayload = {
    eventId: `EVT-E2E-INVALID-${Date.now()}`,
    eventType: 'payment.completed',
    data: {
      transactionId: `TXN-WB-INVALID-${Date.now()}`,
      customerId: 'CUST-WB-E2E',
      amount: 12500,
      currency: 'INR',
      channel: 'crypto',
      timestamp: new Date().toISOString(),
    },
  };
  const invalidWebhookRes = await request(app)
    .post('/api/v1/webhooks/receive')
    .set('X-Provider', 'simulator')
    .set('X-SecurePay-Signature', `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`)
    .set('Content-Type', 'application/json')
    .send(invalidWebhookPayload);
  if (invalidWebhookRes.status !== 401) {
    throw new Error(`Expected tampered webhook to be rejected, received ${invalidWebhookRes.status}.`);
  }
  if (await Transaction.exists({ transactionId: invalidWebhookPayload.data.transactionId })) {
    throw new Error('Invalid webhook unexpectedly persisted a transaction.');
  }
  console.log('   ✓ Invalid webhook signature rejected without persisting a transaction.');

  const dashboardRes = await request(app)
    .get('/api/v1/analytics/dashboard')
    .set('Authorization', `Bearer ${token}`);
  const actualTransactionCount = await Transaction.countDocuments();
  if (
    dashboardRes.status !== 200
    || dashboardRes.body.data?.summary?.totalTx !== actualTransactionCount
  ) {
    throw new Error('Dashboard transaction count does not match persisted transactions.');
  }
  console.log('   ✓ Dashboard transaction count matches MongoDB records.');

  console.log('\n=== ALL END-TO-END VERIFICATION FLOWS COMPLETED SUCCESSFULLY ===');
}

runE2E()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nE2E VERIFICATION FAILED:', err.message);
    process.exit(1);
  });
