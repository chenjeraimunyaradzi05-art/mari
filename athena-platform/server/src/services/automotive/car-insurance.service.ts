/**
 * A car insurance estimate from the things that move a premium: the car's
 * value and type, the driver's age and record, where it lives and sleeps,
 * how far it goes, the excess, and whether it is under finance. Each cover
 * type is priced so the trade-off is visible, and the factors are returned
 * with the number so the estimate explains itself. Quotes differ between
 * insurers by more than any single factor, which is the page's advice.
 */

import { AU_STATES, COVER_TYPES, PREMIUM_FACTORS, type AuState, type CoverKey, type FuelKey } from './automotive-library';

export interface PremiumInput {
  vehicleValue: number;
  driverAge: number;
  state: AuState;
  area?: 'METRO' | 'REGIONAL' | 'REMOTE';
  garaging?: 'GARAGE' | 'CARPORT' | 'STREET';
  kmPerYear?: number;
  excess?: number;
  claimsFreeYears?: number;
  youngDrivers?: boolean;
  fuelType?: FuelKey;
  multiPolicy?: boolean;
  financed?: boolean;
  vehicleAgeYears?: number;
}

export interface CoverEstimate {
  key: CoverKey;
  label: string;
  covers: string;
  suits: string;
  annualLow: number;
  annual: number;
  annualHigh: number;
  monthly: number;
  recommended: boolean;
}

export interface PremiumResult {
  covers: CoverEstimate[];
  factors: Array<{ key: string; label: string; effect: string; multiplier: number }>;
  multiPolicySaving: number;
  ctpNote: string;
  notes: string[];
}

const STATE_FACTOR: Record<AuState, number> = { NSW: 1.15, VIC: 1.1, QLD: 1.0, WA: 0.95, SA: 1.0, TAS: 0.9, ACT: 1.05, NT: 1.05 };
const BASE_RATE_OF_VALUE = 0.035;
const MIN_COMPREHENSIVE = 700;
const MULTI_POLICY_DISCOUNT = 0.1;

const CTP_NOTES: Record<AuState, string> = {
  QLD: 'In Queensland CTP is paid with registration and you choose the insurer on the renewal; the price barely differs, the claims service does.',
  NSW: 'In New South Wales the Green Slip is bought separately before registration; compare on the SIRA site, the spread is real.',
  VIC: 'In Victoria CTP is the TAC charge, paid with registration; nothing to shop for.',
  WA: 'In Western Australia CTP is paid with the licence fee through the Insurance Commission; nothing to shop for.',
  SA: 'In South Australia CTP is paid with registration and you can nominate one of the approved insurers.',
  TAS: 'In Tasmania CTP is the MAIB premium, paid with registration.',
  ACT: 'In the ACT the MAI premium is paid with registration and you choose from the licensed insurers.',
  NT: 'In the Northern Territory CTP is paid with registration through the MAC scheme.',
};

const round = (n: number) => Math.round(n);

