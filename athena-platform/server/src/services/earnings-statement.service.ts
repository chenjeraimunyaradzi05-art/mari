/**
 * What a seller has been paid through ATHENA's escrow, for a financial year or
 * a range of dates, in a form she can keep.
 *
 * The earnings screen used to carry a "Tax Documents" card that said tax
 * document generation was not connected, an Export button that exported
 * nothing and a date-range picker fixed at thirty days. They were removed
 * rather than left looking like features; this is what they stood for, built.
 * A sole trader paid through the platform needs the year's figures — what the
 * buyers paid, what ATHENA kept, what reached her — and needs them to add up.
 *
 * It is a statement of what the escrow rows record, not a tax invoice and not
 * advice, and it says so in the file it produces. Figures are the rows'
 * own: gross is what the buyer paid, the fee is ATHENA's cut as it was taken,
 * and net is the difference. The Australian financial year runs 1 July to
 * 30 June, counted on Queensland time, which has no daylight saving, so a
 * payment released at 9am on 1 July is in the new year and not the old one.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { minorUnitScale } from './stripe-connect.service';
import { isGstRegistered } from './invoice.service';

const QUEENSLAND_OFFSET_MS = 10 * 60 * 60 * 1000;

/** GST is one eleventh of a GST-inclusive price: 10 per cent on top of the rest. */
const GST_FRACTION_DENOMINATOR = 11;

/** A row as the statement and the CSV carry it. Amounts in minor units of `currency`. */
export interface StatementLine {
  id: string;
  /** When the money was released to her, ISO. */
  releasedAt: string;
  description: string;
  kind: string;
  currency: string;
  gross: number;
  fee: number;
  /**
   * The GST inside `fee`, one eleventh of it, once ATHENA is registered for GST
   * and the payment was in Australian dollars; zero before that. ATHENA's fee is
   * quoted as the whole of what it keeps, so it includes the GST, the way an
   * Australian price does. Informational: the statement is not a tax invoice.
   */
  feeGst: number;
  net: number;
  /** RELEASED, or REFUNDED when the buyer was refunded after the release. */
  status: 'RELEASED' | 'REFUNDED';
  /**
   * How much of `gross` has been given back to the buyer so far. A sale
   * refunded in part is still RELEASED, so this is what says it was.
   */
  refunded: number;
}

export interface StatementTotals {
  currency: string;
  /** Released and not refunded. */
  count: number;
  gross: number;
  fee: number;
  /** The GST inside `fee`. See StatementLine. */
  feeGst: number;
  net: number;
  /** Released and later refunded to the buyer; not in the figures above. */
  refundedCount: number;
  refundedNet: number;
}

export interface EarningsStatement {
  /** The year it ends in: 2026 is 1 July 2025 to 30 June 2026. */
  financialYear: number;
  label: string;
  from: string;
  /** Exclusive: midnight at the start of the next financial year. */
  to: string;
  generatedAt: string;
  lines: StatementLine[];
  totals: StatementTotals[];
  /**
   * Whether ATHENA is registered for GST today. When it is, each line and total
   * carries the GST inside the fee, and the CSV gains a column for it. Before
   * that the figures are left as they were, with no GST column to explain.
   */
  gstRegistered: boolean;
  /** The financial years she has anything in, newest first, always including the current one. */
  availableYears: number[];
}

/** The financial year a moment falls in, by its end year, on Queensland time. */
export function financialYearOf(date: Date): number {
  const local = new Date(date.getTime() + QUEENSLAND_OFFSET_MS);
  // July is month 6. July onwards belongs to the year that ends next June.
  return local.getUTCMonth() >= 6 ? local.getUTCFullYear() + 1 : local.getUTCFullYear();
}

/** Midnight on 1 July of the year before, to midnight on 1 July of the year itself, Queensland time. */
export function financialYearBounds(financialYear: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(financialYear - 1, 6, 1) - QUEENSLAND_OFFSET_MS),
    to: new Date(Date.UTC(financialYear, 6, 1) - QUEENSLAND_OFFSET_MS),
  };
}

export function financialYearLabel(financialYear: number): string {
  return `1 July ${financialYear - 1} to 30 June ${financialYear}`;
}

/** What each flow's hold is, in the words the statement uses. */
const KIND_LABELS: Record<string, string> = {
  mentor_session: 'Mentor session',
  service_order: 'Marketplace order',
  service_booking: 'Marketplace booking',
  custom_request: 'Marketplace request',
  vehicle_purchase: 'Car sale',
  car_service: 'Workshop job',
  vehicle_inspection: 'Vehicle inspection',
  course_purchase: 'Course',
  creator_content: 'Creator content',
};

