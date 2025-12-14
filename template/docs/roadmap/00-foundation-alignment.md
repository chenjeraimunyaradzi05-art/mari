# Foundation Alignment & Inventory (0-5%)

## Purpose

- Capture the authoritative product scope defined in `moneyman-v3.0-COMPLETE.md` and supporting bundles (`moneyman-laravel-stubs.zip`, `laravel-social-starter.zip`, `exported-assets.zip`).
- Document current implementation maturity across the four pillars: Recruitment & Social, Education & Apprenticeships, Advertising, Strategic AI.
- Surface the sourced asset inventory (code, data, specifications) and identify owners.
- Establish tracked follow-ups that unblock the 5-10% milestone.

## Canonical Product References

- **Primary PRD:** `moneyman-v3.0-COMPLETE.md` (v3.0 COMPLETE, Oct 31 2025) – end-to-end feature statements, KPIs, verticals, GTM plan.
- **Scoped Stubs:** `moneyman-laravel-stubs.zip` – Laravel 10 controllers/routes/migrations for org pages, courses/intakes, ads.
- **Social Starter:** `laravel-social-starter.zip` – profiles, feeds, reels, AI assist baseline.
- **Phased Build Guides:** `exported-assets.zip` – Phase 1-5 deliverable blueprints (migrations → models → controllers → views → AI services).
- **Legacy Reference:** `dzimba/` – modular Laravel app (nWidart) used for patterns, not yet integrated.

## Implementation Inventory (Nov 07 2025)

- **Recruitment & Social**
  - Web feed & posting flow live via `app/Http/Controllers/Frontend/Social/PostController.php` and `resources/views/frontend/social/*`.
  - Personalized feed scoring implemented in `app/Services/Social/FeedMatcher.php` (recency, sectors, skills, engagement).
  - Missing: dedicated social profiles, follow graph, comment moderation, DM endpoints promised by social starter.
- **Education & Apprenticeships**
  - Org page APIs functional (`app/Http/Controllers/Org/*`, `app/Models/OrganizationPage.php`, `app/Models/Course.php`, `app/Models/ApprenticeshipProgram.php`).
  - Frontend exposure through `resources/views/frontend/org-pages/*` and `routes/web.php` org routes.
  - Missing: intake lifecycle automation, eligibility wizards, subsidy management, analytics dashboards.
- **Advertising Platform**
  - Models/controllers exist for campaigns/creatives/metrics (`app/Models/AdCampaign.php`, `app/Http/Controllers/Frontend/Advertising*`).
  - Missing: pacing, billing, ROI insights, advanced targeting, analytics UI/UX.
- **Strategic AI & Trust**
  - Numerous placeholder services in `app/Services/*` (e.g., `AIContentService` absent, `MediaUploadService` empty).
  - No active AI integrations, moderation pipelines, or trust scoring.
- **Infrastructure & Tooling**
  - Monolithic Laravel app rooted at `app/`, current decision is to remain monolithic through 30-40% of roadmap.
  - Supporting assets: Docker, Tailwind, PostCSS, stylelint outputs. Observability and real-time tooling placeholders, not wired.

## Key Stakeholders & Owners

- **Product Strategy:** Founder/Leadership (PRD authority) – confirm validation cadence for roadmap increments.
- **Engineering Lead:** (You) – coordinates implementation sequencing, code reviews, releases.
- **Design/UX:** Pending confirmation – required before 40-60% milestone (frontend polish).
- **AI/ML Partner:** TBD – needed to operationalise Phase 4.
- **Compliance & Trust:** TBD – align before 80-95% hardening.

## Open Questions (Blockers for 5-10%)

1. Finalise acceptance criteria for 5-10% milestone (schema reconciliation + migration clean-up).
2. Confirm data migration strategy for existing production datasets (if any) before schema adjustments.
3. Identify design owner for social profile screens planned in 25-30% milestone.
4. Decide analytics stack (in-house vs third-party) to avoid rework in 20-40% phases.

## Next Actions

- Schedule alignment session with stakeholders to review this inventory and validate the 5-95% roadmap slices.
- Prepare migration audit checklist ahead of the 5110% milestone (to be tracked in `docs/roadmap/05-schema-harmonisation.md`).
- Maintain this document as the single source of truth for foundational alignment updates.
