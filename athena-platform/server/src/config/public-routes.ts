/**
 * The routes an anonymous caller may reach, each with the reason it is open.
 *
 * ATHENA applies `authenticate` route by route rather than once at the door,
 * so "is this route guarded?" has no single place to be answered. This list is
 * the other half of the answer: src/__tests__/route-auth-coverage.test.ts walks
 * every route the app mounts, sends all the ones NOT named here an anonymous
 * request and fails unless each answers 401. So a new route is closed by
 * default, and opening one means adding a line below with a reason a reviewer
 * can argue with.
 *
 * Two more things that test holds this list to: an entry must name a route that
 * exists, and must not name one that carries `authenticate` (the list would
 * otherwise go on describing a route as open after it was closed). Paths are
 * written as Express registers them, `:param` and all, joined to their mount.
 *
 * A route being here is not a claim that it is harmless. The "optional session"
 * group in particular holds routes whose handlers decide, per viewer, what an
 * anonymous visitor may see; those decisions are tested beside each handler.
 */

export interface PublicRoute {
  method: string;
  path: string;
  reason: string;
}

export const publicRouteKey = (route: { method: string; path: string }) => `${route.method} ${route.path}`;

const open = (reason: string, routes: readonly string[]): PublicRoute[] =>
  routes.map((route) => {
    const space = route.indexOf(' ');
    return { method: route.slice(0, space), path: route.slice(space + 1), reason };
  });

const PROBES =
  'Operational probes and the app root. The host, the uptime check and the status page call them with no session. The ones that say more than up or down (detailed health, launch readiness, metrics) refuse in production without their own token.';

const SIGN_IN =
  'Sign-in, sign-up and recovery steps. The caller has no session yet; the credential, the refresh token or the emailed one-time token in the request is the proof, and each has its own rate limit.';

const SIGNED_LINKS =
  'Reached with a single-purpose code or token that was handed to one person (a reference form, a share link, a certificate code, a referral code, a report reference, an emailed confirmation). The code is the credential and the handler refuses a wrong one.';

const SENDER_PROVES_ITSELF =
  'Called by another system, not a member: Stripe and SendGrid sign their webhooks, and the streaming server must present the hook secret. The handler verifies that proof before it does anything.';

const RETIRED =
  'Withdrawn on purpose and answers 410 Gone to everyone, so an old client is told plainly rather than shown a 404.';

const DEVELOPMENT_SEED =
  'The demonstration-data loader. It exists only outside production, behind ALLOW_DB_SEEDING and its own token, and gates itself; it is mounted ahead of the admin router, which would otherwise refuse it.';

const CALCULATORS =
  'A stateless calculator or planner: numbers in, numbers out, nothing stored and nothing about a member read. It is open so a visitor can try it before joining.';

const INTAKE =
  'A form or beacon that anyone may send without an account: a lead, feedback, a content report, a fleet enquiry, a cookie choice, a view count. The handler validates it and each is rate limited; none reads another person’s data.';

const PUBLIC_PROFILES =
  'The public page of someone who chose to be listed as a mentor or creator. It is the directory a visitor browses before signing up, and it returns only what the listing publishes.';

const PUBLIC_CATALOGUE =
  'A public listing or reference page: opportunities, courses, grants, providers, programmes, policies and the like. Nothing in it belongs to one member, and visitors read it before they have an account.';

