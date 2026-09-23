/**
 * Car finance, worked out honestly: the repayment on a loan (with a
 * balloon if there is one), several loans compared on what they really
 * cost, what a member can carry, the whole cost of owning a car over the
 * years she will keep it, and how ready an application is before a lender
 * sees it. Nothing here is a credit decision; it is the arithmetic a good
 * broker would do on a napkin, with the assumptions written down.
 */

import { INCOME_TAX_BRACKETS, MEDICARE_LEVY } from '../strategy/au-rates';
import { FINANCE_DEFAULTS, LENDER_CHECKS, REGO_AND_CTP, type AuState, type BodyKey, type FuelKey } from './automotive-library';
import { projectValue } from './valuation.service';
import { estimatePremium } from './car-insurance.service';

const round = (n: number, places = 0) => { const f = 10 ** places; return Math.round(n * f) / f; };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------- repayment

export interface RepaymentInput {
  amount: number;
  ratePct: number;
  termMonths: number;
  balloonPct?: number;
  establishmentFee?: number;
  monthlyFee?: number;
}

export interface RepaymentYear {
  year: number;
  opening: number;
  interest: number;
  principal: number;
  closing: number;
}

export interface RepaymentResult {
  repayment: number;
  weekly: number;
  fortnightly: number;
  balloon: number;
  totalRepaid: number;
  totalInterest: number;
  totalFees: number;
  totalCost: number;
  /** The rate with the fees folded in, the way a comparison rate is built. */
  effectiveRatePct: number;
  schedule: RepaymentYear[];
}

/** The level monthly payment that clears the amount, less any balloon, over the term. */
export function monthlyPayment(amount: number, ratePct: number, termMonths: number, balloon = 0): number {
  const n = Math.max(1, Math.round(termMonths));
  const r = ratePct / 1200;
  if (r <= 0) return (amount - balloon) / n;
  const pow = (1 + r) ** n;
  return (amount - balloon / pow) * r / (1 - 1 / pow);
}

/** The amount a monthly payment supports over a term at a rate. */
export function presentValue(payment: number, ratePct: number, termMonths: number): number {
  const n = Math.max(1, Math.round(termMonths));
  const r = ratePct / 1200;
  if (r <= 0) return payment * n;
  return payment * (1 - (1 + r) ** -n) / r;
}

/** The annual rate at which the borrower's true cash flows balance, by bisection. */
export function effectiveRate(netAdvance: number, outgoingMonthly: number, termMonths: number, balloon: number): number {
  if (netAdvance <= 0) return 0;
  const n = Math.max(1, Math.round(termMonths));
  const pv = (r: number) => (r <= 0 ? outgoingMonthly * n + balloon : outgoingMonthly * (1 - (1 + r) ** -n) / r + balloon / (1 + r) ** n);
  let lo = 0;
  let hi = 0.2;
  if (pv(0) <= netAdvance) return 0;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > netAdvance) lo = mid; else hi = mid;
  }
  return round(((lo + hi) / 2) * 1200, 2);
}

export function calculateRepayment(input: RepaymentInput): RepaymentResult {
  const amount = Math.max(0, input.amount);
  const term = clamp(Math.round(input.termMonths || FINANCE_DEFAULTS.typicalTermMonths), 6, 120);
  const balloon = round(amount * clamp(input.balloonPct ?? 0, 0, 60) / 100);
  const establishment = Math.max(0, input.establishmentFee ?? 0);
  const monthlyFee = Math.max(0, input.monthlyFee ?? 0);
  const repayment = monthlyPayment(amount, input.ratePct, term, balloon);
  const totalRepaid = repayment * term + balloon;
  const totalFees = establishment + monthlyFee * term;
  const totalInterest = totalRepaid - amount;

  const schedule: RepaymentYear[] = [];
  let balance = amount;
  const r = input.ratePct / 1200;
  for (let y = 1; y <= Math.ceil(term / 12); y += 1) {
    const opening = balance;
    let interest = 0;
    let principal = 0;
    for (let m = 0; m < 12 && (y - 1) * 12 + m < term; m += 1) {
      const i = balance * r;
      const p = repayment - i;
      interest += i;
      principal += p;
      balance -= p;
    }
    schedule.push({ year: y, opening: round(opening), interest: round(interest), principal: round(principal), closing: round(Math.max(0, balance)) });
  }

  return {
    repayment: round(repayment, 2),
    weekly: round(repayment * 12 / 52, 2),
    fortnightly: round(repayment * 12 / 26, 2),
    balloon,
    totalRepaid: round(totalRepaid),
    totalInterest: round(totalInterest),
    totalFees: round(totalFees),
    totalCost: round(totalInterest + totalFees),
    effectiveRatePct: effectiveRate(amount - establishment, repayment + monthlyFee, term, balloon),
    schedule,
  };
}

