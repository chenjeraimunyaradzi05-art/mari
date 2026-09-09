/**
 * Two more pieces of the housing strategy: the mortgage comparison the
 * blueprint's debt suite asks for, and the property-investing arithmetic
 * behind "building wealth through property".
 *
 * A loan comparison is worked on the member's own loan over the years she
 * expects to keep it, not the $150,000-over-25-years the advertised
 * comparison rate uses, because that is the number that decides which
 * loan is cheaper for her. The investment property sums gross and net
 * yield, the cash a place needs each week after tax, and what ten years
 * of holding it might look like.
 */

import { AuState, RATES_AS_AT } from './au-rates';
import { calculateStampDuty } from './housing-plan.service';
import { marginalWithMedicare, round, round2 } from './tax-plan.service';

const clamp0 = (n: number) => Math.max(0, n);

// ------------------------------------------------------------ loans

export interface LoanOption {
  name: string;
  ratePct: number;
  annualFee?: number;
  upfrontFee?: number;
  offset?: boolean;
  fixedYears?: number;
  revertRatePct?: number;
}

export interface CompareLoansInput {
  principal: number;
  years: number;
  horizonYears?: number;
  offsetBalance?: number;
  loans: LoanOption[];
}

export interface LoanComparison {
  name: string;
  ratePct: number;
  repayment: number;
  repaymentAfterFixed: number | null;
  interestOverHorizon: number;
  feesOverHorizon: number;
  costOverHorizon: number;
  balanceAfterHorizon: number;
  offsetSaving: number;
  trueRatePct: number;
  cheapest: boolean;
  moreThanCheapest: number;
}

export interface CompareLoansResult {
  asAt: string;
  principal: number;
  years: number;
  horizonYears: number;
  loans: LoanComparison[];
  notes: string[];
}

function repayment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (months <= 0) return 0;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Simulate a loan month by month over the horizon. */
function simulate(principal: number, years: number, horizonMonths: number, loan: LoanOption, offsetBalance: number) {
  const totalMonths = years * 12;
  const fixedMonths = loan.fixedYears ? Math.min(totalMonths, Math.round(loan.fixedYears * 12)) : 0;
  const revert = (loan.revertRatePct ?? loan.ratePct) / 100;
  let balance = principal;
  let interest = 0;
  let interestWithoutOffset = 0;
  let pay = repayment(principal, loan.ratePct / 100, totalMonths);
  let payAfterFixed: number | null = null;

  for (let m = 1; m <= horizonMonths && balance > 0.005; m += 1) {
    const rate = fixedMonths > 0 && m > fixedMonths ? revert : loan.ratePct / 100;
    if (fixedMonths > 0 && m === fixedMonths + 1) {
      pay = repayment(balance, revert, totalMonths - fixedMonths);
      payAfterFixed = pay;
    }
    const chargeable = loan.offset ? clamp0(balance - offsetBalance) : balance;
    const i = chargeable * (rate / 12);
    interestWithoutOffset += balance * (rate / 12);
    interest += i;
    balance = balance + i - Math.min(pay, balance + i);
  }
  return { interest, interestWithoutOffset, balance, repayment: repayment(principal, loan.ratePct / 100, totalMonths), payAfterFixed };
}

