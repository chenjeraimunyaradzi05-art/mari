/**
 * The Business Activity Statement (BAS) worksheet, counted from the ledger.
 *
 * Every posted journal line in the period is summed per account, and each
 * account's tax treatment says where it lands on the statement: taxable,
 * GST-free, export and input-taxed sales (G1 to G4), capital and other
 * purchases (G10, G11), and the GST accounts themselves (1A collected, 1B
 * paid). Where no GST account has been tagged, 1A and 1B are estimated at
 * one tenth of the taxable amounts and the worksheet says so.
 *
 * There is no direct lodgement: that needs an ATO-registered digital
 * service provider with machine credentials. The figures are prepared here,
 * the person lodges through ATO Online Services, and the lodgement is
 * recorded as a submitted tax return with the worksheet attached.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { createTaxReturn, submitTaxReturn } from './tax.service';

const round2 = (n: number) => Math.round(n * 100) / 100;
const GST_RATE = 0.1;
const MAX_PERIOD_DAYS = 366;

export interface BasLine {
  accountId: string;
  code: string | null;
  name: string;
  type: string;
  taxTreatment: string;
  amount: number;
  label: string;
}

export interface BasWorksheet {
  period: { from: string; to: string; label: string };
  sales: { taxable: number; gstFree: number; export: number; inputTaxed: number };
  purchases: { capital: number; nonCapital: number; capitalTaxable: number; nonCapitalTaxable: number };
  g1: number;
  g2: number;
  g3: number;
  g4: number;
  g10: number;
  g11: number;
  oneA: number;
  oneB: number;
  oneAEstimated: boolean;
  oneBEstimated: boolean;
  net: number;
  lines: BasLine[];
  basis: string;
}

/** Quarter label on the Australian financial year (starts 1 July). */
export function periodLabel(from: Date, to: Date): string {
  const month = from.getUTCMonth() + 1;
  const year = from.getUTCFullYear();
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days > 100) return `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`;
  if (month >= 7 && month <= 9) return `Q1 FY${year + 1}`;
  if (month >= 10) return `Q2 FY${year + 1}`;
  if (month <= 3) return `Q3 FY${year}`;
  return `Q4 FY${year}`;
}

