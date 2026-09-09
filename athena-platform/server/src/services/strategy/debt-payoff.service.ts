/**
 * The card and loan side of the debt suite: what order to pay debts off
 * in, when they are gone, what the interest costs, and whether rolling
 * them into one loan actually saves anything.
 *
 * Avalanche pays the highest rate first and costs the least; snowball
 * clears the smallest balance first and keeps people going. Both are run
 * so the member can see the price of the one she prefers. A consolidation
 * loan is costed against the plan she would otherwise follow, because a
 * lower rate over a longer term can cost more in total, which is the trap.
 */

import { RATES_AS_AT } from './au-rates';
import { round, round2 } from './tax-plan.service';

const clamp0 = (n: number) => Math.max(0, n);

export interface DebtInput {
  name: string;
  balance: number;
  ratePct: number;
  minPayment?: number;
}

export interface DebtPayoffInput {
  debts: DebtInput[];
  extraMonthly?: number;
  method?: 'avalanche' | 'snowball';
  consolidationRatePct?: number;
  consolidationYears?: number;
  consolidationFee?: number;
}

export interface PayoffPlan {
  method: 'avalanche' | 'snowball';
  months: number | null;
  totalInterest: number;
  totalPaid: number;
  order: Array<{ name: string; clearedMonth: number | null; interest: number }>;
  series: Array<{ month: number; balance: number }>;
  monthlyOutlay: number;
}

export interface DebtPayoffResult {
  asAt: string;
  totalBalance: number;
  minimumsTotal: number;
  weightedRatePct: number;
  chosen: PayoffPlan;
  other: PayoffPlan;
  consolidation: { repayment: number; months: number; totalInterest: number; totalCost: number; savesVsPlan: number; monthsLonger: number; verdict: string } | null;
  notes: string[];
}

function minimumFor(d: DebtInput): number {
  if (d.minPayment && d.minPayment > 0) return d.minPayment;
  // Cards ask about 2% of the balance or $20; a loan with no stated minimum is treated as five years.
  if (d.ratePct >= 12) return Math.max(20, d.balance * 0.02);
  const r = d.ratePct / 100 / 12;
  return r === 0 ? d.balance / 60 : (d.balance * r) / (1 - Math.pow(1 + r, -60));
}

function runPlan(debts: DebtInput[], extra: number, method: 'avalanche' | 'snowball'): PayoffPlan {
  const state = debts.map((d) => ({ ...d, balance: clamp0(d.balance), min: minimumFor(d), interest: 0, cleared: null as number | null }));
  const order = [...state].sort((a, b) => (method === 'avalanche' ? b.ratePct - a.ratePct : a.balance - b.balance));
  const series: PayoffPlan['series'] = [];
  const outlay = state.reduce((s, d) => s + d.min, 0) + extra;
  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;

  while (state.some((d) => d.balance > 0.005) && month < 600) {
    month += 1;
    let budget = outlay;
    // Interest first, then minimums, then everything left to the target.
    for (const d of state) {
      if (d.balance <= 0.005) continue;
      const i = d.balance * (d.ratePct / 100 / 12);
      d.balance += i;
      d.interest += i;
      totalInterest += i;
    }
    for (const d of state) {
      if (d.balance <= 0.005) continue;
      const pay = Math.min(d.min, d.balance, budget);
      d.balance -= pay;
      budget -= pay;
      totalPaid += pay;
    }
    for (const d of order) {
      if (budget <= 0) break;
      if (d.balance <= 0.005) continue;
      const pay = Math.min(d.balance, budget);
      d.balance -= pay;
      budget -= pay;
      totalPaid += pay;
    }
    for (const d of state) if (d.balance <= 0.005 && d.cleared === null) d.cleared = month;
    const total = state.reduce((s, d) => s + d.balance, 0);
    if (month % 3 === 0 || total <= 0.005) series.push({ month, balance: round(total) });
  }

  const done = state.every((d) => d.balance <= 0.005);
  return {
    method,
    months: done ? month : null,
    totalInterest: round(totalInterest),
    totalPaid: round(totalPaid),
    order: order.map((d) => ({ name: d.name, clearedMonth: d.cleared, interest: round(d.interest) })),
    series,
    monthlyOutlay: round(outlay),
  };
}

export function planDebtPayoff(input: DebtPayoffInput): DebtPayoffResult {
  const debts = input.debts.filter((d) => d.balance > 0).slice(0, 12);
  const extra = clamp0(input.extraMonthly ?? 0);
  const method = input.method ?? 'avalanche';
  const total = debts.reduce((s, d) => s + d.balance, 0);
  const weighted = total > 0 ? debts.reduce((s, d) => s + d.balance * d.ratePct, 0) / total : 0;

  const avalanche = runPlan(debts, extra, 'avalanche');
  const snowball = runPlan(debts, extra, 'snowball');
  const chosen = method === 'avalanche' ? avalanche : snowball;
  const other = method === 'avalanche' ? snowball : avalanche;

  let consolidation: DebtPayoffResult['consolidation'] = null;
  if (input.consolidationRatePct !== undefined && total > 0) {
    const rate = clamp0(input.consolidationRatePct) / 100 / 12;
    const months = Math.min(360, Math.max(6, Math.round((input.consolidationYears ?? 5) * 12)));
    const fee = clamp0(input.consolidationFee ?? 0);
    const principal = total + fee;
    const repayment = rate === 0 ? principal / months : (principal * rate) / (1 - Math.pow(1 + rate, -months));
    const totalCost = repayment * months - total;
    const saves = chosen.totalInterest - totalCost;
    const longer = months - (chosen.months ?? months);
    const verdict = saves > 0
      ? `Consolidating saves about $${round(saves).toLocaleString('en-AU')}${longer > 0 ? `, but takes ${longer} months longer; keep paying the old total and it clears sooner still` : ' and clears sooner'}.`
      : `Consolidating costs about $${round(-saves).toLocaleString('en-AU')} more than the ${method} plan, because the lower rate runs for longer. Only worth it if the current repayments are not manageable.`;
    consolidation = { repayment: round2(repayment), months, totalInterest: round(totalCost), totalCost: round(repayment * months), savesVsPlan: round(saves), monthsLonger: Math.max(0, longer), verdict };
  }

  const notes = [
    'Minimums are taken as given, or 2% of a card balance and a five-year loan where none was given.',
    'The extra amount goes to one debt at a time; when it clears, its payment rolls into the next. That rollover is what makes the last debts go fast.',
    weighted >= 15 ? 'Card interest around 20% beats any investment return. Clearing it is the best return available.' : '',
    'A balance transfer at 0% for a period works only if the balance is cleared inside the period and no new spending goes on the card.',
  ].filter(Boolean);

  return {
    asAt: RATES_AS_AT,
    totalBalance: round(total),
    minimumsTotal: round(debts.reduce((s, d) => s + minimumFor(d), 0)),
    weightedRatePct: round2(weighted),
    chosen,
    other,
    consolidation,
    notes,
  };
}
