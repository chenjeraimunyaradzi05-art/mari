# TurboTax Integration — UX Overview

This document outlines UX flows and wireframes for integrating TurboTax into ATHENA. Focus is on a simple, privacy-first experience that connects Formation Studio, Finance Dashboard, Housing Engine and AI assistance.

## Key UX goals
- Minimal friction: users should understand the value and consent quickly
- Persona-aware: show only features relevant to the user's persona (business owner, landlord, employee)
- Privacy & transparency: explicit consent screens and clear visibility of shared data
- Seamless cross-features: tax advice surfaced where decisions are made (Formation Studio, Finance Engine, Housing)

---

## Primary user flows

1) Tax Quick Estimate (one-off)
- Entry points: Finance Dashboard, Formation Studio, Housing property screen
- User clicks “Get tax estimate” → small onboarding modal describing what will be shared, opt-in toggle → estimate results displayed inline

2) Tax Onboarding (connect TurboTax)
- Entry: Settings > Integrations or when using tax features repeatedly
- Steps: consent screen → OAuth flow to authenticate (if using API integration) → preferences (filing vs estimate, share categories) → success confirmation

3) Business Formation tax preview
- Before launching business entity, show expected after-tax cashflow, recommended entity types (with tax pros/cons)
- CTA: "Calculate expected tax" → triggers tax estimate & shows quarterly payment suggestions and category mapping

4) AI Tax Assistant
- AiConcierge integrates tax-aware guidance; when the user asks for taxes, the AI can use estimates (read-only) to explain tax impact

---

## Wireframes
Wireframes are simple, low-fidelity mockups included in the `wireframes/` directory. They can be imported into design tools for higher fidelity.

Files included:
- `docs/integration/ux/wireframes/turbotax-dashboard.svg` — Tax Dashboard (estimate + filing status)
- `docs/integration/ux/wireframes/turbotax-onboarding.svg` — Onboarding / Consent flow
- `docs/integration/ux/wireframes/turbotax-formation-preview.svg` — Formation Studio preview with after-tax income

---

## Accessibility & internationalization
- Use accessible color contrast and large targets
- Make language localizable to support expansions beyond the US

---

## Next steps
- Share these wireframes with product/design for high-fidelity mocks
- Prototype interactions in an internal environment and test with pilot users (e.g., a small cohort of formation users)
