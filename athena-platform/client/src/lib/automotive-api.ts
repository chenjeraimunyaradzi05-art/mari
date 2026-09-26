/**
 * The automotive API: the catalogue and its reviews, the calculators
 * (finance, insurance, valuation), the garage, the pre-loved listings with
 * inspections and purchases under buyer protection, the workshops with
 * bookings and quotes, dealerships with test drives and trade-ins, finance
 * pre-approval, and the admin queues.
 *
 * Reading is open: the catalogue, the listings, the workshops, the
 * dealerships and every calculator work before anyone signs up. Writing,
 * paying and anything that is a member's own needs a session.
 */

import type { AxiosResponse } from 'axios';
import { api } from './api';

type Body = Record<string, unknown>;

/**
 * The reference library, asked for once per page load and shared.
 *
 * Sixteen pages call useReference() on mount, and every one of them used to
 * fetch the whole library again — the same constants, re-sent on each
 * navigation within the vertical, each fetch spending one of the hundred
 * requests an address gets every fifteen minutes. The server now lets the
 * browser cache it too; this keeps a single request in flight and reuses its
 * answer for as long as the tab is open. A failure is not kept, so the next
 * page to ask tries again rather than inheriting the error.
 */
let referenceOnce: Promise<AxiosResponse> | null = null;
function reference(): Promise<AxiosResponse> {
  if (!referenceOnce) {
    referenceOnce = api.get('/automotive/reference');
    referenceOnce.catch(() => { referenceOnce = null; });
  }
  return referenceOnce;
}

