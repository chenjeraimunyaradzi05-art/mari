/**
 * The strategy calculators the phone can run, one entry each: the fields it
 * asks for, the call it makes, and how its answer is read back to her.
 *
 * Every field and every body key is the server's (server/src/routes/
 * strategy.routes.ts); every figure in a summary is one the server worked out,
 * printed as it came back. Rates that the server sends as fractions (a
 * marginal tax rate of 0.3) are turned into percentages here and nowhere else,
 * so a screen cannot print "0%" for a 30 cent dollar.
 *
 * Nothing a calculator works out is stored. Saving a plan is done on the web,
 * where the plan for an area keeps every figure from that page together: a
 * plan saved from one calculator on a phone would overwrite the rest of it.
 */
import type { AxiosResponse } from 'axios';
import { strategyApi, type StrategyArea } from '../../services/money';
import { aud, pct, toNumber, whole, words } from '../../utils/format';

export type FieldKind = 'money' | 'number' | 'percent' | 'years' | 'toggle' | 'state' | 'choice';

export interface CalcField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  choices?: ReadonlyArray<{ value: string; label: string }>;
}

export interface CalcSummary {
  headline: { label: string; value: string; sub?: string };
  rows: Array<{ label: string; value: string }>;
  notes: string[];
  asAt?: string | null;
}

export interface Calculator {
  key: string;
  area: StrategyArea;
  title: string;
  blurb: string;
  fields: CalcField[];
  /** The risk profile asks the server's own questions instead of fixed fields. */
  usesRiskQuestions?: boolean;
  run: (body: Record<string, unknown>) => Promise<AxiosResponse>;
  summarise: (result: unknown) => CalcSummary;
}

export const AU_STATES = [
  { value: 'QLD', label: 'QLD' },
  { value: 'NSW', label: 'NSW' },
  { value: 'VIC', label: 'VIC' },
  { value: 'WA', label: 'WA' },
  { value: 'SA', label: 'SA' },
  { value: 'TAS', label: 'TAS' },
  { value: 'ACT', label: 'ACT' },
  { value: 'NT', label: 'NT' },
] as const;

/** Wraps a typed summary so the list below can hold calculators with different answers. */
function define<R>(spec: Omit<Calculator, 'summarise'> & { summarise: (result: R) => CalcSummary }): Calculator {
  return { ...spec, summarise: (result: unknown) => spec.summarise(result as R) };
}

const perWeek = (n: unknown) => `${aud(n)} a week`;
const perMonth = (n: unknown) => `${aud(n)} a month`;
const fractionPct = (n: unknown, digits = 0) => {
  const v = toNumber(n);
  return v === null ? '–' : pct(v * 100, digits);
};
const months = (n: number | null | undefined) => (n === null || n === undefined ? 'Not at this rate' : n === 1 ? '1 month' : `${whole(n)} months`);
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

// ------------------------------------------------------------------ housing

type Rent = { asAt: string; netWeeklyIncome: number; comfortableWeeklyRent: number; stretchWeeklyRent: number; weeklyRent: number | null; rentShareOfGross: number | null; inRentalStress: boolean; leftAfterRent: number | null; notes: string[] };
type StampDuty = { asAt: string; dutyPayable: number; generalDuty: number; firstHomeRelief: number; reliefApplied: 'none' | 'exempt' | 'concession'; note: string };
type Mortgage = { frequency: string; repayment: number; monthlyEquivalent: number; totalInterest: number; totalRepaid: number; bufferedRepayment: number; withExtra: { repayment: number; yearsToRepay: number; interestSaved: number } | null };
type Borrowing = { asAt: string; estimatedBorrowingPower: number; monthlySurplus: number; assessmentRatePct: number; monthlyRepaymentAtAssessment: number; notes: string[] };
type Deposit = { asAt: string; depositAmount: number; depositPct: number; loanAmount: number; lvr: number; stampDuty: { dutyPayable: number }; otherCosts: number; lmiEstimate: number; cashNeeded: number; shortfall: number; monthsToTarget: number | null; targetDate: string | null; homeGuarantee: { eligible: boolean; note: string }; notes: string[] };
type RentVsBuy = { asAt: string; years: number; buying: { netPosition: number; totalInterest: number }; renting: { netPosition: number; totalRent: number }; difference: number; ahead: 'buying' | 'renting'; breakEvenYear: number | null; notes: string[] };

