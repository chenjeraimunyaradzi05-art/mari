# Unreferenced UI components

Generated 2026-08-23; the backlog it listed was deleted on 2026-09-13.

On 2026-08-23, **32 of 106** component files under `client/src/components`
(~19,300 lines) were never imported by any page, component or hook. They were
excluded from the production bundle by tree-shaking, so this was never a
performance problem. It mattered for two other reasons:

1. **They looked finished but were not wired to anything.** Several contained
   no-op handlers (`onClick={() => {}}`, `onSetDefault={() => {}}`) that would
   have been bugs if the component were mounted.
2. **Grepping the codebase for a feature found these first.** `EarningsDashboard`,
   `SessionManagement` and `MentorCalendar` all looked like the mentor tooling
   was built. No route rendered any of them.

## What happened to them

Four unmounted chat drafts (ChatLayout, MessageBubbles, ChatInput,
MediaAttachmentUpload) and five super-app drafts (CreatorUploadStudio,
UserProfileHeader, CommentThread, NotificationCenter, FeedInteraction) were
deleted on 2026-09-04, each replaced by the component that actually renders.

`EarningsDashboard`, `PageShell`, the two cookie banners under `components/privacy`
and the second `CookieConsentBanner` under `components/gdpr` were mounted or
consolidated between then and September and are no longer on this list.

Everything else was deleted on 2026-09-13, after two independent reachability
walks (the project's own `client/scripts/check-dead-interactions.js --reach`
and a second import graph built from every `from`, `import()`, `require()` and
`jest.mock()` specifier) agreed that no app entry point reached them,
directly or transitively:

- the seventeen studio drafts: studios/community/CommunityGroupHome,
  studios/educator/CourseBuilderPortal, studios/employer/CandidateProfileViewer
  and JobsManagerKanban, studios/events/EventsCalendar,
  studios/formation/AbnLookup, CofounderMatching, FormationDashboard and
  IncorporationWizard, studios/learner/BadgeWallet, SkillsAssessmentUI and
  StudentClassroomView, studios/mentor/MentorCalendar and SessionManagement,
  studios/organization/OrganizationPage, studios/settings/PrivacyCenterDashboard
  and SafetyCenterAccess (about 13,000 lines);
- the super-app drafts GlobalSearch, RichTextEditor (the live editor is
  `components/ui/RichTextEditor.tsx`) and SuperAppNav, and ai/FloatingAIButton;
- the superseded dashboard header set DashboardHeader, NotificationDropdown,
  UserMenuDropdown and Providers, and search/GlobalSearchCommand, which only
  that header mounted (the dashboard layout renders its own header, search box,
  notifications and user menu);
- the provider drafts providers/AppProviders and providers/ThemeProvider (the
  app's providers live in `app/providers.tsx`);
- the barrel files components/index.ts, components/chat/index.ts,
  components/providers/index.ts, lib/hooks/index.ts and lib/stores/index.ts,
  which nothing imported (pages import the modules directly);
- the UI primitives only those drafts used: accordion, checkbox, popover,
  progress, radio-group, scroll-area, share-dialog, sheet, skeletons, slider,
  switch, textarea, toast, toggle and tooltip;
- the library files only those drafts used: lib/api-fetch, the hooks under
  lib/hooks (use-debounce, use-intersection, use-local-storage, use-media-query,
  use-scroll-position, useCommunity, useCompliance, useGDPR, useMentor; the
  hooks the app uses are in `lib/hooks.ts`), lib/services/gdpr.service, the
  formation, jobs and mentor stores, styles/design-tokens, and the two-line
  app/api/_utils/neon.ts stub.

The same pass removed the server modules nothing imported: the bandwidth
profile service, the ETL pipeline and its storage util and event-stream
consumer (all excluded from the build since January), the pre-ffmpeg
video-processing service (replaced by `video-pipeline.service.ts`), the
payment service that simulated Stripe (Stripe Connect and the payments
orchestration service are the live paths), the verification service that
its route never called, the disabled OpenSearch sync middleware, and the
GDPR worker that no worker process started.

They are all in git history: `git log --diff-filter=D --stat` names the commit.

## This is checked

```bash
npm --prefix athena-platform/client run check:dead-interactions
```

`client/scripts/check-dead-interactions.js` computes which files are reachable
from an `app/` entry point and fails the build on a dead interaction in any of
them: an empty handler, a log-only handler, `href="#"`, a "coming soon" notice.
It runs in CI. `--reach` prints the reachable set; anything under `client/src`
that is not in it and is not an entry file is a candidate for this list.

To find server capability that no client helper reaches yet, which is the
usual reason a component like the old `EarningsDashboard` sat unmounted:

```bash
node athena-platform/server/scripts/check-api-contract.js --unreachable
```
