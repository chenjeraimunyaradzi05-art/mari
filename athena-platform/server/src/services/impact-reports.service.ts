/**
 * Impact reports: how one is compiled from what actually happened, and what of
 * it the public may read.
 *
 * ImpactReport had two readers and no writer anywhere, so the reports page
 * could never show a row, and the only honest thing it could say was that
 * nothing had been published. Staff can now publish one, but they do not type
 * the figures in. A report ATHENA publishes about the women it serves is a
 * claim in ATHENA's own name, and a number someone keyed into a form is a
 * number nobody can check afterwards. Every figure here is counted from the
 * platform's own records for the period, and the report carries how it was
 * counted, so a reader (or an auditor, or a funder) can see what it rests on.
 *
 * What is counted, for a period, a region and optionally one community:
 * - each outcome figure is the number of women who recorded that outcome on
 *   ATHENA in the period (EMPLOYMENT_GAINED, HOUSING_SECURED, and so on), not
 *   the number of rows, so recording the same job twice counts once;
 * - "women supported" is the women who recorded any outcome in the period, or
 *   who began or completed a community programme in it;
 * - the average income increase is the mean of the increases members
 *   recorded, and only when enough members recorded one (see below).
 * The outcomes are what members recorded about themselves, and the report
 * says so, with how many of them staff had verified.
 *
 * Small numbers are not published. Many of these women are survivors of
 * domestic violence, and "one woman in the DV survivor community secured
 * housing in Q3" in a small region is a sentence that can point at somebody.
 * A report whose total is under MIN_PUBLISHED_COUNT is refused, and any
 * figure from one to MIN_PUBLISHED_COUNT - 1 is withheld from the public
 * answer and marked as "fewer than", the practice statistical agencies use.
 * The stored row keeps the exact count for staff.
 */

import { CommunityType, ImpactMetricType, Prisma, Region } from '@prisma/client';
import type { ImpactReport } from '@prisma/client';
import { prisma } from '../utils/prisma';

/** The smallest count published as a number. Below it, the public reads "fewer than". */
export const MIN_PUBLISHED_COUNT = 5;

/**
 * Periods are counted in Queensland time, because that is where ATHENA is
 * based and where its financial year is kept. Queensland has no daylight
 * saving, so the offset is fixed and a period's edges never move.
 */
const BRISBANE_OFFSET_HOURS = 10;

/** Midnight at the start of a day in Brisbane, as an instant. Month is 0-based and may run past 11. */
const brisbaneMidnight = (year: number, monthIndex: number, day = 1): Date =>
  new Date(Date.UTC(year, monthIndex, day, -BRISBANE_OFFSET_HOURS));

/**
 * A day in Brisbane as "1 Jul 2026". Spelled out by hand rather than through
 * toLocaleDateString, whose short month names change with the ICU data the
 * server's Node was built with ("Jul" on one machine, "July" on another), and
 * a report's period is text that is stored and compared.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (at: Date) => {
  const local = new Date(at.getTime() + BRISBANE_OFFSET_HOURS * 60 * 60 * 1000);
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
};

export interface ReportPeriod {
  /** The label the report is filed under, e.g. Q3-2026, FY2026, 2026, 2026-09. */
  label: string;
  /** The first instant inside the period. */
  start: Date;
  /** The first instant after it. */
  end: Date;
  /** The period in words, first day to last. */
  description: string;
  /** The last day of the period, in words. */
  lastDay: string;
}

const EARLIEST_YEAR = 2020;
const LATEST_YEAR = 2100;

/**
 * Read a period label. Four shapes are understood: a calendar quarter
 * (Q3-2026), an Australian financial year (FY2026, 1 July 2025 to 30 June
 * 2026), a calendar year (2026) and a month (2026-09). Anything else is null,
 * so a typo is refused rather than filed as a period nobody can compare with
 * another.
 */