// ----------------------------------------------------------------- business

type Structures = { asAt: string; recommended: string; yourMarginalRate: number; options: Array<{ type: string; label: string; yourTax: number; effectiveRate: number; available: boolean; unavailableReason?: string; setupCost: { low: number; high: number } }>; reasons: string[]; notes: string[] };
type Valuation = { asAt: string; range: { low: number; mid: number; high: number }; drivers: Array<{ label: string; detail: string }>; notes: string[] };
type Raise = { postMoney: number; investorPct: number; founderPctBefore: number; founderPctAfter: number; founderValueAfter: number; notes: string[] };
type Runway = { monthlyBurn: number; runwayMonths: number | null; runwayEnds: string | null; breakEvenMonth: number | null; lowestCash: number; notes: string[] };

// ---------------------------------------------------------------------- tax

type TaxEstimate = { asAt: string; taxableIncome: number; incomeTax: number; lito: number; medicareLevy: number; helpRepayment: number; totalTax: number; netIncome: number; monthlyTakeHome: number; fortnightlyTakeHome: number; marginalRate: number; effectiveRate: number; employerSuper: number; notes: string[] };
type Deductions = { asAt: string; items: Array<{ key: string; label: string; amount: number; basis: string }>; totalDeductions: number; taxSaved: number; marginalRate: number; notes: string[] };
type SuperPlan = { asAt: string; concessionalTotal: number; concessionalCap: number; concessionalHeadroom: number; overCapBy: number; taxSavedByVoluntary: number; netCostOfVoluntary: number; coContribution: number; spouseOffset: number; moves: Array<{ key: string; label: string; detail: string }>; notes: string[] };
type SetAside = { asAt: string; quarterlyTotal: number; quarterlyIncomeTax: number; quarterlyGst: number; setAsidePctOfProfit: number; mustRegisterForGst: boolean; suggestedSuper: number; notes: string[] };

// ---------------------------------------------------------------- investing

type RiskProfile = { asAt: string; label: string; summary: string; growthPct: number; defensivePct: number; allocation: Array<{ label: string; pct: number }>; expectedReturnPct: number; volatilityPct: number; cappedBy: string | null; notes: string[] };
type Emergency = { asAt: string; monthsRecommended: number; target: number; current: number; gap: number; progressPct: number; monthsToTarget: number | null; targetDate: string | null; notes: string[] };
type Projection = { asAt: string; years: number; returnPct: number; scenarios: Array<{ key: string; label: string; endTotal: number; endRealTotal: number; totalContributed: number; growth: number }>; notes: string[] };

