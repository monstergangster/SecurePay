# SecurePay UI/UX Redesign — Feature Preservation Checklist

Audit baseline before interface changes. Mark an item complete only after verifying the
corresponding existing workflow remains available and uses the existing API.

## Shared application

- [ ] Keep all current routes and direct links working.
- [ ] Keep authentication, session refresh, logout, and role-protected routes.
- [ ] Keep responsive sidebar navigation and active-route indication.
- [ ] Keep global notifications, keyboard-accessible controls, and meaningful loading,
  empty, and error states.
- [ ] Preserve dark navy styling and meaningful severity/status colors.

## Monitor

- [ ] Command Center: dashboard analytics, API/database/ML health, transactions,
  priority alerts, refresh, transaction status action, and INR/currency caveats.
- [ ] Transactions: search, supported filters, pagination, create/import-related
  actions, transaction list and detail links.
- [ ] Transaction detail: risk assessment, behavioral and ML evidence, rule results,
  related alert/case links, status actions, and case creation.
- [ ] Threat Center: alert search, severity/status filters, pagination, dashboard
  summary, alert details, status updates, analyst notes, and case creation.
- [ ] Alert detail: linked transaction/case, evidence, lifecycle actions, notes, and
  graceful invalid/missing ID and API-error handling.

## Investigate

- [ ] Cases: list, search/filter/pagination, case creation, and status workflow.
- [ ] Case detail: linked alerts/transactions, assignment/status/outcome updates,
  notes, timeline/audit details, and persisted changes.
- [ ] Customers: search, pagination, customer detail navigation, and transaction
  history.
- [ ] Customer detail: real customer statistics, risk assessment, history, and alerts.

## Insights

- [ ] Behaviour Analytics: dashboard/risk/case analytics, date-range controls, charts,
  report export, and currency limitations.
- [ ] Rules: admin-only listing and rule edits persisted through the existing API.

## System

- [ ] Data Import: upload validation, CSV import result accounting, duplicate and row
  errors, and webhook simulation.
- [ ] Audit Logs: admin-only, read-only, searchable/filterable/paginated history.
- [ ] Users: admin-only create/list/activate/deactivate and role controls.
- [ ] Settings: profile display and password change; never expose secrets.

## Access and data integrity

- [ ] Keep analyst/admin authorization and backend-enforced permissions.
- [ ] Do not replace API-backed data with static or success-shaped fallback data.
- [ ] Keep financial values and risk decisions sourced from the backend.
- [ ] Verify the main form, search, filter, pagination, detail, and persistence actions.
