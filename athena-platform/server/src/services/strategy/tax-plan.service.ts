/**
 * The tax strategy: what a member will owe, what she can claim, what super
 * can save her, and what a sole trader should put aside each quarter.
 *
 * Everything is arithmetic on the published rates in au-rates.ts. There is
 * no lodgement here, and no advice: each result is an estimate with the
 * assumptions listed, for the member to take to the ATO calculators or her
 * accountant. The individual scale, Medicare levy, low income offset and
 * HELP repayment are the same functions the business structure comparison
 * uses, so the four engines agree with each other.
 */

import {
  COMPANY_TAX,
  DEDUCTION_RATES,
  GST,
  HELP_REPAYMENT,
  INCOME_TAX_BRACKETS,
  LITO,
  MEDICARE_LEVY,
  RATES_AS_AT,
  SUPER,
} from './au-rates';

export const round = (n: number) => Math.round(n);
export const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp0 = (n: number) => Math.max(0, n);
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

// ------------------------------------------------------------ the scale

export function incomeTaxOn(taxable: number): number {
  let tax = 0;
  for (const b of INCOME_TAX_BRACKETS) {
    if (taxable <= b.from) break;
    const upper = b.to === null ? taxable : Math.min(taxable, b.to);
    tax += (upper - b.from) * b.rate;
  }
  return tax;
}

export function marginalRateAt(taxable: number): number {
  let rate = 0;
  for (const b of INCOME_TAX_BRACKETS) if (taxable > b.from) rate = b.rate;
  return rate;
}

export function medicareLevyOn(taxable: number): number {
  const { rate, lowIncomeThreshold, phaseInRate } = MEDICARE_LEVY;
  if (taxable <= lowIncomeThreshold) return 0;
  return Math.min(taxable * rate, (taxable - lowIncomeThreshold) * phaseInRate);
}

export function litoOn(taxable: number): number {
  if (taxable <= LITO.fullUpTo) return LITO.max;
  if (taxable <= LITO.taper1To) return LITO.max - (taxable - LITO.fullUpTo) * LITO.taper1Rate;
  const afterFirstTaper = LITO.max - (LITO.taper1To - LITO.fullUpTo) * LITO.taper1Rate;
  if (taxable <= LITO.taper2To) return clamp0(afterFirstTaper - (taxable - LITO.taper1To) * LITO.taper2Rate);
  return 0;
}

export function helpRepaymentOn(repaymentIncome: number): number {
  if (repaymentIncome <= HELP_REPAYMENT.threshold) return 0;
  const lower = Math.min(repaymentIncome, HELP_REPAYMENT.upperThreshold) - HELP_REPAYMENT.threshold;
  const upper = clamp0(repaymentIncome - HELP_REPAYMENT.upperThreshold);
  return lower * HELP_REPAYMENT.lowerRate + upper * HELP_REPAYMENT.upperRate;
}

/** Income tax after the low income offset, plus the Medicare levy. */
export function individualTaxOn(taxable: number): number {
  return clamp0(incomeTaxOn(taxable) - litoOn(taxable)) + medicareLevyOn(taxable);
}

/** The rate the next dollar is taxed at, Medicare included. */
export function marginalWithMedicare(taxable: number): number {
  return marginalRateAt(taxable) + (taxable > MEDICARE_LEVY.lowIncomeThreshold ? MEDICARE_LEVY.rate : 0);
}

// --------------------------------------------------- individual estimate

export interface IndividualTaxInput {
  grossIncome: number;
  deductions?: number;
  salarySacrifice?: number;
  hasHelpDebt?: boolean;
  helpBalance?: number;
}

export interface IndividualTaxResult {
  asAt: string;
  grossIncome: number;
  deductions: number;
  salarySacrifice: number;
  taxableIncome: number;
  incomeTax: number;
  lito: number;
  medicareLevy: number;
  helpRepayment: number;
  totalTax: number;
  netIncome: number;
  monthlyTakeHome: number;
  fortnightlyTakeHome: number;
  marginalRate: number;
  effectiveRate: number;
  employerSuper: number;
  brackets: Array<{ from: number; to: number | null; rate: number; amount: number; tax: number }>;
  notes: string[];
}

