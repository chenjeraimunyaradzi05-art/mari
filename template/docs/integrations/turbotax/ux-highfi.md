# TurboTax Integration — High-Fidelity UX & Acceptance Criteria

This document defines Figma-ready mockups and detailed acceptance criteria for two primary flows:
1. Tax Projection card & modal inside Formation Studio (Phase 1)
2. Draft Review + Filing flow (Phase 2 — sandbox/e-file)

Design tokens & assets
- Colors: use ATHENA primary palette — Blue (#0057D9), Accent (#FFC857), Neutral greys
- Typography: System fonts, sizes 14/16/20 for body/title
- Icons: small tax/finance icons for quick recognition

Export checklist for handoff
- Each screen should be exported as 1440px wide artboards
- Export components: Tax Projection Card, Projection Breakdown modal, Draft Review screen, E-Sign panel
- Provide JSON fixture data for each view so devs can implement UI states

---

## Flow 1 — Tax Projection (Formation Studio)

Screens
1. Formation Studio → Business Financials page → Tax Projection Card (compact)
2. Projection modal (full) showing detailed breakdown and toggles

States
- Loading: "Running projection..." spinner while gateway responds
- Connected: shows summary and CTA to open modal
- Not connected: shows CTA "Connect TurboTax" with quick benefits
- Error: friendly error and option to view manual entry form

Acceptance criteria
- [ ] Projection Card shows `Estimated Tax Liability`, `After-Tax Income`, and `View Full Tax Breakdown` CTA
- [ ] When `View Full Tax Breakdown` is opened, the modal displays a by-category breakdown (Income, Deductions, Rental, Business)
- [ ] User can toggle simulated business structure (Sole Proprietor / LLC / S-Corp) and see a re-run of projection (client-side recalculation call)
- [ ] Initial connection opens OAuth flow in a secure in-app modal; after success, the card changes from "Not connected" to "Connected"
- [ ] Sensitive values (SSNs) are masked in the UI; only last 4 digits shown
- [ ] All screens pass accessibility (contrast, keyboard navigation, aria labels)

Sample JSON fixture (compact)
```
{
  "business_name": "Jane Consulting",
  "annual_revenue": 80000,
  "deductions": 15200,
  "estimated_tax": 9120,
  "after_tax_income": 55680
}
```

---

## Flow 2 — Draft Review & Filing (Sandbox)

Screens
- Draft List (shows any Drafts created)
- Draft Review (stepper: Summary → Forms → Signature & Payment → Confirmation)
- Filing Tracking (status updates from webhooks)

Acceptance criteria
- [ ] Draft Review page lists forms included in the return (1040, Schedule C, Schedule E)
- [ ] User can edit fields that map back to ATHENA (e.g., business income, expenses) and re-run projection which updates the draft
- [ ] "File Return" flow includes e-sign modal and payment steps (mocked in sandbox). After file submission, the UI shows a tracking view with status updates (Submitted, Accepted, Rejected)
- [ ] Webhook updates are processed and reflected in the user's Draft status within 30s in the POC (mocked)
- [ ] Legal & consent language appears before final submit; user must explicitly consent to data transfer to Intuit

Events & telemetry
- user_connected_turbotax
- tax_projection_requested
- tax_projection_viewed
- draft_created
- return_submitted
- return_status_updated

Developer handoff notes
- Use the JSON fixtures in `docs/integrations/turbotax/fixtures` (create sample fixtures) to populate Storybook stories
- Provide dark & light theme variants
- Build an accessible modal wrapper for OAuth flows

