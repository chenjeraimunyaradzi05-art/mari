/**
 * What a car is worth: a depreciation curve by body and fuel, adjusted for
 * kilometres against the average, condition and make, giving a private
 * sale range and the lower figure a dealer will offer on a trade-in. Used
 * for the trade-in estimate, the price guide on a listing, the changeover
 * cost of an upgrade, and the depreciation line of the cost of ownership.
 *
 * It is a guide, not a valuation. The pages say so, and point at the
 * comparable listings and a professional valuation for a real number.
 */

import type { BodyKey, ConditionKey, FuelKey } from './automotive-library';

const YEAR_MS = 365.25 * 86400000;
const AVERAGE_KM_PER_YEAR = 15000;
const FIRST_YEAR_RETAINED = 0.82;
const FLOOR_RETAINED = 0.08;

const ANNUAL_LOSS: Record<BodyKey, number> = { HATCH: 0.11, SEDAN: 0.12, WAGON: 0.11, SUV: 0.1, UTE: 0.09, VAN: 0.1, PEOPLE_MOVER: 0.11, COUPE: 0.11, CONVERTIBLE: 0.12 };
const FUEL_LOSS_ADJUST: Record<FuelKey, number> = { PETROL: 0, DIESEL: 0, HYBRID: -0.01, PLUG_IN_HYBRID: 0.01, ELECTRIC: 0.04 };
const CONDITION_FACTOR: Record<ConditionKey, number> = { EXCELLENT: 1.05, GOOD: 1, FAIR: 0.9, POOR: 0.75 };
const TYPICAL_NEW_PRICE: Record<BodyKey, number> = { HATCH: 30000, SEDAN: 38000, WAGON: 42000, SUV: 42000, UTE: 50000, VAN: 45000, PEOPLE_MOVER: 55000, COUPE: 60000, CONVERTIBLE: 70000 };

const MAKE_FACTOR: Record<string, number> = {
  toyota: 1.05, lexus: 1.04, mazda: 1.02, subaru: 1.02, kia: 1.01, honda: 1.01, isuzu: 1.02,
  audi: 0.95, bmw: 0.95, 'mercedes-benz': 0.95, volkswagen: 0.96, volvo: 0.96, peugeot: 0.94, renault: 0.94, skoda: 0.96, mini: 0.96, 'land rover': 0.93, jeep: 0.93,
  mg: 0.94, gwm: 0.94, chery: 0.93, ldv: 0.93, byd: 0.96, tesla: 0.97, polestar: 0.95,
};

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function ageInYears(year: number, now = new Date()): number {
  return Math.max(0.25, (now.getTime() - new Date(year, 6, 1).getTime()) / YEAR_MS);
}

/** The share of the new price a car of this age still carries, before kilometres and condition. */
export function retainedShare(ageYears: number, bodyType: BodyKey, fuelType: FuelKey): number {
  const loss = clamp((ANNUAL_LOSS[bodyType] ?? 0.11) + (FUEL_LOSS_ADJUST[fuelType] ?? 0), 0.05, 0.2);
  if (ageYears < 1) return 1 - (1 - FIRST_YEAR_RETAINED) * ageYears;
  return Math.max(FLOOR_RETAINED, FIRST_YEAR_RETAINED * (1 - loss) ** (ageYears - 1));
}

/** The value at the end of each of the next `years`, for a car that is `startAge` years old today. */
export function projectValue(price: number, bodyType: BodyKey, fuelType: FuelKey, years: number, startAge = 0): number[] {
  const base = startAge > 0 ? price / retainedShare(startAge, bodyType, fuelType) : price;
  const out: number[] = [];
  for (let y = 1; y <= years; y += 1) out.push(Math.round(base * retainedShare(startAge + y, bodyType, fuelType)));
  return out;
}

export interface ValuationInput {
  year: number;
  odometerKm: number;
  bodyType?: BodyKey | null;
  fuelType?: FuelKey | null;
  condition?: ConditionKey | null;
  newPrice?: number | null;
  make?: string | null;
  now?: Date;
}

export interface Valuation {
  low: number;
  mid: number;
  high: number;
  tradeIn: number;
  privateSale: number;
  ageYears: number;
  expectedKm: number;
  kmAdjustmentPct: number;
  retainedPct: number;
  newPriceUsed: number;
  newPriceAssumed: boolean;
  assumptions: string[];
}