export function estimateIndividualTax(input: IndividualTaxInput): IndividualTaxResult {
  const gross = clamp0(input.grossIncome);
  const deductions = clamp0(input.deductions ?? 0);
  const salarySacrifice = Math.min(clamp0(input.salarySacrifice ?? 0), gross);
  const taxable = clamp0(gross - salarySacrifice - deductions);

  const incomeTax = incomeTaxOn(taxable);
  const lito = Math.min(litoOn(taxable), incomeTax);
  const medicareLevy = medicareLevyOn(taxable);
  // HELP repayment income adds reportable super (salary sacrifice) back on.
  const helpRepayment = input.hasHelpDebt ? Math.min(helpRepaymentOn(taxable + salarySacrifice), clamp0(input.helpBalance ?? Number.MAX_SAFE_INTEGER)) : 0;
  const totalTax = incomeTax - lito + medicareLevy + helpRepayment;
  const netIncome = gross - salarySacrifice - totalTax;

  const brackets = INCOME_TAX_BRACKETS.map((b) => {
    const upper = b.to === null ? taxable : Math.min(taxable, b.to);
    const amount = clamp0(upper - b.from);
    return { from: b.from, to: b.to, rate: b.rate, amount: round(amount), tax: round(amount * b.rate) };
  });

  const notes = [
    'Resident rates, no private health or Medicare levy surcharge, no offsets other than the low income offset.',
    salarySacrifice > 0 ? 'Salary sacrifice is taxed at 15% inside super instead of your marginal rate, and still counts toward HELP repayment income.' : '',
    input.hasHelpDebt ? 'HELP repayments are worked out on repayment income (taxable income plus reportable super), at the marginal rates from 1 July 2025.' : '',
  ].filter(Boolean);

  return {
    asAt: RATES_AS_AT,
    grossIncome: round(gross),
    deductions: round(deductions),
    salarySacrifice: round(salarySacrifice),
    taxableIncome: round(taxable),
    incomeTax: round(incomeTax),
    lito: round(lito),
    medicareLevy: round(medicareLevy),
    helpRepayment: round(helpRepayment),
    totalTax: round(totalTax),
    netIncome: round(netIncome),
    monthlyTakeHome: round(netIncome / 12),
    fortnightlyTakeHome: round(netIncome / 26),
    marginalRate: marginalRateAt(taxable),
    effectiveRate: pct(totalTax, gross),
    employerSuper: round(gross * SUPER.guaranteeRate),
    brackets,
    notes,
  };
}

// ---------------------------------------------------------- deductions

export interface DeductionInput {
  taxableIncome: number;
  homeOfficeHoursPerWeek?: number;
  weeksWorkedFromHome?: number;
  carWorkKm?: number;
  selfEducation?: number;
  toolsAndEquipment?: number;
  professionalFees?: number;
  donations?: number;
  incomeProtectionPremiums?: number;
  phoneAndInternet?: number;
  phoneWorkUsePct?: number;
  workClothing?: number;
  personalSuperContributions?: number;
  other?: number;
}

export interface DeductionItem {
  key: string;
  label: string;
  amount: number;
  basis: string;
  records: string;
}

export interface DeductionResult {
  asAt: string;
  items: DeductionItem[];
  totalDeductions: number;
  taxableBefore: number;
  taxableAfter: number;
  taxBefore: number;
  taxAfter: number;
  taxSaved: number;
  marginalRate: number;
  notes: string[];
}