export function estimatePremium(input: PremiumInput): PremiumResult {
  const value = Math.max(0, input.vehicleValue);
  const factors: PremiumResult['factors'] = [];
  const push = (key: string, label: string, multiplier: number, effect: string) => factors.push({ key, label, multiplier: Math.round(multiplier * 100) / 100, effect });

  const age = input.driverAge;
  const ageF = age < 21 ? 1.9 : age < 25 ? 1.6 : age < 30 ? 1.25 : age < 60 ? 1 : age < 70 ? 1.05 : 1.15;
  push('age', 'Your age', ageF, age < 25 ? 'Under 25 pays the most' : age < 30 ? 'Comes down again at 30' : age < 60 ? 'The base rate' : 'Rises a little from 60');

  const state = AU_STATES.includes(input.state) ? input.state : 'QLD';
  push('state', `Registered in ${state}`, STATE_FACTOR[state], STATE_FACTOR[state] > 1 ? 'Dearer than average for repairs and theft' : STATE_FACTOR[state] < 1 ? 'Cheaper than average' : 'About average');

  const areaF = input.area === 'METRO' ? 1.1 : input.area === 'REMOTE' ? 0.95 : 1;
  push('postcode', input.area === 'METRO' ? 'City postcode' : input.area === 'REMOTE' ? 'Remote postcode' : 'Regional postcode', areaF, areaF > 1 ? 'More theft, more crashes, more hail' : areaF < 1 ? 'Fewer cars to hit' : 'About average');

  const garF = input.garaging === 'GARAGE' ? 0.95 : input.garaging === 'STREET' ? 1.1 : 1;
  push('garaging', input.garaging === 'GARAGE' ? 'Locked garage' : input.garaging === 'STREET' ? 'On the street' : 'Carport or driveway', garF, garF < 1 ? 'A garage earns a small discount' : garF > 1 ? 'The street costs a little more' : 'Neutral');

  const km = input.kmPerYear ?? 15000;
  const kmF = km < 10000 ? 0.93 : km > 20000 ? 1.1 : 1;
  push('km', `${km.toLocaleString('en-AU')} km a year`, kmF, kmF < 1 ? 'Low kilometres earn a discount with insurers that ask' : kmF > 1 ? 'High kilometres cost more' : 'Average use');

  const excess = input.excess ?? 800;
  const exF = excess < 600 ? 1.1 : excess < 1000 ? 1 : excess < 1500 ? 0.93 : 0.85;
  push('excess', `$${excess} excess`, exF, exF < 1 ? 'A higher excess lowers the premium' : exF > 1 ? 'A low excess costs more every year' : 'The usual excess');

  const cf = input.claimsFreeYears ?? 3;
  const cfF = cf >= 5 ? 0.85 : cf >= 2 ? 0.93 : 1;
  push('record', cf >= 5 ? 'Five or more years claim-free' : cf >= 2 ? `${cf} years claim-free` : 'A recent claim, or a new record', cfF, cfF < 1 ? 'A clean record is worth money' : 'No discount yet');

  const ydF = input.youngDrivers ? 1.35 : 1;
  if (input.youngDrivers) push('drivers', 'A driver under 25 listed', ydF, 'Listing them costs; not listing them can void a claim');

  const fuelF = input.fuelType === 'ELECTRIC' ? 1.12 : 1;
  if (input.fuelType === 'ELECTRIC') push('vehicle', 'Electric car', fuelF, 'Batteries and sensors cost more to repair');

  const vehAge = input.vehicleAgeYears ?? 3;
  const vaF = vehAge < 1 ? 1.05 : vehAge > 10 ? 1.08 : 1;
  if (vaF !== 1) push('vehicle_age', vehAge < 1 ? 'A new car' : 'An older car', vaF, vehAge < 1 ? 'New-for-old replacement in the first years' : 'Parts and repairability');

  const multiplier = factors.reduce((m, f) => m * f.multiplier, 1);
  const comprehensiveBase = Math.max(MIN_COMPREHENSIVE, value * BASE_RATE_OF_VALUE);
  const comprehensive = comprehensiveBase * multiplier;
  const tpft = Math.max(350, comprehensive * 0.4);
  const tpp = Math.max(280, 320 * ageF * STATE_FACTOR[state]);
  const multi = input.multiPolicy ? 1 - MULTI_POLICY_DISCOUNT : 1;

  const make = (key: CoverKey, annual: number, recommended: boolean): CoverEstimate => {
    const c = COVER_TYPES.find((t) => t.key === key)!;
    const a = round(annual * multi);
    return { key, label: c.label, covers: c.covers, suits: c.suits, annualLow: round(a * 0.85), annual: a, annualHigh: round(a * 1.2), monthly: round(a / 12 * 1.08), recommended };
  };
  const recommend: CoverKey = input.financed || value >= 8000 ? 'COMPREHENSIVE' : value >= 3000 ? 'TPFT' : 'TPP';
  const covers = [make('COMPREHENSIVE', comprehensive, recommend === 'COMPREHENSIVE'), make('TPFT', tpft, recommend === 'TPFT'), make('TPP', tpp, recommend === 'TPP')];

  return {
    covers,
    factors,
    multiPolicySaving: input.multiPolicy ? round(comprehensive * MULTI_POLICY_DISCOUNT) : round(comprehensive * MULTI_POLICY_DISCOUNT),
    ctpNote: CTP_NOTES[state],
    notes: [
      `A comprehensive premium is about ${(BASE_RATE_OF_VALUE * 100).toFixed(1)}% of the car's value a year for a thirty-something with a clean record, then moved by the factors shown.`,
      'Paying monthly usually adds around eight percent; the monthly figure includes that.',
      input.financed ? 'A car under finance must be comprehensively insured; the lender is named on the policy.' : recommend === 'COMPREHENSIVE' ? 'At this value, comprehensive is the sensible choice: one crash costs more than years of the difference.' : `At this value the premium difference over a few years approaches the car's worth; ${recommend === 'TPFT' ? 'third party, fire and theft' : 'third party property'} is a defensible choice if you could replace the car from savings.`,
      input.multiPolicy ? `Holding home or contents cover with the same insurer is taken as ${Math.round(MULTI_POLICY_DISCOUNT * 100)}% off.` : `Home or contents cover with the same insurer usually earns about ${Math.round(MULTI_POLICY_DISCOUNT * 100)}% off each policy.`,
      'The spread between insurers for the same driver is often thirty percent or more; three quotes is the minimum.',
    ],
  };
}

export function insuranceReference() {
  return { coverTypes: COVER_TYPES, factors: PREMIUM_FACTORS, ctp: CTP_NOTES };
}

// ------------------------------------------------------------------ compare

/** A quote as she was given it: the premium, the excess, and what is in or out. */
export interface InsuranceQuote {
  insurer: string;
  cover?: string;
  annual: number;
  /** The total of twelve instalments, when she would pay monthly. */
  monthlyTotal?: number | null;
  excess: number;
  agreedValue?: number | null;
  hireCar?: boolean;
  choiceOfRepairer?: boolean;
  newForOld?: boolean;
  roadside?: boolean;
  windscreen?: boolean;
}