export const CALCULATORS: Calculator[] = [
  define<Rent>({
    key: 'rent',
    area: 'HOUSING',
    title: 'Rent you can carry',
    blurb: 'What your income comfortably covers, and whether a rent puts you in rental stress.',
    fields: [
      { key: 'annualIncome', label: 'Your income, a year, before tax', kind: 'money', required: true, placeholder: '75000' },
      { key: 'partnerAnnualIncome', label: "A partner's income, if you share rent", kind: 'money' },
      { key: 'weeklyRent', label: 'A rent you are looking at, a week', kind: 'money' },
      { key: 'otherWeeklyCommitments', label: 'Other commitments, a week', kind: 'money', hint: 'Loan repayments, childcare, anything fixed' },
    ],
    run: strategyApi.housing.rent,
    summarise: (r) => ({
      headline: { label: 'Comfortable rent', value: perWeek(r.comfortableWeeklyRent), sub: `A stretch: ${perWeek(r.stretchWeeklyRent)}` },
      rows: [
        { label: 'Take-home pay', value: perWeek(r.netWeeklyIncome) },
        ...(r.weeklyRent !== null ? [{ label: 'That rent, of your gross pay', value: pct(r.rentShareOfGross, 0) }, { label: 'Rental stress', value: yesNo(r.inRentalStress) }, { label: 'Left after rent', value: perWeek(r.leftAfterRent) }] : []),
      ],
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),
  define<Borrowing>({
    key: 'borrowing-power',
    area: 'HOUSING',
    title: 'Borrowing power',
    blurb: 'Roughly what a lender would lend, tested at the rate lenders use.',
    fields: [
      { key: 'annualIncome', label: 'Your income, a year, before tax', kind: 'money', required: true },
      { key: 'partnerAnnualIncome', label: "A partner's income", kind: 'money' },
      { key: 'monthlyLivingExpenses', label: 'Living expenses, a month', kind: 'money' },
      { key: 'monthlyOtherRepayments', label: 'Other repayments, a month', kind: 'money' },
      { key: 'creditCardLimits', label: 'Credit card limits, in total', kind: 'money', hint: 'Lenders count the limit, not the balance' },
      { key: 'dependants', label: 'Dependants', kind: 'number' },
    ],
    run: strategyApi.housing.borrowingPower,
    summarise: (r) => ({
      headline: { label: 'Borrowing power, roughly', value: aud(r.estimatedBorrowingPower) },
      rows: [
        { label: 'Left over each month', value: perMonth(r.monthlySurplus) },
        { label: 'Tested at', value: pct(r.assessmentRatePct, 2) },
        { label: 'Repayment at that rate', value: perMonth(r.monthlyRepaymentAtAssessment) },
      ],
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),
  define<StampDuty>({
    key: 'stamp-duty',
    area: 'HOUSING',
    title: 'Stamp duty',
    blurb: 'Transfer duty in your state, with the first-home relief you qualify for.',
    fields: [
      { key: 'state', label: 'State', kind: 'state', required: true },
      { key: 'price', label: 'Price', kind: 'money', required: true, placeholder: '650000' },
      { key: 'firstHome', label: 'Your first home', kind: 'toggle' },
      { key: 'newHome', label: 'A new build', kind: 'toggle' },
    ],
    run: strategyApi.housing.stampDuty,
    summarise: (r) => ({
      headline: { label: 'Duty to pay', value: aud(r.dutyPayable) },
      rows: [
        { label: 'Before any relief', value: aud(r.generalDuty) },
        { label: 'First-home relief', value: r.reliefApplied === 'none' ? 'None' : `${aud(r.firstHomeRelief)} (${r.reliefApplied === 'exempt' ? 'exempt' : 'a concession'})` },
      ],
      notes: r.note ? [r.note] : [],
      asAt: r.asAt,
    }),
  }),
  define<Mortgage>({
    key: 'mortgage',
    area: 'HOUSING',
    title: 'Loan repayments',
    blurb: 'What a loan costs each month, and what paying a little extra saves.',
    fields: [
      { key: 'principal', label: 'Loan amount', kind: 'money', required: true, placeholder: '520000' },
      { key: 'annualRatePct', label: 'Interest rate', kind: 'percent', required: true, placeholder: '6.2' },
      { key: 'years', label: 'Term', kind: 'years', required: true, placeholder: '30' },
      { key: 'extraRepayment', label: 'Extra each month, if any', kind: 'money' },
    ],
    run: strategyApi.housing.mortgage,
    summarise: (r) => ({
      // Monthly is the only frequency this screen asks for, so the buffered
      // figure, worked out per repayment, is a monthly one too.
      headline: { label: 'Repayment', value: perMonth(r.monthlyEquivalent), sub: `If the rate were 3 points higher: ${perMonth(r.bufferedRepayment)}` },
      rows: [
        { label: 'Interest over the loan', value: aud(r.totalInterest) },
        { label: 'Repaid in all', value: aud(r.totalRepaid) },
        ...(r.withExtra ? [{ label: 'With the extra, paid off in', value: `${r.withExtra.yearsToRepay} years` }, { label: 'Interest saved', value: aud(r.withExtra.interestSaved) }] : []),
      ],
      notes: [],
    }),
  }),
  define<Deposit>({
    key: 'deposit',
    area: 'HOUSING',
    title: 'Deposit plan',
    blurb: 'The cash you need on the day, and how long saving it takes.',
    fields: [
      { key: 'state', label: 'State', kind: 'state', required: true },
      { key: 'price', label: 'Price', kind: 'money', required: true },
      { key: 'firstHome', label: 'Your first home', kind: 'toggle' },
      { key: 'currentSavings', label: 'Saved so far', kind: 'money' },
      { key: 'monthlySaving', label: 'You can save, a month', kind: 'money' },
      { key: 'targetDepositPct', label: 'Deposit you are aiming for', kind: 'percent', placeholder: '20' },
      { key: 'useHomeGuarantee', label: 'Use the Home Guarantee Scheme', kind: 'toggle', hint: 'A 5% deposit with no lenders mortgage insurance, for eligible buyers' },
    ],
    run: strategyApi.housing.deposit,
    summarise: (r) => ({
      headline: { label: 'Cash needed on the day', value: aud(r.cashNeeded), sub: r.monthsToTarget !== null ? `About ${months(r.monthsToTarget)} away at your saving rate` : undefined },
      rows: [
        { label: `Deposit (${pct(r.depositPct)})`, value: aud(r.depositAmount) },
        { label: 'Stamp duty', value: aud(r.stampDuty.dutyPayable) },
        { label: 'Lenders mortgage insurance', value: aud(r.lmiEstimate) },
        { label: 'Other costs', value: aud(r.otherCosts) },
        { label: 'Still to save', value: aud(r.shortfall) },
      ],
      notes: [...(r.homeGuarantee.note ? [r.homeGuarantee.note] : []), ...r.notes],
      asAt: r.asAt,
    }),
  }),
  define<RentVsBuy>({
    key: 'rent-vs-buy',
    area: 'HOUSING',
    title: 'Rent or buy',
    blurb: 'Where each leaves you after the years you choose, deposit invested if you rent.',
    fields: [
      { key: 'state', label: 'State', kind: 'state', required: true },
      { key: 'price', label: 'Price of the home', kind: 'money', required: true },
      { key: 'weeklyRent', label: 'Rent for a similar home, a week', kind: 'money', required: true },
      { key: 'years', label: 'Over', kind: 'years', placeholder: '10' },
      { key: 'firstHome', label: 'Your first home', kind: 'toggle' },
    ],
    run: strategyApi.housing.rentVsBuy,
    summarise: (r) => ({
      headline: { label: `After ${r.years} years`, value: `${r.ahead === 'buying' ? 'Buying' : 'Renting'} is ahead by ${aud(r.difference)}`, sub: r.breakEvenYear ? `Buying catches up in year ${r.breakEvenYear}` : undefined },
      rows: [
        { label: 'Buying leaves you with', value: aud(r.buying.netPosition) },
        { label: 'Renting leaves you with', value: aud(r.renting.netPosition) },
        { label: 'Interest paid buying', value: aud(r.buying.totalInterest) },
        { label: 'Rent paid renting', value: aud(r.renting.totalRent) },
      ],
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),

  define<Structures>({
    key: 'structures',
    area: 'BUSINESS',
    title: 'Which structure',
    blurb: 'Sole trader, partnership, company or trust, compared on the tax you would pay.',
    fields: [
      { key: 'profit', label: 'Business profit, a year', kind: 'money', required: true },
      { key: 'otherIncome', label: 'Your other income, a year', kind: 'money' },
      { key: 'hasCoFounders', label: 'Someone in it with you', kind: 'toggle' },
    ],
    run: strategyApi.business.structures,
    summarise: (r) => {
      const best = r.options.find((o) => o.type === r.recommended);
      return {
        headline: { label: 'Suits you best', value: best?.label ?? words(r.recommended), sub: `Your next dollar is taxed at ${fractionPct(r.yourMarginalRate)}` },
        rows: r.options.map((o) => ({ label: o.label, value: o.available ? `${aud(o.yourTax)} tax (${pct(o.effectiveRate, 1)})` : o.unavailableReason ?? 'Not available' })),
        notes: [...r.reasons, ...r.notes],
        asAt: r.asAt,
      };
    },
  }),
  define<Runway>({
    key: 'runway',
    area: 'BUSINESS',
    title: 'Runway',
    blurb: 'How long the cash lasts, and when the business pays for itself.',
    fields: [
      { key: 'cashOnHand', label: 'Cash in the bank', kind: 'money', required: true },
      { key: 'monthlyRevenue', label: 'Revenue, a month', kind: 'money', required: true },
      { key: 'monthlyExpenses', label: 'Expenses, a month', kind: 'money', required: true },
      { key: 'revenueGrowthPct', label: 'Revenue growth, a month', kind: 'percent' },
    ],
    run: strategyApi.business.runway,
    summarise: (r) => ({
      headline: { label: 'Runway', value: r.runwayMonths === null ? 'The cash does not run out' : months(r.runwayMonths), sub: r.runwayEnds ? `Until about ${r.runwayEnds}` : undefined },
      rows: [
        { label: 'Burning, a month', value: aud(r.monthlyBurn) },
        { label: 'Breaks even', value: r.breakEvenMonth ? `Month ${r.breakEvenMonth}` : 'Not in the time modelled' },
        { label: 'Lowest the cash gets', value: aud(r.lowestCash) },
      ],
      notes: r.notes,
    }),
  }),
  define<Valuation>({
    key: 'valuation',
    area: 'BUSINESS',
    title: 'What the business is worth',
    blurb: 'A range from revenue, earnings and cash flow, the way a buyer would look at it.',
    fields: [
      { key: 'annualRevenue', label: 'Revenue, a year', kind: 'money', required: true },
      { key: 'annualProfit', label: 'Profit, a year', kind: 'money', required: true },
      { key: 'growthPct', label: 'Growth, a year', kind: 'percent' },
      { key: 'yearsOperating', label: 'Years operating', kind: 'years' },
    ],
    run: strategyApi.business.valuation,
    summarise: (r) => ({
      headline: { label: 'Worth, roughly', value: aud(r.range.mid), sub: `${aud(r.range.low)} to ${aud(r.range.high)}` },
      rows: r.drivers.map((d) => ({ label: d.label, value: d.detail })),
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),
  define<Raise>({
    key: 'raise',
    area: 'BUSINESS',
    title: 'Raising money',
    blurb: 'What an investment does to what you own.',
    fields: [
      { key: 'preMoney', label: 'Valuation before the raise', kind: 'money', required: true },
      { key: 'raiseAmount', label: 'Amount raised', kind: 'money', required: true },
      { key: 'founderOwnershipPct', label: 'What you own now', kind: 'percent', placeholder: '100' },
      { key: 'optionPoolPct', label: 'Option pool for staff', kind: 'percent' },
    ],
    run: strategyApi.business.raise,
    summarise: (r) => ({
      headline: { label: 'You would own', value: pct(r.founderPctAfter, 1), sub: `Worth ${aud(r.founderValueAfter)} on paper` },
      rows: [
        { label: 'Valuation after', value: aud(r.postMoney) },
        { label: 'Investors would own', value: pct(r.investorPct, 1) },
        { label: 'You own now', value: pct(r.founderPctBefore, 1) },
      ],
      notes: r.notes,
    }),
  }),

  define<TaxEstimate>({
    key: 'tax-estimate',
    area: 'TAX',
    title: 'Tax and take-home',
    blurb: 'Income tax, the Medicare levy and any study loan repayment, and what lands in your account.',
    fields: [
      { key: 'grossIncome', label: 'Salary, a year, before tax', kind: 'money', required: true, placeholder: '75000' },
      { key: 'deductions', label: 'Deductions you expect', kind: 'money' },
      { key: 'salarySacrifice', label: 'Salary sacrificed to super', kind: 'money' },
      { key: 'hasHelpDebt', label: 'A HECS-HELP debt', kind: 'toggle' },
    ],
    run: strategyApi.tax.estimate,
    summarise: (r) => ({
      headline: { label: 'Each month, after tax', value: aud(r.monthlyTakeHome), sub: `${aud(r.fortnightlyTakeHome)} a fortnight` },
      rows: [
        { label: 'Tax for the year', value: `${aud(r.totalTax)} (${pct(r.effectiveRate, 1)})` },
        { label: 'Income tax', value: aud(r.incomeTax) },
        { label: 'Low income tax offset', value: aud(r.lito) },
        { label: 'Medicare levy', value: aud(r.medicareLevy) },
        ...(r.helpRepayment > 0 ? [{ label: 'HELP repayment', value: aud(r.helpRepayment) }] : []),
        { label: 'Your next dollar', value: `${fractionPct(r.marginalRate)}, before Medicare` },
        { label: 'Super your employer adds', value: aud(r.employerSuper) },
      ],
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),
  define<Deductions>({
    key: 'tax-deductions',
    area: 'TAX',
    title: 'Deductions worth the receipts',
    blurb: 'Working from home, the car, study, tools, and what each saves.',
    fields: [
      { key: 'taxableIncome', label: 'Taxable income, a year', kind: 'money', required: true },
      { key: 'homeOfficeHoursPerWeek', label: 'Hours worked from home, a week', kind: 'number' },
      { key: 'weeksWorkedFromHome', label: 'Weeks of that, a year', kind: 'number' },
      { key: 'carWorkKm', label: 'Work kilometres in your own car', kind: 'number' },
      { key: 'selfEducation', label: 'Study for your current job', kind: 'money' },
      { key: 'toolsAndEquipment', label: 'Tools and equipment', kind: 'money' },
      { key: 'donations', label: 'Donations to charities', kind: 'money' },
    ],
    run: strategyApi.tax.deductions,
    summarise: (r) => ({
      headline: { label: 'Tax saved', value: aud(r.taxSaved), sub: `on ${aud(r.totalDeductions)} of deductions, at about ${fractionPct(r.marginalRate)} plus Medicare` },
      rows: r.items.map((i) => ({ label: i.label, value: aud(i.amount) })),
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),
  define<SuperPlan>({
    key: 'tax-super',
    area: 'TAX',
    title: 'Super contributions',
    blurb: 'How much more can go in before tax, and what it saves.',
    fields: [
      { key: 'income', label: 'Income, a year', kind: 'money', required: true },
      { key: 'superBalance', label: 'Super balance', kind: 'money' },
      { key: 'salarySacrifice', label: 'Salary sacrificed, a year', kind: 'money' },
      { key: 'personalAfterTax', label: 'After-tax contributions, a year', kind: 'money' },
    ],
    run: strategyApi.tax.superPlan,
    summarise: (r) => ({
      headline: { label: 'Room left under the cap', value: aud(r.concessionalHeadroom), sub: `${aud(r.concessionalTotal)} of the ${aud(r.concessionalCap)} cap used` },
      rows: [
        ...(r.overCapBy > 0 ? [{ label: 'Over the cap by', value: aud(r.overCapBy) }] : []),
        { label: 'Tax saved by what you add', value: aud(r.taxSavedByVoluntary) },
        { label: 'What it costs your pay', value: aud(r.netCostOfVoluntary) },
        ...(r.coContribution > 0 ? [{ label: 'Government co-contribution', value: aud(r.coContribution) }] : []),
      ],
      notes: [...r.moves.map((m) => `${m.label}: ${m.detail}`), ...r.notes],
      asAt: r.asAt,
    }),
  }),
  define<SetAside>({
    key: 'tax-set-aside',
    area: 'TAX',
    title: 'What a sole trader puts aside',
    blurb: 'The tax and GST to hold back each quarter, so the bill is never a shock.',
    fields: [
      { key: 'businessProfit', label: 'Business profit, a year', kind: 'money', required: true },
      { key: 'businessSales', label: 'Sales, a year', kind: 'money' },
      { key: 'otherIncome', label: 'Other income, a year', kind: 'money' },
      { key: 'gstRegistered', label: 'Registered for GST', kind: 'toggle' },
      { key: 'hasHelpDebt', label: 'A HECS-HELP debt', kind: 'toggle' },
    ],
    run: strategyApi.tax.setAside,
    summarise: (r) => ({
      headline: { label: 'Put aside each quarter', value: aud(r.quarterlyTotal), sub: `${pct(r.setAsidePctOfProfit)} of your profit` },
      rows: [
        { label: 'For income tax', value: aud(r.quarterlyIncomeTax) },
        { label: 'For GST', value: aud(r.quarterlyGst) },
        { label: 'You must register for GST', value: yesNo(r.mustRegisterForGst) },
        { label: 'Super to pay yourself, a year', value: aud(r.suggestedSuper) },
      ],
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),

  define<Emergency>({
    key: 'emergency-fund',
    area: 'INVESTMENT',
    title: 'Your safety net',
    blurb: 'Three to six months of expenses, sized for how steady your income is.',
    fields: [
      { key: 'monthlyExpenses', label: 'Expenses, a month', kind: 'money', required: true },
      { key: 'currentSavings', label: 'Saved for it so far', kind: 'money' },
      { key: 'monthlySaving', label: 'You can add, a month', kind: 'money' },
      {
        key: 'incomeStability',
        label: 'Your income',
        kind: 'choice',
        choices: [
          { value: 'stable', label: 'Steady' },
          { value: 'variable', label: 'Up and down' },
          { value: 'single_income_with_dependants', label: 'One income, with dependants' },
        ],
      },
    ],
    run: strategyApi.investing.emergencyFund,
    summarise: (r) => ({
      headline: { label: 'Your safety net', value: aud(r.target), sub: `${r.monthsRecommended} months of expenses` },
      rows: [
        { label: 'Saved', value: `${aud(r.current)} (${pct(r.progressPct)})` },
        { label: 'Still to go', value: aud(r.gap) },
        { label: 'There in', value: r.gap <= 0 ? 'Already there' : months(r.monthsToTarget) },
      ],
      notes: r.notes,
      asAt: r.asAt,
    }),
  }),
  define<Projection>({
    key: 'projection',
    area: 'INVESTMENT',
    title: 'Where it goes over the years',
    blurb: 'Your investments and super, projected over the years you choose.',
    fields: [
      { key: 'currentInvestments', label: 'Invested now, outside super', kind: 'money' },
      { key: 'currentSuper', label: 'Super now', kind: 'money' },
      { key: 'monthlyContribution', label: 'You add, a month', kind: 'money' },
      { key: 'salary', label: 'Salary, a year', kind: 'money' },
      { key: 'years', label: 'Over', kind: 'years', placeholder: '20' },
    ],
    run: strategyApi.investing.projection,
    summarise: (r) => {
      const base = r.scenarios[0];
      return {
        headline: { label: `In ${r.years} years`, value: base ? aud(base.endTotal) : '–', sub: base ? `${aud(base.endRealTotal)} in today's dollars` : undefined },
        rows: r.scenarios.map((s) => ({ label: s.label, value: `${aud(s.endTotal)} (${aud(s.totalContributed)} put in)` })),
        notes: r.notes,
        asAt: r.asAt,
      };
    },
  }),
  define<RiskProfile>({
    key: 'risk-profile',
    area: 'INVESTMENT',
    title: 'Your investing mix',
    blurb: 'A few questions about time and nerve, and the mix of growth and defensive assets they point to.',
    fields: [{ key: 'age', label: 'Your age', kind: 'number' }],
    usesRiskQuestions: true,
    run: strategyApi.investing.riskProfile,
    summarise: (r) => ({
      headline: { label: 'Your mix', value: r.label, sub: `${pct(r.growthPct)} growth, ${pct(r.defensivePct)} defensive` },
      rows: [
        ...r.allocation.map((a) => ({ label: a.label, value: pct(a.pct) })),
        { label: 'Long-run return assumed', value: `${pct(r.expectedReturnPct, 1)} a year` },
        { label: 'Swings in a bad year', value: `about ${pct(r.volatilityPct, 0)}` },
      ],
      notes: [r.summary, ...(r.cappedBy ? [`Held back a notch: ${r.cappedBy.toLowerCase()}.`] : []), ...r.notes],
      asAt: r.asAt,
    }),
  }),
];

export function calculatorsFor(area: StrategyArea): Calculator[] {
  return CALCULATORS.filter((c) => c.area === area);
}

export function findCalculator(key: string): Calculator | undefined {
  return CALCULATORS.find((c) => c.key === key);
}

/**
 * The body a calculator sends. A blank optional field is left out, never sent
 * as zero: the server has its own defaults, and "no partner income" and "a
 * partner who earns $0" are the server's to tell apart, not the phone's.
 */
export function buildBody(fields: CalcField[], values: Record<string, string>): { body: Record<string, unknown>; missing: string[]; invalid: string[] } {
  const body: Record<string, unknown> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const f of fields) {
    const raw = (values[f.key] ?? '').trim();
    if (f.kind === 'toggle') {
      if (raw === 'yes') body[f.key] = true;
      else if (raw === 'no') body[f.key] = false;
      continue;
    }
    if (!raw) {
      if (f.required) missing.push(f.label);
      continue;
    }
    if (f.kind === 'state' || f.kind === 'choice') {
      body[f.key] = raw;
      continue;
    }
    const n = toNumber(raw);
    if (n === null) invalid.push(f.label);
    else body[f.key] = n;
  }
  return { body, missing, invalid };
}

/** The saved plan's headline figures, named the way the web saves them for each area. */
export const PLAN_FIGURES: Record<StrategyArea, Array<{ key: string; label: string; format: (v: unknown) => string }>> = {
  HOUSING: [
    { key: 'cashNeeded', label: 'Cash needed on the day', format: aud },
    { key: 'monthsToTarget', label: 'Months to get there', format: (v) => months(toNumber(v)) },
    { key: 'borrowingPower', label: 'Borrowing power', format: aud },
    { key: 'repayment', label: 'Repayment', format: aud },
    { key: 'ahead', label: 'Ahead after the years chosen', format: (v) => (v === 'buying' ? 'Buying' : v === 'renting' ? 'Renting' : '–') },
  ],
  BUSINESS: [
    { key: 'recommended', label: 'Structure', format: (v) => (typeof v === 'string' ? words(v) : '–') },
    { key: 'valuationMid', label: 'Worth, roughly', format: aud },
    { key: 'runwayMonths', label: 'Runway', format: (v) => months(toNumber(v)) },
    { key: 'founderPctAfter', label: 'You would own after a raise', format: (v) => pct(v, 1) },
  ],
  TAX: [
    { key: 'totalTax', label: 'Tax for the year', format: aud },
    { key: 'netIncome', label: 'Take-home for the year', format: aud },
    { key: 'deductionsSaved', label: 'Saved by deductions', format: aud },
    { key: 'superHeadroom', label: 'Super cap left', format: aud },
    { key: 'quarterlySetAside', label: 'Put aside each quarter', format: aud },
  ],
  INVESTMENT: [
    { key: 'label', label: 'Your mix', format: (v) => (typeof v === 'string' ? v : '–') },
    { key: 'netWorth', label: 'Net worth', format: aud },
    { key: 'emergencyTarget', label: 'Safety net target', format: aud },
    { key: 'endTotal', label: 'Projected', format: aud },
  ],
};

/** Only the figures a saved plan actually holds; a figure it does not have is not drawn as a dash. */
export function planFigures(area: StrategyArea, result: Record<string, unknown> | null | undefined): Array<{ label: string; value: string }> {
  if (!result) return [];
  return PLAN_FIGURES[area].filter((f) => result[f.key] !== null && result[f.key] !== undefined).map((f) => ({ label: f.label, value: f.format(result[f.key]) }));
}