export function planDeductions(input: DeductionInput): DeductionResult {
  const items: DeductionItem[] = [];
  const add = (key: string, label: string, amount: number, basis: string, records: string) => {
    if (amount > 0) items.push({ key, label, amount: round(amount), basis, records });
  };

  const hours = clamp0(input.homeOfficeHoursPerWeek ?? 0) * clamp0(input.weeksWorkedFromHome ?? 48);
  add('home_office', 'Working from home', hours * DEDUCTION_RATES.homeOfficeFixedRatePerHour, `${round(hours)} hours at the ${Math.round(DEDUCTION_RATES.homeOfficeFixedRatePerHour * 100)}c fixed rate`, 'A diary or timesheet of the hours, and one bill for each running cost.');

  const km = Math.min(clamp0(input.carWorkKm ?? 0), DEDUCTION_RATES.carCentsPerKmMaxKm);
  add('car', 'Work travel by car', km * DEDUCTION_RATES.carCentsPerKm, `${round(km)} km at ${Math.round(DEDUCTION_RATES.carCentsPerKm * 100)}c a kilometre (capped at ${DEDUCTION_RATES.carCentsPerKmMaxKm.toLocaleString('en-AU')} km)`, 'How you worked out the kilometres. Home to work does not count.');

  add('self_education', 'Self-education', clamp0(input.selfEducation ?? 0), 'Course fees, textbooks and travel for study tied to your current job', 'Receipts, and how the course relates to the work you do now.');

  const tools = clamp0(input.toolsAndEquipment ?? 0);
  add('tools', 'Tools and equipment', tools, tools > DEDUCTION_RATES.immediateDeductionItemLimit ? `Items over $${DEDUCTION_RATES.immediateDeductionItemLimit} are claimed over their effective life, so the first year is less than this` : 'Items under $300 are claimed in full this year', 'Receipts, and the share of work use.');

  add('professional_fees', 'Union and professional fees', clamp0(input.professionalFees ?? 0), 'Membership, registration and subscriptions for your occupation', 'The annual statement or receipt.');
  add('donations', 'Donations', clamp0(input.donations ?? 0), 'Gifts of $2 or more to a deductible gift recipient', 'Receipts showing the DGR status.');
  add('income_protection', 'Income protection insurance', clamp0(input.incomeProtectionPremiums ?? 0), 'Premiums for a policy held outside super', 'The annual premium statement. Life and trauma cover are not deductible.');

  const phone = clamp0(input.phoneAndInternet ?? 0) * Math.min(100, clamp0(input.phoneWorkUsePct ?? 0)) / 100;
  add('phone', 'Phone and internet', phone, `${round(input.phoneWorkUsePct ?? 0)}% work use of the bills (leave out if you claimed the fixed home office rate)`, 'A four-week diary of work use, and the bills.');

  add('clothing', 'Uniform and laundry', clamp0(input.workClothing ?? 0), 'Compulsory uniform, protective wear and the cost of washing it', 'Receipts, or a reasonable laundry estimate under $150.');
  add('super_personal', 'Personal super contributions', clamp0(input.personalSuperContributions ?? 0), 'Deductible when you give your fund a notice of intent before you lodge', 'The notice of intent and the fund acknowledgement.');
  add('other', 'Other work expenses', clamp0(input.other ?? 0), 'Anything else you spent to earn your income and were not reimbursed for', 'Receipts.');

  const total = items.reduce((s, i) => s + i.amount, 0);
  const before = clamp0(input.taxableIncome);
  const after = clamp0(before - total);
  const taxBefore = individualTaxOn(before);
  const taxAfter = individualTaxOn(after);

  return {
    asAt: RATES_AS_AT,
    items,
    totalDeductions: round(total),
    taxableBefore: round(before),
    taxableAfter: round(after),
    taxBefore: round(taxBefore),
    taxAfter: round(taxAfter),
    taxSaved: round(taxBefore - taxAfter),
    marginalRate: marginalRateAt(before),
    notes: [
      'A deduction reduces taxable income, so it saves tax at your marginal rate, not dollar for dollar.',
      'Claims over $300 in total need written evidence for every item.',
      'The fixed home office rate already covers phone, internet, power and stationery; claim those separately only under the actual cost method.',
    ],
  };
}

// --------------------------------------------------------------- super

export interface SuperPlanInput {
  income: number;
  superBalance?: number;
  employerContributions?: number;
  salarySacrifice?: number;
  personalDeductible?: number;
  personalAfterTax?: number;
  spouseIncome?: number;
  spouseContribution?: number;
}

export interface SuperMove {
  key: string;
  label: string;
  amount: number;
  benefit: number;
  detail: string;
}

export interface SuperPlanResult {
  asAt: string;
  employerContributions: number;
  voluntaryConcessional: number;
  concessionalTotal: number;
  concessionalCap: number;
  concessionalHeadroom: number;
  overCapBy: number;
  contributionsTax: number;
  taxSavedByVoluntary: number;
  netCostOfVoluntary: number;
  division293Tax: number;
  coContribution: number;
  spouseOffset: number;
  carryForwardEligible: boolean;
  marginalRate: number;
  moves: SuperMove[];
  notes: string[];
}