export function parsePeriod(fromInput: unknown, toInput: unknown): { from: Date; to: Date } {
  const parse = (value: unknown, endOfDay: boolean): Date => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}/.test(text)) throw new ApiError(400, 'Give the period as YYYY-MM-DD dates');
    const date = new Date(text.length === 10 ? `${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : text);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'That is not a real date');
    return date;
  };
  const from = parse(fromInput, false);
  const to = parse(toInput, true);
  if (from > to) throw new ApiError(400, 'The period has to start before it ends');
  if ((to.getTime() - from.getTime()) / 86400000 > MAX_PERIOD_DAYS) throw new ApiError(400, 'A BAS period is at most a year');
  return { from, to };
}

export async function computeBas(params: { userId: string; organizationId?: string; from: Date; to: Date }): Promise<BasWorksheet> {
  const scope = params.organizationId ? { organizationId: params.organizationId } : { userId: params.userId, organizationId: null };
  const journalLines = await prisma.journalLine.findMany({
    where: { journalEntry: { status: 'POSTED', ...scope, entryDate: { gte: params.from, lte: params.to } } },
    include: { account: { select: { id: true, name: true, code: true, type: true, taxTreatment: true } } },
  });

  // Net movement per account on its natural side: credit for revenue,
  // liabilities and equity; debit for assets and expenses.
  const perAccount = new Map<string, { account: (typeof journalLines)[number]['account']; debit: number; credit: number }>();
  for (const line of journalLines) {
    const entry = perAccount.get(line.accountId) ?? { account: line.account, debit: 0, credit: 0 };
    entry.debit += Number(line.debit || 0);
    entry.credit += Number(line.credit || 0);
    perAccount.set(line.accountId, entry);
  }

  const sales = { taxable: 0, gstFree: 0, export: 0, inputTaxed: 0 };
  const purchases = { capital: 0, nonCapital: 0, capitalTaxable: 0, nonCapitalTaxable: 0 };
  let collected = 0;
  let paid = 0;
  let sawCollected = false;
  let sawPaid = false;
  const lines: BasLine[] = [];

  for (const { account, debit, credit } of perAccount.values()) {
    const creditSide = account.type === 'REVENUE' || account.type === 'LIABILITY' || account.type === 'EQUITY';
    const net = round2(creditSide ? credit - debit : debit - credit);
    const treatment = account.taxTreatment;
    let label: string | null = null;

    if (treatment === 'GST_COLLECTED') {
      collected += net;
      sawCollected = true;
      label = '1A GST on sales';
    } else if (treatment === 'GST_PAID') {
      paid += net;
      sawPaid = true;
      label = '1B GST on purchases';
    } else if (treatment === 'CAPITAL') {
      purchases.capital += net;
      purchases.capitalTaxable += net;
      label = 'G10 capital purchases';
    } else if (treatment === 'BAS_EXCLUDED') {
      label = null;
    } else if (account.type === 'REVENUE') {
      if (treatment === 'GST_FREE') {
        sales.gstFree += net;
        label = 'G3 GST-free sales';
      } else if (treatment === 'EXPORT') {
        sales.export += net;
        label = 'G2 export sales';
      } else if (treatment === 'INPUT_TAXED') {
        sales.inputTaxed += net;
        label = 'G4 input-taxed sales';
      } else {
        sales.taxable += net;
        label = 'G1 taxable sales';
      }
    } else if (account.type === 'EXPENSE') {
      purchases.nonCapital += net;
      if (treatment === 'GST') purchases.nonCapitalTaxable += net;
      label = 'G11 non-capital purchases';
    }
    // Other balance-sheet accounts (the bank, loans, equity) are not BAS items.

    if (label) {
      lines.push({ accountId: account.id, code: account.code ?? null, name: account.name, type: account.type, taxTreatment: treatment, amount: net, label });
    }
  }

  const oneAEstimated = !sawCollected;
  const oneBEstimated = !sawPaid;
  const oneA = round2(oneAEstimated ? sales.taxable * GST_RATE : collected);
  const oneB = round2(oneBEstimated ? (purchases.capitalTaxable + purchases.nonCapitalTaxable) * GST_RATE : paid);

  // The statement's G fields are GST-inclusive: sales carry the GST
  // collected; taxable purchases carry a tenth on top of their net cost.
  const g1 = round2(sales.taxable + sales.gstFree + sales.export + sales.inputTaxed + oneA);
  const g10 = round2(purchases.capital + purchases.capitalTaxable * GST_RATE);
  const g11 = round2(purchases.nonCapital + purchases.nonCapitalTaxable * GST_RATE);

  return {
    period: { from: params.from.toISOString().slice(0, 10), to: params.to.toISOString().slice(0, 10), label: periodLabel(params.from, params.to) },
    sales: { taxable: round2(sales.taxable), gstFree: round2(sales.gstFree), export: round2(sales.export), inputTaxed: round2(sales.inputTaxed) },
    purchases: {
      capital: round2(purchases.capital),
      nonCapital: round2(purchases.nonCapital),
      capitalTaxable: round2(purchases.capitalTaxable),
      nonCapitalTaxable: round2(purchases.nonCapitalTaxable),
    },
    g1,
    g2: round2(sales.export),
    g3: round2(sales.gstFree),
    g4: round2(sales.inputTaxed),
    g10,
    g11,
    oneA,
    oneB,
    oneAEstimated,
    oneBEstimated,
    net: round2(oneA - oneB),
    lines: lines.sort((a, b) => a.label.localeCompare(b.label) || (a.code ?? a.name).localeCompare(b.code ?? b.name)),
    basis: 'Posted journal entries dated in the period, on the accrual basis.',
  };
}

export async function lodgeBas(params: {
  userId: string;
  organizationId?: string;
  from: Date;
  to: Date;
  w1?: number;
  w2?: number;
  reference?: string;
  lodgedVia?: string;
}) {
  const worksheet = await computeBas(params);
  const w1 = round2(Math.max(0, Number(params.w1) || 0));
  const w2 = round2(Math.max(0, Number(params.w2) || 0));
  const payable = round2(worksheet.net + w2);

  const created = await createTaxReturn({
    organizationId: params.organizationId,
    userId: params.userId,
    periodStart: params.from,
    periodEnd: params.to,
    currency: 'AUD',
    totalSales: Math.max(worksheet.g1, 0),
    totalTax: Math.max(payable, 0),
    reference: params.reference?.trim() || `BAS ${worksheet.period.label}`,
    metadata: {
      kind: 'BAS',
      worksheet,
      w1,
      w2,
      payable,
      refund: payable < 0 ? round2(-payable) : 0,
      lodgedVia: params.lodgedVia?.trim() || 'ATO Online Services for business',
      recordedAt: new Date().toISOString(),
    },
  });
  return submitTaxReturn(created.id, params.userId);
}
