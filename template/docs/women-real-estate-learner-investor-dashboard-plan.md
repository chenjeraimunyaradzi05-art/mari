# Women Real Estate Platform — Learner & Investor Dashboard Plan (Step 14)

## 1. Goals

- Deliver personalised dashboards for women learners (Uni/TAFE) and first-home buyers/investors.
- Provide actionable insights, AI-driven guidance, and community resources in a supportive experience.
- Enable pathways to mentorship, partnerships, and mortgage readiness in a single hub.

## 2. Persona Profiles

- **Learners/Students**: women in tertiary or vocational education seeking housing, apprenticeships, and study support.
- **First-Home Buyers**: early-stage buyers focused on deposits, grants, and mortgage preparedness.
- **Investors/Emerging Developers**: women seeking co-investment partners, ROI analysis, and project opportunities.

## 3. Dashboard Information Architecture

1. **Hero Summary**
   - Readiness Score (based on savings, credit posture, mentorship engagement).
   - Savings tracker with target vs. current progress.
   - Quick actions (view recommended listings, connect with mentor, explore grants).

2. **Listings & Opportunities**
   - Carousel of AI-recommended listings segmented by persona (student housing, women-only rentals, first-home opportunities, women-led investments).
   - Filters for audience, price, location, partnership opportunities.
   - Save/share controls with AI captions for social sharing.

3. **Mortgage & Finance Tools**
   - `x-women.mortgage-widget` embedded with scenario planner (deposit slider, repayment frequency) and AI commentary.
   - Grant eligibility checklist with status (eligible, action needed, ineligible) and required steps.
   - Budget coach module for learners (e.g., track weekly spend vs. savings goals).

4. **Mentorship & Network**
   - Mentor match cards showing recommended mentors and compatibility score.
   - Schedule module integrating with calendar invites and reminders.
   - Cohort feed highlighting events, workshops, peer discussions.

5. **Partnership & Projects (Investors)**
   - Project pipeline with ability to view partner profiles, send invitations, and review pitches.
   - Collaboration tools (document vault, chat prompt, task board snapshots).

6. **Learning Pathways**
   - Curated learning modules (financial literacy, property law basics, renovation bootcamps).
   - Progress tracking badges and completion certificates.
   - AI-curated content feed (articles, videos, podcasts) matched to goals.

7. **Notifications & Nudges**
   - `x-women.toast` and timeline for upcoming milestones, expiring grants, mentor check-ins.
   - AI-generated encouragement and tips (PersonaNudgeService) with opt-out controls.

## 4. Technical Components

- Livewire components: `Livewire\Cohorts\Dashboard`, `Livewire\Mortgage\Widget`, `Livewire\Cohorts\MentorMatches`, `Livewire\Goals\Tracker`, `Livewire\Partners\Opportunities`.
- Services: `WomenCohortService`, `MortgageGuidanceService`, `MentorshipMatchingService`, `GoalTrackingService`.
- Policies enforcing access (`WomenCohortProfilePolicy`, `WomenPartnerProjectPolicy`).
- Data sources: `WomenCohortProfile`, `WomenGoalTracker`, `WomenListing`, `WomenListingMortgageSnapshot`, AI insights.

## 5. Personalisation Layer

- Persona defined in `WomenCohortProfile` drives component visibility (investor modules hidden for pure learners).
- AI insights stored in profile used to adjust messaging, recommended actions, and content ordering.
- Preference controls let users tune dashboard modules (pin/unpin, reorder) using `women_dashboard_preferences` table.

## 6. Accessibility & Inclusivity

- Clear language with tooltips/glossary for financial terms.
- Support for screen readers, high-contrast mode, dyslexia-friendly font option.
- Emotional tone guidelines to encourage without overwhelming; respect cultural diversity.

## 7. Integration with Other Modules

- Mortgage engine (Step 05) provides real-time rates and narratives.
  - Notifications triggered when rates change significantly or new grants become available.
- Partner projects (Step 15) feed into investor panels.
- Social integration (Step 06) allows sharing achievements and opportunities to feed/cohort groups.
- Analytics instrumentation (Step 10) tracks module engagement and goal progress.

## 8. Testing Plan

- Livewire component tests for persona-specific behaviour, data loading states, and AI fallback handling.
- Feature tests verifying full dashboard render per persona and access controls.
- UX research loops with representative users; gather qualitative feedback via in-app surveys.
- Accessibility audits using axe-core and manual keyboard navigation checks.

## 9. Rollout Strategy

- Phase 1 beta for internal cohorts and early adopters, focusing on first-home buyers.
- Phase 2 expands to student housing modules, partner projects, and investor tools.
- Gather metrics: goal completion rate, mortgage widget usage, mentor match conversions.
- Iterate UI components based on feedback before general release.

## 10. Open Questions

- Should investors have separate risk tolerance settings influencing recommendations?
- Do we integrate external budgeting APIs (e.g., Frollo, Pocketbook) for automated savings updates?
- Any region-specific modules (state grants, local mentorship programs) needed at launch?
- Strategy for offline access or low-bandwidth environments (downloadable guides, SMS updates)?
