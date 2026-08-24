# Unreferenced UI components

Generated 2026-08-23. **32 of 106** component files under `client/src/components`
(~19,300 lines) are never imported by any page, component, or hook.

They are excluded from the production bundle by tree-shaking, so this is not a
performance problem. It matters for two other reasons:

1. **They look finished but are not wired to anything.** Several contain no-op
   handlers (`onClick={() => {}}`, `onSetDefault={() => {}}`) that would be bugs
   if the component were mounted. Do not assume a component works because it
   exists and compiles.
2. **Grepping the codebase for a feature finds these first.** `EarningsDashboard`,
   `SessionManagement` and `MentorCalendar` all look like the mentor tooling is
   built. No route renders any of them.

## How this was determined

For each component file, every exported `PascalCase` symbol was searched across
all other `.ts`/`.tsx` files under `src`, along with a path-based import match on
the filename. A file is listed only when nothing matched.

Two known-good sanity checks: the cookie banner that actually renders is
`components/CookieConsentBanner.tsx` (imported by `app/providers.tsx`) — the two
files under `components/privacy/` really are unused, and there is a second,
duplicate `CookieConsentBanner` under `components/gdpr/` that is also unused.

## The list

| Lines | File |
|------:|------|
| 1111 | `studios/formation/IncorporationWizard.tsx` |
| 979 | `studios/educator/CourseBuilderPortal.tsx` |
| 909 | `studios/mentor/SessionManagement.tsx` |
| 867 | `studios/events/EventsCalendar.tsx` |
| 863 | `studios/settings/PrivacyCenterDashboard.tsx` |
| 854 | `studios/mentor/MentorCalendar.tsx` |
| 833 | `studios/employer/CandidateProfileViewer.tsx` |
| 826 | `studios/learner/SkillsAssessmentUI.tsx` |
| 798 | `studios/learner/StudentClassroomView.tsx` |
| 784 | `studios/employer/JobsManagerKanban.tsx` |
| 744 | `super-app/CreatorUploadStudio.tsx` |
| 727 | `studios/settings/SafetyCenterAccess.tsx` |
| 700 | `studios/mentor/EarningsDashboard.tsx` |
| 649 | `studios/formation/FormationDashboard.tsx` |
| 648 | `studios/formation/CofounderMatching.tsx` |
| 630 | `studios/community/CommunityGroupHome.tsx` |
| 609 | `studios/organization/OrganizationPage.tsx` |
| 585 | `studios/learner/BadgeWallet.tsx` |
| 581 | `super-app/UserProfileHeader.tsx` |
| 522 | `chat/MessageBubbles.tsx` |
| 514 | `super-app/CommentThread.tsx` |
| 510 | `chat/ChatInput.tsx` |
| 466 | `chat/MediaAttachmentUpload.tsx` |
| 412 | `super-app/GlobalSearch.tsx` |
| 411 | `super-app/NotificationCenter.tsx` |
| 404 | `super-app/FeedInteraction.tsx` |
| 364 | `privacy/GranularCookieBanner.tsx` |
| 341 | `chat/ChatLayout.tsx` |
| 204 | `ai/FloatingAIButton.tsx` |
| 187 | `layout/PageShell.tsx` |
| 175 | `ui/share-dialog.tsx` |
| 127 | `privacy/CookieBanner.tsx` |

The whole `chat/` directory (1,839 lines across four files) is unmounted — the
messaging UI in use lives elsewhere.

## Known no-op handlers inside these files

These are the reason the list is worth keeping rather than ignoring:

- `studios/educator/CourseBuilderPortal.tsx` — `onEditLesson`, `onEditModule`
- `studios/formation/CofounderMatching.tsx` — the "Apply Filters" button. The
  filter checkboxes already call `onFiltersChange` as they change, so the button
  only needs to dismiss the sheet (`SheetClose` is exported from `ui/sheet`).
- `studios/mentor/EarningsDashboard.tsx` — `onSetDefault` for payout methods.
  The client helper `paymentsApi` exposes only `getMethods`, but the server has
  more than that: `POST /api/payments/payout`, `/process`, `/convert` and
  `GET /pricing`, `/currencies`, `/best-provider` all exist and no client code
  calls them. There is still no *set default method* route, which is what
  `onSetDefault` specifically needs.

**Updated 2026-08-24.** The API gaps this used to depend on are closed, so
wiring these up is now mostly a client-side job — see
[CLIENT-API-SURFACE-GAPS.md](./api/CLIENT-API-SURFACE-GAPS.md) for the current
contract and the CI check that keeps it honest.

To find server capability that no client helper reaches yet, which is the usual
blocker for a component like `EarningsDashboard`:

```bash
node athena-platform/server/scripts/check-api-contract.js --unreachable
```