export function estimateValue(input: ValuationInput): Valuation {
  const now = input.now ?? new Date();
  const body = input.bodyType ?? 'SUV';
  const fuel = input.fuelType ?? 'PETROL';
  const condition = input.condition ?? 'GOOD';
  const age = ageInYears(input.year, now);
  const newPriceAssumed = !input.newPrice || input.newPrice <= 0;
  const newPrice = newPriceAssumed ? TYPICAL_NEW_PRICE[body] : input.newPrice!;
  const retained = retainedShare(age, body, fuel);
  const expectedKm = Math.round(age * AVERAGE_KM_PER_YEAR);
  const diffThousands = (Math.max(0, input.odometerKm) - expectedKm) / 1000;
  const kmAdjustmentPct = clamp(diffThousands > 0 ? -0.5 * diffThousands : -0.4 * diffThousands, -15, 15);
  const makeFactor = MAKE_FACTOR[(input.make ?? '').toLowerCase()] ?? 1;
  const mid = newPrice * retained * (1 + kmAdjustmentPct / 100) * CONDITION_FACTOR[condition] * makeFactor;
  const step = mid < 5000 ? 50 : 100;
  const midR = Math.max(300, roundTo(mid, step));
  return {
    low: roundTo(midR * 0.92, step),
    mid: midR,
    high: roundTo(midR * 1.08, step),
    tradeIn: roundTo(midR * 0.85, step),
    privateSale: midR,
    ageYears: Math.round(age * 10) / 10,
    expectedKm,
    kmAdjustmentPct: Math.round(kmAdjustmentPct * 10) / 10,
    retainedPct: Math.round(retained * 100),
    newPriceUsed: newPrice,
    newPriceAssumed,
    assumptions: [
      newPriceAssumed ? `No new price was given, so a typical ${body.toLowerCase().replace('_', ' ')} price of $${newPrice.toLocaleString('en-AU')} is assumed; give the real one for a better figure.` : `From a new price of $${newPrice.toLocaleString('en-AU')}.`,
      `A ${body.toLowerCase().replace('_', ' ')} ${fuel === 'ELECTRIC' ? 'electric car' : 'car'} typically keeps about ${Math.round(retained * 100)}% of its price at ${Math.round(age * 10) / 10} years.`,
      kmAdjustmentPct === 0 ? 'Kilometres are about average for the age.' : `${Math.abs(Math.round(input.odometerKm - expectedKm)).toLocaleString('en-AU')} km ${input.odometerKm > expectedKm ? 'over' : 'under'} the average of ${AVERAGE_KM_PER_YEAR.toLocaleString('en-AU')} a year ${kmAdjustmentPct > 0 ? 'adds' : 'takes'} about ${Math.abs(Math.round(kmAdjustmentPct))}%.`,
      condition === 'GOOD' ? 'Condition taken as good.' : `Condition ${condition.toLowerCase()} ${CONDITION_FACTOR[condition] >= 1 ? 'adds' : 'takes'} ${Math.abs(Math.round((CONDITION_FACTOR[condition] - 1) * 100))}%.`,
      ...(makeFactor !== 1 ? [`${input.make} ${makeFactor > 1 ? 'holds value a little better' : 'depreciates a little faster'} than average.`] : []),
      'A dealer trade-in is typically fifteen percent under a private sale, in exchange for no advertising, no strangers and no waiting.',
    ],
  };
}

export type PriceVerdict = 'WELL_BELOW' | 'BELOW' | 'FAIR' | 'ABOVE' | 'WELL_ABOVE';

export function benchmarkPrice(price: number, valuation: Valuation): { guideLow: number; guideHigh: number; verdict: PriceVerdict; differencePct: number; words: string } {
    const diff = valuation.mid > 0 ? (price - valuation.mid) / valuation.mid * 100 : 0;
    const verdict: PriceVerdict = diff < -20 ? 'WELL_BELOW' : diff < -8 ? 'BELOW' : diff <= 8 ? 'FAIR' : diff <= 20 ? 'ABOVE' : 'WELL_ABOVE';
    const words: Record<PriceVerdict, string> = {
      WELL_BELOW: 'Well under the guide. Ask why before you get excited; a real bargain has a reason you can check.',
      BELOW: 'Under the guide: a fair price for a quick sale, or a car with something to disclose.',
      FAIR: 'In line with the guide for the year, kilometres and condition.',
      ABOVE: 'Above the guide. Room to negotiate, or extras that justify it.',
      WELL_ABOVE: 'Well above the guide. Unless it is rare or immaculate, keep looking.',
    };
    return { guideLow: valuation.low, guideHigh: valuation.high, verdict, differencePct: Math.round(diff), words: words[verdict] };
}

export interface UpgradeInput {
  current: Valuation;
  targetPrice: number;
  loanBalance?: number;
  savings?: number;
  monthlySaving?: number;
}

export function upgradePath(input: UpgradeInput): { changeoverPrivate: number; changeoverTradeIn: number; privateAdvantage: number; equity: number; negativeEquity: boolean; monthsToSave: number | null; steps: string[] } {
  const loan = Math.max(0, input.loanBalance ?? 0);
  const equity = input.current.privateSale - loan;
  const changeoverPrivate = Math.max(0, input.targetPrice - input.current.privateSale + loan);
  const changeoverTradeIn = Math.max(0, input.targetPrice - input.current.tradeIn + loan);
  const gap = Math.max(0, changeoverPrivate - (input.savings ?? 0));
  const monthsToSave = input.monthlySaving && input.monthlySaving > 0 ? Math.ceil(gap / input.monthlySaving) : null;
  const steps = [
    equity < 0 ? `You owe $${Math.abs(equity).toLocaleString('en-AU')} more than the car is worth. Paying that down first, or rolling it into the next loan (dearer), comes before anything else.` : `Your car carries about $${equity.toLocaleString('en-AU')} of equity toward the next one.`,
    `Selling privately nets about $${(input.current.privateSale - input.current.tradeIn).toLocaleString('en-AU')} more than a trade-in; it costs a weekend, an advertisement and a safety certificate.`,
    `The changeover is $${changeoverPrivate.toLocaleString('en-AU')} selling privately, $${changeoverTradeIn.toLocaleString('en-AU')} trading in.`,
    monthsToSave !== null ? (monthsToSave === 0 ? 'Your savings cover the changeover now.' : `At $${input.monthlySaving!.toLocaleString('en-AU')} a month the changeover is covered in ${monthsToSave} month${monthsToSave === 1 ? '' : 's'}.`) : 'Set a monthly amount to see when the changeover is covered without borrowing.',
    'Get finance pre-approved by a lender or a licensed broker before you talk to a dealer, so the trade-in and the price are negotiated separately. ATHENA cannot pre-approve anything; it is not a lender.',
  ];
  return { changeoverPrivate, changeoverTradeIn, privateAdvantage: input.current.privateSale - input.current.tradeIn, equity, negativeEquity: equity < 0, monthsToSave, steps };
}