export function parseReportPeriod(raw: unknown): ReportPeriod | null {
  if (typeof raw !== 'string') return null;
  const label = raw.trim().toUpperCase();
  let start: Date | null = null;
  let end: Date | null = null;
  let year = 0;

  const quarter = /^Q([1-4])-(\d{4})$/.exec(label);
  const financial = /^FY(\d{4})$/.exec(label);
  const calendar = /^(\d{4})$/.exec(label);
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(label);

  if (quarter) {
    year = Number(quarter[2]);
    const q = Number(quarter[1]);
    start = brisbaneMidnight(year, (q - 1) * 3);
    end = brisbaneMidnight(year, q * 3);
  } else if (financial) {
    year = Number(financial[1]);
    start = brisbaneMidnight(year - 1, 6);
    end = brisbaneMidnight(year, 6);
  } else if (calendar) {
    year = Number(calendar[1]);
    start = brisbaneMidnight(year, 0);
    end = brisbaneMidnight(year + 1, 0);
  } else if (month) {
    year = Number(month[1]);
    const m = Number(month[2]) - 1;
    start = brisbaneMidnight(year, m);
    end = brisbaneMidnight(year, m + 1);
  }

  if (!start || !end || year < EARLIEST_YEAR || year > LATEST_YEAR) return null;
  const lastDay = dayLabel(new Date(end.getTime() - 1));
  return { label, start, end, description: `${dayLabel(start)} to ${lastDay}`, lastDay };
}

// ------------------------------------------------------------- compiling

/** The outcome each report figure counts. */
const FIGURE_METRIC = {
  employmentGained: ImpactMetricType.EMPLOYMENT_GAINED,
  housingSecured: ImpactMetricType.HOUSING_SECURED,
  qualificationsObtained: ImpactMetricType.QUALIFICATION_OBTAINED,
  businessesStarted: ImpactMetricType.BUSINESS_STARTED,
  safetyAchieved: ImpactMetricType.SAFETY_ACHIEVED,
} as const;

type OutcomeFigure = keyof typeof FIGURE_METRIC;

/** The count figures, in the order the page shows them. */
export const COUNT_FIGURES = ['totalUsersSupported', ...(Object.keys(FIGURE_METRIC) as OutcomeFigure[])] as const;
export type CountFigure = (typeof COUNT_FIGURES)[number];

export interface ReportFigures {
  totalUsersSupported: number;
  employmentGained: number;
  housingSecured: number;
  qualificationsObtained: number;
  businessesStarted: number;
  safetyAchieved: number;
  /** Null when fewer than MIN_PUBLISHED_COUNT members recorded an increase. */
  avgIncomeIncrease: number | null;
}

/** How a report was counted. Stored in ImpactReport.dataJson and shown with the report. */
export interface ReportBasis {
  method: 'COMPILED_FROM_RECORDS';
  version: 1;
  period: { label: string; start: string; end: string; description: string };
  region: Region;
  communityType: CommunityType | null;
  /** Outcome rows members recorded in the period, and how many of those staff had verified. */
  outcomesRecorded: number;
  outcomesVerified: number;
  /** Women who began or completed a community programme in the period. */
  programmeMembers: number;
  /** Members who recorded an income increase with an amount. */
  incomeReports: number;
  compiledAt: string;
}

export interface CompiledReport {
  figures: ReportFigures;
  basis: ReportBasis;
}

export interface CompileScope {
  period: ReportPeriod;
  region: Region;
  communityType: CommunityType | null;
}

/**
 * Count a period from the records. Reads only; nothing is written here, so
 * staff can look at a report before deciding to publish it.
 *
 * Outcomes are filtered by the member's own region and by the community the
 * outcome was recorded under; programmes by the programme's region and
 * community. "All communities" (null) filters on neither.
 */