export const autoApi = {
  reference,
  overview: () => api.get('/automotive/overview'),

  catalogue: (params?: Body) => api.get('/automotive/catalogue', { params }),
  compare: (slugs: string[]) => api.get('/automotive/catalogue/compare', { params: { slugs: slugs.join(',') } }),
  car: (slug: string, params?: Body) => api.get(`/automotive/catalogue/${slug}`, { params }),
  carReviews: (slug: string, page = 1) => api.get(`/automotive/catalogue/${slug}/reviews`, { params: { page } }),
  reviewCar: (slug: string, data: Body) => api.post(`/automotive/catalogue/${slug}/reviews`, data),
  updateReview: (id: string, data: Body) => api.patch(`/automotive/reviews/${id}`, data),
  deleteReview: (id: string) => api.delete(`/automotive/reviews/${id}`),

  finance: {
    repayment: (data: Body) => api.post('/automotive/finance/repayment', data),
    compare: (data: Body) => api.post('/automotive/finance/compare', data),
    affordability: (data: Body) => api.post('/automotive/finance/affordability', data),
    ownership: (data: Body) => api.post('/automotive/finance/cost-of-ownership', data),
    readiness: (data: Body) => api.post('/automotive/finance/readiness', data),
    applications: () => api.get('/automotive/finance/applications'),
    apply: (data: Body) => api.post('/automotive/finance/applications', data),
    updateApplication: (id: string, data: Body) => api.patch(`/automotive/finance/applications/${id}`, data),
  },
  insurance: { estimate: (data: Body) => api.post('/automotive/insurance/estimate', data), compare: (data: Body) => api.post('/automotive/insurance/compare', data) },
  fleetEnquiry: (data: Body) => api.post('/automotive/fleet-enquiries', data),
  valuation: { estimate: (data: Body) => api.post('/automotive/valuation/estimate', data), upgrade: (data: Body) => api.post('/automotive/valuation/upgrade', data) },

  garage: () => api.get('/automotive/garage'),
  addVehicle: (data: Body) => api.post('/automotive/garage', data),
  vehicle: (id: string) => api.get(`/automotive/garage/${id}`),
  updateVehicle: (id: string, data: Body) => api.patch(`/automotive/garage/${id}`, data),
  deleteVehicle: (id: string) => api.delete(`/automotive/garage/${id}`),
  odometer: (id: string, odometerKm: number) => api.post(`/automotive/garage/${id}/odometer`, { odometerKm }),
  addService: (id: string, data: Body) => api.post(`/automotive/garage/${id}/services`, data),
  deleteService: (id: string) => api.delete(`/automotive/garage/services/${id}`),

  listings: (params?: Body) => api.get('/automotive/listings', { params }),
  myListings: () => api.get('/automotive/listings/mine'),
  savedListings: () => api.get('/automotive/listings/saved'),
  listing: (id: string) => api.get(`/automotive/listings/${id}`),
  createListing: (data: Body) => api.post('/automotive/listings', data),
  updateListing: (id: string, data: Body) => api.patch(`/automotive/listings/${id}`, data),
  withdrawListing: (id: string) => api.post(`/automotive/listings/${id}/withdraw`),
  markSold: (id: string) => api.post(`/automotive/listings/${id}/sold`),
  saveListing: (id: string) => api.post(`/automotive/listings/${id}/save`),
  unsaveListing: (id: string) => api.delete(`/automotive/listings/${id}/save`),
  offer: (id: string, data: Body) => api.post(`/automotive/listings/${id}/offers`, data),
  requestInspection: (id: string, data?: Body) => api.post(`/automotive/listings/${id}/inspections`, data ?? {}),

  inspections: () => api.get('/automotive/inspections'),
  openInspections: () => api.get('/automotive/inspections/open'),
  acceptInspection: (id: string, data?: Body) => api.post(`/automotive/inspections/${id}/accept`, data ?? {}),
  payInspection: (id: string) => api.post(`/automotive/inspections/${id}/pay`),
  releaseInspection: (id: string) => api.post(`/automotive/inspections/${id}/release`),
  updateInspection: (id: string, data: Body) => api.patch(`/automotive/inspections/${id}`, data),

  purchases: () => api.get('/automotive/purchases'),
  purchase: (id: string) => api.get(`/automotive/purchases/${id}`),
  purchasePayment: (id: string) => api.get(`/automotive/purchases/${id}/payment`),
  acceptOffer: (id: string, data?: Body) => api.post(`/automotive/purchases/${id}/accept`, data ?? {}),
  declineOffer: (id: string, data?: Body) => api.post(`/automotive/purchases/${id}/decline`, data ?? {}),
  pay: (id: string) => api.post(`/automotive/purchases/${id}/pay`),
  handover: (id: string, data?: Body) => api.post(`/automotive/purchases/${id}/handover`, data ?? {}),
  release: (id: string) => api.post(`/automotive/purchases/${id}/release`),
  dispute: (id: string, data: Body) => api.post(`/automotive/purchases/${id}/dispute`, data),
  cancelPurchase: (id: string, data?: Body) => api.post(`/automotive/purchases/${id}/cancel`, data ?? {}),
  resolvePurchase: (id: string, data: Body) => api.post(`/automotive/purchases/${id}/resolve`, data),
  reviewPurchase: (id: string, data: Body) => api.post(`/automotive/purchases/${id}/review`, data),

  mechanics: (params?: Body) => api.get('/automotive/mechanics', { params }),
  mechanic: (slug: string) => api.get(`/automotive/mechanics/${slug}`),
  mechanicSlots: (id: string, day: string, service?: string) => api.get(`/automotive/mechanics/${id}/slots`, { params: { day, service } }),
  book: (id: string, data: Body) => api.post(`/automotive/mechanics/${id}/bookings`, data),
  bookings: () => api.get('/automotive/bookings'),
  updateBooking: (id: string, data: Body) => api.patch(`/automotive/bookings/${id}`, data),
  payBooking: (id: string) => api.post(`/automotive/bookings/${id}/pay`),
  releaseBooking: (id: string) => api.post(`/automotive/bookings/${id}/release`),
  reviewBooking: (id: string, data: Body) => api.post(`/automotive/bookings/${id}/review`, data),
  bookingIcs: (id: string) => api.get(`/automotive/bookings/${id}/ics`, { responseType: 'text' }),

  workshop: () => api.get('/automotive/workshop'),
  saveWorkshop: (data: Body) => api.put('/automotive/workshop', data),
  workshopBookings: () => api.get('/automotive/workshop/bookings'),
  updateWorkshopBooking: (id: string, data: Body) => api.patch(`/automotive/workshop/bookings/${id}`, data),

  dealerships: (params?: Body) => api.get('/automotive/dealerships', { params }),
  dealership: (slug: string) => api.get(`/automotive/dealerships/${slug}`),
  myDealership: () => api.get('/automotive/dealership'),
  saveDealership: (data: Body) => api.put('/automotive/dealership', data),
  dealershipRequests: () => api.get('/automotive/dealership/requests'),
  updateTestDriveAsDealer: (id: string, data: Body) => api.patch(`/automotive/dealership/test-drives/${id}`, data),
  quoteTradeIn: (id: string, data: Body) => api.post(`/automotive/dealership/trade-ins/${id}/quotes`, data),

  requestTestDrive: (data: Body) => api.post('/automotive/test-drives', data),
  testDrives: () => api.get('/automotive/test-drives'),
  cancelTestDrive: (id: string) => api.patch(`/automotive/test-drives/${id}`, {}),
  reportSale: (id: string, data: { price?: number }) => api.post(`/automotive/test-drives/${id}/sale`, data),
  disputeSale: (id: string) => api.post(`/automotive/test-drives/${id}/sale/dispute`, {}),
  requestTradeIn: (data: Body) => api.post('/automotive/trade-ins', data),
  tradeIns: () => api.get('/automotive/trade-ins'),
  updateTradeIn: (id: string, data: Body) => api.patch(`/automotive/trade-ins/${id}`, data),

  admin: {
    overview: () => api.get('/automotive/admin/overview'),
    mechanic: (id: string, data: Body) => api.patch(`/automotive/admin/mechanics/${id}`, data),
    dealership: (id: string, data: Body) => api.patch(`/automotive/admin/dealerships/${id}`, data),
    listing: (id: string, data: Body) => api.patch(`/automotive/admin/listings/${id}`, data),
    finance: (id: string, data: Body) => api.patch(`/automotive/admin/finance/${id}`, data),
    mechanicReview: (id: string, isHidden: boolean) => api.patch(`/automotive/admin/mechanic-reviews/${id}`, { isHidden }),
    referrals: (params?: Body) => api.get('/automotive/admin/referrals', { params }),
    addReferral: (data: Body) => api.post('/automotive/admin/referrals', data),
    referral: (id: string, data: Body) => api.patch(`/automotive/admin/referrals/${id}`, data),
  },
};

