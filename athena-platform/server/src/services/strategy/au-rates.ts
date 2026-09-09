/**
 * The Australian rates and thresholds the strategy engines read.
 *
 * Every number here is one the ATO, Treasury, Housing Australia or a state
 * revenue office publishes and changes from time to time, so each block says
 * which year or date it is for. The pages show `RATES_AS_AT` beside their
 * results so a member can see how current the figures are, and every result
 * is framed as an estimate to check against the official calculators. When a
 * year rolls over, update the block and the string together.
 */

export const RATES_AS_AT = '2025-26 financial year';

export type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
export const AU_STATES: AuState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

/** Resident individual income tax from 1 July 2024, unchanged for 2025-26. */
export const INCOME_TAX_BRACKETS: Array<{ from: number; to: number | null; rate: number }> = [
  { from: 0, to: 18200, rate: 0 },
  { from: 18200, to: 45000, rate: 0.16 },
  { from: 45000, to: 135000, rate: 0.3 },
  { from: 135000, to: 190000, rate: 0.37 },
  { from: 190000, to: null, rate: 0.45 },
];

/** Medicare levy, with the low-income phase-in for a single person. */
export const MEDICARE_LEVY = { rate: 0.02, lowIncomeThreshold: 27222, phaseInRate: 0.1 };

/** Low income tax offset: $700, tapering away by $66,667. */
export const LITO = { max: 700, fullUpTo: 37500, taper1Rate: 0.05, taper1To: 45000, taper2Rate: 0.015, taper2To: 66667 };

/** HELP (HECS) repayment from 1 July 2025: marginal, 15c then 17c in the dollar. */
export const HELP_REPAYMENT = { threshold: 67000, upperThreshold: 125000, lowerRate: 0.15, upperRate: 0.17 };

export const SUPER = {
  guaranteeRate: 0.12, // from 1 July 2025
  concessionalCap: 30000,
  nonConcessionalCap: 120000,
  contributionsTax: 0.15,
  division293Threshold: 250000,
  division293Rate: 0.15,
  carryForwardBalanceLimit: 500000,
  coContribution: { max: 500, matchRate: 0.5, lowerIncome: 47488, upperIncome: 62488, maxPersonal: 1000 },
  spouseOffset: { max: 540, rate: 0.18, maxContribution: 3000, spouseIncomeFull: 37000, spouseIncomeCutoff: 40000 },
};

export const COMPANY_TAX = { baseRate: 0.25, fullRate: 0.3, baseRateTurnoverLimit: 50_000_000 };

export const GST = { rate: 0.1, registrationThreshold: 75000 };

/** Work-related deduction rates the ATO publishes. */
export const DEDUCTION_RATES = {
  homeOfficeFixedRatePerHour: 0.7,
  carCentsPerKm: 0.88,
  carCentsPerKmMaxKm: 5000,
  instantAssetWriteOff: 20000,
  immediateDeductionItemLimit: 300,
};

/**
 * Home Guarantee Scheme (First Home Guarantee) from 5 October 2025: a 5%
 * deposit with no lenders mortgage insurance, no income cap and no place
 * limit, for a home under the cap for its area. "Capital" covers the capital
 * city and the large regional centres each state names; "regional" is the
 * rest of the state.
 */
export const HOME_GUARANTEE = {
  asAt: 'from 5 October 2025',
  minDepositPct: 0.05,
  caps: {
    NSW: { capital: 1_500_000, regional: 800_000 },
    VIC: { capital: 950_000, regional: 650_000 },
    QLD: { capital: 1_000_000, regional: 700_000 },
    WA: { capital: 850_000, regional: 600_000 },
    SA: { capital: 900_000, regional: 500_000 },
    TAS: { capital: 700_000, regional: 550_000 },
    ACT: { capital: 1_000_000, regional: 1_000_000 },
    NT: { capital: 600_000, regional: 600_000 },
  } as Record<AuState, { capital: number; regional: number }>,
};

/**
 * Lenders mortgage insurance, roughly, as a share of the loan by loan-to-value
 * band. Premiums differ by insurer and loan size; this is the order of
 * magnitude a member should budget for when the deposit is under 20%.
 */
export const LMI_BANDS: Array<{ maxLvr: number; premiumPct: number }> = [
  { maxLvr: 0.8, premiumPct: 0 },
  { maxLvr: 0.85, premiumPct: 0.01 },
  { maxLvr: 0.9, premiumPct: 0.02 },
  { maxLvr: 0.95, premiumPct: 0.035 },
];

/**
 * Transfer (stamp) duty on an established home, general rate, by state.
 *
 * Each bracket applies from `threshold` up: duty = base + rate x (value -
 * threshold). A bracket marked `flat` charges its rate on the whole value.
 * The Northern Territory uses a formula under $525,000, handled in code.
 * Thresholds are the 2025-26 schedules; NSW and ACT index theirs each July.
 */
export interface DutyBracket {
  threshold: number;
  base: number;
  rate: number;
  flat?: boolean;
}

