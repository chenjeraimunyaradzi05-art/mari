/**
 * The Creator Terms Addendum a creator accepts before she can be paid.
 *
 * The server holds the version a creator must have accepted
 * (server/src/config/creator-terms.ts) and refuses a withdrawal, Stripe
 * onboarding or turning on creator mode without it. The web app cannot import
 * from the server package, so this is the copy the addendum page and the box she
 * ticks read. server/src/config/__tests__/creator-terms.test.ts reads both files
 * and fails when they differ: change them together, in the same commit as the
 * text in src/content/legal/creator-terms.md.
 */
export const CREATOR_TERMS_VERSION = '2026-10-01';

/** Where a creator reads the addendum and accepts it. */
export const CREATOR_TERMS_PATH = '/creator-terms';
