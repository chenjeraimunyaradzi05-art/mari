/**
 * The pre-loved marketplace's rules: the platform's cut by seller kind,
 * the checks a listing is put through before it is shown (the things a
 * fraud looks like, written down), the shape of a VIN, the buyer
 * protection state machine, and the links a buyer uses to check a car's
 * history before she pays.
 */

import { BUYER_PROTECTION, FRAUD_SIGNS, INSPECTION_SECTIONS, REGO_CHECKS, type AuState } from './automotive-library';
import type { PriceVerdict } from './valuation.service';

/** Private sales carry the higher commission the blueprint sets; dealers, with their own obligations, the lower. */
export const PURCHASE_FEE_PERCENT = { PRIVATE: 6, DEALER: 4 } as const;
export const SERVICE_FEE_PERCENT = 12;
export const INSPECTION_FEE_PERCENT = 15;
export const DEFAULT_INSPECTION_FEE = 250;

export function inspectionDays(): number {
  const env = Number(process.env.AUTOMOTIVE_INSPECTION_DAYS);
  return Number.isFinite(env) && env >= 1 && env <= 30 ? Math.round(env) : BUYER_PROTECTION.inspectionDays;
}

export function inspectionEnds(handedOverAt: Date, days = inspectionDays()): Date {
  return new Date(handedOverAt.getTime() + days * 86400000);
}

/** Seventeen characters, no I, O or Q; the check digit is only defined for North American cars, so only the shape is checked. */
export function isValidVin(vin: string | null | undefined): boolean {
  if (!vin) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin.trim());
}

export function maskVin(vin: string | null | undefined): string | null {
  if (!vin) return null;
  const v = vin.trim().toUpperCase();
  return v.length > 6 ? `${v.slice(0, 3)}${'•'.repeat(v.length - 6)}${v.slice(-3)}` : v;
}

export function maskRego(rego: string | null | undefined): string | null {
  if (!rego) return null;
  const r = rego.trim().toUpperCase();
  return r.length > 3 ? `${r.slice(0, 2)}${'•'.repeat(r.length - 3)}${r.slice(-1)}` : r;
}

export interface RiskInput {
  price: number;
  guideLow?: number | null;
  guideHigh?: number | null;
  verdict?: PriceVerdict | null;
  photosCount: number;
  vin?: string | null;
  sellerAccountAgeDays: number;
  description: string;
  odometerKm: number;
  year: number;
  serviceHistory: string;
  accidentHistory: string;
  now?: Date;
}

export interface RiskAssessment {
  flags: Array<{ key: string; label: string; weight: number; forBuyer: string }>;
  score: number;
  band: 'low' | 'medium' | 'high';
  holdForReview: boolean;
}

const URGENT_WORDS = /\b(urgent|overseas|deposit to hold|hold it for you|western union|moneygram|gift card|shipping agent|courier will|paypal only|crypto|bitcoin|whatsapp me|telegram)\b/i;