export const STAMP_DUTY: Record<AuState, DutyBracket[]> = {
  NSW: [
    { threshold: 0, base: 0, rate: 0.0125 },
    { threshold: 17000, base: 212, rate: 0.015 },
    { threshold: 37000, base: 512, rate: 0.0175 },
    { threshold: 99000, base: 1597, rate: 0.035 },
    { threshold: 372000, base: 11152, rate: 0.045 },
    { threshold: 1240000, base: 50212, rate: 0.055 },
    { threshold: 3721000, base: 186668, rate: 0.07 },
  ],
  VIC: [
    { threshold: 0, base: 0, rate: 0.014 },
    { threshold: 25000, base: 350, rate: 0.024 },
    { threshold: 130000, base: 2870, rate: 0.06 },
    { threshold: 960000, base: 0, rate: 0.055, flat: true },
    { threshold: 2000000, base: 110000, rate: 0.065 },
  ],
  QLD: [
    { threshold: 0, base: 0, rate: 0 },
    { threshold: 5000, base: 0, rate: 0.015 },
    { threshold: 75000, base: 1050, rate: 0.035 },
    { threshold: 540000, base: 17325, rate: 0.045 },
    { threshold: 1000000, base: 38025, rate: 0.0575 },
  ],
  WA: [
    { threshold: 0, base: 0, rate: 0.019 },
    { threshold: 120000, base: 2280, rate: 0.0285 },
    { threshold: 150000, base: 3135, rate: 0.038 },
    { threshold: 360000, base: 11115, rate: 0.0475 },
    { threshold: 725000, base: 28453, rate: 0.0515 },
  ],
  SA: [
    { threshold: 0, base: 0, rate: 0.01 },
    { threshold: 12000, base: 120, rate: 0.02 },
    { threshold: 30000, base: 480, rate: 0.03 },
    { threshold: 50000, base: 1080, rate: 0.035 },
    { threshold: 100000, base: 2830, rate: 0.04 },
    { threshold: 200000, base: 6830, rate: 0.0425 },
    { threshold: 250000, base: 8955, rate: 0.0475 },
    { threshold: 300000, base: 11330, rate: 0.05 },
    { threshold: 500000, base: 21330, rate: 0.055 },
  ],
  TAS: [
    { threshold: 0, base: 50, rate: 0 },
    { threshold: 3000, base: 50, rate: 0.0175 },
    { threshold: 25000, base: 435, rate: 0.0225 },
    { threshold: 75000, base: 1560, rate: 0.035 },
    { threshold: 200000, base: 5935, rate: 0.04 },
    { threshold: 375000, base: 12935, rate: 0.0425 },
    { threshold: 725000, base: 27810, rate: 0.045 },
  ],
  ACT: [
    { threshold: 0, base: 0, rate: 0.0049 },
    { threshold: 260000, base: 1274, rate: 0.022 },
    { threshold: 300000, base: 2154, rate: 0.034 },
    { threshold: 500000, base: 8954, rate: 0.0432 },
    { threshold: 750000, base: 19754, rate: 0.059 },
    { threshold: 1000000, base: 34504, rate: 0.064 },
    { threshold: 1455000, base: 0, rate: 0.0454, flat: true },
  ],
  NT: [
    { threshold: 525000, base: 0, rate: 0.0495, flat: true },
    { threshold: 3000000, base: 0, rate: 0.0575, flat: true },
    { threshold: 5000000, base: 0, rate: 0.0595, flat: true },
  ],
};

/**
 * First home buyer duty relief on an established home: full relief at or
 * under `exemptUpTo`, phasing out to nothing at `concessionUpTo`. New homes
 * and land often have a separate, more generous rule, which `note` says.
 */
export const FIRST_HOME_DUTY: Record<AuState, { exemptUpTo: number; concessionUpTo: number; note: string }> = {
  NSW: { exemptUpTo: 800000, concessionUpTo: 1000000, note: 'First Home Buyers Assistance: no duty to $800,000 and a sliding concession to $1,000,000, new or established.' },
  VIC: { exemptUpTo: 600000, concessionUpTo: 750000, note: 'No duty to $600,000 and a sliding concession to $750,000 when you live in the home.' },
  QLD: { exemptUpTo: 700000, concessionUpTo: 800000, note: 'First home concession: no duty to $700,000 on an established home, phasing out by $800,000. A new home, or land to build on, pays no duty at any price.' },
  WA: { exemptUpTo: 500000, concessionUpTo: 700000, note: 'No duty to $500,000 and a concession to $700,000 in Perth and Peel, or $750,000 elsewhere.' },
  SA: { exemptUpTo: 0, concessionUpTo: 0, note: 'No relief on an established home. A new home, or land to build one, pays no duty at any price.' },
  TAS: { exemptUpTo: 750000, concessionUpTo: 750000, note: 'No duty on an established home to $750,000.' },
  ACT: { exemptUpTo: Number.MAX_SAFE_INTEGER, concessionUpTo: Number.MAX_SAFE_INTEGER, note: 'Home Buyer Concession: no duty at any price if household income is under $170,000 (plus $3,330 a dependent child) and you have not owned property in the last two years.' },
  NT: { exemptUpTo: 0, concessionUpTo: 0, note: 'No duty relief; the Territory offers grants for a new build instead.' },
};

/** Other upfront purchase costs a buyer should hold back for. */
export const PURCHASE_COSTS = { conveyancing: 2000, inspections: 800, lenderFees: 800, movingAndSetup: 2500 };

/** Long-run return assumptions by risk profile, nominal, before fees and tax. */
export const RETURN_ASSUMPTIONS: Record<string, { returnPct: number; volatilityPct: number }> = {
  conservative: { returnPct: 4.5, volatilityPct: 4 },
  cautious: { returnPct: 5.5, volatilityPct: 6 },
  balanced: { returnPct: 6.5, volatilityPct: 9 },
  growth: { returnPct: 7.5, volatilityPct: 12 },
  high_growth: { returnPct: 8.5, volatilityPct: 15 },
};

export const INFLATION_ASSUMPTION_PCT = 2.5;
