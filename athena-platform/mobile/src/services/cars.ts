/**
 * The cars API, as the phone uses it: the member's overview (garage,
 * reminders, purchases under way), the new-car catalogue, the pre-loved
 * listings, saving a listing and making an offer.
 *
 * Paths and bodies are server/src/routes/automotive.routes.ts, and
 * server/scripts/check-api-contract.js walks this file. Paying for a car,
 * booking an inspection and anything else that holds money on a card happen
 * on the web, where the card form is; nothing here can take a payment.
 */
import { api } from './api';

export interface Reminder {
  key: string;
  kind: string;
  title: string;
  body: string;
  dueOn: string | null;
  daysAway: number | null;
  urgency: 'overdue' | 'soon' | 'upcoming';
}

export interface GarageVehicle {
  id: string;
  name: string;
  rego: string | null;
  regoState: string | null;
  odometerNow: number | null;
  regoDueAt: string | null;
  nextServiceDueAt: string | null;
  insuranceRenewsAt: string | null;
  reminders: Reminder[];
  valuation: { low: number; mid: number; high: number; tradeIn: number; assumed: boolean };
}

export interface ListingCard {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  variant: string | null;
  bodyLabel: string;
  fuelLabel: string;
  transmission: string | null;
  odometerKm: number;
  price: number;
  priceGuideLow: number | null;
  priceGuideHigh: number | null;
  priceVerdict: string | null;
  photos: string[];
  suburb: string | null;
  city: string | null;
  state: string;
  sellerKind: 'PRIVATE' | 'DEALER';
  serviceHistory: string;
  accidentHistory: string;
  ownersCount: number | null;
  ppsrChecked: boolean;
  roadworthy: boolean;
  regoExpires: string | null;
  status: string;
  seller: { id: string; name: string; memberSince: string };
  saved?: boolean;
  inspected?: string | null;
}

export interface PurchaseCard {
  id: string;
  status: string;
  role: 'buyer' | 'seller' | 'admin' | 'other';
  offerAmount: number;
  agreedAmount: number | null;
  nextStep: string;
  listing: { id: string; title: string };
}

export interface CarsOverview {
  vehicles: GarageVehicle[];
  reminders: Reminder[];
  purchases: PurchaseCard[];
  counts: { saved: number; listings: number; testDrives: number; tradeIns: number };
}

export interface CatalogueCar {
  id: string;
  slug: string;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  bodyLabel: string;
  fuelLabel: string;
  seats: number;
  priceFrom: number;
  ancap: { status: 'current' | 'expired' | 'unrated'; label: string };
  energy: string | null;
  warranty: string | null;
  servicingCostYear: number | null;
  runningCostYear?: number;
  asAt: string | null;
  sourceUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  emissions: string | null;
}

export interface CarDetail extends CatalogueCar {
  safety: Array<{ key: string; name: string; fitted: boolean }>;
  highlights: string[];
  reviews: Array<{ id: string; rating: number; title: string | null; body: string; by: string; isOwner: boolean; isHidden: boolean }>;
  womenSay: { rating: number; reliability: number; count: number; owners: number } | null;
  ownership: { totals: { total: number; perYear: number; perWeek: number }; assumptions: string[] };
  finance: { repayment: number; deposit: number; amount: number; ratePct: number; termMonths: number; totalInterest: number };
  insurance: { comprehensive: number; low: number; high: number; state: string };
  similar: CatalogueCar[];
}

export interface ListingDetail extends ListingCard {
  description: string;
  features: string[];
  isOwner: boolean;
  canOffer: boolean;
  guide: { guideLow: number; guideHigh: number; verdict: string; words: string; assumed: boolean };
  beforeYouPay: Array<{ key: string; label: string; advice: string }>;
  protection: { inspectionDays: number; steps: string[]; feePercent: number };
  myPurchase: { id: string; status: string; offerAmount: number } | null;
  running: { perWeek: number; perYear: number };
  finance: { repayment: number; ratePct: number; deposit: number };
}

export const BODY_TYPES = [
  { value: 'HATCH', label: 'Hatch' },
  { value: 'SEDAN', label: 'Sedan' },
  { value: 'WAGON', label: 'Wagon' },
  { value: 'SUV', label: 'SUV' },
  { value: 'UTE', label: 'Ute' },
  { value: 'VAN', label: 'Van' },
  { value: 'PEOPLE_MOVER', label: 'People mover' },
] as const;

export type CatalogueSort = 'name' | 'price' | 'safety' | 'running';
export type ListingSort = 'newest' | 'price_asc' | 'km' | 'year';

export const carsApi = {
  overview: () => api.get('/automotive/overview'),
  catalogue: (params: { q?: string; bodyType?: string; electrified?: boolean; sort?: CatalogueSort }) => api.get('/automotive/catalogue', { params }),
  car: (slug: string) => api.get(`/automotive/catalogue/${encodeURIComponent(slug)}`),
  listings: (params: { q?: string; bodyType?: string; state?: string; sort?: ListingSort; page?: number }) => api.get('/automotive/listings', { params }),
  savedListings: () => api.get('/automotive/listings/saved'),
  listing: (id: string) => api.get(`/automotive/listings/${id}`),
  save: (id: string) => api.post(`/automotive/listings/${id}/save`),
  unsave: (id: string) => api.delete(`/automotive/listings/${id}/save`),
  // An offer only: the seller is told and can accept or decline. Paying,
  // which holds the money on a card, is done on the web.
  offer: (id: string, data: { amount: number; message?: string }) => api.post(`/automotive/listings/${id}/offers`, data),
};

/** "Well under the guide" and the rest, as the server words them for a card. */
export const VERDICT_WORDS: Record<string, string> = {
  WELL_BELOW: 'Well under the price guide',
  BELOW: 'Under the price guide',
  FAIR: 'In line with the price guide',
  ABOVE: 'Above the price guide',
  WELL_ABOVE: 'Well above the price guide',
};