export async function compileImpactReport(scope: CompileScope, now: Date = new Date()): Promise<CompiledReport> {
  const { period, region, communityType } = scope;
  const window = { gte: period.start, lt: period.end };
  const metricWhere: Prisma.ImpactMetricWhereInput = {
    createdAt: window,
    user: { region },
    ...(communityType ? { communityType } : {}),
  };

  const [pairs, recorded, verified, income, enrolled] = await Promise.all([
    prisma.impactMetric.groupBy({ by: ['metricType', 'userId'], where: metricWhere }),
    prisma.impactMetric.count({ where: metricWhere }),
    prisma.impactMetric.count({ where: { ...metricWhere, verifiedAt: { not: null } } }),
    prisma.impactMetric.aggregate({
      where: { ...metricWhere, metricType: ImpactMetricType.INCOME_INCREASED, value: { not: null } },
      _avg: { value: true },
      _count: { _all: true },
    }),
    prisma.programEnrollment.findMany({
      where: {
        status: { not: 'CANCELLED' },
        program: { region, ...(communityType ? { communityType } : {}) },
        OR: [{ enrolledAt: window }, { completedAt: window }],
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const women = new Set<string>();
  const byOutcome = new Map<ImpactMetricType, Set<string>>();
  for (const pair of pairs) {
    women.add(pair.userId);
    const set = byOutcome.get(pair.metricType) ?? new Set<string>();
    set.add(pair.userId);
    byOutcome.set(pair.metricType, set);
  }
  for (const row of enrolled) women.add(row.userId);

  const count = (figure: OutcomeFigure) => byOutcome.get(FIGURE_METRIC[figure])?.size ?? 0;
  const incomeReports = income._count._all;
  const average = income._avg.value;

  return {
    figures: {
      totalUsersSupported: women.size,
      employmentGained: count('employmentGained'),
      housingSecured: count('housingSecured'),
      qualificationsObtained: count('qualificationsObtained'),
      businessesStarted: count('businessesStarted'),
      safetyAchieved: count('safetyAchieved'),
      // An average of three women's pay rises is close to a statement about
      // each of them, so it is left out until there are enough to average.
      avgIncomeIncrease: incomeReports >= MIN_PUBLISHED_COUNT && average !== null ? Math.round(Number(average.toString()) * 100) / 100 : null,
    },
    basis: {
      method: 'COMPILED_FROM_RECORDS',
      version: 1,
      period: { label: period.label, start: period.start.toISOString(), end: period.end.toISOString(), description: period.description },
      region,
      communityType,
      outcomesRecorded: recorded,
      outcomesVerified: verified,
      programmeMembers: enrolled.length,
      incomeReports,
      compiledAt: now.toISOString(),
    },
  };
}

/**
 * Why a compiled report may not be published yet, or null when it may.
 * A period still running would be published short, and a total under the
 * floor could identify the women in it.
 */
export function publishRefusal(compiled: CompiledReport, period: ReportPeriod, now: Date = new Date()): string | null {
  if (period.end.getTime() > now.getTime()) {
    return `${period.label} has not ended yet (it runs to ${period.lastDay}), so its report would be short. Publish it once the period is over.`;
  }
  if (compiled.figures.totalUsersSupported < MIN_PUBLISHED_COUNT) {
    return `Fewer than ${MIN_PUBLISHED_COUNT} women are counted in this period, region and community. A report that small could identify them, so it is not published.`;
  }
  return null;
}

/** The row written for a compiled report. */
export function reportRowData(compiled: CompiledReport, narrativeSummary: string | null): Omit<Prisma.ImpactReportUncheckedCreateInput, 'reportPeriod' | 'communityType' | 'region'> {
  const { figures, basis } = compiled;
  return {
    totalUsersSupported: figures.totalUsersSupported,
    employmentGained: figures.employmentGained,
    housingSecured: figures.housingSecured,
    qualificationsObtained: figures.qualificationsObtained,
    businessesStarted: figures.businessesStarted,
    safetyAchieved: figures.safetyAchieved,
    avgIncomeIncrease: figures.avgIncomeIncrease,
    // Nothing on the platform measures economic impact, so a compiled report
    // never claims a figure for it.
    totalEconomicImpact: null,
    narrativeSummary,
    dataJson: basis as unknown as Prisma.InputJsonValue,
  };
}

// ------------------------------------------------------------- reading

type StoredReport = Pick<
  ImpactReport,
  | 'id'
  | 'reportPeriod'
  | 'communityType'
  | 'region'
  | 'totalUsersSupported'
  | 'employmentGained'
  | 'avgIncomeIncrease'
  | 'housingSecured'
  | 'qualificationsObtained'
  | 'businessesStarted'
  | 'safetyAchieved'
  | 'totalEconomicImpact'
  | 'narrativeSummary'
  | 'dataJson'
  | 'createdAt'
>;

/** The public part of the basis. Anything unrecognised in the column is left out rather than echoed. */
function publicBasis(dataJson: Prisma.JsonValue | null): Omit<ReportBasis, 'version'> | null {
  if (!dataJson || typeof dataJson !== 'object' || Array.isArray(dataJson)) return null;
  const basis = dataJson as Record<string, unknown>;
  if (basis.method !== 'COMPILED_FROM_RECORDS') return null;
  const period = basis.period as ReportBasis['period'] | undefined;
  return {
    method: 'COMPILED_FROM_RECORDS',
    period: period ?? { label: '', start: '', end: '', description: '' },
    region: basis.region as Region,
    communityType: (basis.communityType as CommunityType | null) ?? null,
    outcomesRecorded: Number(basis.outcomesRecorded) || 0,
    outcomesVerified: Number(basis.outcomesVerified) || 0,
    programmeMembers: Number(basis.programmeMembers) || 0,
    incomeReports: Number(basis.incomeReports) || 0,
    compiledAt: typeof basis.compiledAt === 'string' ? basis.compiledAt : '',
  };
}

/**
 * A report as the public reads it: counts from one to MIN_PUBLISHED_COUNT - 1
 * become null and are named in `suppressed`, so the page can say "fewer than
 * five" rather than print a number that could point at someone. The basis is
 * shown so the reader knows what the figures rest on.
 */
export function presentPublicReport(report: StoredReport) {
  const suppressed: CountFigure[] = [];
  const shown = {} as Record<CountFigure, number | null>;
  for (const figure of COUNT_FIGURES) {
    const value = report[figure];
    if (value > 0 && value < MIN_PUBLISHED_COUNT) {
      shown[figure] = null;
      suppressed.push(figure);
    } else {
      shown[figure] = value;
    }
  }
  return {
    id: report.id,
    reportPeriod: report.reportPeriod,
    communityType: report.communityType,
    region: report.region,
    ...shown,
    avgIncomeIncrease: report.avgIncomeIncrease === null ? null : Number(report.avgIncomeIncrease.toString()),
    totalEconomicImpact: report.totalEconomicImpact === null ? null : Number(report.totalEconomicImpact.toString()),
    narrativeSummary: report.narrativeSummary,
    basis: publicBasis(report.dataJson),
    suppressed,
    minPublishedCount: MIN_PUBLISHED_COUNT,
    createdAt: report.createdAt,
  };
}

/** The figures of a stored report, for the before and after of an audit row. */
export function storedFigures(report: StoredReport): ReportFigures {
  return {
    totalUsersSupported: report.totalUsersSupported,
    employmentGained: report.employmentGained,
    housingSecured: report.housingSecured,
    qualificationsObtained: report.qualificationsObtained,
    businessesStarted: report.businessesStarted,
    safetyAchieved: report.safetyAchieved,
    avgIncomeIncrease: report.avgIncomeIncrease === null ? null : Number(report.avgIncomeIncrease.toString()),
  };
}

/** A report as staff see it: the exact counts, with the basis beside them. */
export function presentStaffReport(report: StoredReport) {
  return {
    id: report.id,
    reportPeriod: report.reportPeriod,
    communityType: report.communityType,
    region: report.region,
    ...storedFigures(report),
    narrativeSummary: report.narrativeSummary,
    basis: publicBasis(report.dataJson),
    createdAt: report.createdAt,
  };
}