// ------------------------------------------------------------------ compare

export interface LoanOption {
  name: string;
  ratePct: number;
  establishmentFee?: number;
  monthlyFee?: number;
  balloonPct?: number;
  earlyExitFee?: number;
  secured?: boolean;
  lender?: string;
}

export interface LoanComparison extends RepaymentResult {
  name: string;
  lender?: string;
  ratePct: number;
  secured: boolean;
  earlyExitFee: number;
  cheapest: boolean;
  moreThanCheapest: number;
  note: string;
}

export function compareCarLoans(input: { amount: number; termMonths: number; loans: LoanOption[] }): { loans: LoanComparison[]; cheapest: string | null; note: string } {
  const rows = input.loans.slice(0, 8).map((l) => {
    const r = calculateRepayment({ amount: input.amount, ratePct: l.ratePct, termMonths: input.termMonths, balloonPct: l.balloonPct, establishmentFee: l.establishmentFee, monthlyFee: l.monthlyFee });
    const parts: string[] = [];
    if ((l.balloonPct ?? 0) > 0) parts.push(`a ${l.balloonPct}% balloon of $${r.balloon.toLocaleString('en-AU')} still owing at the end`);
    if ((l.monthlyFee ?? 0) > 0) parts.push(`$${l.monthlyFee} a month in fees`);
    if (l.secured === false) parts.push('unsecured, so the car is not at risk but the rate is higher');
    return { ...r, name: l.name, lender: l.lender, ratePct: l.ratePct, secured: l.secured !== false, earlyExitFee: l.earlyExitFee ?? 0, cheapest: false, moreThanCheapest: 0, note: parts.length ? `Includes ${parts.join(', ')}.` : 'A plain loan: what you see is what you pay.' };
  });
  const min = rows.length ? Math.min(...rows.map((r) => r.totalCost)) : 0;
  for (const r of rows) { r.cheapest = r.totalCost === min; r.moreThanCheapest = round(r.totalCost - min); }
  rows.sort((a, b) => a.totalCost - b.totalCost);
  return { loans: rows, cheapest: rows[0]?.name ?? null, note: FINANCE_DEFAULTS.comparisonNote };
}

// ------------------------------------------------------------ affordability

/** Take-home pay for a year, from the resident brackets and the Medicare levy. Offsets and HELP are left out, and said so. */
export function netAnnualIncome(gross: number): number {
  if (gross <= 0) return 0;
  let tax = 0;
  for (const b of INCOME_TAX_BRACKETS) {
    const top = b.to ?? Infinity;
    if (gross > b.from) tax += (Math.min(gross, top) - b.from) * b.rate;
  }
  const levy = gross > MEDICARE_LEVY.lowIncomeThreshold ? gross * MEDICARE_LEVY.rate : 0;
  return round(gross - tax - levy);
}

export interface AffordabilityInput {
  incomeAnnual: number;
  partnerIncomeAnnual?: number;
  expensesMonthly: number;
  otherDebtsMonthly?: number;
  dependants?: number;
  deposit?: number;
  tradeIn?: number;
  termMonths?: number;
  ratePct?: number;
  runningCostsMonthly?: number;
}

