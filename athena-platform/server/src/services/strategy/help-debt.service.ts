/**
 * The HECS-HELP debt optimiser from the blueprint's debt suite.
 *
 * A HELP debt has no interest but is indexed each June, and is repaid
 * through the tax system at a rate that rises with income. The questions
 * a member actually has are: when will it be gone, what does a lump sum
 * or an extra amount each month do to that, and is she better off paying
 * it down or investing the money. All three are answered by running the
 * balance forward a year at a time.
 */

import { HELP_REPAYMENT, RATES_AS_AT } from './au-rates';
import { helpRepaymentOn, round, round2 } from './tax-plan.service';

const clamp0 = (n: number) => Math.max(0, n);

export interface HelpDebtInput {
  balance: number;
  income: number;
  incomeGrowthPct?: number;
  indexationPct?: number;
  lumpSum?: number;
  extraMonthly?: number;
  investReturnPct?: number;
}

export interface HelpScenario {
  key: 'base' | 'lumpSum' | 'extraMonthly';
  label: string;
  yearsToRepay: number | null;
  totalIndexation: number;
  totalRepaid: number;
  voluntaryPaid: number;
  series: Array<{ year: number; balance: number; compulsory: number; indexation: number }>;
}

export interface HelpDebtResult {
  asAt: string;
  balance: number;
  compulsoryThisYear: number;
  repaymentRatePct: number;
  scenarios: HelpScenario[];
  lumpSumComparison: { lumpSum: number; indexationSaved: number; investedInstead: number; yearsSooner: number; verdict: string } | null;
  notes: string[];
}

function run(input: HelpDebtInput, lumpSum: number, extraMonthly: number): HelpScenario['series'] & { years: number | null; indexation: number; repaid: number; voluntary: number } {
  let balance = clamp0(input.balance);
  let income = clamp0(input.income);
  const growth = (input.incomeGrowthPct ?? 3) / 100;
  const index = clamp0(input.indexationPct ?? 3.2) / 100;
  const series: HelpScenario['series'] = [];
  let totalIndex = 0;
  let repaid = 0;
  let voluntary = 0;
  let years: number | null = null;

  // A lump sum is paid before indexation, which is the whole point of it.
  const first = Math.min(lumpSum, balance);
  balance -= first;
  voluntary += first;
  repaid += first;

  for (let y = 1; y <= 40 && balance > 0.5; y += 1) {
    const extra = Math.min(balance, extraMonthly * 12);
    balance -= extra;
    voluntary += extra;
    repaid += extra;
    const indexation = balance * index;
    totalIndex += indexation;
    balance += indexation;
    const compulsory = Math.min(balance, helpRepaymentOn(income));
    balance -= compulsory;
    repaid += compulsory;
    series.push({ year: y, balance: round(balance), compulsory: round(compulsory), indexation: round(indexation) });
    if (balance <= 0.5) { years = y; break; }
    income *= 1 + growth;
  }
  return Object.assign(series, { years, indexation: totalIndex, repaid, voluntary });
}

export function planHelpDebt(input: HelpDebtInput): HelpDebtResult {
  const balance = clamp0(input.balance);
  const lump = Math.min(balance, clamp0(input.lumpSum ?? 0));
  const extra = clamp0(input.extraMonthly ?? 0);
  const investReturn = clamp0(input.investReturnPct ?? 6.5) / 100;
  const index = clamp0(input.indexationPct ?? 3.2) / 100;

  const base = run(input, 0, 0);
  const withLump = run(input, lump, 0);
  const withExtra = run(input, 0, extra);

  const scenario = (key: HelpScenario['key'], label: string, r: ReturnType<typeof run>): HelpScenario => ({
    key, label, yearsToRepay: r.years, totalIndexation: round(r.indexation), totalRepaid: round(r.repaid), voluntaryPaid: round(r.voluntary), series: [...r],
  });

  let lumpSumComparison: HelpDebtResult['lumpSumComparison'] = null;
  if (lump > 0) {
    const years = withLump.years ?? base.years ?? 10;
    const invested = lump * Math.pow(1 + investReturn, years);
    const indexationSaved = base.indexation - withLump.indexation;
    const yearsSooner = (base.years ?? 40) - (withLump.years ?? 40);
    const verdict = investReturn > index
      ? `Invested at ${(investReturn * 100).toFixed(1)}% the lump sum would grow to about $${round(invested).toLocaleString('en-AU')}, more than the $${round(indexationSaved).toLocaleString('en-AU')} of indexation it saves. Paying it early only wins if the debt is the thing keeping you up at night, or you want the higher take-home pay sooner.`
      : `Indexation at ${(index * 100).toFixed(1)}% is above the return you expect, so paying the lump sum saves more than investing it would earn.`;
    lumpSumComparison = { lumpSum: round(lump), indexationSaved: round(indexationSaved), investedInstead: round(invested), yearsSooner, verdict };
  }

  return {
    asAt: RATES_AS_AT,
    balance: round(balance),
    compulsoryThisYear: round(helpRepaymentOn(clamp0(input.income))),
    repaymentRatePct: round2(clamp0(input.income) > HELP_REPAYMENT.threshold ? (helpRepaymentOn(clamp0(input.income)) / clamp0(input.income)) * 100 : 0),
    scenarios: [
      scenario('base', 'Compulsory repayments only', base),
      scenario('lumpSum', lump > 0 ? `A $${round(lump).toLocaleString('en-AU')} lump sum now` : 'A lump sum now', withLump),
      scenario('extraMonthly', extra > 0 ? `$${round(extra).toLocaleString('en-AU')} extra a month` : 'Extra each month', withExtra),
    ],
    lumpSumComparison,
    notes: [
      `From 1 July 2025 repayments start at $${HELP_REPAYMENT.threshold.toLocaleString('en-AU')} and are ${Math.round(HELP_REPAYMENT.lowerRate * 100)}c in the dollar above it, ${Math.round(HELP_REPAYMENT.upperRate * 100)}c above $${HELP_REPAYMENT.upperThreshold.toLocaleString('en-AU')}. Your employer withholds them through the year.`,
      'Indexation is applied on 1 June at the lower of CPI and wage growth; a voluntary payment before then is not indexed. There is no discount for paying early.',
      'A HELP debt does not count toward a home loan the way a card does, but the repayment reduces the income a lender counts.',
      'Repayment income includes salary sacrificed super and fringe benefits, so packaging does not shrink the repayment.',
    ],
  };
}