export interface QuoteComparison {
  insurer: string;
  cover: string;
  annual: number;
  paidYearly: number;
  monthlyLoading: number;
  excess: number;
  expectedExcess: number;
  missing: string[];
  missingValue: number;
  allIn: number;
  moreThanBest: number;
  cheapest: boolean;
  bestValue: boolean;
  flags: string[];
}

/** What the extras cost bought separately, so a quote that leaves them out is compared honestly. */
export const EXTRAS_VALUE = { hireCar: 250, roadside: 100, windscreen: 80 } as const;
/** The chance of a claim in a year for an ordinary driver, so the excess is weighed rather than ignored. */
export const CLAIM_CHANCE = 0.12;

/**
 * The quotes she collected, ranked by what each would really cost in a
 * year: the premium as she would pay it, the excess weighted by the
 * chance of a claim, and the price of buying the missing extras
 * separately. The cheapest premium and the best value are marked
 * separately, because they are often different insurers.
 */
export function compareInsuranceQuotes(input: { quotes: InsuranceQuote[]; claimChance?: number; vehicleValue?: number | null }): { quotes: QuoteComparison[]; cheapest: string | null; bestValue: string | null; spreadPct: number; notes: string[] } {
  const chance = Math.min(1, Math.max(0, input.claimChance ?? CLAIM_CHANCE));
  const rows: QuoteComparison[] = input.quotes.slice(0, 6).map((q) => {
    const annual = Math.max(0, q.annual);
    const paidYearly = q.monthlyTotal && q.monthlyTotal > 0 ? q.monthlyTotal : annual;
    const monthlyLoading = Math.max(0, round(paidYearly - annual));
    const excess = Math.max(0, q.excess);
    const expectedExcess = round(excess * chance);
    const missing: string[] = [];
    let missingValue = 0;
    if (!q.hireCar) { missing.push('hire car'); missingValue += EXTRAS_VALUE.hireCar; }
    if (!q.roadside) { missing.push('roadside assistance'); missingValue += EXTRAS_VALUE.roadside; }
    if (!q.windscreen) { missing.push('windscreen without excess'); missingValue += EXTRAS_VALUE.windscreen; }
    const flags: string[] = [];
    if (monthlyLoading > annual * 0.05) flags.push(`Paying monthly adds $${monthlyLoading} a year; pay yearly if you can.`);
    if (excess >= 1500) flags.push(`A $${excess.toLocaleString('en-AU')} excess is a lot to find in a bad week; make sure it is deliberate.`);
    if (!q.choiceOfRepairer) flags.push('No choice of repairer: the insurer picks the workshop.');
    if (q.agreedValue && input.vehicleValue && q.agreedValue < input.vehicleValue * 0.85) flags.push(`The agreed value ($${q.agreedValue.toLocaleString('en-AU')}) is well under what the car is worth; a write-off would leave you short.`);
    if (!q.newForOld && input.vehicleValue && input.vehicleValue >= 30000) flags.push('No new-for-old replacement on a car worth this much.');
    const cover = String(q.cover ?? 'COMPREHENSIVE');
    return { insurer: q.insurer.trim() || 'Unnamed', cover: COVER_TYPES.find((c) => c.key === cover)?.label ?? cover, annual, paidYearly, monthlyLoading, excess, expectedExcess, missing, missingValue, allIn: round(paidYearly + expectedExcess + missingValue), moreThanBest: 0, cheapest: false, bestValue: false, flags };
  });
  if (rows.length === 0) return { quotes: [], cheapest: null, bestValue: null, spreadPct: 0, notes: [] };
  const minPremium = Math.min(...rows.map((r) => r.paidYearly));
  const minAllIn = Math.min(...rows.map((r) => r.allIn));
  for (const r of rows) { r.cheapest = r.paidYearly === minPremium; r.bestValue = r.allIn === minAllIn; r.moreThanBest = round(r.allIn - minAllIn); }
  rows.sort((a, b) => a.allIn - b.allIn);
  const maxPremium = Math.max(...rows.map((r) => r.paidYearly));
  return {
    quotes: rows,
    cheapest: rows.find((r) => r.cheapest)?.insurer ?? null,
    bestValue: rows[0]?.insurer ?? null,
    spreadPct: minPremium > 0 ? round(((maxPremium - minPremium) / minPremium) * 100) : 0,
    notes: [
      `All-in is the premium as you would pay it, plus the excess weighted by a ${Math.round(chance * 100)}% chance of a claim in the year, plus what the missing extras cost bought separately (a hire car about $${EXTRAS_VALUE.hireCar}, roadside $${EXTRAS_VALUE.roadside}, windscreen cover $${EXTRAS_VALUE.windscreen}).`,
      'The cheapest premium and the best value are often different insurers; the gap is usually the excess and what has been left out.',
      'Read the product disclosure statement for the one you pick: the exclusions, agreed or market value, and who chooses the repairer.',
    ],
  };
}