export interface AffordabilityResult {
  netMonthly: number;
  surplusMonthly: number;
  comfortableRepayment: number;
  comfortableLoan: number;
  comfortablePrice: number;
  maxRepayment: number;
  maxLoan: number;
  maxPrice: number;
  runningCostsMonthly: number;
  testedRatePct: number;
  verdict: 'comfortable' | 'stretch' | 'not_yet';
  notes: string[];
}

const DEPENDANT_ALLOWANCE = 350;
const SERVICEABILITY_BUFFER_POINTS = 2;
const COMFORTABLE_SHARE_OF_TAKE_HOME = 0.15;

export function assessAffordability(input: AffordabilityInput): AffordabilityResult {
  const term = clamp(Math.round(input.termMonths ?? FINANCE_DEFAULTS.typicalTermMonths), 12, 84);
  const rate = input.ratePct ?? FINANCE_DEFAULTS.usedCarSecured.typical;
  const net = netAnnualIncome(input.incomeAnnual) + netAnnualIncome(input.partnerIncomeAnnual ?? 0);
  const netMonthly = round(net / 12);
  const running = input.runningCostsMonthly ?? 350;
  const surplus = round(netMonthly - Math.max(0, input.expensesMonthly) - Math.max(0, input.otherDebtsMonthly ?? 0) - Math.max(0, input.dependants ?? 0) * DEPENDANT_ALLOWANCE);
  const comfortableRepayment = round(Math.max(0, Math.min(netMonthly * COMFORTABLE_SHARE_OF_TAKE_HOME - running, surplus * 0.5)));
  const maxRepayment = round(Math.max(0, surplus - running));
  const testedRate = rate + SERVICEABILITY_BUFFER_POINTS;
  const comfortableLoan = round(presentValue(comfortableRepayment, rate, term), -2);
  const maxLoan = round(presentValue(maxRepayment, testedRate, term), -2);
  const cash = Math.max(0, input.deposit ?? 0) + Math.max(0, input.tradeIn ?? 0);
  const notes = [
    `Take-home pay is worked out from the ${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)} resident brackets and the Medicare levy; offsets and HELP repayments are not counted.`,
    `A car that costs under ${Math.round(COMFORTABLE_SHARE_OF_TAKE_HOME * 100)}% of take-home pay, repayments and running costs together, is the usual comfortable line; $${running} a month is allowed here for fuel, insurance, registration and servicing.`,
    `The maximum is tested at ${testedRate.toFixed(2)}%, ${SERVICEABILITY_BUFFER_POINTS} points above the rate, the way a lender stress-tests it, and takes every dollar of surplus, which no one should sign up to.`,
    ...((input.dependants ?? 0) > 0 ? [`$${DEPENDANT_ALLOWANCE} a month is set aside for each dependant.`] : []),
  ];
  const verdict: AffordabilityResult['verdict'] = comfortableRepayment >= 150 ? 'comfortable' : maxRepayment >= 150 ? 'stretch' : 'not_yet';
  if (verdict === 'not_yet') notes.push('On these numbers a loan would not leave room to live. A cheaper car bought with savings, or a few months of building the deposit, comes first.');
  return { netMonthly, surplusMonthly: surplus, comfortableRepayment, comfortableLoan, comfortablePrice: round(comfortableLoan + cash, -2), maxRepayment, maxLoan, maxPrice: round(maxLoan + cash, -2), runningCostsMonthly: running, testedRatePct: testedRate, verdict, notes };
}

// ------------------------------------------------------- cost of ownership

export const RUNNING_ASSUMPTIONS = {
  asAt: FINANCE_DEFAULTS.asAt,
  petrolPerLitre: 1.9,
  dieselPerLitre: 1.95,
  homeElectricityPerKwh: 0.3,
  publicElectricityPerKwh: 0.55,
  phevElectricShare: 0.6,
  phevKwhPer100: 18,
  phevPetrolPer100: 6.5,
  tyresPerYear: { default: 300, heavy: 420 },
  servicingPerYear: { ELECTRIC: 250, HYBRID: 300, PLUG_IN_HYBRID: 350, PETROL: 400, DIESEL: 500 } as Record<FuelKey, number>,
};

