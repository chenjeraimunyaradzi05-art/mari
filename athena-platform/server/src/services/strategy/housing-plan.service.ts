/**
 * The housing strategy: what rent a member can carry, what a deposit will
 * take and when, what a purchase costs on the day, what the loan costs
 * after, and whether renting or buying comes out ahead over the years.
 *
 * The blueprint lists a mortgage calculator, a stamp duty calculator, Home
 * Guarantee Scheme information and a first-home guide. They are one engine
 * here because they feed each other: the duty and the guarantee decide the
 * cash a deposit plan needs, and the loan decides whether the plan is
 * affordable at all. Rates come from au-rates.ts and are estimates only.
 */

import {
  AU_STATES,
  AuState,
  FIRST_HOME_DUTY,
  HOME_GUARANTEE,
  LMI_BANDS,
  PURCHASE_COSTS,
  RATES_AS_AT,
  STAMP_DUTY,
} from './au-rates';
import { estimateIndividualTax, round, round2 } from './tax-plan.service';

const clamp0 = (n: number) => Math.max(0, n);

export function isAuState(value: unknown): value is AuState {
  return typeof value === 'string' && (AU_STATES as string[]).includes(value);
}

// ------------------------------------------------------------ renting

export interface RentAffordabilityInput {
  annualIncome: number;
  partnerAnnualIncome?: number;
  weeklyRent?: number;
  otherWeeklyCommitments?: number;
}

export interface RentAffordabilityResult {
  asAt: string;
  householdIncome: number;
  netWeeklyIncome: number;
  comfortableWeeklyRent: number;
  stretchWeeklyRent: number;
  weeklyRent: number | null;
  rentShareOfGross: number | null;
  rentShareOfNet: number | null;
  inRentalStress: boolean;
  leftAfterRent: number | null;
  notes: string[];
}

/**
 * The 30% rule, on gross household income, is the line housing agencies use
 * for rental stress. It is shown next to the share of take-home pay, which
 * is what a member actually feels.
 */
export function assessRentAffordability(input: RentAffordabilityInput): RentAffordabilityResult {
  const income = clamp0(input.annualIncome);
  const partner = clamp0(input.partnerAnnualIncome ?? 0);
  const household = income + partner;
  const netAnnual = estimateIndividualTax({ grossIncome: income }).netIncome + (partner > 0 ? estimateIndividualTax({ grossIncome: partner }).netIncome : 0);
  const netWeekly = netAnnual / 52;
  const grossWeekly = household / 52;
  const comfortable = grossWeekly * 0.3;
  const stretch = grossWeekly * 0.35;
  const rent = input.weeklyRent !== undefined && input.weeklyRent > 0 ? input.weeklyRent : null;
  const commitments = clamp0(input.otherWeeklyCommitments ?? 0);

  return {
    asAt: RATES_AS_AT,
    householdIncome: round(household),
    netWeeklyIncome: round(netWeekly),
    comfortableWeeklyRent: round(comfortable),
    stretchWeeklyRent: round(stretch),
    weeklyRent: rent,
    rentShareOfGross: rent !== null && grossWeekly > 0 ? round2((rent / grossWeekly) * 100) : null,
    rentShareOfNet: rent !== null && netWeekly > 0 ? round2((rent / netWeekly) * 100) : null,
    inRentalStress: rent !== null && grossWeekly > 0 && rent / grossWeekly > 0.3,
    leftAfterRent: rent !== null ? round(netWeekly - rent - commitments) : null,
    notes: [
      'Rent over 30% of gross household income is the usual definition of rental stress.',
      'Bond is normally four weeks of rent, and most states let you pay it through a bond loan if you need to.',
    ],
  };
}

// ----------------------------------------------------------- stamp duty

export interface StampDutyInput {
  state: AuState;
  price: number;
  firstHome?: boolean;
  newHome?: boolean;
  regional?: boolean;
}

export interface StampDutyResult {
  asAt: string;
  state: AuState;
  price: number;
  generalDuty: number;
  firstHomeRelief: number;
  dutyPayable: number;
  reliefApplied: 'none' | 'exempt' | 'concession';
  note: string;
}

function dutyFromSchedule(state: AuState, price: number): number {
  if (state === 'NT' && price < 525000) {
    const v = price / 1000;
    return 0.06571441 * v * v + 15 * v;
  }
  const schedule = STAMP_DUTY[state];
  let bracket = schedule[0];
  for (const b of schedule) if (price >= b.threshold) bracket = b;
  if (bracket.flat) return price * bracket.rate;
  return bracket.base + (price - bracket.threshold) * bracket.rate;
}

