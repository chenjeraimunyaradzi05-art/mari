# ATHENA — TurboTax Integration (Technical Architecture)

## Goal
Add tax preparation and optimization capabilities to the ATHENA platform by integrating TurboTax functionality (via Intuit APIs or a white-label/licensing approach). This doc focuses on a secure API-first integration that keeps ATHENA the primary UX and uses TurboTax for tax computation and filing capabilities.

## Recommended approach
- Primary recommendation: API Integration with Intuit's TurboTax and/or Intuit Developer Platform (fastest path to integrated UX, lower maintenance than white-label).
- Alternative (higher effort): White-label licensing to fully embed TurboTax functionality under ATHENA branding.
- Fastest (lowest effort): Partnership / Referral (link to TurboTax product) — good for initial pilots and revenue share tests.

---

## High-level system diagram

A simple flow:

ATHENA Frontend -> ATHENA Backend -> TurboTax API (via secure gateway) -> Intuit Services

Mermaid diagram:

```mermaid
flowchart LR
  A[ATHENA UI] --> |User actions & data| B[ATHENA Backend]
  B --> |Tax Data Sync| C[Integration Gateway]
  C --> |REST / OAuth 2.0| D[TurboTax API (Intuit)]
  D --> E[TurboTax Engine: calculations, forms, e-file]
  E --> D
  D --> C --> B --> A
  subgraph secure
    C
    D
  end
``` 

---

## Key integration components

1. Authentication & Authorization
   - Use OAuth2 (Intuit supports OAuth2) for per-user authorization; acquire access tokens securely.
   - Treat TurboTax integrations as third-party connectors for each ATHENA member.
   - Provide an admin-level integration (company account) for Company / Employer personas where applicable.

2. Data Mapping & Sync
   - Financial data sources in ATHENA: payroll, invoices, expense tracker, rental income, investment accounts, business formation inputs.
   - Map ATHENA financial entities to TurboTax inputs:
     - W-2 / 1099 income types => TurboTax income categories
     - Business expenses => Schedule C categories
     - Rental income & depreciation => Schedule E
     - Mortgage interest => Schedule A (itemized) or relevant entries
   - Use a normalized intermediate model (ATHENA TaxContext) for robust mapping and replay.

3. Privacy & Security
   - Ensure PII and tax data are encrypted at rest and in transit (TLS + field-level encryption for SSNs, TINs, bank account numbers).
   - Model consent flows and capture explicit user consent statements before sending data to TurboTax.
   - Follow Intuit's developer security requirements and SOC/PCI-like controls where necessary.

4. API gateway & orchestration
   - A small integration microservice (Integration Gateway) will:
     - Normalize ATHENA data into TurboTax API payloads
     - Handle token management & refresh
     - Implement retry, rate limiting and idempotency
     - Log events to an audit trail

5. UX considerations
   - Keep users in ATHENA UI with embedded flows (deep-linked pages or in-app consoles) to maintain consistent experience.
   - Provide contextual tax advice in Formation Studio, Finance Engine, Housing Engine and Life Pathway.
   - Start with read-only tax projections and recommendations (low risk) before enabling e-file.

6. Error handling & reconciliation
   - Maintain a mapping status object for each ATTaxRequest (Pending, SyncFailed, ReadyForReview, Submitted, Filed, Error)
   - Provide rollback semantics and a queue for manual review when automatic transforms fail

---

## Phased implementation (technical)

Phase 0 — Discovery (2–6 weeks)
- Secure Intuit partner POC program or sandbox access
- Confirm required endpoints, API rate limits and data schemas
- Sample dataset mapping

Phase 1 — Pilot (3–6 months)
- Implement Integration Gateway with read-only tax projections
- Build internal mapping & staging tax context
- UX integration for single persona (e.g., Business Owner)
- Security review & approval

Phase 2 — Pilot expansion + e-file (3–6 months)
- Expand persona coverage and mappings
- Implement e-file and payment integrations if permitted by Intuit
- Add consent flows, long-term auditing, and advanced tax planning

Phase 3 — Productization & scale (3–6 months)
- Hardening, performance, observability
- Analytics and aggregated anonymous insights
- Explore white-label or deeper licensing if beneficial

---

## Required Intuit/TurboTax surface (examples)
- OAuth2 for user consent & token issuance
- Endpoints for tax calculation / tax projection
- Endpoints for account data retrieval (if Intuit can store aggregated data or compute)
- Filing endpoints (e-file) with e-signature and payment flows
- Webhooks for status updates (e.g., filing accepted / rejected)

---

## Non-technical considerations
- Contractual commercial agreement with Intuit (API licensing, fees)
- Liability and regulatory compliance for tax advice
- Privacy / Data Residency requirements for tax filing data
- Customer support and dispute handling for tax filings

---

## Next technical deliverables (immediate)
- Minimal Integration Gateway proof-of-concept in a small microservice repository
- Mapping spec between ATHENA entities and TurboTax schema (see mapping templates)
- UX mockups for key flows: "Tax Projection in Formation Studio", "Tax Filing flow (join & file)"