export interface OwnershipInput {
  price: number;
  fuelType: FuelKey;
  bodyType?: BodyKey;
  fuelPer100?: number | null;
  kwhPer100?: number | null;
  kmPerYear?: number;
  years?: number;
  state?: AuState;
  insuranceAnnual?: number | null;
  servicingYear?: number | null;
  driverAge?: number;
  homeCharging?: boolean;
  loan?: { amount: number; ratePct: number; termMonths: number; balloonPct?: number } | null;
  isNew?: boolean;
}

export interface OwnershipYear {
  year: number;
  depreciation: number;
  energy: number;
  insurance: number;
  rego: number;
  servicing: number;
  tyres: number;
  interest: number;
  total: number;
  valueAtEnd: number;
}

export interface OwnershipResult {
  years: OwnershipYear[];
  totals: Omit<OwnershipYear, 'year' | 'valueAtEnd'> & { perYear: number; perWeek: number; perKm: number };
  energyPer100Km: number;
  energyLabel: string;
  assumptions: string[];
}

export function costOfOwnership(input: OwnershipInput): OwnershipResult {
  const years = clamp(Math.round(input.years ?? 5), 1, 10);
  const km = clamp(Math.round(input.kmPerYear ?? 15000), 1000, 60000);
  const state = input.state ?? 'QLD';
  const a = RUNNING_ASSUMPTIONS;
  const price = Math.max(0, input.price);
  const heavy = input.fuelType === 'ELECTRIC' || input.bodyType === 'UTE' || input.bodyType === 'SUV' || input.bodyType === 'PEOPLE_MOVER';

  let energyPer100 = 0;
  let energyLabel = '';
  let energyPerKm = 0;
  if (input.fuelType === 'ELECTRIC') {
    energyPer100 = input.kwhPer100 ?? 17;
    const perKwh = input.homeCharging === false ? a.publicElectricityPerKwh : a.homeElectricityPerKwh;
    energyPerKm = energyPer100 / 100 * perKwh;
    energyLabel = `${energyPer100} kWh per 100 km at $${perKwh.toFixed(2)} a kWh ${input.homeCharging === false ? 'on public chargers' : 'at home'}`;
  } else if (input.fuelType === 'PLUG_IN_HYBRID') {
    const kwh = input.kwhPer100 ?? a.phevKwhPer100;
    const petrol = input.fuelPer100 && input.fuelPer100 > 2 ? input.fuelPer100 : a.phevPetrolPer100;
    energyPerKm = a.phevElectricShare * (kwh / 100) * a.homeElectricityPerKwh + (1 - a.phevElectricShare) * (petrol / 100) * a.petrolPerLitre;
    energyPer100 = round(energyPerKm * 100 / a.petrolPerLitre, 1);
    energyLabel = `${Math.round(a.phevElectricShare * 100)}% of kilometres electric at ${kwh} kWh per 100 km, the rest on petrol at ${petrol} L per 100 km`;
  } else {
    const perLitre = input.fuelType === 'DIESEL' ? a.dieselPerLitre : a.petrolPerLitre;
    energyPer100 = input.fuelPer100 ?? (input.fuelType === 'HYBRID' ? 4.5 : input.fuelType === 'DIESEL' ? 7.5 : 7.0);
    energyPerKm = energyPer100 / 100 * perLitre;
    energyLabel = `${energyPer100} L per 100 km at $${perLitre.toFixed(2)} a litre`;
  }

  const insurance = input.insuranceAnnual ?? estimatePremium({ vehicleValue: price, driverAge: input.driverAge ?? 35, state, fuelType: input.fuelType }).covers.find((c) => c.key === 'COMPREHENSIVE')!.annual;
  const servicing = input.servicingYear ?? a.servicingPerYear[input.fuelType];
  const tyres = heavy ? a.tyresPerYear.heavy : a.tyresPerYear.default;
  const rego = REGO_AND_CTP[state];
  const values = projectValue(price, input.bodyType ?? 'SUV', input.fuelType, years, input.isNew === false ? 3 : 0);
  const loan = input.loan && input.loan.amount > 0 ? calculateRepayment({ amount: input.loan.amount, ratePct: input.loan.ratePct, termMonths: input.loan.termMonths, balloonPct: input.loan.balloonPct }) : null;

  const rows: OwnershipYear[] = [];
  let prev = price;
  for (let y = 1; y <= years; y += 1) {
    const valueAtEnd = values[y - 1] ?? prev;
    const depreciation = round(prev - valueAtEnd);
    const energy = round(km * energyPerKm);
    const ins = round(insurance * (1 - 0.03 * (y - 1)));
    const serv = round(servicing * (y > 5 ? 1.3 : 1));
    const interest = loan ? (loan.schedule[y - 1]?.interest ?? 0) : 0;
    const total = depreciation + energy + ins + rego + serv + tyres + interest;
    rows.push({ year: y, depreciation, energy, insurance: ins, rego, servicing: serv, tyres, interest, total: round(total), valueAtEnd: round(valueAtEnd) });
    prev = valueAtEnd;
  }
  const sum = (k: keyof Omit<OwnershipYear, 'year' | 'valueAtEnd'>) => round(rows.reduce((s, r) => s + r[k], 0));
  const total = sum('total');
  return {
    years: rows,
    totals: { depreciation: sum('depreciation'), energy: sum('energy'), insurance: sum('insurance'), rego: sum('rego'), servicing: sum('servicing'), tyres: sum('tyres'), interest: sum('interest'), total, perYear: round(total / years), perWeek: round(total / years / 52), perKm: round(total / (km * years), 2) },
    energyPer100Km: energyPer100,
    energyLabel,
    assumptions: [
      `${km.toLocaleString('en-AU')} km a year for ${years} year${years === 1 ? '' : 's'}; energy: ${energyLabel}.`,
      `Depreciation follows a typical curve for a ${(input.bodyType ?? 'SUV').toLowerCase().replace('_', ' ')}${input.fuelType === 'ELECTRIC' ? ', steeper for an electric car as the market has been' : ''}.`,
      input.insuranceAnnual ? 'Insurance is the figure you gave, easing a little each year.' : `Insurance is an estimate for a ${input.driverAge ?? 35}-year-old in ${state} with comprehensive cover; a quote will differ.`,
      `Registration and CTP for ${state} at about $${rego} a year; servicing at $${servicing} a year (more after five years); tyres at $${tyres} a year.`,
      ...(loan ? [`Interest on a $${input.loan!.amount.toLocaleString('en-AU')} loan at ${input.loan!.ratePct}% over ${input.loan!.termMonths} months.`] : []),
      `Prices as at ${a.asAt}.`,
    ],
  };
}

