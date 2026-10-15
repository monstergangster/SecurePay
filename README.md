# SecurePay — Enterprise Digital Payment Fraud Detection & Investigation Platform

SecurePay is a production-minded digital payment risk monitoring and fraud investigation platform built for payment operations and compliance teams.

---

## Architecture Overview

```
securepay/
├── client/           # React 19 + Vite + Tailwind CSS + Recharts + React Router
├── server/           # Node.js + Express + MongoDB + Mongoose + JWT + Helmet
├── ml-service/       # Python 3.11+ FastAPI (Feature Extraction & ML Integration)
└── README.md         # Windows PowerShell Local Execution Guide
```

- **Frontend:** Runs on `http://localhost:5173`
- **Backend API:** Runs on `http://localhost:5000` (API base: `/api/v1`)
- **ML & Feature Service:** Runs on `http://localhost:8001`
- **Database:** MongoDB at `mongodb://127.0.0.1:27017/securepay`

---

## Seed Accounts & Credentials

The database seed provides two pre-configured roles with deterministic hashed credentials:

| Role | Email | Password | Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@securepay.dev` | `Admin@SecurePay2024` | User management, rule weights, audit trail, full case access |
| **Fraud Analyst** | `analyst@securepay.dev` | `Analyst@SecurePay2024` | Transaction monitoring, alert reviews, case notes, outcome filing |

---

## Currency Policy and Existing-Data Migration

SecurePay accepts and stores new transaction amounts in INR only. Transaction imports and webhooks must identify INR, and amounts must be finite, positive, and have at most two decimal places. Monetary values in the client use Indian grouping and INR formatting.

Existing records with a non-INR or missing currency are not relabeled or converted automatically. Back up MongoDB, obtain authoritative conversion rates for every recorded source currency, and create a JSON rates file containing those approved numeric rates. Preview the migration first:

```powershell
cd D:\Final\securepay
node server\src\scripts\migrate-currency-to-inr.js --rates path\to\approved-rates.json
```

Review the transaction-level preview and rates, then apply the conversion:

```powershell
node server\src\scripts\migrate-currency-to-inr.js --rates path\to\approved-rates.json --apply
```

The migration records each original amount, source currency, approved conversion rate, and conversion timestamp on its transaction, writes an audit entry, preserves transaction IDs and relationships, and recomputes customer monetary totals. It refuses missing currencies, invalid amounts, and missing/invalid rates; it never supplies an exchange rate itself. Review/reassess existing risk outcomes against INR thresholds before operational use.

Until migration is applied, legacy transaction amounts retain their recorded source currency. The client labels those amounts "INR conversion required" instead of displaying them as rupees, and INR dashboard/report totals are withheld while non-INR transactions remain.

---

## Windows PowerShell Setup & Local Run Guide

### 1. Prerequisites
Ensure you have installed:
- **Node.js** v18.20+, v20.x, v22.x, or v24.x (compatible with Vite and modern ECMAScript modules)
- **MongoDB Community Server** running locally on port 27017 (`net start MongoDB` or service)
- **Python 3.11+** with `pip` and virtual environment support (scikit-learn 1.4.1.post1)

---

### 2. Backend Server Setup
Open a PowerShell terminal:
```powershell
cd D:\Final\securepay\server

# Copy environment variables (or verify .env exists)
Copy-Item .env.example .env

# Install backend dependencies
npm install

# Seed demo rules, users, transactions, and cases
node src/scripts/seed.js

# Start backend in development mode
npm run dev
# Server will be listening on http://localhost:5000
```

---

### 3. Frontend Client Setup
Open a second PowerShell terminal:
```powershell
cd D:\Final\securepay\client

# Install frontend dependencies (with legacy peer resolution for React 19)
npm install --legacy-peer-deps

# Start Vite dev server
npm run dev
# Frontend will be live on http://localhost:5173
```

---

### 4. Risk & ML Microservice Setup (Optional / Complementary)
Open a third PowerShell terminal:
```powershell
cd D:\Final\securepay\ml-service

# Create and activate Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Start FastAPI risk service
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
# Interactive API docs: http://localhost:8001/docs
```

---

## Running Automated Tests
Run server-side unit and integration tests:
```powershell
cd D:\Final\securepay\server
npm test
```

Run Python ML feature extraction & Isolation Forest inference tests:
```powershell
cd D:\Final\securepay\ml-service
.\.venv\Scripts\python test_ml.py
```

---

## Clean Packaging Guidelines
When archiving or creating submission ZIP bundles:
- **Strictly Exclude:** `node_modules/`, `.venv/`, `venv/`, `coverage/`, `dist/`, `*.log`, and actual `.env` files containing environment secrets.
- **Strictly Retain:** All source code, configuration files, `package-lock.json`, `requirements.txt`, and clean `.env.example` templates.

---

## Key Features

1. **Deterministic Risk Scoring:**
   - Multi-signal explainable heuristic weights (High Amount, Velocity Bursts, Foreign Currency, Monitored Channels, Unusual Night Hours).
   - Dynamic threshold configuration manageable by Administrators.
2. **Alert Deduplication:**
   - Unique hash keys prevent duplicate alerts for the same transaction event.
3. **Structured Investigation Workflow:**
   - Open $\rightarrow$ In Progress $\rightarrow$ Escalated $\rightarrow$ Resolved.
   - Requires documented resolution notes for confirmed outcomes (`confirmed_fraud`, `legitimate`, `inconclusive`).
4. **Audit Trail:**
   - Every login, role change, rule edit, and manual transaction creation is immutably logged with actor, action, timestamp, and IP.
5. **Batch Ingestion:**
   - Validated CSV parsing with duplicate detection, header validation, and transaction simulator.