export function calculateStampDuty(input: StampDutyInput): StampDutyResult {
  const price = clamp0(input.price);
  const general = dutyFromSchedule(input.state, price);
  const relief = FIRST_HOME_DUTY[input.state];
  let payable = general;
  let applied: StampDutyResult['reliefApplied'] = 'none';

  if (input.firstHome) {
    const newHomeFreeStates: AuState[] = ['QLD', 'SA'];
    if (input.newHome && newHomeFreeStates.includes(input.state)) {
      payable = 0;
      applied = 'exempt';
    } else if (price <= relief.exemptUpTo) {
      payable = 0;
      applied = 'exempt';
    } else if (price < relief.concessionUpTo) {
      const through = (price - relief.exemptUpTo) / (relief.concessionUpTo - relief.exemptUpTo);
      payable = general * through;
      applied = 'concession';
    }
  }

  return {
    asAt: RATES_AS_AT,
    state: input.state,
    price: round(price),
    generalDuty: round(general),
    firstHomeRelief: round(general - payable),
    dutyPayable: round(payable),
    reliefApplied: applied,
    note: relief.note,
  };
}

// --------------------------------------------------------------- loan

export interface MortgageInput {
  principal: number;
  annualRatePct: number;
  years: number;
  frequency?: 'monthly' | 'fortnightly' | 'weekly';
  extraRepayment?: number;
}

export interface MortgageResult {
  principal: number;
  annualRatePct: number;
  years: number;
  frequency: 'monthly' | 'fortnightly' | 'weekly';
  repayment: number;
  monthlyEquivalent: number;
  totalInterest: number;
  totalRepaid: number;
  withExtra: { repayment: number; yearsToRepay: number; interestSaved: number } | null;
  bufferedRepayment: number;
}

const PERIODS = { monthly: 12, fortnightly: 26, weekly: 52 } as const;