// ---------------------------------------------------------------- readiness

export interface ReadinessInput {
  vehiclePrice: number;
  deposit?: number;
  tradeIn?: number;
  incomeAnnual: number;
  expensesMonthly: number;
  otherDebtsMonthly?: number;
  dependants?: number;
  employment: string;
  employmentMonths?: number;
  residency?: string;
  hasDefaults?: boolean;
  termMonths?: number;
  ratePct?: number;
  vehicleAgeYears?: number;
}

export interface ReadinessResult {
  score: number;
  band: 'ready' | 'nearly' | 'not_yet';
  amount: number;
  repaymentMonthly: number;
  ratePct: number;
  notes: string[];
  lenderChecks: string[];
}

export function assessReadiness(input: ReadinessInput): ReadinessResult {
  const cash = Math.max(0, input.deposit ?? 0) + Math.max(0, input.tradeIn ?? 0);
  const amount = Math.max(0, round(input.vehiclePrice - cash));
  const term = clamp(Math.round(input.termMonths ?? FINANCE_DEFAULTS.typicalTermMonths), 12, 84);
  const rate = input.ratePct ?? ((input.vehicleAgeYears ?? 0) <= 1 ? FINANCE_DEFAULTS.newCarSecured.typical : FINANCE_DEFAULTS.usedCarSecured.typical);
  const repayment = round(monthlyPayment(amount, rate, term));
  const afford = assessAffordability({ incomeAnnual: input.incomeAnnual, expensesMonthly: input.expensesMonthly, otherDebtsMonthly: input.otherDebtsMonthly, dependants: input.dependants, termMonths: term, ratePct: rate });
  const notes: string[] = [];
  let score = 50;

  const depositPct = input.vehiclePrice > 0 ? cash / input.vehiclePrice : 0;
  if (depositPct >= 0.2) { score += 15; notes.push(`A ${Math.round(depositPct * 100)}% deposit: lenders like it and price it.`); }
  else if (depositPct >= 0.1) { score += 8; notes.push(`A ${Math.round(depositPct * 100)}% deposit helps; twenty would help more.`); }
  else if (depositPct > 0) { score -= 2; notes.push('A small deposit means borrowing close to the car\'s value; the rate is usually higher.'); }
  else { score -= 8; notes.push('No deposit: possible, but the rate is higher and you owe more than the car is worth for the first two years.'); }

  if (repayment <= afford.comfortableRepayment) { score += 20; notes.push('The repayment sits inside the comfortable line for your take-home pay.'); }
  else if (repayment <= afford.maxRepayment) { score += 5; notes.push(`The repayment ($${repayment} a month) is above the comfortable line ($${afford.comfortableRepayment}); a lender may pass it, and you may feel it.`); }
  else { score -= 25; notes.push(`The repayment ($${repayment} a month) is more than your surplus allows; a cheaper car, a longer term or a bigger deposit is needed first.`); }

  const months = input.employmentMonths ?? 0;
  switch (input.employment) {
    case 'FULL_TIME':
    case 'PART_TIME':
      if (months >= 6) { score += 10; notes.push('Six months or more in the job: the usual line is met.'); } else { score -= 5; notes.push('Under six months in the job: some lenders wait, others ask for the previous job\'s history.'); }
      break;
    case 'CASUAL':
      if (months >= 12) { score += 6; notes.push('Twelve months of casual work: most lenders count it.'); } else { score -= 8; notes.push('Casual work under twelve months is the hardest to get across the line; a co-borrower or a bigger deposit helps.'); }
      break;
    case 'SELF_EMPLOYED':
      if (months >= 24) { score += 8; notes.push('Two years self-employed with tax returns to show: fine.'); } else { score -= 6; notes.push('Under two years self-employed: expect to show BAS statements and bank statements instead of tax returns.'); }
      break;
    case 'CONTRACT':
      if (months >= 12) { score += 6; } else { score -= 4; }
      notes.push('Contract income is read by its history and the time left on the contract.');
      break;
    case 'PARENTAL_LEAVE':
      score -= 4;
      notes.push('On parental leave a lender wants a return-to-work letter and will read the return salary, not the leave payment.');
      break;
    default:
      score -= 20;
      notes.push('Without an income of your own, no lender will approve a loan in your name alone; a co-borrower changes that.');
  }

  if (input.residency === 'VISA') { score -= 6; notes.push('On a visa the loan usually has to end before the visa does.'); }
  if (input.hasDefaults) { score -= 15; notes.push('A default in the last five years does not end it, but the mainstream lenders will say no; specialist lenders charge more.'); }
  const dti = afford.netMonthly > 0 ? (repayment + (input.otherDebtsMonthly ?? 0)) / afford.netMonthly : 1;
  if (dti > 0.4) { score -= 10; notes.push('Repayments on all debts would take over forty percent of take-home pay, which lenders read as stretched.'); }

  score = clamp(round(score), 0, 100);
  const band: ReadinessResult['band'] = score >= 70 ? 'ready' : score >= 45 ? 'nearly' : 'not_yet';
  return { score, band, amount, repaymentMonthly: repayment, ratePct: rate, notes, lenderChecks: LENDER_CHECKS };
}

export function financeReference() {
  return { defaults: FINANCE_DEFAULTS, lenderChecks: LENDER_CHECKS, running: RUNNING_ASSUMPTIONS };
}