/** The single rate that, with no fees, costs the same over the horizon. */
function equivalentRate(principal: number, years: number, horizonMonths: number, targetCost: number, balanceTarget: number): number {
  let lo = 0;
  let hi = 0.3;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const sim = simulate(principal, years, horizonMonths, { name: '', ratePct: mid * 100 }, 0);
    // Cost of borrowing = interest paid plus how much less principal was cleared.
    const cost = sim.interest + (sim.balance - balanceTarget);
    if (cost < targetCost) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function compareLoans(input: CompareLoansInput): CompareLoansResult {
  const principal = clamp0(input.principal);
  const years = Math.min(40, Math.max(1, Math.round(input.years)));
  const horizon = Math.min(years, Math.max(1, Math.round(input.horizonYears ?? 5)));
  const horizonMonths = horizon * 12;
  const offsetBalance = clamp0(input.offsetBalance ?? 0);

  const rows = input.loans.slice(0, 6).map((loan) => {
    const sim = simulate(principal, years, horizonMonths, loan, offsetBalance);
    const fees = clamp0(loan.upfrontFee ?? 0) + clamp0(loan.annualFee ?? 0) * horizon;
    const cost = sim.interest + fees;
    return { loan, sim, fees, cost };
  });
  const cheapestCost = rows.length ? Math.min(...rows.map((r) => r.cost)) : 0;
  const bestBalance = rows.length ? Math.min(...rows.map((r) => r.sim.balance)) : 0;

  const loans: LoanComparison[] = rows.map(({ loan, sim, fees, cost }) => ({
    name: loan.name,
    ratePct: loan.ratePct,
    repayment: round2(sim.repayment),
    repaymentAfterFixed: sim.payAfterFixed !== null ? round2(sim.payAfterFixed) : null,
    interestOverHorizon: round(sim.interest),
    feesOverHorizon: round(fees),
    costOverHorizon: round(cost),
    balanceAfterHorizon: round(sim.balance),
    offsetSaving: round(sim.interestWithoutOffset - sim.interest),
    trueRatePct: round2(equivalentRate(principal, years, horizonMonths, cost + (sim.balance - bestBalance), bestBalance) * 100),
    cheapest: cost === cheapestCost,
    moreThanCheapest: round(cost - cheapestCost),
  }));

  return {
    asAt: RATES_AS_AT,
    principal: round(principal),
    years,
    horizonYears: horizon,
    loans,
    notes: [
      `Cost is interest plus fees over the ${horizon} years you expect to keep the loan, on your own loan amount; the advertised comparison rate is worked on $150,000 over 25 years and can rank loans differently.`,
      'A fixed rate is costed at the fixed rate for its term and the revert rate after, which is where many fixed loans get expensive.',
      offsetBalance > 0 ? `An offset account only earns its keep with money in it: here $${round(offsetBalance).toLocaleString('en-AU')} sits against the loans that have one.` : 'Give an offset balance to see what an offset account is worth to you.',
      'The true rate is the single no-fee rate that would cost the same over the horizon, so loans with different fees can be read on one scale.',
    ],
  };
}

// ---------------------------------------------------- an investment property

export interface InvestmentPropertyInput {
  state: AuState;
  price: number;
  weeklyRent: number;
  depositPct?: number;
  ratePct?: number;
  interestOnly?: boolean;
  years?: number;
  taxableIncome: number;
  managementPct?: number;
  vacancyWeeks?: number;
  annualCosts?: number;
  depreciation?: number;
  growthPct?: number;
  rentGrowthPct?: number;
  horizonYears?: number;
}

export interface InvestmentPropertyResult {
  asAt: string;
  purchaseCosts: { deposit: number; stampDuty: number; other: number; total: number };
  loan: number;
  annualRent: number;
  annualCosts: number;
  interestYear1: number;
  principalYear1: number;
  grossYieldPct: number;
  netYieldPct: number;
  cashFlowBeforeTax: number;
  taxableResult: number;
  taxEffect: number;
  cashFlowAfterTax: number;
  weeklyCostAfterTax: number;
  breakEvenWeeklyRent: number;
  marginalRate: number;
  projection: Array<{ year: number; value: number; loan: number; equity: number; cumulativeCash: number; rent: number }>;
  saleAfterHorizon: { value: number; gain: number; cgt: number; sellingCosts: number; netEquity: number; returnPct: number };
  notes: string[];
}

export function assessInvestmentProperty(input: InvestmentPropertyInput): InvestmentPropertyResult {
  const price = clamp0(input.price);
  const depositPct = Math.min(100, Math.max(0, input.depositPct ?? 20));
  const deposit = price * (depositPct / 100);
  const loan = price - deposit;
  const rate = clamp0(input.ratePct ?? 6.5) / 100;
  const years = Math.min(40, Math.max(1, input.years ?? 30));
  const horizon = Math.min(30, Math.max(1, Math.round(input.horizonYears ?? 10)));
  const marginal = marginalWithMedicare(clamp0(input.taxableIncome));
  const duty = calculateStampDuty({ state: input.state, price, firstHome: false });
  const other = 3500 + (loan > 0 ? 800 : 0);

  const vacancy = Math.min(52, clamp0(input.vacancyWeeks ?? 2));
  const mgmt = Math.min(20, clamp0(input.managementPct ?? 7)) / 100;
  let weeklyRent = clamp0(input.weeklyRent);
  let annualRent = weeklyRent * (52 - vacancy);
  const baseCosts = clamp0(input.annualCosts ?? price * 0.012);
  let costs = baseCosts + annualRent * mgmt;
  const depreciation = clamp0(input.depreciation ?? 0);
  const growth = (input.growthPct ?? 4) / 100;
  const rentGrowth = (input.rentGrowthPct ?? 3) / 100;

  const monthlyPay = input.interestOnly ? (loan * rate) / 12 : repayment(loan, rate, years * 12);
  let balance = loan;
  let value = price;
  let cumulativeCash = 0;
  const projection: InvestmentPropertyResult['projection'] = [];
  let year1: { interest: number; principal: number; cashBefore: number; taxable: number; taxEffect: number; cashAfter: number } | null = null;

  for (let y = 1; y <= horizon; y += 1) {
    let interest = 0;
    let principalPaid = 0;
    for (let m = 0; m < 12; m += 1) {
      const i = balance * (rate / 12);
      interest += i;
      const pay = Math.min(monthlyPay, balance + i);
      const p = input.interestOnly ? 0 : pay - i;
      principalPaid += p;
      balance = clamp0(balance - p);
    }
    const cashBefore = annualRent - costs - interest - principalPaid;
    const taxable = annualRent - costs - interest - depreciation;
    const taxEffect = -taxable * marginal; // a loss comes back as a refund, a profit is taxed
    const cashAfter = cashBefore + taxEffect;
    cumulativeCash += cashAfter;
    if (y === 1) year1 = { interest, principal: principalPaid, cashBefore, taxable, taxEffect, cashAfter };
    value *= 1 + growth;
    projection.push({ year: y, value: round(value), loan: round(balance), equity: round(value - balance), cumulativeCash: round(cumulativeCash), rent: round(weeklyRent) });
    weeklyRent *= 1 + rentGrowth;
    annualRent = weeklyRent * (52 - vacancy);
    costs = baseCosts * Math.pow(1.025, y) + annualRent * mgmt;
  }

  const y1 = year1!;
  const firstYearRent = clamp0(input.weeklyRent) * (52 - vacancy);
  const firstYearCosts = baseCosts + firstYearRent * mgmt;
  const grossYield = price > 0 ? (clamp0(input.weeklyRent) * 52) / price : 0;
  const netYield = price > 0 ? (firstYearRent - firstYearCosts) / price : 0;
  const breakEvenAnnualRent = (firstYearCosts + y1.interest + y1.principal - (y1.interest + baseCosts + depreciation) * marginal) / (1 - mgmt * (1 - marginal) - marginal);
  const breakEvenWeekly = breakEvenAnnualRent / Math.max(1, 52 - vacancy);

  const sellingCosts = value * 0.025;
  const costBase = price + duty.dutyPayable + other;
  const gain = clamp0(value - sellingCosts - costBase);
  const cgt = gain * 0.5 * marginal;
  const netEquity = value - balance - sellingCosts - cgt;
  const invested = deposit + duty.dutyPayable + other - cumulativeCash;
  const returnPct = invested > 0 ? Math.pow(netEquity / invested, 1 / horizon) - 1 : 0;

  return {
    asAt: RATES_AS_AT,
    purchaseCosts: { deposit: round(deposit), stampDuty: duty.dutyPayable, other: round(other), total: round(deposit + duty.dutyPayable + other) },
    loan: round(loan),
    annualRent: round(firstYearRent),
    annualCosts: round(firstYearCosts),
    interestYear1: round(y1.interest),
    principalYear1: round(y1.principal),
    grossYieldPct: round2(grossYield * 100),
    netYieldPct: round2(netYield * 100),
    cashFlowBeforeTax: round(y1.cashBefore),
    taxableResult: round(y1.taxable),
    taxEffect: round(y1.taxEffect),
    cashFlowAfterTax: round(y1.cashAfter),
    weeklyCostAfterTax: round(-y1.cashAfter / 52),
    breakEvenWeeklyRent: round(clamp0(breakEvenWeekly)),
    marginalRate: marginal,
    projection,
    saleAfterHorizon: { value: round(value), gain: round(gain), cgt: round(cgt), sellingCosts: round(sellingCosts), netEquity: round(netEquity), returnPct: round2(returnPct * 100) },
    notes: [
      'A loss on the property comes off your other taxable income (negative gearing), so the tax effect is a refund at your marginal rate; a profit is taxed at it.',
      'Investors pay full transfer duty and no first-home relief. Interest, management, rates, insurance and depreciation on a newer building are deductible; the principal is not.',
      'Held over twelve months, only half the gain is taxed when you sell. Selling costs are taken as 2.5% of the price.',
      'Growth and rent growth are assumptions. A place that only works if prices rise is a bet, not an income.',
    ],
  };
}
