/**
 * The handful of platform constants the phone needs, kept here rather than
 * imported from the shared package.
 *
 * Two screens used to import these through an `@shared/*` alias wired in four
 * places — tsconfig paths, the babel module-resolver, metro's
 * extraNodeModules and jest's moduleNameMapper — every one of which resolved
 * to `../shared`, outside `mobile/`. `mobile/` is the EAS project root: it is
 * the directory holding app.json and eas.json, and the repository root
 * declares no npm workspaces, so there is nothing that guarantees the build
 * container ever receives `shared/`. A bundle that cannot resolve
 * `@shared/src` does not degrade; it fails, and it fails in EAS rather than
 * on anyone's laptop, where `../shared` is always sitting right there.
 *
 * So the app no longer reaches outside its own root at bundle time. These are
 * mirrors of athena-platform/shared/src, and they are not trusted to stay
 * mirrors by good intentions: src/constants/__tests__/shared.test.ts imports
 * the real shared package by relative path and fails if either one drifts.
 * That test runs on a checkout, where `shared/` exists, and never in a
 * bundle. The mobile CI workflow already runs on changes to shared/**, so a
 * change there that forgets this file is caught before it is merged.
 *
 * If the repository root ever gains npm workspaces, this file can go back to
 * being a re-export of the shared package.
 */

/** Mirrors `Persona` in shared/src/index.ts. */
export enum Persona {
  EARLY_CAREER = 'EARLY_CAREER',
  MID_CAREER = 'MID_CAREER',
  CAREER_CHANGER = 'MID_CAREER',
  RETURNING_PROFESSIONAL = 'MID_CAREER',
  STUDENT = 'EARLY_CAREER',
  ENTREPRENEUR = 'ENTREPRENEUR',
  CREATOR = 'CREATOR',
  EMPLOYER = 'EMPLOYER',
  MENTOR = 'MENTOR',
  EDUCATION_PROVIDER = 'EDUCATION_PROVIDER',
  REAL_ESTATE = 'REAL_ESTATE',
  GOVERNMENT_NGO = 'GOVERNMENT_NGO',
}

/** Mirrors `APPLICATION_STATUS_DISPLAY` in shared/src/utils.ts. */
export const APPLICATION_STATUS_DISPLAY = {
  PENDING: 'Pending Review',
  REVIEWING: 'Under Review',
  REVIEWED: 'Reviewed',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  OFFER: 'Offer Extended',
  OFFERED: 'Offer Extended',
  REJECTED: 'Not Selected',
  WITHDRAWN: 'Withdrawn',
};
