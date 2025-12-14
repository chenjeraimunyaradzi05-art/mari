# Athena pillar focus mapping

This document previously captured the member dashboard hero + welcome toast alignment. Those surfaces have been retired, but the underlying pillar config remains for future reuse.

## Files involved

- `config/athena_pillars.php` holds the source-of-truth metadata for:
  - `pillars`: labels, stats, descriptive copy, CTA targets, and interest tags.
  - `signals`: reserved for future use if additional research banners are reintroduced.
  - `micro_panels`: copy/CTAs injected under each dashboard section.
  - `charter_highlights` and `problem_map`: data used by the existing cards.
- `app/Support/AthenaPillarService.php` reads the config, normalises it, and exposes helpers for the controller + Blade partials.
- `app/Services/WelcomeMessageService.php` generates the greeting copy and uses the pillar service to determine a "Today's focus" payload.
- `resources/views/dashboard/partials/*.blade.php` render the hero row, signal strip, welcome toast, and micro-panels.

## Updating or adding pillars

1. Add or adjust an entry inside `config/athena_pillars.php > pillars`.
2. Provide `interest_tags` keywords (lowercase) so the Welcome service can match a member's stored interests + active pathway metadata to the best pillar.
3. Point each `cta`/`focus_cta` to the real workflow routes (e.g. `housing.index`, `jobs.index`, `financial.budget`, `grants.index`) now that those surfaces exist beyond the wishlist.
4. Optional: specify a dedicated `focus_summary` or `focus_cta` if the welcome toast should differ from the hero CTA.
5. Build assets/CSS by targeting `.pillar-card--{slug}` modifiers when adding a new slug.

## Mapping logic overview

- The controller hydrates `AthenaPillarService::focusDetails` with the logged-in user plus their `CareerInterest` records.
- Tokens are derived from `user->interests`, `user->preferences`, and the pathway fields (type, field, industry, category). The first pillar whose `interest_tags` appear in any token wins.
- If nothing matches, the `focus_fallback` key in the config is used.
- The resulting payload (label, stat, summary, CTA) is injected into the welcome toast component so members see why Athena emphasises a given area.

## Micro-panels

- Every dashboard section includes `@include('dashboard.partials.athena-micro-panel', ...)`.
- Update `micro_panels` config entries to change the copy, CTA label, or destination per section. Missing data simply hides the CTA.

Keep this file updated whenever new research pillars, stats, or CTA targets are introduced so future teams can maintain parity between evidence, copy, and UI treatments.
