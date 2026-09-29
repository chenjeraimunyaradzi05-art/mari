import { describe, it, expect, jest } from '@jest/globals';

/**
 * The period a report counts, and what of it the public may read.
 *
 * A report is filed under a label staff type, so the label decides which
 * records are counted. These pin the four shapes it understands, in
 * Queensland time, and the small-number rule that keeps a count from pointing
 * at one woman.
 */

jest.mock('../../utils/prisma', () => ({ prisma: {} }));

import { MIN_PUBLISHED_COUNT, parseReportPeriod, presentPublicReport, publishRefusal } from '../impact-reports.service';

describe('parseReportPeriod', () => {
  it('reads a quarter as three calendar months from midnight in Brisbane', () => {
    const q = parseReportPeriod(' q3-2026 ');
    expect(q?.label).toBe('Q3-2026');
    expect(q?.start.toISOString()).toBe('2026-06-30T14:00:00.000Z');
    expect(q?.end.toISOString()).toBe('2026-09-30T14:00:00.000Z');
    expect(q?.description).toBe('1 Jul 2026 to 30 Sep 2026');
  });

  it('reads the fourth quarter into the new year', () => {
    const q = parseReportPeriod('Q4-2026');
    expect(q?.end.toISOString()).toBe('2026-12-31T14:00:00.000Z');
  });

  it('reads FY2026 as the Australian financial year, 1 July 2025 to 30 June 2026', () => {
    const fy = parseReportPeriod('FY2026');
    expect(fy?.start.toISOString()).toBe('2025-06-30T14:00:00.000Z');
    expect(fy?.end.toISOString()).toBe('2026-06-30T14:00:00.000Z');
    expect(fy?.lastDay).toBe('30 Jun 2026');
  });

  it('reads a calendar year and a month', () => {
    expect(parseReportPeriod('2026')?.end.toISOString()).toBe('2026-12-31T14:00:00.000Z');
    const month = parseReportPeriod('2026-02');
    expect(month?.start.toISOString()).toBe('2026-01-31T14:00:00.000Z');
    expect(month?.end.toISOString()).toBe('2026-02-28T14:00:00.000Z');
  });

  it('refuses anything else, and years nobody could mean', () => {
    for (const bad of ['spring', 'Q5-2026', 'FY26', '2026-13', '1999', 'Q1-3000', '', undefined, 2026]) {
      expect(parseReportPeriod(bad)).toBeNull();
    }
  });
});

describe('publishRefusal', () => {
  const compiled = (total: number) => ({
    figures: { totalUsersSupported: total, employmentGained: 0, housingSecured: 0, qualificationsObtained: 0, businessesStarted: 0, safetyAchieved: 0, avgIncomeIncrease: null },
    basis: {} as never,
  });

  it('refuses a period still running, and a total under the floor', () => {
    const q3 = parseReportPeriod('Q3-2026')!;
    expect(publishRefusal(compiled(50), q3, new Date('2026-09-15T00:00:00Z'))).toMatch(/has not ended yet \(it runs to 30 Sep 2026\)/);
    expect(publishRefusal(compiled(MIN_PUBLISHED_COUNT - 1), q3, new Date('2026-10-02T00:00:00Z'))).toMatch(/could identify them/);
    expect(publishRefusal(compiled(MIN_PUBLISHED_COUNT), q3, new Date('2026-10-02T00:00:00Z'))).toBeNull();
  });
});

describe('presentPublicReport', () => {
  it('withholds counts from one to four, keeps zero as zero, and reads nothing it does not recognise from the basis', () => {
    const report = presentPublicReport({
      id: 'r',
      reportPeriod: 'Q1-2026',
      communityType: null,
      region: 'ANZ',
      totalUsersSupported: 30,
      employmentGained: 4,
      avgIncomeIncrease: null,
      housingSecured: 5,
      qualificationsObtained: 0,
      businessesStarted: 1,
      safetyAchieved: 12,
      totalEconomicImpact: null,
      narrativeSummary: null,
      dataJson: { method: 'SOMETHING_ELSE' },
      createdAt: new Date(),
    });
    expect(report.employmentGained).toBeNull();
    expect(report.businessesStarted).toBeNull();
    expect(report.housingSecured).toBe(5);
    expect(report.qualificationsObtained).toBe(0);
    expect(report.suppressed).toEqual(['employmentGained', 'businessesStarted']);
    expect(report.basis).toBeNull();
  });
});