function repaymentFor(principal: number, annualRate: number, periodsPerYear: number, years: number): number {
  const n = periodsPerYear * years;
  const r = annualRate / periodsPerYear;
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function amortise(principal: number, annualRate: number, periodsPerYear: number, repayment: number, maxYears: number) {
  const r = annualRate / periodsPerYear;
  let balance = principal;
  let interest = 0;
  let periods = 0;
  const limit = periodsPerYear * maxYears + 1;
  while (balance > 0.005 && periods < limit) {
    const i = balance * r;
    interest += i;
    balance = balance + i - repayment;
    periods += 1;
    if (repayment <= i) break; // never repays
  }
  return { interest, periods };
}

export function calculateMortgage(input: MortgageInput): MortgageResult {
  const principal = clamp0(input.principal);
  const rate = clamp0(input.annualRatePct) / 100;
  const years = Math.min(40, Math.max(1, input.years));
  const frequency = input.frequency ?? 'monthly';
  const per = PERIODS[frequency];
  const repayment = repaymentFor(principal, rate, per, years);
  const base = amortise(principal, rate, per, repayment, years);
  const buffered = repaymentFor(principal, rate + 0.03, per, years);

  let withExtra: MortgageResult['withExtra'] = null;
  const extra = clamp0(input.extraRepayment ?? 0);
  if (extra > 0 && principal > 0) {
    const faster = amortise(principal, rate, per, repayment + extra, years);
    withExtra = {
      repayment: round2(repayment + extra),
      yearsToRepay: round2(faster.periods / per),
      interestSaved: round(base.interest - faster.interest),
    };
  }

  return {
    principal: round(principal),
    annualRatePct: input.annualRatePct,
    years,
    frequency,
    repayment: round2(repayment),
    monthlyEquivalent: round2((repayment * per) / 12),
    totalInterest: round(base.interest),
    totalRepaid: round(principal + base.interest),
    withExtra,
    bufferedRepayment: round2(buffered),
  };
}

export interface BorrowingPowerInput {
  annualIncome: number;
  partnerAnnualIncome?: number;
  monthlyLivingExpenses?: number;
  monthlyOtherRepayments?: number;
  creditCardLimits?: number;
  dependants?: number;
  annualRatePct?: number;
  years?: number;
}

export interface BorrowingPowerResult {
  asAt: string;
  netMonthlyIncome: number;
  monthlyLivingExpenses: number;
  monthlySurplus: number;
  assessmentRatePct: number;
  estimatedBorrowingPower: number;
  monthlyRepaymentAtAssessment: number;
  notes: string[];
}

/**
 * The way a lender looks at it: take-home pay less living costs, other
 * repayments and a slice of every card limit, then the loan that surplus
 * services at the offered rate plus a three-point buffer.
 */
export function estimateBorrowingPower(input: BorrowingPowerInput): BorrowingPowerResult {
  const income = clamp0(input.annualIncome);
  const partner = clamp0(input.partnerAnnualIncome ?? 0);
  const netAnnual = estimateIndividualTax({ grossIncome: income }).netIncome + (partner > 0 ? estimateIndividualTax({ grossIncome: partner }).netIncome : 0);
  const netMonthly = netAnnual / 12;
  const adults = partner > 0 ? 2 : 1;
  const dependants = clamp0(input.dependants ?? 0);
  const defaultLiving = 2200 + (adults - 1) * 1300 + dependants * 650;
  const living = Math.max(clamp0(input.monthlyLivingExpenses ?? 0), defaultLiving);
  const commitments = clamp0(input.monthlyOtherRepayments ?? 0) + clamp0(input.creditCardLimits ?? 0) * 0.038;
  const surplus = clamp0(netMonthly - living - commitments);
  const rate = clamp0(input.annualRatePct ?? 6) / 100 + 0.03;
  const years = Math.min(30, Math.max(5, input.years ?? 30));
  const n = years * 12;
  const r = rate / 12;
  const maxRepayment = surplus * 0.9;
  const power = r === 0 ? maxRepayment * n : (maxRepayment * (1 - Math.pow(1 + r, -n))) / r;

  return {
    asAt: RATES_AS_AT,
    netMonthlyIncome: round(netMonthly),
    monthlyLivingExpenses: round(living),
    monthlySurplus: round(surplus),
    assessmentRatePct: round2(rate * 100),
    estimatedBorrowingPower: round(power / 1000) * 1000,
    monthlyRepaymentAtAssessment: round(maxRepayment),
    notes: [
      'Lenders test the loan at the offered rate plus three percentage points, and count around 3.8% of every credit card limit as a monthly commitment.',
      `Living costs are set no lower than a benchmark of $${round(defaultLiving).toLocaleString('en-AU')} a month for your household, which is roughly what lenders use.`,
      'Ten percent of the surplus is left as a buffer. A broker can be more precise with your actual bank statements.',
    ],
  };
}

// ------------------------------------------------------------- deposit

export interface DepositPlanInput {
  state: AuState;
  price: number;
  regional?: boolean;
  firstHome?: boolean;
  newHome?: boolean;
  currentSavings?: number;
  monthlySaving?: number;
  savingsRatePct?: number;
  targetDepositPct?: number;
  useHomeGuarantee?: boolean;
}

export interface DepositPlanResult {
  asAt: string;
  price: number;
  depositPct: number;
  depositAmount: number;
  loanAmount: number;
  lvr: number;
  stampDuty: StampDutyResult;
  otherCosts: number;
  lmiEstimate: number;
  homeGuarantee: { eligible: boolean; cap: number; note: string };
  cashNeeded: number;
  currentSavings: number;
  shortfall: number;
  monthsToTarget: number | null;
  targetDate: string | null;
  monthlySavingNeededIn: { twoYears: number; threeYears: number; fiveYears: number };
  scenarios: Array<{ depositPct: number; depositAmount: number; lmiEstimate: number; cashNeeded: number; monthsToTarget: number | null }>;
  notes: string[];
}

function lmiFor(loan: number, lvr: number, guaranteed: boolean): number {
  if (guaranteed || lvr <= 0.8) return 0;
  const band = LMI_BANDS.find((b) => lvr <= b.maxLvr) ?? LMI_BANDS[LMI_BANDS.length - 1];
  return loan * band.premiumPct;
}

function monthsToSave(target: number, current: number, monthly: number, annualRatePct: number): number | null {
  if (current >= target) return 0;
  if (monthly <= 0) return null;
  const r = annualRatePct / 100 / 12;
  let balance = current;
  for (let m = 1; m <= 600; m += 1) {
    balance = balance * (1 + r) + monthly;
    if (balance >= target) return m;
  }
  return null;
}

function monthlyFor(target: number, current: number, months: number, annualRatePct: number): number {
  if (current >= target) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return (target - current) / months;
  const growth = Math.pow(1 + r, months);
  return clamp0((target - current * growth) * r / (growth - 1));
}

export function planDeposit(input: DepositPlanInput): DepositPlanResult {
  const price = clamp0(input.price);
  const current = clamp0(input.currentSavings ?? 0);
  const monthly = clamp0(input.monthlySaving ?? 0);
  const savingsRate = clamp0(input.savingsRatePct ?? 4);
  const caps = HOME_GUARANTEE.caps[input.state];
  const cap = input.regional ? caps.regional : caps.capital;
  const guaranteeEligible = Boolean(input.firstHome) && price <= cap;
  const useGuarantee = guaranteeEligible && input.useHomeGuarantee !== false;

  const chosenPct = input.targetDepositPct !== undefined ? Math.min(100, Math.max(1, input.targetDepositPct)) : useGuarantee ? HOME_GUARANTEE.minDepositPct * 100 : 20;
  const stampDuty = calculateStampDuty({ state: input.state, price, firstHome: input.firstHome, newHome: input.newHome, regional: input.regional });
  const otherCosts = PURCHASE_COSTS.conveyancing + PURCHASE_COSTS.inspections + PURCHASE_COSTS.lenderFees + PURCHASE_COSTS.movingAndSetup;

  const scenario = (depositPct: number) => {
    const depositAmount = price * (depositPct / 100);
    const loan = price - depositAmount;
    const lvr = price > 0 ? loan / price : 0;
    const guaranteedHere = useGuarantee && depositPct >= HOME_GUARANTEE.minDepositPct * 100;
    const lmi = lmiFor(loan, lvr, guaranteedHere);
    const cashNeeded = depositAmount + stampDuty.dutyPayable + otherCosts + lmi;
    return { depositPct, depositAmount: round(depositAmount), lmiEstimate: round(lmi), cashNeeded: round(cashNeeded), monthsToTarget: monthsToSave(cashNeeded, current, monthly, savingsRate), loan, lvr };
  };

  const chosen = scenario(chosenPct);
  const months = chosen.monthsToTarget;
  const targetDate = months === null ? null : new Date(Date.now() + months * 30.44 * 86400000).toISOString().slice(0, 10);

  const notes = [
    guaranteeEligible ? `Under the Home Guarantee Scheme cap of $${cap.toLocaleString('en-AU')} for this area, so a 5% deposit needs no lenders mortgage insurance.` : input.firstHome ? `Over the Home Guarantee Scheme cap of $${cap.toLocaleString('en-AU')} for this area, so a deposit under 20% will carry lenders mortgage insurance.` : 'Lenders mortgage insurance applies to a deposit under 20% unless a guarantee covers it.',
    stampDuty.note,
    `Other costs cover conveyancing, inspections, lender fees and moving, about $${otherCosts.toLocaleString('en-AU')} together.`,
    'The First Home Super Saver scheme lets you withdraw voluntary super contributions of up to $50,000 for a first home deposit, taxed at a lower rate.',
  ];

  return {
    asAt: RATES_AS_AT,
    price: round(price),
    depositPct: chosenPct,
    depositAmount: chosen.depositAmount,
    loanAmount: round(chosen.loan),
    lvr: round2(chosen.lvr * 100),
    stampDuty,
    otherCosts,
    lmiEstimate: chosen.lmiEstimate,
    homeGuarantee: { eligible: guaranteeEligible, cap, note: `${HOME_GUARANTEE.asAt}: 5% deposit, no income cap, home under the area cap.` },
    cashNeeded: chosen.cashNeeded,
    currentSavings: round(current),
    shortfall: round(clamp0(chosen.cashNeeded - current)),
    monthsToTarget: months,
    targetDate,
    monthlySavingNeededIn: {
      twoYears: round(monthlyFor(chosen.cashNeeded, current, 24, savingsRate)),
      threeYears: round(monthlyFor(chosen.cashNeeded, current, 36, savingsRate)),
      fiveYears: round(monthlyFor(chosen.cashNeeded, current, 60, savingsRate)),
    },
    scenarios: [5, 10, 20].map((p) => {
      const s = scenario(p);
      return { depositPct: s.depositPct, depositAmount: s.depositAmount, lmiEstimate: s.lmiEstimate, cashNeeded: s.cashNeeded, monthsToTarget: s.monthsToTarget };
    }),
    notes,
  };
}

// ------------------------------------------------------- rent or buy

export interface RentVsBuyInput {
  state: AuState;
  price: number;
  weeklyRent: number;
  depositPct?: number;
  annualRatePct?: number;
  years?: number;
  propertyGrowthPct?: number;
  rentGrowthPct?: number;
  investmentReturnPct?: number;
  firstHome?: boolean;
  regional?: boolean;
}

export interface RentVsBuyResult {
  asAt: string;
  years: number;
  buying: { upfront: number; totalRepayments: number; totalInterest: number; ownershipCosts: number; endValue: number; loanRemaining: number; equity: number; netPosition: number };
  renting: { totalRent: number; investedDeposit: number; netPosition: number };
  difference: number;
  ahead: 'buying' | 'renting';
  breakEvenYear: number | null;
  series: Array<{ year: number; buying: number; renting: number }>;
  notes: string[];
}

/**
 * Both paths start with the same cash. The buyer spends it on the deposit
 * and costs, pays the loan and the running costs, and ends with the home
 * less the debt. The renter pays rent that rises each year and invests the
 * same starting cash plus whatever the buyer would have spent over the rent.
 */
export function compareRentVsBuy(input: RentVsBuyInput): RentVsBuyResult {
  const price = clamp0(input.price);
  const years = Math.min(30, Math.max(1, input.years ?? 10));
  const depositPct = Math.min(100, Math.max(5, input.depositPct ?? 20));
  const rate = clamp0(input.annualRatePct ?? 6) / 100;
  const growth = (input.propertyGrowthPct ?? 4) / 100;
  const rentGrowth = (input.rentGrowthPct ?? 3) / 100;
  const invest = (input.investmentReturnPct ?? 6.5) / 100;

  const plan = planDeposit({ state: input.state, price, firstHome: input.firstHome, regional: input.regional, targetDepositPct: depositPct });
  const upfront = plan.cashNeeded;
  const loan = plan.loanAmount;
  const monthlyRepayment = repaymentFor(loan, rate, 12, 30);
  const monthlyRate = rate / 12;

  let balance = loan;
  let totalInterest = 0;
  let totalRepayments = 0;
  let ownershipCosts = 0;
  let value = price;
  let rent = clamp0(input.weeklyRent) * 52;
  let totalRent = 0;
  let renterPot = upfront;
  let breakEvenYear: number | null = null;
  const series: RentVsBuyResult['series'] = [];

  for (let y = 1; y <= years; y += 1) {
    let yearInterest = 0;
    let yearRepay = 0;
    for (let m = 0; m < 12; m += 1) {
      if (balance <= 0) break;
      const i = balance * monthlyRate;
      const pay = Math.min(monthlyRepayment, balance + i);
      yearInterest += i;
      yearRepay += pay;
      balance = balance + i - pay;
    }
    const upkeep = value * 0.012; // rates, insurance, maintenance, strata
    totalInterest += yearInterest;
    totalRepayments += yearRepay;
    ownershipCosts += upkeep;
    value *= 1 + growth;

    const ownerOutlay = yearRepay + upkeep;
    totalRent += rent;
    // The renter invests whatever the owner paid above the rent that year.
    renterPot = renterPot * (1 + invest) + clamp0(ownerOutlay - rent);
    rent *= 1 + rentGrowth;

    const buyingNet = value - balance - value * 0.025; // less selling costs
    const rentingNet = renterPot;
    series.push({ year: y, buying: round(buyingNet), renting: round(rentingNet) });
    if (breakEvenYear === null && buyingNet >= rentingNet) breakEvenYear = y;
  }

  const equity = value - balance;
  const buyingNet = equity - value * 0.025;
  const rentingNet = renterPot;

  return {
    asAt: RATES_AS_AT,
    years,
    buying: {
      upfront: round(upfront),
      totalRepayments: round(totalRepayments),
      totalInterest: round(totalInterest),
      ownershipCosts: round(ownershipCosts),
      endValue: round(value),
      loanRemaining: round(balance),
      equity: round(equity),
      netPosition: round(buyingNet),
    },
    renting: { totalRent: round(totalRent), investedDeposit: round(renterPot), netPosition: round(rentingNet) },
    difference: round(buyingNet - rentingNet),
    ahead: buyingNet >= rentingNet ? 'buying' : 'renting',
    breakEvenYear,
    series,
    notes: [
      'Ownership costs are taken as 1.2% of the value each year for rates, insurance, maintenance and strata, and 2.5% is allowed for selling costs at the end.',
      'The renter is assumed to invest the deposit and every dollar the owner pays above the rent, which is the discipline the comparison depends on.',
      'Growth rates are assumptions, not forecasts. Change them and see how much the answer moves.',
    ],
  };
}

/** What the housing pages need to draw their forms. */
export function housingReference() {
  return {
    asAt: RATES_AS_AT,
    states: AU_STATES,
    homeGuarantee: HOME_GUARANTEE,
    firstHomeDuty: FIRST_HOME_DUTY,
    purchaseCosts: PURCHASE_COSTS,
  };
}