export function planSuperContributions(input: SuperPlanInput): SuperPlanResult {
  const income = clamp0(input.income);
  const employer = input.employerContributions !== undefined ? clamp0(input.employerContributions) : income * SUPER.guaranteeRate;
  const sacrifice = clamp0(input.salarySacrifice ?? 0);
  const deductible = clamp0(input.personalDeductible ?? 0);
  const afterTax = clamp0(input.personalAfterTax ?? 0);
  const voluntary = sacrifice + deductible;
  const concessional = employer + voluntary;
  const headroom = clamp0(SUPER.concessionalCap - concessional);
  const overCap = clamp0(concessional - SUPER.concessionalCap);

  const taxableWithout = income;
  const taxableWith = clamp0(income - voluntary);
  const taxOutside = individualTaxOn(taxableWithout) - individualTaxOn(taxableWith);
  const contributionsTax = concessional * SUPER.contributionsTax;
  const taxOnVoluntary = voluntary * SUPER.contributionsTax;

  // Division 293: an extra 15% on concessional contributions once income plus
  // those contributions passes $250,000.
  const div293Income = income + concessional;
  const div293Excess = clamp0(div293Income - SUPER.division293Threshold);
  const division293Tax = div293Excess > 0 ? Math.min(div293Excess, concessional) * SUPER.division293Rate : 0;

  const taxSavedByVoluntary = clamp0(taxOutside - taxOnVoluntary);
  const netCostOfVoluntary = voluntary - taxOutside;

  const co = SUPER.coContribution;
  let coContribution = 0;
  if (afterTax > 0 && income < co.upperIncome) {
    const maxAtIncome = clamp0(co.max - clamp0(income - co.lowerIncome) * (co.max / (co.upperIncome - co.lowerIncome)));
    coContribution = Math.min(maxAtIncome, Math.min(afterTax, co.maxPersonal) * co.matchRate);
  }

  const sp = SUPER.spouseOffset;
  let spouseOffset = 0;
  const spouseIncome = input.spouseIncome;
  const spouseContribution = clamp0(input.spouseContribution ?? 0);
  if (spouseContribution > 0 && spouseIncome !== undefined && spouseIncome < sp.spouseIncomeCutoff) {
    const eligibleContribution = Math.min(spouseContribution, clamp0(sp.maxContribution - clamp0(spouseIncome - sp.spouseIncomeFull)));
    spouseOffset = Math.min(sp.max, eligibleContribution * sp.rate);
  }

  const marginal = marginalWithMedicare(income);
  const moves: SuperMove[] = [];
  if (headroom > 0 && marginal > SUPER.contributionsTax) {
    const benefit = individualTaxOn(taxableWith) - individualTaxOn(clamp0(taxableWith - headroom)) - headroom * SUPER.contributionsTax;
    moves.push({ key: 'fill_cap', label: 'Fill the concessional cap', amount: round(headroom), benefit: round(clamp0(benefit)), detail: `Another $${round(headroom).toLocaleString('en-AU')} before tax through salary sacrifice or a deductible personal contribution is taxed at 15% instead of ${Math.round(marginal * 100)}%.` });
  }
  if (income < co.upperIncome && afterTax < co.maxPersonal) {
    const extra = co.maxPersonal - afterTax;
    const maxAtIncome = clamp0(co.max - clamp0(income - co.lowerIncome) * (co.max / (co.upperIncome - co.lowerIncome)));
    const gain = clamp0(Math.min(maxAtIncome, co.maxPersonal * co.matchRate) - coContribution);
    if (gain > 0) moves.push({ key: 'co_contribution', label: 'Claim the government co-contribution', amount: round(extra), benefit: round(gain), detail: `An after-tax contribution of up to $${co.maxPersonal.toLocaleString('en-AU')} is matched at 50c in the dollar while your income is under $${co.upperIncome.toLocaleString('en-AU')}.` });
  }
  if (spouseIncome !== undefined && spouseIncome < sp.spouseIncomeCutoff && spouseContribution < sp.maxContribution) {
    moves.push({ key: 'spouse', label: 'A contribution for your partner', amount: round(sp.maxContribution - spouseContribution), benefit: round(clamp0(sp.max - spouseOffset)), detail: `Contributing to a partner earning under $${sp.spouseIncomeCutoff.toLocaleString('en-AU')} earns you a tax offset of up to $${sp.max}.` });
  }
  const carryForwardEligible = clamp0(input.superBalance ?? 0) < SUPER.carryForwardBalanceLimit;
  if (carryForwardEligible) {
    moves.push({ key: 'catch_up', label: 'Catch-up after a career break', amount: 0, benefit: 0, detail: 'With a balance under $500,000 you can use unused concessional cap from the last five years, which is how a parental leave year is made up later.' });
  }
  moves.sort((a, b) => b.benefit - a.benefit);

  const notes = [
    `Employer super is ${Math.round(SUPER.guaranteeRate * 100)}% of ordinary earnings from 1 July 2025 and counts toward the $${SUPER.concessionalCap.toLocaleString('en-AU')} concessional cap.`,
    'Money in super is locked until preservation age. Keep the emergency fund outside it.',
    overCap > 0 ? `You are $${round(overCap).toLocaleString('en-AU')} over the concessional cap; the excess is taxed at your marginal rate instead.` : '',
    division293Tax > 0 ? 'Division 293 tax applies because income plus concessional contributions passes $250,000.' : '',
  ].filter(Boolean);

  return {
    asAt: RATES_AS_AT,
    employerContributions: round(employer),
    voluntaryConcessional: round(voluntary),
    concessionalTotal: round(concessional),
    concessionalCap: SUPER.concessionalCap,
    concessionalHeadroom: round(headroom),
    overCapBy: round(overCap),
    contributionsTax: round(contributionsTax),
    taxSavedByVoluntary: round(taxSavedByVoluntary),
    netCostOfVoluntary: round(netCostOfVoluntary),
    division293Tax: round(division293Tax),
    coContribution: round(coContribution),
    spouseOffset: round(spouseOffset),
    carryForwardEligible,
    marginalRate: marginal,
    moves,
    notes,
  };
}