/**
 * The fuels "Hybrid or electric" means. The searches read a fuel type and that
 * box together — Diesel and electrified is nothing, because there is no such
 * car — so the pages keep the two from contradicting each other: with the box
 * ticked, the fuel list offers only these, and ticking it clears a fuel that
 * is not one of them rather than leaving a filter that can match nothing.
 */
export const ELECTRIFIED_FUELS: readonly string[] = ['HYBRID', 'PLUG_IN_HYBRID', 'ELECTRIC'];

/**
 * A link that opens a direct message to someone, with a first line saying
 * which car it is about.
 *
 * The "message the seller" links went to the general inbox addressed to the
 * seller and nothing else, so a woman selling two cars got a message that
 * could have been about either, and a thread that ended in a dispute had
 * nothing in it tying it to the purchase. The inbox already carries a draft
 * through `?text=` into the composer, so the draft names the car and links
 * back to it; she can edit or delete the line before she sends anything.
 */
export function messageAbout(userId: string, subject: string, path: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const draft = `About ${subject} (${origin}${path}): `;
  return `/dashboard/messages?user=${encodeURIComponent(userId)}&text=${encodeURIComponent(draft)}`;
}

/** The message an API error carries, or a fallback. */
export function autoError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } };
  return e?.response?.data?.message || e?.response?.data?.error || fallback;
}

