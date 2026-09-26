import { describe, it, expect } from '@jest/globals';
import { ApplicationStatus } from '@prisma/client';
import { EMPLOYER_SETTABLE_STATUSES, assertEmployerStatusMove } from '../application-status.service';

// The employer's side of a job application's life. Nothing tested it directly;
// the two route suites exercised a handful of moves each.

const statusOf = (fn: () => unknown): number | null => {
  try {
    fn();
    return null;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode ?? -1;
  }
};

describe('Which stages an employer may set', () => {
  it('never includes the two that are the candidate’s to write', () => {
    expect(EMPLOYER_SETTABLE_STATUSES).not.toContain(ApplicationStatus.ACCEPTED);
    expect(EMPLOYER_SETTABLE_STATUSES).not.toContain(ApplicationStatus.WITHDRAWN);
  });
});

describe('Moving an application', () => {
  it('treats a card dropped back into its own column as no change', () => {
    expect(assertEmployerStatusMove(ApplicationStatus.INTERVIEW, ApplicationStatus.INTERVIEW)).toEqual({ changed: false });
  });

  it('walks the ordinary path', () => {
    expect(assertEmployerStatusMove(ApplicationStatus.PENDING, ApplicationStatus.REVIEWED)).toEqual({ changed: true });
    expect(assertEmployerStatusMove(ApplicationStatus.REVIEWED, ApplicationStatus.INTERVIEW)).toEqual({ changed: true });
    expect(assertEmployerStatusMove(ApplicationStatus.INTERVIEW, ApplicationStatus.OFFERED)).toEqual({ changed: true });
  });

  it('will not offer on an application nobody has opened', () => {
    expect(statusOf(() => assertEmployerStatusMove(ApplicationStatus.PENDING, ApplicationStatus.OFFERED))).toBe(400);
  });

  it('lets an employer reconsider a rejection', () => {
    expect(assertEmployerStatusMove(ApplicationStatus.REJECTED, ApplicationStatus.SHORTLISTED)).toEqual({ changed: true });
  });

  it('never overwrites what the candidate decided', () => {
    expect(statusOf(() => assertEmployerStatusMove(ApplicationStatus.ACCEPTED, ApplicationStatus.INTERVIEW))).toBe(409);
    expect(statusOf(() => assertEmployerStatusMove(ApplicationStatus.WITHDRAWN, ApplicationStatus.REVIEWED))).toBe(409);
  });

  it('will not write the candidate’s stages for her', () => {
    expect(statusOf(() => assertEmployerStatusMove(ApplicationStatus.OFFERED, ApplicationStatus.ACCEPTED))).toBe(400);
    expect(statusOf(() => assertEmployerStatusMove(ApplicationStatus.INTERVIEW, ApplicationStatus.WITHDRAWN))).toBe(400);
  });
});