// ------------------------------------------------------ sole trader quarter

export interface SetAsideInput {
  businessProfit: number;
  businessSales?: number;
  businessExpenses?: number;
  otherIncome?: number;
  gstRegistered?: boolean;
  hasHelpDebt?: boolean;
}

export interface SetAsideResult {
  asAt: string;
  taxOnBusinessIncome: number;
  helpOnBusinessIncome: number;
  gstNetAnnual: number;
  quarterlyIncomeTax: number;
  quarterlyGst: number;
  quarterlyTotal: number;
  setAsidePctOfProfit: number;
  mustRegisterForGst: boolean;
  suggestedSuper: number;
  companyComparison: number;
  notes: string[];
}

export function planQuarterlySetAside(input: SetAsideInput): SetAsideResult {
  const profit = clamp0(input.businessProfit);
  const other = clamp0(input.otherIncome ?? 0);
  const sales = clamp0(input.businessSales ?? 0);
  const expenses = clamp0(input.businessExpenses ?? 0);

  const taxOnBusiness = individualTaxOn(other + profit) - individualTaxOn(other);
  const helpOnBusiness = input.hasHelpDebt ? helpRepaymentOn(other + profit) - helpRepaymentOn(other) : 0;
  const mustRegister = sales >= GST.registrationThreshold;
  const registered = Boolean(input.gstRegistered) || mustRegister;
  const gstNet = registered ? clamp0(sales - expenses) * (GST.rate / (1 + GST.rate)) : 0;

  const quarterlyIncomeTax = (taxOnBusiness + helpOnBusiness) / 4;
  const quarterlyGst = gstNet / 4;
  const setAsidePct = pct(taxOnBusiness + helpOnBusiness, profit);

  return {
    asAt: RATES_AS_AT,
    taxOnBusinessIncome: round(taxOnBusiness),
    helpOnBusinessIncome: round(helpOnBusiness),
    gstNetAnnual: round(gstNet),
    quarterlyIncomeTax: round(quarterlyIncomeTax),
    quarterlyGst: round(quarterlyGst),
    quarterlyTotal: round(quarterlyIncomeTax + quarterlyGst),
    setAsidePctOfProfit: setAsidePct,
    mustRegisterForGst: mustRegister,
    suggestedSuper: round(profit * SUPER.guaranteeRate),
    companyComparison: round(profit * COMPANY_TAX.baseRate),
    notes: [
      'A sole trader pays tax on business profit at her own marginal rate; nothing is withheld, so the money has to be put aside as it comes in.',
      'After the first return the ATO usually asks for PAYG instalments each quarter, which replaces the guessing.',
      mustRegister ? `Sales are at or over $${GST.registrationThreshold.toLocaleString('en-AU')}, so GST registration is required.` : `GST registration is optional under $${GST.registrationThreshold.toLocaleString('en-AU')} in sales.`,
      'Nobody pays super for a sole trader. The suggested super is 12% of profit, the same as an employee would get, and it is deductible.',
    ],
  };
}