export function assessListingRisk(input: RiskInput): RiskAssessment {
  const flags: RiskAssessment['flags'] = [];
  const add = (key: string, label: string, weight: number, forBuyer: string) => flags.push({ key, label, weight, forBuyer });
  const now = input.now ?? new Date();

  if (input.verdict === 'WELL_BELOW') add('price_well_below', 'Priced well under the guide', 30, 'A price far under the guide is the oldest lure there is. Ask why, and see the car before any money moves.');
  else if (input.verdict === 'BELOW') add('price_below', 'Priced under the guide', 8, 'Under the guide. Fine for a quick sale; ask what is being disclosed.');
  if (input.photosCount === 0) add('no_photos', 'No photos', 25, 'No photos means nothing to check against. Ask for photos of the car with today\'s newspaper, or walk away.');
  else if (input.photosCount < 4) add('few_photos', 'Fewer than four photos', 8, 'Ask for the odometer, the tyres, the engine bay and the compliance plate.');
  // The VIN is the one PPSR-shaped thing on a listing that is not the seller's
  // word for it: a buyer either has seventeen valid characters to type into
  // ppsr.gov.au or she does not, and no tick box changes that.
  //
  // What used to sit under this line was a ten-point penalty for a listing
  // whose ppsrChecked box was unticked — which meant the box was a lever the
  // seller held over her own fraud score. Ticking it took ten points off, and
  // at forty-five a listing is held for review, so the one kind of seller most
  // motivated to tick a box she had not earned was the one it helped most.
  // ATHENA runs no PPSR lookup: nothing fetches the certificate the seller
  // pastes, nothing checks it belongs to the VIN, so a tick is a claim and not
  // a check, and a claim must not move a score that decides whether a listing
  // is shown. The advice to run your own is unconditional now — it is given to
  // every buyer through historyChecks() below, whatever the seller ticked.
  if (!isValidVin(input.vin)) add('no_vin', 'No VIN, or one of the wrong shape', 20, 'Without a VIN you cannot run a PPSR check. Ask for it before you meet.');
  if (input.sellerAccountAgeDays < 14) add('new_seller', 'Seller joined in the last two weeks', 15, 'A brand-new account is not a fraud, but it has no history either. Meet in daylight, in a public place, with someone.');
  if (URGENT_WORDS.test(input.description)) add('urgent_language', 'Urgency, distance or an unusual payment method in the description', 35, 'Any request to pay outside ATHENA, to hold the car with a deposit, or to deal with a shipping agent is a reason to stop.');
  const age = Math.max(0.5, now.getFullYear() - input.year + 0.5);
  if (input.odometerKm < age * 4000 && age >= 3) add('low_km', 'Kilometres are very low for the age', 12, 'Genuine low-kilometre cars exist; so do wound-back odometers. Check the service book and the last safety certificate for the reading.');
  if (input.odometerKm > age * 40000) add('high_km', 'Kilometres are very high for the age', 5, 'Ex-fleet or rideshare, probably. Fine if serviced; check the history.');
  if (input.serviceHistory === 'NONE') add('no_history', 'No service history', 10, 'Budget for a full service straight away and a timing belt if it has one.');
  if (input.accidentHistory === 'MAJOR_REPAIRED') add('major_repair', 'Major accident repair disclosed', 6, 'Disclosed is good. Have an inspector check the repair, and expect the price to reflect it.');

  const score = Math.min(100, flags.reduce((s, f) => s + f.weight, 0));
  return { flags, score, band: score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low', holdForReview: score >= 45 };
}

// -------------------------------------------------------- buyer protection

export type PurchaseStatus = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'PAID_HELD' | 'HANDED_OVER' | 'RELEASED' | 'DISPUTED' | 'REFUNDED' | 'CANCELLED';
export type PurchaseAction = 'accept' | 'decline' | 'pay' | 'handover' | 'release' | 'dispute' | 'cancel' | 'resolve_release' | 'resolve_refund';
export type Party = 'buyer' | 'seller' | 'admin' | 'other';

const TRANSITIONS: Record<PurchaseAction, { from: PurchaseStatus[]; by: Party[]; to: PurchaseStatus }> = {
  accept: { from: ['OFFERED'], by: ['seller'], to: 'ACCEPTED' },
  decline: { from: ['OFFERED'], by: ['seller'], to: 'DECLINED' },
  // What `pay` permits is the card step, not the move: the purchase reaches
  // PAID_HELD only when the hold behind it is authorised, which is decided in
  // purchase-escrow.service and can happen from the webhook rather than from
  // this request. PAID_HELD is a legal starting point as well as the
  // destination, so that a purchase left in it by the old behaviour — marked
  // paid before the buyer had seen a card field — can still be finished
  // instead of only cancelled.
  pay: { from: ['ACCEPTED', 'PAID_HELD'], by: ['buyer'], to: 'PAID_HELD' },
  handover: { from: ['PAID_HELD'], by: ['buyer'], to: 'HANDED_OVER' },
  release: { from: ['HANDED_OVER'], by: ['buyer', 'admin'], to: 'RELEASED' },
  dispute: { from: ['HANDED_OVER'], by: ['buyer'], to: 'DISPUTED' },
  cancel: { from: ['OFFERED', 'ACCEPTED', 'PAID_HELD'], by: ['buyer', 'seller', 'admin'], to: 'CANCELLED' },
  resolve_release: { from: ['DISPUTED'], by: ['admin'], to: 'RELEASED' },
  resolve_refund: { from: ['DISPUTED'], by: ['admin'], to: 'REFUNDED' },
};

export function purchaseTransition(action: PurchaseAction, status: PurchaseStatus, party: Party): { ok: true; to: PurchaseStatus } | { ok: false; reason: string } {
  const t = TRANSITIONS[action];
  if (!t.from.includes(status)) return { ok: false, reason: `That cannot be done while the purchase is ${status.toLowerCase().replace('_', ' ')}` };
  if (!t.by.includes(party)) return { ok: false, reason: party === 'other' ? 'This purchase is not yours' : `Only the ${t.by.filter((p) => p !== 'admin').join(' or ')} can do that` };
  return { ok: true, to: t.to };
}

/** The buyer's inspection period still running, so a dispute can be opened. */
export function withinInspection(inspectionEndsAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(inspectionEndsAt && now.getTime() <= new Date(inspectionEndsAt).getTime());
}

export function purchaseFee(sellerKind: 'PRIVATE' | 'DEALER', amount: number): number {
  return Math.round(amount * PURCHASE_FEE_PERCENT[sellerKind] / 100);
}

export function historyChecks(vin: string | null | undefined, rego: string | null | undefined, state: AuState | string | null | undefined) {
  const st = (state as AuState) in REGO_CHECKS ? (state as AuState) : null;
  return {
    ppsr: { name: 'PPSR certificate', url: 'https://www.ppsr.gov.au', what: 'Money owing, written-off, or reported stolen, by VIN. Two dollars.', ready: isValidVin(vin) },
    rego: st ? { ...REGO_CHECKS[st], what: 'That the plates, the make and the expiry match what you were told.', ready: Boolean(rego) } : null,
    inspection: { name: 'An independent inspection', what: 'A workshop in the directory looks at the car before you pay, and reports section by section.', sections: INSPECTION_SECTIONS.map((s) => s.label) },
    fraudSigns: FRAUD_SIGNS,
  };
}

export function emptyInspectionReport() {
  return INSPECTION_SECTIONS.map((s) => ({ key: s.key, label: s.label, result: 'PASS' as 'PASS' | 'ADVISORY' | 'FAIL', notes: '', items: [...s.items] }));
}

export function normaliseInspectionReport(value: unknown): Array<{ key: string; label: string; result: 'PASS' | 'ADVISORY' | 'FAIL'; notes: string }> {
  const sections = new Map<string, string>(INSPECTION_SECTIONS.map((s) => [s.key, s.label] as [string, string]));
  if (!Array.isArray(value)) return [];
  const out: Array<{ key: string; label: string; result: 'PASS' | 'ADVISORY' | 'FAIL'; notes: string }> = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const key = String(r.key ?? '');
    if (!sections.has(key)) continue;
    const result = r.result === 'FAIL' ? 'FAIL' : r.result === 'ADVISORY' ? 'ADVISORY' : 'PASS';
    out.push({ key, label: sections.get(key)!, result, notes: String(r.notes ?? '').slice(0, 2000) });
  }
  return out;
}

export function inspectionOutcome(report: Array<{ result: 'PASS' | 'ADVISORY' | 'FAIL' }>): 'PASS' | 'ADVISORIES' | 'FAIL' {
  if (report.some((s) => s.result === 'FAIL')) return 'FAIL';
  if (report.some((s) => s.result === 'ADVISORY')) return 'ADVISORIES';
  return 'PASS';
}
