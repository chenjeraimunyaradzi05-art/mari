# TurboTax Integration — Financial Model Notes

This file outlines the assumptions used in the CSV model and the four revenue approaches explored:

Scenarios modeled:
- Freemium / upgrade to premium
- Subscription add-on (e.g. annual tax add-on or unlimited filings)
- Per-filing fee (one-off fee when filing through ATHENA)
- Referral / affiliate revenue share when routing users to TurboTax

Primary assumptions in the CSV (example):
- Active users: total ATHENA monthly active users in year
- Tax feature adoption: percent of users who use tax features in a year
- Premium conversion: percent of adopters who buy an ATHENA premium tax product
- Premium price: small annual charge (e.g. $19.99)
- Subscription add-on: larger subscription add-on e.g. $49.99 / year
- Per-filing: per-filing user base (counts) and per-filing price (blocked revenue)
- Referral: percentage that are referred and a small commission per conversion
- Costs: include licensing and dev & ops for integration

These numbers are illustrative. Next iterative steps:
1. Replace assumptions with real ATHENA user metrics and retention numbers
2. Run sensitivity analysis: vary adoption and conversion rates
3. Model gross margins after handling support and payments costs
4. Build a 3-statement model if this moves to a commercial feasibility stage

If you'd like, I can export a ready spreadsheet (XLSX) with formulas for scenario analysis and sensitivity charts.
