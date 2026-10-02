/**
 * The Creator Terms Addendum a creator accepts before she can be paid.
 *
 * Terms of Service 5.1 lists accepting it among the conditions for monetising,
 * and nothing recorded that anyone had. The version is what she accepted: when
 * the addendum is rewritten the version is changed here, a creator whose recorded
 * version is not this one is asked again at her next withdrawal, and nobody is
 * treated as having agreed to text she never saw.
 *
 * The web app cannot import from this package, so client/src/lib/creator-terms.ts
 * holds the same string for the page that shows the addendum and the box she
 * ticks. src/config/__tests__/creator-terms.test.ts reads both and fails when they
 * differ. Change them together, in the same commit as the text.
 *
 * Nothing here imports anything: it has to stay loadable from a test, a script or
 * a middleware without pulling in a database.
 */
export const CREATOR_TERMS_VERSION = '2026-10-01';

/** Where a creator reads the addendum and accepts it. */
export const CREATOR_TERMS_PATH = '/creator-terms';