function kindLabel(sessionType: string | null): string {
  return (sessionType && KIND_LABELS[sessionType]) || 'Payment';
}

/**
 * The financial years from the first one she was paid in to the current one,
 * newest first. A member paid nothing yet still gets the current year, so the
 * screen has something to show rather than an empty picker.
 */
async function availableFinancialYears(userId: string, now: Date): Promise<number[]> {
  const first = await prisma.escrowPayment.findFirst({
    where: { sellerId: userId, capturedAt: { not: null }, status: { in: ['CAPTURED', 'REFUNDED'] } },
    orderBy: { capturedAt: 'asc' },
    select: { capturedAt: true },
  });

  const current = financialYearOf(now);
  const earliest = first?.capturedAt ? financialYearOf(first.capturedAt) : current;
  const years: number[] = [];
  for (let year = current; year >= earliest; year -= 1) years.push(year);
  return years;
}

export async function getEarningsStatement(
  userId: string,
  financialYear: number,
  now = new Date()
): Promise<EarningsStatement> {
  const current = financialYearOf(now);
  if (!Number.isInteger(financialYear) || financialYear < 2000 || financialYear > current) {
    throw new ApiError(400, `Choose a financial year from 2000 to ${current}`);
  }

  const { from, to } = financialYearBounds(financialYear);

  const [rows, availableYears] = await Promise.all([
    prisma.escrowPayment.findMany({
      where: {
        sellerId: userId,
        status: { in: ['CAPTURED', 'REFUNDED'] },
        capturedAt: { gte: from, lt: to },
      },
      orderBy: [{ capturedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        amount: true,
        platformFee: true,
        currency: true,
        status: true,
        description: true,
        sessionType: true,
        capturedAt: true,
        refundedAmount: true,
      },
    }),
    availableFinancialYears(userId, now),
  ]);

  const lines: StatementLine[] = rows.map(row => ({
    id: row.id,
    releasedAt: (row.capturedAt as Date).toISOString(),
    description: row.description || kindLabel(row.sessionType),
    kind: kindLabel(row.sessionType),
    currency: row.currency.toUpperCase(),
    gross: row.amount,
    fee: row.platformFee,
    // Asked of the day the money was released, not of today: ATHENA's registration
    // starts on a day, and a payment released before it carried no GST in its fee.
    feeGst:
      row.currency.toUpperCase() === 'AUD' && isGstRegistered(row.capturedAt as Date)
        ? Math.round(row.platformFee / GST_FRACTION_DENOMINATOR)
        : 0,
    net: row.amount - row.platformFee,
    status: row.status === 'REFUNDED' ? 'REFUNDED' : 'RELEASED',
    refunded: row.refundedAmount ?? 0,
  }));

  const byCurrency = new Map<string, StatementTotals>();
  for (const line of lines) {
    const totals =
      byCurrency.get(line.currency) ??
      { currency: line.currency, count: 0, gross: 0, fee: 0, feeGst: 0, net: 0, refundedCount: 0, refundedNet: 0 };
    if (line.status === 'RELEASED') {
      totals.count += 1;
      totals.gross += line.gross;
      totals.fee += line.fee;
      totals.feeGst += line.feeGst;
      totals.net += line.net;
    } else {
      totals.refundedCount += 1;
      totals.refundedNet += line.net;
    }
    byCurrency.set(line.currency, totals);
  }

  return {
    financialYear,
    label: financialYearLabel(financialYear),
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: now.toISOString(),
    lines,
    totals: [...byCurrency.values()].sort((a, b) => b.net - a.net),
    gstRegistered: isGstRegistered(now),
    availableYears,
  };
}

/** A minor-unit amount as a plain decimal in its currency's precision: 12345 AUD is 123.45. */
function decimal(amount: number, currency: string): string {
  const scale = minorUnitScale(currency);
  const places = scale === 1 ? 0 : scale === 1000 ? 3 : 2;
  return (amount / scale).toFixed(places);
}

/** A Queensland calendar date, YYYY-MM-DD, for a spreadsheet to sort on. */
function queenslandDate(iso: string): string {
  return new Date(new Date(iso).getTime() + QUEENSLAND_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * One CSV cell. Quoted when it has to be, and with a leading apostrophe on
 * anything a spreadsheet would run as a formula: descriptions come from order
 * and service titles that other members wrote, and a title beginning "=" would
 * otherwise execute in the seller's spreadsheet when she opens her own
 * statement.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function statementToCsv(statement: EarningsStatement): string {
  const header = [
    'Date released (Queensland)',
    'Reference',
    'Type',
    'Description',
    'Currency',
    'Paid by buyer',
    'ATHENA fee',
    ...(statement.gstRegistered ? ['GST in ATHENA fee'] : []),
    'Paid to you',
    'Status',
  ];

  const lines = statement.lines.map(line =>
    [
      queenslandDate(line.releasedAt),
      line.id,
      line.kind,
      line.description,
      line.currency,
      decimal(line.gross, line.currency),
      decimal(line.fee, line.currency),
      ...(statement.gstRegistered ? [decimal(line.feeGst, line.currency)] : []),
      decimal(line.net, line.currency),
      line.status === 'REFUNDED'
        ? 'Refunded to the buyer after release'
        : line.refunded > 0
          ? `Released; ${decimal(line.refunded, line.currency)} of it refunded to the buyer`
          : 'Released',
    ]
      .map(cell)
      .join(',')
  );

  const totals = statement.totals.map(t =>
    [
      'Total',
      '',
      '',
      `${t.count} payment(s) released and not refunded in full`,
      t.currency,
      decimal(t.gross, t.currency),
      decimal(t.fee, t.currency),
      ...(statement.gstRegistered ? [decimal(t.feeGst, t.currency)] : []),
      decimal(t.net, t.currency),
      t.refundedCount > 0 ? `${t.refundedCount} refunded after release, not included` : '',
    ]
      .map(cell)
      .join(',')
  );

  const notes = [
    `ATHENA earnings statement, financial year ${statement.label}. Generated ${statement.generatedAt}.`,
    'A record of payments ATHENA released to you through Stripe, from ATHENA\'s escrow records. It is not a tax invoice and not tax advice.',
    ...(statement.gstRegistered
      ? ['ATHENA is registered for GST. The GST in ATHENA fee column is one eleventh of the fee, which is quoted as the whole of what ATHENA keeps. Ask your accountant how it applies to you.']
      : []),
    'Your Stripe dashboard is the record of what reached your bank. Ask a registered tax agent or the ATO how to report this income.',
  ].map(note => cell(note));

  // CRLF, which is what RFC 4180 asks for and what Excel expects.
  return [...notes, '', header.map(cell).join(','), ...lines, ...totals].join('\r\n') + '\r\n';
}

export interface EarningsTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: Date;
  capturedAt: Date | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD as the Queensland midnight it starts at, or a 400 naming the field. */
function queenslandMidnight(value: string, field: string): Date {
  if (!DATE_PATTERN.test(value)) throw new ApiError(400, `${field} must be a date written YYYY-MM-DD`);
  const [year, month, day] = value.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new ApiError(400, `${field} is not a real date`);
  }
  return new Date(utc - QUEENSLAND_OFFSET_MS);
}

/**
 * Her escrow payments made between two dates, newest first, a page at a time.
 *
 * The earnings screen listed the twenty most recent and nothing else, with a
 * range picker that could not be moved. Dates are Queensland calendar days and
 * both ends are included; either may be left out.
 */
export async function listEarningsTransactions(
  userId: string,
  query: { from?: string; to?: string; cursor?: string; limit?: number }
): Promise<{ transactions: EarningsTransaction[]; nextCursor: string | null }> {
  const from = query.from ? queenslandMidnight(query.from, 'from') : null;
  const toStart = query.to ? queenslandMidnight(query.to, 'to') : null;
  const toExclusive = toStart ? new Date(toStart.getTime() + 24 * 60 * 60 * 1000) : null;

  if (from && toExclusive && from >= toExclusive) {
    throw new ApiError(400, 'The start date must be on or before the end date');
  }

  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 100);

  const rows = await prisma.escrowPayment.findMany({
    where: {
      sellerId: userId,
      ...(from || toExclusive
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(toExclusive ? { lt: toExclusive } : {}) } }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      amount: true,
      platformFee: true,
      currency: true,
      status: true,
      description: true,
      createdAt: true,
      capturedAt: true,
    },
  });

  const page = rows.slice(0, limit);

  return {
    // Net of ATHENA's fee, as the earnings screen has always shown them.
    transactions: page.map(row => ({
      id: row.id,
      amount: row.amount - row.platformFee,
      currency: row.currency.toUpperCase(),
      status: row.status,
      description: row.description,
      createdAt: row.createdAt,
      capturedAt: row.capturedAt,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}
