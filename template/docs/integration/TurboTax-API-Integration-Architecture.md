# TurboTax API Integration — Technical Architecture

## Overview
This document outlines a recommended technical architecture for integrating TurboTax (Intuit) into the ATHENA platform via API. It covers data flows, endpoints, security considerations, consent & privacy, error handling, and a suggested proof-of-concept (POC) service scaffold.

---

## High-level architecture
1. ATHENA UI (frontend) — presents tax dashboards, helpers and UI for tax flows
2. Backend integration service (ATHENA) — validates and transforms financial data, enforces consents, calls TurboTax APIs
3. TurboTax API (3rd-party) — performs tax calculations, UX for filing (if permitted) and returns analysis
4. Data store / audit logs — storing only permitted data, retention policies maintained

---

## Data flow
1. User triggers tax calculation (e.g., during formation flow, Finance Engine review)
2. Frontend requests a tax estimate from ATHENA backend
3. Backend collects user financial inputs (income streams, expenses, entity type), validates consent
4. Backend transforms data and posts to TurboTax API via secure channel
5. TurboTax returns tax estimates, filing recommendations, and required forms
6. Backend stores minimal results and displays them to user in ATHENA
7. For tax filing (if enabled) backend orchestrates deeper data exchange or redirects to TurboTax filing workflow

---

## API contract & endpoints (example)
- POST /api/integrations/turbotax/estimate
  - Purpose: Return a tax estimate based on provided financial payload
  - Input: JSON payload (user id, year, income sources, filing status, entity type, deduction categories)
  - Output: Estimated tax liability, recommended actions, itemized guidance

- POST /api/integrations/turbotax/submit
  - Purpose: Submit a filing-ready payload (opted-in users) to TurboTax or to queue for review
  - Input: full JSON payload + consent flags
  - Output: Filing ticket reference, next steps

- POST /api/integrations/turbotax/webhooks
  - Purpose: Receive asynchronous notifications from TurboTax (filing status, payment confirmations)
  - Input: Signed webhook payload
  - Output: 200 OK

---

## Authorization & security
- Use OAuth 2.0 for Intuit integration (client_id / secret, with rotating tokens)
- All API calls must use TLS 1.2+ and strict certificate validation
- Store tokens using vault or encrypted storage (never in plain .env in production)
- Minimal data principle: only share required fields after explicit opt-in
- Use signed webhooks and validate signature headers
- Audit logs for access and any data transmissions (who, what, when)

---

## Consent & UX considerations
- Explicit consent screen before exporting any financial or PII data to TurboTax
- Separate toggles for "estimate only" vs "submit filing"
- Clear privacy disclaimers and contact info for support

---

## Error handling & retry
- Use idempotent request tokens (client-provided idempotency keys) when submitting filings
- Exponential backoff for transient errors (429, 5xx)
- Write errors to a monitored queue and a retry backoff system

---

## Data retention & PII minimization
- Keep only derivable results (estimates, diagnostic codes) and the minimum payload required for UX
- Mask SSNs and other fully PII values in persisted logs
- Retention policies and direct-delete option on account deletion

---

## POC scope — recommended steps
1. Add a lightweight service class in ATHENA that can make an authenticated request to an Intuit sandbox endpoint (test only)
2. Add endpoints for `estimate` and `submit` with feature flags and dry-run only in the first iteration
3. Ensure UI flows work for the formation studio and finance dashboard integrations
4. Introduce data consent acceptance and capture before any data leaves ATHENA

---

## Example environment variables
- INTUIT_CLIENT_ID
- INTUIT_CLIENT_SECRET
- INTUIT_ENVIRONMENT (sandbox|production)
- INTUIT_API_BASE
- TURBOTAX_INTEGRATION_FEATURE_FLAG

---

## Files to add for POC
- `app/Services/Financial/TurboTaxIntegrationService.php` (service wrapper)
- `app/Http/Controllers/Api/Integration/TurboTaxController.php` (endpoints: estimate, submit, webhook)
- API route entries under `routes/api.php` or the integrations route group
- Unit tests and integration test harness that can be toggled with mock providers

---

Next: create a lightweight service class and controller stubs in the codebase as a proof-of-concept scaffold. Then we will create UX mockups and a financial model.
