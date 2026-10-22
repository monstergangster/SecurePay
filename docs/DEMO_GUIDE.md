# SecurePay — Local Demonstration & Testing Guide

This guide provides repeatable, evidence-based instructions for running and evaluating the SecurePay Fraud Detection & Investigation Platform locally on Windows PowerShell.

---

## 1. Quick Local Environment Startup

### Terminal 1: Express API Server
```powershell
cd D:\Final\securepay\server
# Verify or create environment file
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Seed deterministic test accounts and initial data
node src/scripts/seed.js
# Start development server on port 5001
npm run dev
```

### Terminal 2: React / Vite Frontend
```powershell
cd D:\Final\securepay\client
# Start Vite development server on port 5173
npm run dev
```

### Terminal 3: Python FastAPI Anomaly Detection Service
```powershell
cd D:\Final\securepay\ml-service
# Train / verify versioned Isolation Forest model
.\.venv\Scripts\python train.py
# Start microservice on port 8001
.\.venv\Scripts\uvicorn main:app --port 8001 --reload
```

---

## 2. Default Test Credentials

All demo accounts are pre-configured with deterministic credentials:

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@securepay.dev` | `Admin@SecurePay2024` | User role creation, heuristic rule weights, raw audit trail, cases |
| **Fraud Analyst** | `analyst@securepay.dev` | `Analyst@SecurePay2024` | Alert queue, evidence review, case outcome resolution |

---

## 3. Step-by-Step Scenario Verification Matrix

### Scenario A: Normal Legitimate Transaction
- **Action:** POST to `/api/v1/transactions` with amount `45.00`, currency `INR`, channel `card`, normal hours.
- **Expected System Outcome:** Heuristic score $\le 20$, risk level `low`, transaction status `approved`, no alert triggered.
- **Verification:** View under **Transactions** list; verify status badge is green.

### Scenario B: High-Value Relative to Customer Baseline
- **Action:** Post transaction for customer `CUST-001` with amount `12,500.00 INR` (exceeding historical mean `150.00 INR`).
- **Expected System Outcome:** Triggers `RULE_HIGH_AMOUNT` (+30) and `AMOUNT_SIGNIFICANT_DEVIATION` (+35). Risk score $\ge 65$ (`high`), transaction marked `flagged`, deduplicated alert created in queue.
- **Verification:** View under **Alerts** queue; title shows `HIGH Risk Alert`.

### Scenario C: Rapid Successive Burst Velocity
- **Action:** Post 4 transactions for the same customer within 10 minutes.
- **Expected System Outcome:** 4th transaction triggers `BURST_VELOCITY_ANOMALY` (+30). Risk elevated, flagged for analyst review.
- **Verification:** Behavioral signals appear under Transaction Detail drawer.

### Scenario D: Monitored Channel & Unusual Hours
- **Action:** Ingest transaction with channel `crypto` at `03:15 UTC`.
- **Expected System Outcome:** Triggers `RULE_SUSPICIOUS_CHANNEL` (+20) and `RULE_NIGHT_TRANSACTION` (+15). Score $\ge 35$ (`medium`).

### Scenario E: Inbound Webhook with Valid HMAC-SHA256 Signature
- **Action:** Use the **Ingestion** tab Simulator or post to `/api/v1/webhooks/receive` with header `X-SecurePay-Signature: t={time},v1={hash}`.
- **Expected System Outcome:** Signature accepted, `WebhookEvent` logged, transaction ingested and assessed. HTTP status `201 Created`.

### Scenario F: Replay / Duplicate Webhook Event
- **Action:** Resend the exact same `eventId` to `/api/v1/webhooks/receive`.
- **Expected System Outcome:** Database idempotency triggers. Returns HTTP `200 OK` with `{ status: "duplicate" }`. No duplicate transaction, alert, or case is created.

### Scenario G: Invalid / Tampered Webhook Signature
- **Action:** Post to `/api/v1/webhooks/receive` with modified payload or invalid signature header.
- **Expected System Outcome:** HTTP `401 Unauthorized` returned with `Webhook signature verification failed`. Zero data persisted.

### Scenario H: Risk Engine Failure / Database Outage Resilience
- **Action:** Risk engine encounters database timeout or unexpected exception.
- **Expected System Outcome:** Engine retries transient errors with backoff. If fatal, transaction is marked `assessmentStatus: "failed"`, `status: "held_for_review"`, and `riskLevel: "unassessed"`. **Strict refusal to default to low risk or 0 score.**

### Scenario I: New Customer with Limited History
- **Action:** Ingest transaction for an unregistered `CUST-999`.
- **Expected System Outcome:** Identified as `NEW_CUSTOMER_BASELINE`. Avoids severe penalty; flags minimal baseline notice without falsely classifying as high risk.

### Scenario J: Fraud Analyst Investigation Workflow
- **Action:**
  1. Open alert from the **Alerts Center**.
  2. Click **Open Investigation Case** (transitions to `/cases/{id}`).
  3. Add investigation finding note.
  4. Update case status from `open` $\rightarrow$ `in_progress` $\rightarrow$ `resolved`.
  5. Select outcome `confirmed_fraud` and enter mandatory resolution note.
- **Expected System Outcome:** State transitions validated by backend state machine; resolution note enforced. Dashboard case metrics update automatically.
