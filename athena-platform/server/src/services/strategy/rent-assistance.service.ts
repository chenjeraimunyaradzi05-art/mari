/**
 * Help with the bond and the rent: the financial-assistance side of safe
 * housing the blueprint lists (deposit bonds, rental grants) and the
 * Commonwealth Rent Assistance a low-income renter can claim.
 *
 * Every state runs an interest-free bond loan or guarantee for people who
 * cannot pay four weeks of rent up front, and most have a grant or an
 * advance for someone leaving violence. Those are listed by state with
 * where to apply. Rent Assistance is estimated from the published formula:
 * 75 cents for every dollar of fortnightly rent above a threshold, up to a
 * maximum that depends on the household. The rates move each March and
 * September, so the ones here carry their date.
 */

import { AuState, AU_STATES } from './au-rates';
import { round2 } from './tax-plan.service';

export const RENT_ASSISTANCE_AS_AT = 'rates from 20 September 2025';

export type Household = 'single' | 'single_sharer' | 'couple' | 'single_children_1_2' | 'single_children_3' | 'couple_children_1_2' | 'couple_children_3';

export const HOUSEHOLDS: Array<{ id: Household; label: string; threshold: number; max: number }> = [
  { id: 'single', label: 'Single, no children', threshold: 151.6, max: 211.2 },
  { id: 'single_sharer', label: 'Single, sharing, no children', threshold: 151.6, max: 140.8 },
  { id: 'couple', label: 'Couple, no children', threshold: 245.4, max: 198.8 },
  { id: 'single_children_1_2', label: 'Single, one or two children', threshold: 199.36, max: 248.08 },
  { id: 'single_children_3', label: 'Single, three or more children', threshold: 199.36, max: 280.28 },
  { id: 'couple_children_1_2', label: 'Couple, one or two children', threshold: 295.12, max: 248.08 },
  { id: 'couple_children_3', label: 'Couple, three or more children', threshold: 295.12, max: 280.28 },
];

export interface RentAssistanceResult {
  asAt: string;
  household: Household;
  fortnightlyRent: number;
  threshold: number;
  maximum: number;
  estimateFortnightly: number;
  estimateWeekly: number;
  rentToReachMaximum: number;
  notes: string[];
}

export function estimateRentAssistance(input: { fortnightlyRent: number; household: Household }): RentAssistanceResult {
  const h = HOUSEHOLDS.find((x) => x.id === input.household) ?? HOUSEHOLDS[0];
  const rent = Math.max(0, input.fortnightlyRent);
  const estimate = Math.min(h.max, Math.max(0, (rent - h.threshold) * 0.75));
  return {
    asAt: RENT_ASSISTANCE_AS_AT,
    household: h.id,
    fortnightlyRent: round2(rent),
    threshold: h.threshold,
    maximum: h.max,
    estimateFortnightly: round2(estimate),
    estimateWeekly: round2(estimate / 2),
    rentToReachMaximum: round2(h.threshold + h.max / 0.75),
    notes: [
      'Rent Assistance is paid with an income support payment or Family Tax Benefit; on its own it cannot be claimed.',
      'Board and lodging counts at two thirds of the amount paid unless the rent part is shown separately.',
      'Services Australia applies the current rates and any income test; this is the formula, not a decision.',
    ],
  };
}

export interface BondHelp {
  state: AuState;
  scheme: string;
  what: string;
  who: string;
  leavingViolence: string;
  url: string;
}

export const BOND_HELP: Record<AuState, BondHelp> = {
  NSW: { state: 'NSW', scheme: 'Rentstart Bond Loan', what: 'An interest-free loan for up to 75% of the bond, repaid over the tenancy.', who: 'Low-income renters eligible for social housing, renting privately.', leavingViolence: 'Start Safely gives a private rental subsidy for up to three years to people leaving domestic violence.', url: 'https://www.facs.nsw.gov.au/housing/help/ways/rentstart' },
  VIC: { state: 'VIC', scheme: 'RentAssist Bond Loan', what: 'An interest-free loan for the whole bond, up to a rent limit.', who: 'Renters on a low income with little savings.', leavingViolence: 'Family violence flexible support packages and the Private Rental Assistance Program can cover bond and rent in advance.', url: 'https://www.housing.vic.gov.au/bond-loan-scheme' },
  QLD: { state: 'QLD', scheme: 'Bond Loan, and the Rental Grant', what: 'An interest-free loan for up to four weeks of rent as bond; the Rental Grant is two weeks of rent that is not repaid.', who: 'Renters on a low income; the grant is for people in crisis, including leaving violence.', leavingViolence: 'The Rental Grant and a Bond Loan Plus (bond and two weeks of rent) for people leaving domestic and family violence.', url: 'https://www.qld.gov.au/housing/renting/rent-assistance/bond-loan' },
  WA: { state: 'WA', scheme: 'Bond Assistance Loan', what: 'An interest-free loan for the bond and two weeks of rent in advance.', who: 'Renters on a low income moving into a private rental.', leavingViolence: 'Bond assistance and the Private Rental Assistance Program prioritise people leaving family violence.', url: 'https://www.wa.gov.au/service/community-services/community-support/apply-bond-assistance-loan' },
  SA: { state: 'SA', scheme: 'Bond Guarantee', what: 'Housing SA guarantees the bond to the landlord instead of a cash bond, plus rent in advance if needed.', who: 'Renters on a low income with little savings.', leavingViolence: 'Private Rental Assistance and the domestic violence crisis accommodation program.', url: 'https://www.sa.gov.au/topics/housing/renting-and-letting/renting-privately/bond-guarantee' },
  TAS: { state: 'TAS', scheme: 'Private Rental Assistance', what: 'Bond and rent in advance paid to the landlord, usually not repaid; up to three payments.', who: 'Renters on a low income, assessed through Housing Connect.', leavingViolence: 'Housing Connect prioritises people leaving family violence for the Rapid Rehousing program.', url: 'https://www.homestasmania.com.au/Housing-Connect' },
  ACT: { state: 'ACT', scheme: 'Rental Bond Loan', what: 'An interest-free loan for the bond, repaid over up to two years.', who: 'Renters on a low income in the ACT.', leavingViolence: 'The Domestic Violence Crisis Service and OneLink help with bond and the first weeks of rent.', url: 'https://www.communityservices.act.gov.au/hcs/help-with-renting/rental-bond-loan' },
  NT: { state: 'NT', scheme: 'Bond Assistance', what: 'An interest-free loan or a guarantee for the bond, through Territory Housing.', who: 'Renters on a low income in the Territory.', leavingViolence: 'Crisis accommodation and bond assistance through Territory Families for people leaving family violence.', url: 'https://nt.gov.au/property/renters/apply-for-help-to-rent-privately' },
};

export const LEAVING_VIOLENCE = {
  name: 'Leaving Violence Program',
  what: 'Up to $5,000 in financial support, part cash and part goods or services, plus safety planning and referrals, for someone leaving an intimate partner who has been violent.',
  url: 'https://www.leavingviolence.gov.au/',
  phone: '1800 RESPECT (1800 737 732)',
};

export function rentAssistanceReference() {
  return {
    asAt: RENT_ASSISTANCE_AS_AT,
    households: HOUSEHOLDS,
    bondHelp: AU_STATES.map((s) => BOND_HELP[s]),
    leavingViolence: LEAVING_VIOLENCE,
  };
}