export const aud0 = (n: number | null | undefined) => `$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`;
export const km = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString('en-AU')} km`;

export type Ancap = { status: 'current' | 'expired' | 'unrated'; label: string };
export type CarCard = { id: string; slug: string; make: string; model: string; variant: string | null; year: number; bodyType: string; bodyLabel: string; fuelType: string; fuelLabel: string; transmission: string; seats: number; priceFrom: number; ancapStars: number | null; ancapYear: number | null; ancap: Ancap; fuelPer100: number | null; kwhPer100: number | null; rangeKm: number | null; energy: string | null; warrantyYears: number | null; warrantyKm: number | null; warranty: string | null; serviceIntervalMonths: number | null; serviceIntervalKm: number | null; servicingCostYear: number | null; safetyFeatures: string[]; highlights: string[]; asAt: string | null; ratingAvg: number; ratingCount: number; reliabilityAvg: number; co2GramsKm: number | null; emissions: string; runningCostYear?: number };
export type ListingCard = { id: string; title: string; make: string; model: string; year: number; variant: string | null; bodyType: string; bodyLabel: string; fuelType: string; fuelLabel: string; transmission: string; odometerKm: number; price: number; priceGuideLow: number | null; priceGuideHigh: number | null; priceVerdict: string | null; colour: string | null; seats: number | null; photos: string[]; videoUrl: string | null; suburb: string | null; city: string | null; state: string; postcode: string | null; sellerKind: 'PRIVATE' | 'DEALER'; serviceHistory: string; accidentHistory: string; ownersCount: number | null; ppsrChecked: boolean; roadworthy: boolean; warranty: string; warrantyNote: string | null; regoExpires: string | null; status: string; isFeatured: boolean; viewCount: number; saveCount: number; createdAt: string; vin: string | null; rego: string | null; hasVin: boolean; seller: { id: string; name: string; memberSince: string }; dealership: { id: string; slug: string; name: string } | null; description?: string; features?: string[]; riskFlags?: string[]; riskScore?: number; suspendedReason?: string | null; inspected?: string | null; saved?: boolean };
export type MechanicCard = { id: string; slug: string; name: string; headline: string; womenOwned: boolean; womenMechanics: boolean; services: string[]; serviceLabels: string[]; makes: string[]; evCapable: boolean; mobile: boolean; loanCar: boolean; afterHours: boolean; doesInspections: boolean; languages: string[]; suburb: string | null; city: string | null; state: string | null; postcode: string | null; phone: string | null; website: string | null; bookingUrl: string | null; labourRateHour: number | null; partsWarrantyMonths: number | null; labourWarrantyMonths: number | null; warrantyNote: string | null; slotMinutes: number; acceptsBookings: boolean; isVerified: boolean; isFeatured: boolean; ratingAvg: number; ratingCount: number; transparencyAvg: number; contactUserId: string | null; nextFree?: string | null; price?: { from: number | null; to: number | null; note: string | null; own: boolean } | null };
export type VehicleCard = { id: string; name: string; nickname: string | null; make: string; model: string; year: number; variant: string | null; bodyType: string | null; fuelType: string; fuelLabel: string; colour: string | null; rego: string | null; regoState: string | null; vin: string | null; odometerKm: number | null; odometerAt: string | null; odometerNow: number | null; kmPerYear: number | null; purchasePrice: number | null; purchasedAt: string | null; boughtNew: boolean; newPrice: number | null; warrantyEndsAt: string | null; warrantyEndsKm: number | null; regoDueAt: string | null; insuranceRenewsAt: string | null; insurer: string | null; insurancePremium: number | null; nextServiceDueAt: string | null; nextServiceDueKm: number | null; serviceIntervalMonths: number; serviceIntervalKm: number; notes: string | null; carModelId: string | null; reminders: Reminder[]; valuation: { low: number; mid: number; high: number; tradeIn: number; assumed: boolean } };
export type Reminder = { key: string; kind: 'SERVICE' | 'REGO' | 'INSURANCE' | 'WARRANTY'; title: string; body: string; dueOn: string | null; daysAway: number | null; urgency: 'overdue' | 'soon' | 'upcoming'; action: { label: string; href: string } };
export type PurchaseCard = { id: string; status: string; role: 'buyer' | 'seller' | 'admin' | 'other'; offerAmount: number; agreedAmount: number | null; platformFee: number; message: string | null; sellerMessage: string | null; paidAt: string | null; handedOverAt: string | null; inspectionEndsAt: string | null; daysLeft: number | null; releasedAt: string | null; disputeReason: string | null; disputeOpenedAt: string | null; disputeResolution: string | null; resolvedAt: string | null; transferNote: string | null; cancelledAt: string | null; cancelReason: string | null; reviewRating: number | null; reviewComment: string | null; createdAt: string; escrow: { status: string; amount: number; platformFee: number } | null; listing: ListingCard; buyer: { id: string; name: string; email?: string }; seller: { id: string; name: string; email?: string }; nextStep: string; inspectionDays: number };
export type BookingCard = { id: string; kind: string; kindLabel: string; scheduledAt: string; durationMinutes: number; dropOff: boolean; address: string | null; concern: string | null; odometerKm: number | null; status: string; quoteAmount: number | null; quoteLines: Array<{ label: string; amount: number; kind: string }>; quoteTotals: { total: number; parts: number; labour: number; other: number }; quoteNote: string | null; quotedAt: string | null; quoteAcceptedAt: string | null; partsRequested: Array<{ name: string; qty: number; note?: string }>; finalAmount: number | null; paidAt: string | null; escrowStatus: string | null; workshopNote: string | null; completedAt: string | null; partsWarrantyMonths: number | null; labourWarrantyMonths: number | null; cancelReason: string | null; createdAt: string; mechanic: { id: string; slug: string; name: string; place: string; phone: string | null; takesPayment: boolean }; vehicle: { id: string; name: string } | null; reviewed: boolean; canCancel: boolean; member?: { name: string; email: string } };
export type InspectionCard = { id: string; kind: string; status: string; fee: number; scheduledAt: string | null; completedAt: string | null; outcome: string | null; summary: string | null; report: Array<{ key: string; label: string; result: string; notes: string }>; reportUrl: string | null; escrowStatus: string | null; createdAt: string; listing: { id: string; title: string; sellerId: string; state: string; suburb: string | null; city: string | null; make: string; model: string; year: number }; inspector: { id: string; name: string; slug: string; phone: string | null } | null; requestedBy: string; isRequester: boolean; isInspector: boolean; sections: Array<{ key: string; label: string; result: string; notes: string; items: string[] }> };
export type ApplicationCard = { id: string; referenceCode: string; status: string; purpose: string; vehiclePrice: number; deposit: number; tradeIn: number; amount: number; termMonths: number; balloonPct: number; ratePct: number; repaymentMonthly: number; incomeAnnual: number; expensesMonthly: number; otherDebtsMonthly: number; dependants: number; employment: string; employmentMonths: number | null; residency: string | null; readinessScore: number; readinessNotes: string[]; lender: string | null; submittedAt: string | null; decisionAt: string | null; expiresAt: string | null; decisionNote: string | null; timeline: Array<{ at: string; status: string; note: string }>; listingId: string | null; carModelId: string | null; createdAt: string; updatedAt: string; applicant?: { name: string; email: string } };
export type DealershipCard = { id: string; slug: string; name: string; headline: string; brands: string[]; suburb: string | null; city: string | null; state: string | null; postcode: string | null; address: string | null; phone: string | null; website: string | null; womenLed: boolean; financeAvailable: boolean; financePartners: string[]; hours: Record<string, Array<[string, string]>> | null; isVerified: boolean; isFeatured: boolean; ratingAvg: number; ratingCount: number; contactUserId: string | null; stock?: number };
export type ReferralCard = { id: string; kind: string; kindLabel: string; status: string; partner: string | null; dealership: { name: string; slug: string } | null; member: { name: string; email: string } | null; referenceId: string | null; basisAmount: number; feePercent: number; fee: number; note: string | null; confirmedAt: string | null; paidAt: string | null; createdAt: string };
export type ReferralTotals = { pending: number; confirmed: number; paid: number; byKind: Record<string, { count: number; fee: number }> };
export type ReferralFees = { dealerSale: { percent: number; min: number; max: number; words: string }; finance: { percent: number; words: string }; insurance: { percent: number; words: string }; warranty: { percent: number; words: string }; parts: { percent: number; words: string }; fleet: { percent: number; words: string } };
export type QuoteComparison = { insurer: string; cover: string; annual: number; paidYearly: number; monthlyLoading: number; excess: number; expectedExcess: number; missing: string[]; missingValue: number; allIn: number; moreThanBest: number; cheapest: boolean; bestValue: boolean; flags: string[] };
export type Reference = { asAt: string; catalogueAsAt: string; states: string[]; bodyTypes: Array<{ key: string; label: string; blurb: string }>; fuelTypes: Array<{ key: string; label: string; blurb: string }>; transmissions: Array<{ key: string; label: string }>; makes: string[]; conditions: Array<{ key: string; label: string; blurb: string }>; safetyFeatures: Array<{ key: string; name: string; what: string; why: string; lookFor: string }>; ancap: { what: string; dateStamp: string; expiry: string; unrated: string; url: string }; maintenance: Array<{ key: string; title: string; every: string; what: string; cost: string; ev?: string }>; serviceKinds: Array<{ key: string; label: string; from: number; to: number; minutes: number; blurb: string }>; inspectionSections: Array<{ key: string; label: string; items: string[] }>; buyerProtection: { inspectionDays: number; steps: string[]; covers: string[]; doesNotCover: string[]; note: string }; fraudSigns: string[]; finance: { defaults: { asAt: string; newCarSecured: { low: number; typical: number; high: number }; usedCarSecured: { low: number; typical: number; high: number }; unsecured: { low: number; typical: number; high: number }; typicalTermMonths: number; comparisonNote: string }; glossary: Array<{ term: string; plain: string }>; lenderChecks: string[]; employment: Array<{ key: string; label: string }>; running: Record<string, unknown> }; insurance: { coverTypes: Array<{ key: string; label: string; covers: string; suits: string }>; factors: Array<{ key: string; label: string; how: string }>; claims: string[]; women: string[]; ctp: Record<string, string> }; sources: Array<{ key: string; name: string; url: string; what: string }>; warranty: { what: string; covers: string[]; doesNotCover: string[]; costRange: { low: number; high: number }; worthIt: string[]; rights: string }; fleet: { what: string; includes: string[]; suits: string; note: string }; referralFees: ReferralFees; fees: { purchasePercent: { PRIVATE: number; DEALER: number }; servicePercent: number; inspectionPercent: number; inspectionFee: number } };
