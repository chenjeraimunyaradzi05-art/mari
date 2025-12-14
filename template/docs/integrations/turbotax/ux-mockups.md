# TurboTax Integration — UX Mockups & Flow Descriptions

This document contains in-ATHENA UX wireframes and flow descriptions for two prioritized flows:
1. Tax Projection inside Formation Studio (read-only projection and recommendations)
2. Filing flow (sandbox) — draft review and e-file (phase 2 / optional)

---

## 1) Tax Projection — Formation Studio

Purpose: Let a user see the *after-tax* picture while creating their business (one-click projections using TurboTax integration). This is read-only at first (no e-file) and focuses on tax optimization recommendations.

Wireframe (simplified)

[Formation Studio] —> [Business Financials] —> [Tax Projection Card]

Tax Projection Card
-------------------
+---------------------------------------------+
| Business Name | Buttons: [Edit] [Invite CPA] |
|---------------------------------------------|
| Annual Revenue: $80,000                      |
| Est. Business Deductions: $15,200           |
| ------------------------------------------- |
| Estimated Tax Liability: $9,120 (15% est)   |
| Estimated After-Tax Income: $55,680         |
| Small CTA: [View Full Tax Breakdown]        |
+---------------------------------------------+

Full Tax Breakdown (modal)
- Pie chart showing income vs deductions
- Line items (W-2, 1099, Business income, rental income)
- Actionable suggestions (e.g., "Consider S-Corp election to reduce self-employment tax")
- Buttons: [Simulate Different Structure] [Save as Draft] [Start Filing (when allowed)]

Key UX behaviors
- Auth: During first-time setup, request TurboTax OAuth consent (explain data shared + purpose)
- Loading: show "Running Projection..." spinner while gateway communicates with TurboTax sandbox
- Errors: show friendly guidance to retry or pre-fill manually

---

## 2) Filing Flow (Sandbox) — Draft & e-file

Purpose: Provide a safe, guided filing experience using TurboTax engine (phase 2 pilot). Start with a draft return and let users review and optionally e-file in sandbox before moving to production.

High-level steps
1. User connects TurboTax (OAuth) and consents to share ATHENA financial data
2. User requests a draft return to be created in TurboTax (via Integration Gateway)
3. Gateway returns draft_id + summary → show "Draft ready for review" in UI
4. User opens a secure Draft Review screen showing all forms and breakdowns
5. User can edit values in ATHENA to correct data, then re-run projection and update draft
6. When satisfied, user chooses "File Return" — e-file steps: e-sign, payment method, final confirmation
7. TurboTax webhooks update filing status back into ATHENA (Submitted → Accepted/Rejected)

Draft Review Screen Wireframe (simplified)
+--------------------------------------------+
| Return Draft — 2025 (Draft ID: ABC123)     |
| Status: Ready for review                    |
|--------------------------------------------|
| Summary: Estimated Tax: $9,120 (see breakdown) |
| Forms Available: 1040, Schedule C            |
| [Edit in ATHENA] [Download PDF] [File Return] |
+--------------------------------------------+

When e-file is selected
- Present a secure e-sign screen (capture consent & signature)
- Show payment options (if fees apply)
- Confirm submission and show a tracking page (with webhook-fed status updates)

Accessibility & Privacy
- Mask SSNs, show partial numbers in UI.
- Provide clear legal disclaimers: not legal / tax advice, encourage professional advice.

---

## Design notes & developer handoff
- Provide sample JSON payloads for TaxContext in the Integration Gateway README (done in code POC).
- Mock data for UI testing: include sample W-2, 1099, Schedule C data in fixtures.
- Track events: user_connected_turbotax, tax_projection_requested, draft_created, return_submitted


