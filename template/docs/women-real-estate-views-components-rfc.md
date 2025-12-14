# Women Real Estate Platform — Views & UI Component RFC (Step 09)

## 1. UI Design Principles

- **Women-First Experience**: warm, empowering visuals (soft gradients, accessible typography) while maintaining professional credibility.
- **Trust & Safety Visibility**: verified badges, safety commitments, and transparent policies front-and-center.
- **Modular Components**: reusable Blade and Livewire components with Tailwind utility classes and design tokens.
- **Performance & Accessibility**: lazy loading media, ARIA semantics, WCAG 2.1 AA compliance, keyboard-first navigation.

## 2. Layout Strategy

- Base layout `resources/views/women-real-estate/layouts/app.blade.php` extending primary app shell with custom top-nav, sub-navigation, and announcement bar.
- Dashboard layout `layouts/dashboard.blade.php` with collapsible sidebar, metric header, and widget grid.
- Agent, learner, and partner dashboards reuse shared layout with persona-specific accent colors and card sets.

## 3. Component Library

| Component | Purpose | Notes |
| --- | --- | --- |
| `x-women.badge` | Verified badges, trust labels | Supports variants (agent, safe-space, partner). |
| `x-women.metric-card` | KPI display | Animated counts, sparkline integration. |
| `x-women.listing-card` | Listing summary | Gallery carousel, AI highlights, audience tags. |
| `x-women.mortgage-widget` | Repayment + AI insights | Sliders for deposit, frequency; includes disclaimers. |
| `x-women.goal-tracker` | Savings/progress visual | Circular progress, milestone timeline. |
| `x-women.partner-card` | Collaboration invite | Match score badge, call-to-action buttons. |
| `x-women.feed-post` | Social feed entry | Video support, reactions, share controls. |
| `x-women.cohort-panel` | Cohort overview | Mentor list, upcoming events. |
| `x-women.modal` | Reusable modal | Accessible focus traps, Livewire compatible. |
| `x-women.toast` | Notifications | Works with Alpine.js for auto-dismiss. |

## 4. View Pages

- **Listings**
  - `index.blade.php`: filtered grid with map toggle, intent/audience filters.
  - `show.blade.php`: hero media, AI highlights, mortgage widget, partner invitations, social share actions.
  - `create.blade.php`: multi-step form with Livewire wizard (details, media, AI preview, publish rules).

- **Agent Dashboard** (`agents/dashboard.blade.php`)
  - Metrics row (active listings, lead conversions, trust score).
  - Tabs: Listings management, Leads CRM, Social performance, Compliance center, Learning library.
  - Embedded video module for spotlight uploads.

- **Learner/Investor Dashboard** (`cohorts/dashboard.blade.php`)
  - Savings progress, readiness score, recommended listings carousel.
  - Upcoming cohort events, mentor availability, grant alerts.
  - Mortgage calculator widget + AI action plan pane.

- **Partner Workspace** (`partners/workspace.blade.php`)
  - Project pipeline board (Kanban view), investor matches list, document vault.
  - Task board with assignable items, timeline heat map.

- **Admin Verification Console** (`admin/verification/index.blade.php`)
  - Queued submissions table, risk filters, AI summary sidebar, action modals.
  - Audit trail timeline, regulator API status widget.

## 5. Livewire Modules

- `Livewire\Listings\CreateWizard`: handles stepper, validation, AI preview toggles.
- `Livewire\Mortgage\Widget`: recalculations + AI narrative retrieval with loading states.
- `Livewire\Agents\SocialPerformance`: charts + pagination for social shares.
- `Livewire\Cohorts\GoalTracker`: real-time progress updates, nudge triggers.
- `Livewire\Partners\MatchFinder`: partner search filters, match acceptance workflow.
- `Livewire\Admin\VerificationQueue`: table with filters, approve/reject actions, AI summary display.

## 6. Styling & Design Tokens

- Extend Tailwind config with `women` palette (e.g., `women-rose`, `women-indigo`), spacing scale for cards, and typographic scale for headings.
- Component-specific SCSS under `resources/css/women-real-estate/` compiled via Vite.
- Dark mode support for dashboards; respect system preferences.

## 7. Accessibility & Localization

- All interactive components labeled with `aria-*`, keyboard navigation tested (tab order, focus outlines).
- Provide `lang` files under `resources/lang/en/women_real_estate.php`; plan for additional locales (phase 2).
- Offer text alternatives for media (captions, transcripts for spotlight videos).
- Consider dyslexia-friendly font options in user preferences.

## 8. Analytics Instrumentation

- Data-attributes (`data-analytics`) on primary components to fire events via `AdvancedAnalyticsService`.
- Track component interactions (mortgage slider adjustments, partner invites sent, feed shares) for feature KPIs.
- Integrate heatmap-ready hooks (respecting privacy) to analyse dashboard usage.

## 9. Testing & QA

- Laravel Dusk tests for key flows (listing creation, agent dashboard navigation, mortgage widget).
- Livewire component tests to ensure state changes and validation behave as expected.
- Visual regression testing (Percy or Chromatic) for high-sensitivity pages.
- Accessibility audits using axe-core CLI in CI pipeline.

## 10. Documentation

- Create Storybook-style component catalogue (could leverage Blade UI Kit demos) for internal reference.
- Update design system docs with new tokens, component usage guidelines, and accessibility considerations.
- Provide UX copy guidance (tone, inclusive language) in collaboration with content design.

## 11. Open Questions

- Should we integrate video conferencing (e.g., daily mentor huddles) within dashboards now or later?
- Do we need white-label theming for enterprise partners at launch?
- Preferred approach for map integration on listings (Mapbox vs. Google vs. Leaflet)?
- Any required integrations with existing CMS blocks (PageBuilder) for marketing pages?