const OPTIONAL_SESSION =
  'Public content that signed-in and anonymous visitors both read. The handler reads the optional session where what a viewer may see depends on who they are (blocks, private groups and channels, hidden items) and shows an anonymous visitor only what is public.';

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  ...open(PROBES, [
  'GET /',
  'GET /health',
  'GET /livez',
  'GET /readyz',
  'GET /__test/500',
  'GET /metrics',
  'GET /api/maintenance',
  'POST /api/client-errors',
  'GET /health/live',
  'GET /health/ready',
  'GET /health/detailed',
  'GET /health/launch-readiness',
  'GET /health/version',
  'GET /health/auth-diag',
  ]),
  ...open(SIGN_IN, [
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/suspension-appeal',
  'POST /api/auth/google',
  'POST /api/auth/facebook',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'GET /api/auth/verify-email',
  'POST /api/auth/verify-email',
  'POST /api/auth/resend-verification',
  'POST /api/auth/lock-by-token',
  'POST /api/auth/unlock',
  'POST /api/auth/request-unlock',
  ]),
  ...open(SIGNED_LINKS, [
  'GET /api/courses/certificates/:code',
  'GET /api/referrals/validate/:code',
  'GET /api/strategy/business/accelerator-certificates/:enrollmentId',
  'GET /api/wellness/share/:token',
  'GET /api/references/form/:token',
  'POST /api/references/form/:token/submit',
  'POST /api/references/form/:token/decline',
  'GET /api/gdpr/dsar/rectify/confirm-email',
  'GET /api/compliance/report-status/:reference',
  ]),
  ...open(SENDER_PROVES_ITSELF, [
  'POST /api/webhooks/stripe',
  'POST /api/webhooks/sendgrid',
  'POST /api/livestream/key/validate',
  'POST /api/livestream/webhooks/rtmp',
  ]),
  ...open(RETIRED, [
  'POST /api/subscriptions/webhook',
  'GET /api/algorithms/recommendation-engine-2',
  'GET /api/feed',
  'GET /api/feed/opportunities',
  ]),
  ...open(DEVELOPMENT_SEED, [
  'GET /api/admin/seed/status',
  'POST /api/admin/seed/content',
  'POST /api/admin/seed/admin',
  'POST /api/admin/seed/all',
  ]),
  ...open(CALCULATORS, [
  'GET /api/strategy/reference',
  'POST /api/strategy/housing/rent',
  'POST /api/strategy/housing/stamp-duty',
  'POST /api/strategy/housing/mortgage',
  'POST /api/strategy/housing/borrowing-power',
  'POST /api/strategy/housing/deposit',
  'POST /api/strategy/housing/rent-vs-buy',
  'POST /api/strategy/business/structures',
  'POST /api/strategy/business/valuation',
  'POST /api/strategy/business/raise',
  'POST /api/strategy/business/runway',
  'POST /api/strategy/tax/estimate',
  'POST /api/strategy/tax/deductions',
  'POST /api/strategy/tax/super',
  'POST /api/strategy/tax/set-aside',
  'POST /api/strategy/investing/risk-profile',
  'GET /api/strategy/housing/rent-help',
  'POST /api/strategy/housing/rent-assistance',
  'POST /api/strategy/housing/compare-loans',
  'POST /api/strategy/housing/investment-property',
  'POST /api/strategy/business/pitch-check',
  'POST /api/strategy/tax/help-debt',
  'POST /api/strategy/investing/debts',
  'POST /api/strategy/investing/goal-plan',
  'POST /api/strategy/investing/insurance-needs',
  'POST /api/strategy/investing/super-projection',
  'GET /api/strategy/business/launch-package',
  'POST /api/strategy/business/deck-outline',
  'POST /api/strategy/investing/projection',
  'POST /api/strategy/investing/emergency-fund',
  'POST /api/wellness/k10',
  'POST /api/automotive/finance/repayment',
  'POST /api/automotive/finance/compare',
  'POST /api/automotive/finance/affordability',
  'POST /api/automotive/finance/cost-of-ownership',
  'POST /api/automotive/finance/readiness',
  'POST /api/automotive/insurance/estimate',
  'POST /api/automotive/insurance/compare',
  'POST /api/automotive/valuation/estimate',
  'POST /api/automotive/valuation/upgrade',
  ]),
  ...open(INTAKE, [
  'POST /api/posts/impressions',
  'POST /api/posts/:id/view',
  'POST /api/marketing/leads',
  'POST /api/feedback',
  'POST /api/video/:id/view',
  'POST /api/automotive/fleet-enquiries',
  'POST /api/gdpr/cookies',
  'POST /api/compliance/report-content',
  ]),
  ...open(PUBLIC_PROFILES, [
  'GET /api/mentors/profile/:userId',
  'GET /api/mentors/:mentorId',
  'GET /api/creator/profile/:userId',
  ]),
  ...open(PUBLIC_CATALOGUE, [
  'GET /api/organizations',
  'GET /api/organizations/:slug',
  'GET /api/organizations/:slug/jobs',
  'GET /api/courses',
  'GET /api/courses/stats',
  'GET /api/mentors/timezones',
  'GET /api/blog',
  'GET /api/blog/tags',
  'GET /api/blog/:slug',
  'GET /api/education/providers',
  'GET /api/education/providers/:slug',
  'GET /api/creator/gifts',
  'GET /api/creator/tiers',
  'GET /api/fees',
  'GET /api/formation/fees',
  'GET /api/creator/leaderboard',
  'GET /api/search/suggestions',
  'GET /api/search/trending',
  'GET /api/engagement/achievements/list',
  'GET /api/regions',
  'GET /api/payments/pricing',
  'GET /api/payments/currencies',
  'GET /api/safety/dv/resources',
  'GET /api/business/accelerators',
  'GET /api/business/grants',
  'GET /api/business/grants/:id',
  'GET /api/business/investors',
  'GET /api/business/investors/:id',
  'GET /api/business/vendors/:id',
  'GET /api/business/rfps',
  'GET /api/finance/insurance',
  'GET /api/finance/insurance/:id',
  'GET /api/wellness/reference',
  'GET /api/wellness/library',
  'GET /api/automotive/reference',
  'GET /api/automotive/catalogue',
  'GET /api/automotive/catalogue/compare',
  'GET /api/automotive/catalogue/:slug/reviews',
  'GET /api/automotive/mechanics/:id/slots',
  'GET /api/automotive/dealerships',
  'GET /api/impact/reports',
  'GET /api/impact/reports/:id',
  'GET /api/impact/partners',
  'GET /api/impact/partners/:id',
  'GET /api/impact/dv-services',
  'GET /api/impact/disability-friendly-employers',
  'GET /api/community-support/programs',
  'GET /api/community-support/programs/:id',
  'GET /api/community-support/indigenous/communities/:id',
  'GET /api/community-support/indigenous/resources',
  'GET /api/community-support/assessing-bodies',
  'GET /api/community-support/bridging-programs',
  'GET /api/gdpr/data-categories',
  'GET /api/gdpr/retention-policies',
  'GET /api/compliance/region/:countryCode',
  'GET /api/compliance/pricing/:region',
  'GET /api/compliance/privacy/:region',
  'GET /api/compliance/gdpr',
  'GET /api/compliance/online-safety',
  'GET /api/compliance/uk-safety',
  'GET /api/compliance/transparency-report',
  'GET /api/compliance/subprocessors',
  'GET /api/compliance/data-transfers',
  'GET /api/compliance/legal-documents',
  'GET /api/sounds/trending',
  'GET /api/sounds',
  'GET /api/sounds/:id',
  'GET /api/topics/trending',
  'GET /api/livestream/gifts',
  'GET /api/livestream/:id/leaderboard',
  ]),
  ...open(OPTIONAL_SESSION, [
  'GET /api/users/:id',
  'GET /api/jobs',
  'GET /api/jobs/:id',
  'GET /api/posts/:id/reposts',
  'GET /api/posts/feed',
  'GET /api/posts/video-feed',
  'GET /api/posts/:id',
  'GET /api/posts/user/:userId',
  'GET /api/courses/recommendations/for-me',
  'GET /api/courses/:slug',
  'GET /api/mentors',
  'GET /api/mentors/:mentorId/slots',
  'GET /api/subscriptions/plans',
  'GET /api/search',
  'GET /api/search/users',
  'GET /api/search/posts',
  'GET /api/search/jobs',
  'GET /api/search/courses',
  'GET /api/search/videos',
  'GET /api/search/mentors',
  'GET /api/engagement/leaderboard',
  'GET /api/engagement/leaderboard/xp',
  'GET /api/engagement/leaderboard/creators',
  'GET /api/events',
  'GET /api/events/:id',
  'GET /api/groups',
  'GET /api/groups/:id',
  'GET /api/groups/:id/posts',
  'GET /api/status/highlights/user/:userId',
  'GET /api/status/feed',
  'GET /api/algorithms/opportunity-scan',
  'GET /api/video/feed',
  'GET /api/video/trending',
  'GET /api/video/category/:category',
  'GET /api/video/user/:userId',
  'GET /api/video/:id',
  'GET /api/video/:id/comments',
  'GET /api/channels',
  'GET /api/channels/discover',
  'GET /api/channels/:id',
  'GET /api/channels/:id/members',
  'GET /api/channels/:id/pinned',
  'GET /api/channels/:id/search',
  'GET /api/channels/:id/messages',
  'GET /api/apprenticeships',
  'GET /api/apprenticeships/featured',
  'GET /api/apprenticeships/categories',
  'GET /api/apprenticeships/:id',
  'GET /api/apprenticeships/:id/milestones',
  'GET /api/skills-marketplace/services',
  'GET /api/skills-marketplace/categories',
  'GET /api/skills-marketplace/services/:id',
  'GET /api/skills-marketplace/services/:id/reviews',
  'GET /api/skills-marketplace/sellers/:userId',
  'GET /api/business/vendors',
  'GET /api/business/rfps/:id',
  'GET /api/housing/listings',
  'GET /api/housing/listings/:id',
  'GET /api/automotive/catalogue/:slug',
  'GET /api/automotive/listings',
  'GET /api/automotive/listings/:id',
  'GET /api/automotive/mechanics',
  'GET /api/automotive/mechanics/:slug',
  'GET /api/automotive/dealerships/:slug',
  'GET /api/community-support/indigenous/communities',
  'GET /api/feature-flags/active',
  'GET /api/gdpr/cookies',
  'GET /api/gdpr/cookies/:visitorId',
  'GET /api/sounds/:id/videos',
  'GET /api/topics/suggest',
  'GET /api/topics/:tag',
  'GET /api/livestream',
  'GET /api/livestream/:id',
  'GET /api/livestream/:id/messages',
  ]),
];
