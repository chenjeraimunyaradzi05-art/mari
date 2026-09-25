import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, any>;
const store: { cars: Row[]; reviews: Row[]; vehicles: Row[]; records: Row[]; listings: Row[]; purchases: Row[]; inspections: Row[]; mechanics: Row[]; bookings: Row[]; mechanicReviews: Row[]; dealerships: Row[]; applications: Row[]; notifications: Row[]; escrows: Row[]; testDrives: Row[]; tradeIns: Row[]; referrals: Row[]; leads: Row[]; audits: Row[] } = { cars: [], reviews: [], vehicles: [], records: [], listings: [], purchases: [], inspections: [], mechanics: [], bookings: [], mechanicReviews: [], dealerships: [], applications: [], notifications: [], escrows: [], testDrives: [], tradeIns: [], referrals: [], leads: [], audits: [] };
let seq = 0;
import { randomUUID } from "crypto";
const id = (_p: string) => { seq += 1; return randomUUID(); };
const matches = (row: Row, where: Row | undefined): boolean => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Row[]).some((w) => matches(row, w));
    if (k === 'AND') return (v as Row[]).every((w) => matches(row, w));
    if (k === 'NOT') return !matches(row, v as Row);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return (v.in as unknown[]).includes(row[k]);
      if ('notIn' in v) return !(v.notIn as unknown[]).includes(row[k]);
      if ('not' in v) return v.not === null ? row[k] !== null && row[k] !== undefined : row[k] !== v.not;
      if ('equals' in v) return typeof row[k] === 'string' && typeof v.equals === 'string' ? row[k].toLowerCase() === v.equals.toLowerCase() : row[k] === v.equals;
      if ('contains' in v) return typeof row[k] === 'string' && row[k].toLowerCase().includes(String(v.contains).toLowerCase());
      if ('has' in v) return Array.isArray(row[k]) && row[k].includes(v.has);
      if ('gte' in v || 'lte' in v || 'lt' in v || 'gt' in v) { const x = row[k] instanceof Date ? row[k].getTime() : row[k]; const t = (y: any) => (y instanceof Date ? y.getTime() : y); return (v.gte === undefined || x >= t(v.gte)) && (v.lte === undefined || x <= t(v.lte)) && (v.lt === undefined || x < t(v.lt)) && (v.gt === undefined || x > t(v.gt)); }
      // `isEmpty` is answered properly because a live filter turns on it: the
      // mechanic directory offers "or a workshop that works on anything" as
      // the second half of its make filter, and while this returned true for
      // every operator it could not name, that filter passed whatever it did.
      // The bug it was hiding — every filter appended into one flat OR, so a
      // make or a town widened the results instead of narrowing them — shipped
      // and stayed shipped, with a green suite over it.
      if ('isEmpty' in v) return Array.isArray(row[k]) ? (row[k].length === 0) === v.isEmpty : !v.isEmpty;
      // `some` is answered for the same reason `isEmpty` is: a live filter
      // turns on it. `?inspected=true` on the pre-loved search is
      // `inspections: { some: { status: 'COMPLETED' } }`, and a buyer who
      // ticks that box is asking to be shown only cars a workshop has already
      // looked over — the one filter on that page with a safety claim behind
      // it. While this returned true for every operator it could not name,
      // the box could have selected nothing at all and the suite would still
      // have been green. Answering it means the rows reaching this matcher
      // have to carry their relations, which is what `relate` in table() is
      // for; an unrelated row has no `inspections` array and matches nothing,
      // which is the honest answer rather than a generous one.
      if ('some' in v) return Array.isArray(row[k]) && row[k].some((child: Row) => matches(child, v.some as Row));
      // `path` reads inside a Json column and is still unanswered. Only the
      // reminder service's duplicate-notification check uses it, and the
      // notification double here does not go through this matcher at all. See
      // the deferred note about a real-database suite for this domain.
      if ('path' in v) return true;
      return matches(row[k] ?? {}, v);
    }
    return row[k] === v;
  });
};
/**
 * The arithmetic an aggregate does once its rows are picked, kept apart from
 * the picking so a delegate that resolves relations can hand it related rows
 * instead of raw ones. It has to be faithful as well as present: an average
 * over no rows is null and never 0, and _count counts the rows whose field is
 * set. A mock that answered 0 would hide the one case the route has to get
 * right, which is "no ratings yet" against "everyone gave it nothing".
 */
const aggregateOver = (hit: Row[], { _avg, _count, _sum }: any = {}) => {
  const numbers = (k: string) => hit.map((r) => r[k]).filter((v): v is number => typeof v === 'number');
  const over = (spec: any, f: (key: string) => unknown): Row => Object.fromEntries(Object.keys(spec ?? {}).map((k) => [k, f(k)]));
  return {
    _avg: over(_avg, (k) => { const v = numbers(k); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }),
    _count: _count === true ? hit.length : over(_count, (k) => hit.filter((r) => r[k] !== null && r[k] !== undefined).length),
    _sum: over(_sum, (k) => { const v = numbers(k); return v.length ? v.reduce((s, x) => s + x, 0) : null; }),
  };
};
/**
 * A model's rows, and — for the models whose handlers filter across a
 * relation — the function that hangs those relations off each row.
 *
 * `relate` used to live outside in a wrapper that ran after the filtering,
 * which meant every read filtered raw rows. A raw listing row holds only its
 * own columns, so `inspections: { some: ... }` and `listing: { sellerId }`
 * walked into nothing, and the matcher answered true to keep the suite
 * moving. Relating first and filtering afterwards is what lets those
 * conditions mean something; the write paths still work on the store's own
 * objects, because that is where the state lives.
 */
const table = (rows: () => Row[], defaults: () => Row = () => ({}), relate: (row: Row) => Row = (r) => r) => {
  const view = () => rows().map((r) => relate({ ...r }));
  return {
    findMany: jest.fn(async ({ where, take, skip, orderBy }: any = {}) => { let out = view().filter((r) => matches(r, where)); if (Array.isArray(orderBy)) { for (const o of [...orderBy].reverse()) { const [k, dir] = Object.entries(o)[0] as [string, string]; out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); } } return out.slice(skip ?? 0, (skip ?? 0) + (take ?? out.length)); }),
    findFirst: jest.fn(async ({ where }: any = {}) => view().find((x) => matches(x, where)) ?? null),
    findUnique: jest.fn(async ({ where }: any) => { const w = { ...where }; for (const k of Object.keys(w)) if (k.includes('_') && w[k] && typeof w[k] === 'object') { Object.assign(w, w[k]); delete w[k]; } return view().find((x) => matches(x, w)) ?? null; }),
    count: jest.fn(async ({ where }: any = {}) => view().filter((r) => matches(r, where)).length),
    create: jest.fn(async ({ data }: any) => { const row = { id: id('r'), createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...data }; rows().push(row); return relate({ ...row }); }),
    update: jest.fn(async ({ where, data }: any) => { const row = rows().find((r) => matches(r, where)); if (!row) throw new Error('not found'); for (const [k, v] of Object.entries(data as Row)) { if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && ('increment' in v || 'decrement' in v)) row[k] = (row[k] ?? 0) + ((v as any).increment ?? 0) - ((v as any).decrement ?? 0); else if (v !== undefined) row[k] = v; } row.updatedAt = new Date(); return relate({ ...row }); }),
    updateMany: jest.fn(async ({ where, data }: any) => { const hit = rows().filter((r) => matches(r, where)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length }; }),
    upsert: jest.fn(async ({ where, create, update }: any) => { const w = { ...where }; for (const k of Object.keys(w)) if (k.includes('_') && w[k] && typeof w[k] === 'object') { Object.assign(w, w[k]); delete w[k]; } const row = rows().find((r) => matches(r, w)); if (row) { Object.assign(row, update); return relate({ ...row }); } const made = { id: id('r'), createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...create }; rows().push(made); return relate({ ...made }); }),
    delete: jest.fn(async ({ where }: any) => { const i = rows().findIndex((r) => matches(r, where)); const [row] = rows().splice(i, 1); return row; }),
    deleteMany: jest.fn(async () => ({ count: 0 })),
    groupBy: jest.fn(async () => []),
    // The rating helpers ask the database for the average instead of pulling
    // every review row into memory, so every mocked model needs this or the
    // handler dies with "prisma.carReview.aggregate is not a function". It
    // goes through the same related view as the rest: dealershipRating
    // filters on `where: { listing: { dealershipId } }`, and over raw
    // purchase rows that finds nothing and averages null, which is the same
    // answer a dealership with no reviews gets — so the assertion would have
    // passed however wrong the filter was.
    aggregate: jest.fn(async (args: any = {}) => aggregateOver(view().filter((r) => matches(r, args.where)), args)),
  };
};

const users: Record<string, Row> = { member: { id: 'member', firstName: 'Mei', lastName: 'Lin', displayName: null, email: 'mei@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date('2025-01-01') }, seller: { id: 'seller', firstName: 'Ana', lastName: 'Ruiz', displayName: null, email: 'ana@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date('2025-01-01') }, mech: { id: 'mech', firstName: 'Jo', lastName: 'Park', displayName: null, email: 'jo@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date('2025-01-01') }, admin: { id: 'admin', firstName: 'Ad', lastName: 'Min', displayName: null, email: 'admin@athena.com', role: 'ADMIN', timezone: 'Australia/Brisbane', createdAt: new Date('2024-01-01') }, newbie: { id: 'newbie', firstName: 'New', lastName: 'One', displayName: null, email: 'new@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date() } };

jest.mock('../../utils/prisma', () => {
  const listingRel = (r: Row) => ({ ...r, seller: users[r.sellerId], dealership: r.dealershipId ? store.dealerships.find((d) => d.id === r.dealershipId) ?? null : null, inspections: store.inspections.filter((i) => i.listingId === r.id), purchases: store.purchases.filter((p) => p.listingId === r.id) });
  const purchaseRel = (r: Row) => ({ ...r, listing: listingRel(store.listings.find((l) => l.id === r.listingId)!), buyer: users[r.buyerId], seller: users[r.sellerId], escrow: r.escrowPaymentId ? store.escrows.find((e) => e.id === r.escrowPaymentId) ?? null : null });
  const bookingRel = (r: Row) => ({ ...r, mechanic: store.mechanics.find((m) => m.id === r.mechanicId), vehicle: r.vehicleId ? store.vehicles.find((v) => v.id === r.vehicleId) ?? null : null, review: store.mechanicReviews.find((x) => x.bookingId === r.id) ?? null, escrow: r.escrowPaymentId ? store.escrows.find((e) => e.id === r.escrowPaymentId) ?? null : null, user: users[r.userId] });
  const inspectionRel = (r: Row) => ({ ...r, listing: store.listings.find((l) => l.id === r.listingId), inspector: r.inspectorId ? store.mechanics.find((m) => m.id === r.inspectorId) ?? null : null, requestedBy: users[r.requestedById], escrow: r.escrowPaymentId ? store.escrows.find((e) => e.id === r.escrowPaymentId) ?? null : null });
  const carModelT = table(() => store.cars);
  const client: Row = {
    user: { findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null), findMany: jest.fn(async ({ where }: any) => Object.values(users).filter((u) => matches(u, where))) },
    carModel: carModelT,
    carReview: table(() => store.reviews, () => ({ isHidden: false, helpfulCount: 0 }), (r) => ({ ...r, user: users[r.userId] })),
    vehicle: table(() => store.vehicles, () => ({ isActive: true, nickname: null, variant: null, bodyType: null, colour: null, rego: null, regoState: null, vin: null, odometerKm: null, odometerAt: null, kmPerYear: null, purchasePrice: null, purchasedAt: null, boughtNew: false, newPrice: null, warrantyEndsAt: null, warrantyEndsKm: null, regoDueAt: null, insuranceRenewsAt: null, insurer: null, insurancePremium: null, nextServiceDueAt: null, nextServiceDueKm: null, notes: null, lastReminderKeys: null, carModelId: null })),
    vehicleServiceRecord: table(() => store.records, () => ({}), (r) => ({ ...r, mechanic: r.mechanicId ? store.mechanics.find((m) => m.id === r.mechanicId) ?? null : null })),
    vehicleListing: table(() => store.listings, () => ({ status: 'DRAFT', isFeatured: false, viewCount: 0, saveCount: 0, soldAt: null, suspendedReason: null, variant: null, colour: null, seats: null, videoUrl: null, suburb: null, city: null, postcode: null, vin: null, rego: null, regoExpires: null, ownersCount: null, ppsrCertificateUrl: null, warrantyNote: null, dealershipId: null, vehicleId: null, transmission: 'AUTOMATIC', serviceHistory: 'UNKNOWN', accidentHistory: 'NONE', ppsrChecked: false, roadworthy: false, warranty: 'NONE', riskFlags: [], riskScore: 0 }), listingRel),
    vehicleListingSave: table(() => []),
    vehiclePurchase: table(() => store.purchases, () => ({ status: 'OFFERED', agreedAmount: null, platformFee: 0, message: null, sellerMessage: null, escrowPaymentId: null, paidAt: null, handedOverAt: null, inspectionEndsAt: null, releasedAt: null, disputeReason: null, disputeOpenedAt: null, disputeResolution: null, resolvedAt: null, resolvedById: null, transferNote: null, cancelledAt: null, cancelReason: null, reviewRating: null, reviewComment: null }), purchaseRel),
    vehicleInspection: table(() => store.inspections, () => ({ status: 'REQUESTED', inspectorId: null, purchaseId: null, scheduledAt: null, completedAt: null, outcome: null, summary: null, report: null, reportUrl: null, escrowPaymentId: null }), inspectionRel),
    mechanic: table(() => store.mechanics, () => ({ isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, transparencyAvg: 0, languages: ['English'], makes: [], services: [], acceptsBookings: true, slotMinutes: 60, availability: null, priceList: null })),
    mechanicBooking: table(() => store.bookings, () => ({ status: 'REQUESTED', dropOff: true, address: null, concern: null, odometerKm: null, quoteAmount: null, quoteLines: null, quoteNote: null, quotedAt: null, quoteAcceptedAt: null, partsRequested: null, finalAmount: null, escrowPaymentId: null, paidAt: null, workshopNote: null, completedAt: null, partsWarrantyMonths: null, labourWarrantyMonths: null, cancelReason: null, vehicleId: null }), bookingRel),
    mechanicReview: table(() => store.mechanicReviews, () => ({ isHidden: false })),
    dealership: table(() => store.dealerships, () => ({ isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, brands: [], financePartners: [], hours: null })),
    testDriveRequest: table(() => store.testDrives, () => ({ status: 'REQUESTED', dealerNote: null, confirmedAt: null, alternativeAt: null, note: null, carModelId: null, listingId: null }), (r) => ({ ...r, dealership: r.dealershipId ? store.dealerships.find((d) => d.id === r.dealershipId) ?? null : null, carModel: r.carModelId ? store.cars.find((c) => c.id === r.carModelId) ?? null : null, listing: r.listingId ? store.listings.find((l) => l.id === r.listingId) ?? null : null, user: users[r.userId] })),
    tradeInRequest: table(() => store.tradeIns, () => ({ status: 'OPEN', quotes: [], dealershipId: null, variant: null, notes: null, photos: [], condition: 'GOOD', acceptedQuote: null }), (r) => ({ ...r, user: users[r.userId] })),
    carReferral: table(() => store.referrals, () => ({ status: 'PENDING', userId: null, dealershipId: null, referenceId: null, partner: null, note: null, createdById: null, confirmedAt: null, paidAt: null, feePercent: 0 }), (r) => ({ ...r, user: r.userId ? users[r.userId] ?? null : null, dealership: r.dealershipId ? store.dealerships.find((d) => d.id === r.dealershipId) ?? null : null })),
    lead: table(() => store.leads, () => ({ status: 'NEW' })),
    carFinanceApplication: table(() => store.applications),
    notification: { create: jest.fn(async ({ data }: any) => { store.notifications.push(data); return data; }), findFirst: jest.fn(async () => null) },
    escrowPayment: table(() => store.escrows),
    auditLog: table(() => store.audits),
  };
  /**
   * Both forms of $transaction, because the routes now use both. The
   * interactive form hands the work the same client — this double has one
   * connection and no isolation to speak of, so what a test proves about it is
   * that the handler asks for a transaction and that everything inside one
   * still reads and writes correctly, not that Postgres would serialise two of
   * them. The real guarantee is the Serializable isolation level the route
   * passes, and only a database can demonstrate that.
   */
  client.$transaction = jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(client) : Promise.all(arg)));
  return { prisma: client };
});

jest.mock('../../services/stripe-connect.service', () => ({
  createEscrowPayment: jest.fn(async (input: any) => { const row = { id: `esc${++seq}`, paymentIntentId: `pi_${seq}`, status: 'PENDING', amount: input.amount, platformFee: Math.round(input.amount * (input.platformFeePercent ?? 15) / 100), buyerId: input.buyerId, sellerId: input.sellerId }; store.escrows.push(row); return { escrowId: row.id, paymentIntentId: row.paymentIntentId, clientSecret: `${row.paymentIntentId}_secret`, amount: row.amount, platformFee: row.platformFee }; }),
  captureEscrowPayment: jest.fn(async (pi: string) => { const e = store.escrows.find((x) => x.paymentIntentId === pi)!; e.status = 'CAPTURED'; return { status: 'captured', amountCaptured: e.amount }; }),
  cancelEscrowPayment: jest.fn(async (pi: string) => { const e = store.escrows.find((x) => x.paymentIntentId === pi)!; e.status = 'CANCELED'; return { status: 'canceled' }; }),
  getEscrowClientSecret: jest.fn(async (pi: string) => `${pi}_secret`),
}));

/**
 * The hold behind a car purchase is now settled against the processor rather
 * than against the escrow row alone, so the suite has to be certain which
 * answer it gets. Left to the environment, a machine with a STRIPE_SECRET_KEY
 * set would send purchase-escrow.service to the real Stripe with the `pi_N`
 * ids the mock above invents, and the tests would fail on infrastructure
 * rather than on behaviour. Unconfigured is the honest fixture here: it is
 * what a developer's machine and CI both have.
 */
jest.mock('../../utils/stripe', () => ({
  isStripeConfigured: () => false,
  getStripe: () => { throw new Error('Stripe is not configured in tests'); },
  STRIPE_API_VERSION: '2023-10-16',
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: req.headers['x-test-user'] || 'member', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' }; next(); },
  optionalAuth: (req: any, _res: any, next: any) => { if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' }; next(); },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { app } from '../../index';
import { prisma } from '../../utils/prisma';
import { CAR_SEEDS } from '../../services/automotive/automotive-library';
import { captureEscrowPayment, createEscrowPayment } from '../../services/stripe-connect.service';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
/**
 * What the handler's own aggregate() call came back with. A test that only
 * checks the stored average against a figure it worked out for itself would
 * pass even if the route ignored the database and wrote a number of its own,
 * so the assertions below compare the two.
 */
const lastAggregate = async (delegate: { aggregate: unknown }): Promise<{ _avg: Row; _count: Row }> => {
  const results = (delegate.aggregate as jest.Mock).mock.results;
  expect(results.length).toBeGreaterThan(0);
  return (await results[results.length - 1].value) as { _avg: Row; _count: Row };
};
const seedCars = () => { store.cars = CAR_SEEDS.slice(0, 12).map((s, i) => ({ id: `car${i}`, ...s, variant: s.variant ?? null, transmission: s.transmission ?? 'AUTOMATIC', seats: s.seats ?? 5, ancapStars: s.ancapStars ?? null, ancapYear: s.ancapYear ?? null, fuelPer100: s.fuelPer100 ?? null, kwhPer100: s.kwhPer100 ?? null, rangeKm: s.rangeKm ?? null, servicingCostYear: s.servicingCostYear ?? null, co2GramsKm: null, sourceUrl: null, asAt: 'test', isActive: true, ratingAvg: 0, ratingCount: 0, reliabilityAvg: 0, createdAt: new Date(), updatedAt: new Date() })); };
/**
 * A listing walked the whole way to a released, reviewed purchase, because
 * that is the only path that reaches the dealership average. `member` is
 * always the buyer; the seller decides whether the sale counts as a
 * dealership's, since a listing picks up a dealershipId when its seller owns
 * a verified one.
 */
const soldAndRated = async (sellerId: string, listing: Row, rating: number): Promise<Row> => {
  const l = await request(app).post('/api/automotive/listings').set(as(sellerId)).send({ ...listing, state: 'QLD', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], ppsrChecked: true, serviceHistory: 'FULL', publish: true }).expect(201);
  expect(l.body.data.status).toBe('ACTIVE');
  const offer = await request(app).post(`/api/automotive/listings/${l.body.data.id}/offers`).set(as('member')).send({ amount: listing.price }).expect(201);
  const pid = offer.body.data.id;
  await request(app).post(`/api/automotive/purchases/${pid}/accept`).set(as(sellerId)).expect(200);
  await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(200);
  // Paying only opens the card step now; the purchase moves when the hold is
  // confirmed, which is what the card form does on its way out.
  await request(app).post(`/api/automotive/purchases/${pid}/payment/confirm`).set(as('member')).expect(200);
  await request(app).post(`/api/automotive/purchases/${pid}/handover`).set(as('member')).expect(200);
  await request(app).post(`/api/automotive/purchases/${pid}/release`).set(as('member')).expect(200);
  await request(app).post(`/api/automotive/purchases/${pid}/review`).set(as('member')).send({ rating }).expect(200);
  return l.body.data;
};
const workshop = () => ({ id: 'm1', slug: 'jos-garage', name: "Jo's Garage", ownerUserId: 'mech', headline: 'Women-owned, plain-spoken', about: 'We explain every charge before we touch the car.', womenOwned: true, womenMechanics: true, services: ['logbook', 'brakes', 'pre_purchase'], makes: [], evCapable: false, mobile: false, loanCar: true, afterHours: false, doesInspections: true, languages: ['English'], suburb: 'Annerley', city: 'Brisbane', state: 'QLD', postcode: '4103', address: null, phone: '07 3000 0000', website: null, bookingUrl: null, licenceNumber: null, priceList: [{ kind: 'logbook', from: 299, to: 399 }], labourRateHour: 120, partsWarrantyMonths: 12, labourWarrantyMonths: 6, warrantyNote: null, availability: { '1': [['08:00', '16:00']], '2': [['08:00', '16:00']], '3': [['08:00', '16:00']], '4': [['08:00', '16:00']], '5': [['08:00', '16:00']] }, slotMinutes: 60, acceptsBookings: true, isVerified: true, isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, transparencyAvg: 0, createdAt: new Date(), updatedAt: new Date() });

/** A second workshop in the store, so a filter has something to leave out. */
const otherWorkshop = (over: Row = {}): Row => ({ ...workshop(), id: 'm2', slug: 'southport-toyota-specialist', name: 'Southport Toyota Specialist', ownerUserId: null, makes: ['Toyota'], services: ['logbook'], womenOwned: false, mobile: false, suburb: 'Southport', city: 'Gold Coast', acceptsBookings: false, priceList: null, ...over });

/** A verified dealership owned by the named member. */
const dealership = (id: string, ownerUserId: string, name: string, slug: string, over: Row = {}): Row => ({ id, slug, name, ownerUserId, brands: ['Toyota'], headline: 'Women-led, no games', about: null, suburb: 'Ipswich', city: 'Ipswich', state: 'QLD', postcode: null, address: null, phone: null, website: null, email: null, womenLed: true, financeAvailable: false, financePartners: [], hours: null, isVerified: true, isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, createdAt: new Date(), updatedAt: new Date(), ...over });

describe('The automotive routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(store) as Array<keyof typeof store>) store[k] = [];
    seedCars();
    store.mechanics = [workshop()];
  });

  it('opens the reference and the catalogue to anyone, with ratings dated and lapsed ratings marked', async () => {
    const ref = await request(app).get('/api/automotive/reference').expect(200);
    expect(ref.body.data.safetyFeatures.length).toBeGreaterThan(10);
    expect(ref.body.data.buyerProtection.inspectionDays).toBe(14);
    const cat = await request(app).get('/api/automotive/catalogue?fuelType=HYBRID&sort=price').expect(200);
    expect(cat.body.data.cars.length).toBeGreaterThan(0);
    expect(cat.body.data.cars.every((c: any) => c.fuelType === 'HYBRID')).toBe(true);
    const corolla = cat.body.data.cars.find((c: any) => c.slug === 'toyota-corolla-hybrid');
    expect(corolla.ancap.status).toBe('expired');
    expect(corolla.runningCostYear).toBeGreaterThan(0);
    const current = await request(app).get('/api/automotive/catalogue?minStars=5').expect(200);
    expect(current.body.data.cars.every((c: any) => c.ancap.status === 'current' && c.ancapStars === 5)).toBe(true);
    const one = await request(app).get('/api/automotive/catalogue/toyota-rav4-hybrid').expect(200);
    expect(one.body.data.ownership.totals.total).toBeGreaterThan(0);
    expect(one.body.data.finance.repayment).toBeGreaterThan(0);
    expect(one.body.data.safety.some((f: any) => f.fitted)).toBe(true);
    const cmp = await request(app).get('/api/automotive/catalogue/compare?slugs=toyota-rav4-hybrid,mazda-cx-5').expect(200);
    expect(cmp.body.data.cars).toHaveLength(2);
    expect(cmp.body.data.rows.find((r: any) => r.key === 'ancap').values).toHaveLength(2);
    await request(app).get('/api/automotive/catalogue/compare?slugs=one').expect(400);
  });

  it('runs the calculators without a session and validates the input', async () => {
    const rep = await request(app).post('/api/automotive/finance/repayment').send({ amount: 30000, ratePct: 8, termMonths: 60 }).expect(200);
    expect(rep.body.data.repayment).toBeCloseTo(608.29, 1);
    await request(app).post('/api/automotive/finance/repayment').send({ amount: -1 }).expect(400);
    const aff = await request(app).post('/api/automotive/finance/affordability').send({ incomeAnnual: 85000, expensesMonthly: 2500 }).expect(200);
    expect(aff.body.data.comfortableLoan).toBeGreaterThan(0);
    const own = await request(app).post('/api/automotive/finance/cost-of-ownership').send({ cars: [{ label: 'Petrol', price: 35000, fuelType: 'PETROL', fuelPer100: 7.5 }, { label: 'EV', price: 45000, fuelType: 'ELECTRIC', kwhPer100: 16 }] }).expect(200);
    expect(own.body.data.cars).toHaveLength(2);
    const ins = await request(app).post('/api/automotive/insurance/estimate').send({ vehicleValue: 30000, driverAge: 35, state: 'QLD' }).expect(200);
    expect(ins.body.data.covers).toHaveLength(3);
    const val = await request(app).post('/api/automotive/valuation/estimate').send({ year: 2021, odometerKm: 70000, make: 'Toyota', model: 'RAV4', condition: 'GOOD' }).expect(200);
    expect(val.body.data.newPriceFromCatalogue).toBe(true);
    expect(val.body.data.tradeIn).toBeLessThan(val.body.data.mid);
    const ready = await request(app).post('/api/automotive/finance/readiness').send({ vehiclePrice: 30000, deposit: 6000, incomeAnnual: 90000, expensesMonthly: 2500, employment: 'FULL_TIME', employmentMonths: 24 }).expect(200);
    expect(ready.body.data.band).toBe('ready');
  });

  it('keeps a garage with reminders, a valuation and a service history that resets the next service', async () => {
    const created = await request(app).post('/api/automotive/garage').set(as('member')).send({ make: 'Mazda', model: 'CX-5', year: 2021, odometerKm: 60000, kmPerYear: 15000, regoDueAt: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), boughtNew: true, purchasedAt: '2021-06-01', purchasePrice: 39000 }).expect(201);
    const v = created.body.data;
    expect(v.carModelId).toBe(store.cars.find((c) => c.slug === 'mazda-cx-5')!.id);
    expect(v.reminders.some((r: any) => r.kind === 'REGO' && r.urgency === 'soon')).toBe(true);
    expect(v.valuation.mid).toBeGreaterThan(0);
    const rec = await request(app).post(`/api/automotive/garage/${v.id}/services`).set(as('member')).send({ date: '2026-09-01', odometerKm: 61000, kind: 'logbook', title: '60,000 km service', cost: 350, partsWarrantyMonths: 12 }).expect(201);
    expect(rec.body.data.nextServiceDueKm).toBe(76000);
    const detail = await request(app).get(`/api/automotive/garage/${v.id}`).set(as('member')).expect(200);
    expect(detail.body.data.services).toHaveLength(1);
    expect(detail.body.data.services[0].warrantyUntil).toBe('2027-09-01');
    expect(detail.body.data.spent).toBe(350);
    await request(app).get(`/api/automotive/garage/${v.id}`).set(as('seller')).expect(404);
    await request(app).post(`/api/automotive/garage/${v.id}/odometer`).set(as('member')).send({ odometerKm: 50000 }).expect(400);
    const list = await request(app).get('/api/automotive/garage').set(as('member')).expect(200);
    expect(list.body.data.vehicles).toHaveLength(1);
  });

  it('lists a car with a price guide, holds a suspicious one for review, and masks the VIN from strangers', async () => {
    const good = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2021 Mazda CX-5 Maxx, one owner', make: 'Mazda', model: 'CX-5', year: 2021, bodyType: 'SUV', fuelType: 'PETROL', odometerKm: 70000, price: 27000, description: 'Serviced at Mazda every year, two keys, new tyres in June. Happy to meet at a workshop for an inspection.', state: 'QLD', city: 'Brisbane', photos: ['https://img.example.com/1.jpg', 'https://img.example.com/2.jpg', 'https://img.example.com/3.jpg', 'https://img.example.com/4.jpg'], vin: 'JM0KF4WLA00123456', ppsrChecked: true, serviceHistory: 'FULL', publish: true }).expect(201);
    expect(good.body.data.status).toBe('ACTIVE');
    expect(good.body.data.priceGuideLow).toBeLessThan(good.body.data.priceGuideHigh);
    expect(good.body.data.checks.band).toBe('low');
    const bad = await request(app).post('/api/automotive/listings').set(as('newbie')).send({ title: 'Urgent sale, overseas, cheap SUV', make: 'Toyota', model: 'RAV4', year: 2022, bodyType: 'SUV', fuelType: 'HYBRID', odometerKm: 9000, price: 12000, description: 'I am overseas, a shipping agent will deliver after a deposit to hold it. Urgent.', state: 'NSW', publish: true }).expect(201);
    expect(bad.body.data.status).toBe('SUSPENDED');
    expect(bad.body.data.checks.holdForReview).toBe(true);
    expect(store.notifications.some((n) => n.userId === 'admin' && n.data.kind === 'CAR_LISTING_REVIEW')).toBe(true);
    const publicList = await request(app).get('/api/automotive/listings?state=QLD').expect(200);
    expect(publicList.body.data.listings).toHaveLength(1);
    expect(publicList.body.data.listings[0].vin).toContain('•');
    const detail = await request(app).get(`/api/automotive/listings/${good.body.data.id}`).set(as('member')).expect(200);
    expect(detail.body.data.vin).toContain('•');
    expect(detail.body.data.canOffer).toBe(true);
    expect(detail.body.data.checks.ppsr.ready).toBe(true);
    expect(detail.body.data.protection.feePercent).toBe(6);
    const own = await request(app).get(`/api/automotive/listings/${good.body.data.id}`).set(as('seller')).expect(200);
    expect(own.body.data.vin).toBe('JM0KF4WLA00123456');
    await request(app).get(`/api/automotive/listings/${bad.body.data.id}`).expect(404);
  });

  it('walks a purchase under buyer protection: offer, accept, pay into holding, handover, dispute, and an admin decision', async () => {
    const l = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2020 Toyota Corolla hybrid', make: 'Toyota', model: 'Corolla', year: 2020, bodyType: 'HATCH', fuelType: 'HYBRID', odometerKm: 80000, price: 22000, description: 'Full Toyota history, tyres and brakes done, one owner from new, garaged.', state: 'QLD', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], vin: 'JTNKN3JE0L0123456', ppsrChecked: true, serviceHistory: 'FULL', publish: true }).expect(201);
    const listingId = l.body.data.id;
    await request(app).post(`/api/automotive/listings/${listingId}/offers`).set(as('seller')).send({ amount: 21000 }).expect(400);
    await request(app).post(`/api/automotive/listings/${listingId}/offers`).set(as('member')).send({ amount: 5000 }).expect(400);
    const offer = await request(app).post(`/api/automotive/listings/${listingId}/offers`).set(as('member')).send({ amount: 21000, message: 'Can collect Saturday.' }).expect(201);
    const pid = offer.body.data.id;
    expect(offer.body.data.status).toBe('OFFERED');
    expect(offer.body.data.platformFee).toBe(1260);
    await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(400);
    await request(app).post(`/api/automotive/purchases/${pid}/accept`).set(as('member')).expect(400);
    const accepted = await request(app).post(`/api/automotive/purchases/${pid}/accept`).set(as('seller')).send({ message: 'Saturday suits.' }).expect(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');
    expect(store.listings[0].status).toBe('UNDER_OFFER');
    const paid = await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(200);
    // Starting the card step is not paying. The purchase stays ACCEPTED and
    // the seller is told nothing, because at this point no card has been seen.
    expect(paid.body.data.status).toBe('ACCEPTED');
    expect(paid.body.data.alreadyHeld).toBe(false);
    expect(paid.body.data.payment.clientSecret).toContain('_secret');
    expect(store.notifications.some((x) => x.data.kind === 'CAR_PAID')).toBe(false);
    expect((createEscrowPayment as jest.Mock).mock.calls[0][0]).toMatchObject({ amount: 2100000, platformFeePercent: 6, sessionType: 'vehicle_purchase' });
    await request(app).post(`/api/automotive/purchases/${pid}/handover`).set(as('member')).expect(400);
    const held = await request(app).post(`/api/automotive/purchases/${pid}/payment/confirm`).set(as('member')).expect(200);
    expect(held.body.data.status).toBe('PAID_HELD');
    expect(store.escrows[0].status).toBe('AUTHORIZED');
    expect(store.notifications.some((x) => x.userId === 'seller' && x.data.kind === 'CAR_PAID')).toBe(true);
    await request(app).post(`/api/automotive/purchases/${pid}/handover`).set(as('seller')).expect(400);
    const handed = await request(app).post(`/api/automotive/purchases/${pid}/handover`).set(as('member')).send({ note: 'Collected with both keys and the service book.' }).expect(200);
    expect(handed.body.data.status).toBe('HANDED_OVER');
    expect(handed.body.data.daysLeft).toBe(14);
    expect(store.listings[0].status).toBe('SOLD');
    const view = await request(app).get(`/api/automotive/purchases/${pid}`).set(as('seller')).expect(200);
    expect(view.body.data.role).toBe('seller');
    expect(view.body.data.buyer.email).toBe('mei@athena.com');
    await request(app).get(`/api/automotive/purchases/${pid}`).set(as('newbie')).expect(404);
    const disputed = await request(app).post(`/api/automotive/purchases/${pid}/dispute`).set(as('member')).send({ reason: 'The odometer reads 96,000, not 80,000, and the service book stops in 2023.' }).expect(200);
    expect(disputed.body.data.status).toBe('DISPUTED');
    expect(store.notifications.some((n) => n.userId === 'admin' && n.data.kind === 'CAR_DISPUTE')).toBe(true);
    await request(app).post(`/api/automotive/purchases/${pid}/resolve`).set(as('seller')).send({ outcome: 'RELEASE', note: 'no' }).expect(403);
    const resolved = await request(app).post(`/api/automotive/purchases/${pid}/resolve`).set(as('admin', 'ADMIN')).send({ outcome: 'REFUND', note: 'The kilometres were misdescribed; refunded in full.' }).expect(200);
    expect(resolved.body.data.status).toBe('REFUNDED');
    expect(store.escrows[0].status).toBe('CANCELED');
  });

  it('releases the money to the seller when the buyer is satisfied', async () => {
    const l = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2019 Kia Sportage, tidy', make: 'Kia', model: 'Sportage', year: 2019, bodyType: 'SUV', fuelType: 'PETROL', odometerKm: 95000, price: 19000, description: 'Serviced on time, second owner, no accidents, sold with a safety certificate.', state: 'QLD', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], vin: 'KNAPH81BDK0123456', ppsrChecked: true, publish: true }).expect(201);
    const offer = await request(app).post(`/api/automotive/listings/${l.body.data.id}/offers`).set(as('member')).send({ amount: 19000 }).expect(201);
    const pid = offer.body.data.id;
    await request(app).post(`/api/automotive/purchases/${pid}/accept`).set(as('seller')).expect(200);
    await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(200);
    await request(app).post(`/api/automotive/purchases/${pid}/payment/confirm`).set(as('member')).expect(200);
    await request(app).post(`/api/automotive/purchases/${pid}/handover`).set(as('member')).expect(200);
    const released = await request(app).post(`/api/automotive/purchases/${pid}/release`).set(as('member')).expect(200);
    expect(released.body.data.status).toBe('RELEASED');
    expect(store.escrows[0].status).toBe('CAPTURED');
    const reviewed = await request(app).post(`/api/automotive/purchases/${pid}/review`).set(as('member')).send({ rating: 5, comment: 'Exactly as described.' }).expect(200);
    expect(reviewed.body.data.reviewRating).toBe(5);
    const mine = await request(app).get('/api/automotive/purchases').set(as('seller')).expect(200);
    expect(mine.body.data.selling).toHaveLength(1);
    expect(mine.body.data.buying).toHaveLength(0);
  });

  /**
   * The buyer who closes the card form. Before this, the pay route wrote
   * PAID_HELD and told the seller the money was held before the response
   * carrying the client secret had left the server, so shutting the form left
   * her with a purchase that claimed she had paid and no Pay button to come
   * back to — and a seller who might hand over a car against it.
   */
  it('lets a buyer who closed the card form come back to it, and tells the seller nothing until the card has gone through', async () => {
    const l = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2018 Honda Jazz', make: 'Honda', model: 'Jazz', year: 2018, bodyType: 'HATCH', fuelType: 'PETROL', odometerKm: 70000, price: 15000, description: 'One owner, logbooks complete, new tyres last winter, never smoked in.', state: 'QLD', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], vin: 'JHMGK5H50JX123456', ppsrChecked: true, publish: true }).expect(201);
    const offer = await request(app).post(`/api/automotive/listings/${l.body.data.id}/offers`).set(as('member')).send({ amount: 15000 }).expect(201);
    const pid = offer.body.data.id;
    await request(app).post(`/api/automotive/purchases/${pid}/accept`).set(as('seller')).expect(200);

    const started = await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(200);
    expect(started.body.data.status).toBe('ACCEPTED');
    expect(store.notifications.some((x) => x.data.kind === 'CAR_PAID')).toBe(false);

    // She closes the form. The detail page still says what is true to both of
    // them, and the seller is not waiting on a handover.
    const hers = await request(app).get(`/api/automotive/purchases/${pid}`).set(as('member')).expect(200);
    expect(hers.body.data.nextStep).toContain('not been authorised');
    const his = await request(app).get(`/api/automotive/purchases/${pid}`).set(as('seller')).expect(200);
    expect(his.body.data.nextStep).toContain('Nothing is held');

    // And she cannot walk past the card step: the handover is not open to her.
    await request(app).post(`/api/automotive/purchases/${pid}/handover`).set(as('member')).expect(400);

    // Coming back reopens the same hold rather than starting a second one.
    const resumed = await request(app).get(`/api/automotive/purchases/${pid}/payment`).set(as('member')).expect(200);
    expect(resumed.body.data.clientSecret).toContain('_secret');
    await request(app).get(`/api/automotive/purchases/${pid}/payment`).set(as('seller')).expect(403);
    const again = await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(200);
    expect(again.body.data.payment.paymentIntentId).toBe(started.body.data.payment.paymentIntentId);
    expect((createEscrowPayment as jest.Mock).mock.calls).toHaveLength(1);
    expect(store.escrows).toHaveLength(1);

    // Only the card going through moves the purchase, and only then does the
    // seller hear anything.
    await request(app).post(`/api/automotive/purchases/${pid}/payment/confirm`).set(as('seller')).expect(403);
    const held = await request(app).post(`/api/automotive/purchases/${pid}/payment/confirm`).set(as('member')).expect(200);
    expect(held.body.data.status).toBe('PAID_HELD');
    expect(held.body.data.paidAt).toBeTruthy();
    expect(store.notifications.filter((x) => x.userId === 'seller' && x.data.kind === 'CAR_PAID')).toHaveLength(1);

    // Confirming twice does not tell the seller twice.
    await request(app).post(`/api/automotive/purchases/${pid}/payment/confirm`).set(as('member')).expect(200);
    expect(store.notifications.filter((x) => x.userId === 'seller' && x.data.kind === 'CAR_PAID')).toHaveLength(1);
  });

  it('starts a fresh hold when the first card was declined, rather than leaving her with a dead one', async () => {
    const l = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2017 Subaru Impreza', make: 'Subaru', model: 'Impreza', year: 2017, bodyType: 'HATCH', fuelType: 'PETROL', odometerKm: 88000, price: 14000, description: 'All-wheel drive, serviced at the dealer, two owners, tyres near new.', state: 'QLD', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], vin: 'JF1GPAK60H8123456', ppsrChecked: true, publish: true }).expect(201);
    const offer = await request(app).post(`/api/automotive/listings/${l.body.data.id}/offers`).set(as('member')).send({ amount: 14000 }).expect(201);
    const pid = offer.body.data.id;
    await request(app).post(`/api/automotive/purchases/${pid}/accept`).set(as('seller')).expect(200);
    await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(200);

    // The webhook's answer to a card the issuer refused outright.
    store.escrows[0].status = 'CANCELED';
    const retried = await request(app).post(`/api/automotive/purchases/${pid}/pay`).set(as('member')).expect(200);
    expect((createEscrowPayment as jest.Mock).mock.calls).toHaveLength(2);
    expect(retried.body.data.payment.paymentIntentId).not.toBe(store.escrows[0].paymentIntentId);
    await request(app).post(`/api/automotive/purchases/${pid}/payment/confirm`).set(as('member')).expect(200);
    const view = await request(app).get(`/api/automotive/purchases/${pid}`).set(as('member')).expect(200);
    expect(view.body.data.status).toBe('PAID_HELD');
    expect(view.body.data.escrow.status).toBe('AUTHORIZED');
  });

  it('finds a workshop, books inside its hours, takes a quote line by line, and writes the job into the garage when it is done', async () => {
    const dir = await request(app).get('/api/automotive/mechanics?womenOwned=true&service=logbook').expect(200);
    expect(dir.body.data.mechanics).toHaveLength(1);
    expect(dir.body.data.mechanics[0].price).toMatchObject({ from: 299, own: true });
    const page = await request(app).get('/api/automotive/mechanics/jos-garage').expect(200);
    expect(page.body.data.nextAvailable.length).toBeGreaterThan(0);
    expect(page.body.data.prices.find((p: any) => p.kind === 'brakes').own).toBe(false);
    // The page's "next available" is counted in the workshop's default
    // 60-minute slots; a logbook service takes 120 and needs two hours'
    // notice, so early on a weekday afternoon the first offered day has no
    // logbook slot left. Take the first offered day that has one, as a
    // member would.
    let slots: request.Response | null = null;
    for (const offered of page.body.data.nextAvailable as Array<{ day: string }>) {
      const candidate = await request(app).get(`/api/automotive/mechanics/m1/slots?day=${offered.day}&service=logbook`).expect(200);
      if (candidate.body.data.slots.length > 0) { slots = candidate; break; }
    }
    if (!slots) throw new Error('No offered day had a logbook slot');
    expect(slots.body.data.minutes).toBe(120);
    const car = await request(app).post('/api/automotive/garage').set(as('member')).send({ make: 'Kia', model: 'Sportage', year: 2019, odometerKm: 90000 }).expect(201);
    await request(app).post('/api/automotive/mechanics/m1/bookings').set(as('member')).send({ kind: 'logbook', scheduledAt: new Date('2020-01-01T00:00:00Z').toISOString(), vehicleId: car.body.data.id }).expect(400);
    const booked = await request(app).post('/api/automotive/mechanics/m1/bookings').set(as('member')).send({ kind: 'logbook', scheduledAt: slots.body.data.slots[0].start, vehicleId: car.body.data.id, concern: 'A squeak from the front left.', parts: [{ name: 'Cabin filter', qty: 1 }] });
    expect(booked.status).toBe(201);
    const bid = booked.body.data.id;
    expect(booked.body.data.durationMinutes).toBe(120);
    expect(store.notifications.some((n) => n.userId === 'mech' && n.data.kind === 'CAR_BOOKING')).toBe(true);
    const quoted = await request(app).patch(`/api/automotive/workshop/bookings/${bid}`).set(as('mech')).send({ quoteLines: [{ label: '90,000 km service', amount: 349, kind: 'LABOUR' }, { label: 'Cabin filter', amount: 45, kind: 'PARTS' }], quoteNote: 'Squeak is a stone in the brake dust shield; no charge.' }).expect(200);
    expect(quoted.body.data.status).toBe('QUOTED');
    expect(quoted.body.data.quoteAmount).toBe(394);
    expect(quoted.body.data.quoteTotals.parts).toBe(45);
    const accepted = await request(app).patch(`/api/automotive/bookings/${bid}`).set(as('member')).send({ acceptQuote: true }).expect(200);
    expect(accepted.body.data.status).toBe('CONFIRMED');
    const paid = await request(app).post(`/api/automotive/bookings/${bid}/pay`).set(as('member')).expect(201);
    expect(paid.body.data.payment.amount).toBe(39400);
    expect((createEscrowPayment as jest.Mock).mock.calls.at(-1)![0]).toMatchObject({ platformFeePercent: 12, sessionType: 'car_service' });
    await request(app).post(`/api/automotive/bookings/${bid}/release`).set(as('member')).expect(400);
    const done = await request(app).patch(`/api/automotive/workshop/bookings/${bid}`).set(as('mech')).send({ status: 'COMPLETED', odometerKm: 90210, workshopNote: 'All good. Rear pads at 40%.' }).expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(store.records).toHaveLength(1);
    expect(store.records[0].workshop).toBe("Jo's Garage");
    expect(store.vehicles[0].nextServiceDueKm).toBe(105210);
    await request(app).post(`/api/automotive/bookings/${bid}/release`).set(as('member')).expect(200);
    expect(store.escrows.at(-1)!.status).toBe('CAPTURED');
    const reviewed = await request(app).post(`/api/automotive/bookings/${bid}/review`).set(as('member')).send({ rating: 5, transparency: 5, comment: 'Explained every line.' }).expect(201);
    expect(reviewed.body.data.id).toBeTruthy();
    // The workshop's card carries the average the database worked out over its
    // visible reviews, and the count that says how many stand behind it.
    const agg = await lastAggregate(prisma.mechanicReview);
    expect(agg._avg.rating).toBe(5);
    expect(agg._count.rating).toBe(1);
    expect(store.mechanics[0].ratingAvg).toBe(agg._avg.rating);
    expect(store.mechanics[0].ratingCount).toBe(agg._count.rating);
    expect(store.mechanics[0].transparencyAvg).toBe(5);
    const ics = await request(app).get(`/api/automotive/bookings/${bid}/ics`).set(as('member')).expect(200);
    expect(ics.text).toContain('BEGIN:VCALENDAR');
  });

  it('leaves a hidden review out of the workshop average', async () => {
    // The only assertion anywhere that hiding a mechanic review changes what
    // her card says used to live on recomputeMechanicRating, which the routes
    // no longer call. The rule now lives in the aggregate's `isHidden: false`,
    // so it is checked here, through the route a moderator actually uses.
    store.mechanics = [{ ...workshop(), ratingAvg: 3, ratingCount: 2, transparencyAvg: 2.5 }];
    store.mechanicReviews = [
      { id: 'mr1', mechanicId: 'm1', userId: 'member', bookingId: 'b1', rating: 5, transparency: 4, comment: 'Explained every line.', isHidden: false, createdAt: new Date() },
      { id: 'mr2', mechanicId: 'm1', userId: 'member2', bookingId: 'b2', rating: 1, transparency: 1, comment: 'Abusive and untrue.', isHidden: false, createdAt: new Date() },
    ];

    await request(app).patch('/api/automotive/admin/mechanic-reviews/mr2').set(as('member')).send({ isHidden: true }).expect(403);
    await request(app).patch('/api/automotive/admin/mechanic-reviews/mr2').set(as('admin', 'ADMIN')).send({ isHidden: true }).expect(200);

    // Hiding the one leaves only the five, so the average has to rise to it and
    // the count has to fall with it. An average that moved while the count
    // stayed at two would mean the card still counts a review nobody can read.
    const agg = await lastAggregate(prisma.mechanicReview);
    expect(agg._avg.rating).toBe(5);
    expect(agg._count.rating).toBe(1);
    expect(store.mechanics[0].ratingAvg).toBe(5);
    expect(store.mechanics[0].ratingCount).toBe(1);
    expect(store.mechanics[0].transparencyAvg).toBe(4);
  });

  it('takes a workshop profile that waits for verification, and an admin verifies and features it', async () => {
    const created = await request(app).put('/api/automotive/workshop').set(as('seller')).send({ name: 'Ana Autos', headline: 'Mobile mechanic, southside', about: 'Twenty years on the tools, and I come to your driveway with everything on the van.', services: ['oil', 'brakes', 'nonsense'], womenOwned: true, mobile: true, state: 'QLD', city: 'Brisbane', priceList: [{ kind: 'oil', from: 180 }] }).expect(201);
    expect(created.body.data.pendingVerification).toBe(true);
    expect(created.body.data.services).toEqual(['oil', 'brakes']);
    expect(store.notifications.some((n) => n.userId === 'admin' && n.data.kind === 'CAR_MECHANIC_VERIFY')).toBe(true);
    await request(app).get(`/api/automotive/mechanics/${created.body.data.slug}`).expect(404);
    const overview = await request(app).get('/api/automotive/admin/overview').set(as('admin', 'ADMIN')).expect(200);
    expect(overview.body.data.mechanics).toHaveLength(1);
    const verified = await request(app).patch(`/api/automotive/admin/mechanics/${created.body.data.id}`).set(as('admin', 'ADMIN')).send({ isVerified: true, featuredDays: 30 }).expect(200);
    expect(verified.body.data.isVerified).toBe(true);
    expect(verified.body.data.isFeatured).toBe(true);
    expect(store.notifications.some((n) => n.userId === 'seller' && n.data.kind === 'CAR_MECHANIC_VERIFIED')).toBe(true);
    const dir = await request(app).get('/api/automotive/mechanics?mobile=true').expect(200);
    expect(dir.body.data.mechanics.map((m: any) => m.slug)).toContain(created.body.data.slug);
  });

  it('accepts a review of a catalogue car from a member, marks an owner, and keeps the average', async () => {
    await request(app).post('/api/automotive/garage').set(as('member')).send({ make: 'Toyota', model: 'RAV4', year: 2023 }).expect(201);
    const r = await request(app).post('/api/automotive/catalogue/toyota-rav4-hybrid/reviews').set(as('member')).send({ rating: 5, reliability: 5, safetyFeel: 4, runningCosts: 5, title: 'Three years, no drama', body: 'Forty thousand kilometres, one set of tyres, services under three hundred dollars each. The lane keeping is gentle.' }).expect(201);
    expect(r.body.data.isOwner).toBe(true);
    await request(app).post('/api/automotive/catalogue/toyota-rav4-hybrid/reviews').set(as('seller')).send({ rating: 3, reliability: 4, safetyFeel: 4, runningCosts: 3, title: 'Fine, a bit dull', body: 'Does everything it should and nothing more. The infotainment is behind the Koreans and the wait list was long.' }).expect(201);
    const car = store.cars.find((c) => c.slug === 'toyota-rav4-hybrid')!;
    // Fives and threes: the stored figure has to be the aggregate's average of
    // the two, not the last rating written, and reliability rounds to one place.
    const both = await lastAggregate(prisma.carReview);
    expect(both._avg.rating).toBe(4);
    expect(both._count.rating).toBe(2);
    expect(car.ratingAvg).toBe(both._avg.rating);
    expect(car.ratingCount).toBe(both._count.rating);
    expect(car.reliabilityAvg).toBe(4.5);
    const detail = await request(app).get('/api/automotive/catalogue/toyota-rav4-hybrid').set(as('member')).expect(200);
    expect(detail.body.data.womenSay.owners).toBe(1);
    expect(detail.body.data.womenSay.rating).toBe(4);
    expect(detail.body.data.myReview.rating).toBe(5);
    await request(app).patch(`/api/automotive/reviews/${r.body.data.id}`).set(as('seller')).send({ isHidden: true }).expect(403);
    await request(app).patch(`/api/automotive/reviews/${r.body.data.id}`).set(as('admin', 'ADMIN')).send({ isHidden: true }).expect(200);
    // Hiding the five leaves the three showing, so the average has to fall to
    // it. A count that dropped while the average stayed at 4 would mean the
    // card was still quoting a review nobody can read.
    const visible = await lastAggregate(prisma.carReview);
    expect(visible._avg.rating).toBe(3);
    expect(car.ratingAvg).toBe(visible._avg.rating);
    expect(car.ratingCount).toBe(1);
    expect(car.reliabilityAvg).toBe(4);
  });

  it('goes back to having no average at all when the last review is deleted', async () => {
    const r = await request(app).post('/api/automotive/catalogue/toyota-rav4-hybrid/reviews').set(as('member')).send({ rating: 4, reliability: 4, safetyFeel: 4, runningCosts: 4, title: 'Steady and easy to park', body: 'Two years of school runs and one long drive to Sydney, and it has not missed a beat or cost me anything unplanned.' }).expect(201);
    const car = store.cars.find((c) => c.slug === 'toyota-rav4-hybrid')!;
    expect(car.ratingAvg).toBe(4);
    expect(car.ratingCount).toBe(1);
    await request(app).delete(`/api/automotive/reviews/${r.body.data.id}`).set(as('member')).expect(200);
    // With the last review gone the aggregate has nothing to average, so it
    // gives back null rather than 0.
    const empty = await lastAggregate(prisma.carReview);
    expect(empty._avg.rating).toBeNull();
    expect(empty._count.rating).toBe(0);
    // The column is a non-null Decimal defaulting to 0, so 0 is how "no
    // ratings yet" is stored; the count beside it at 0 is what tells a card
    // there is no average to show, and the detail page says nothing rather
    // than showing her a zero out of five.
    expect(car.ratingAvg).toBe(0);
    expect(car.ratingCount).toBe(0);
    expect(car.reliabilityAvg).toBe(0);
    const detail = await request(app).get('/api/automotive/catalogue/toyota-rav4-hybrid').expect(200);
    expect(detail.body.data.womenSay).toBeNull();
    expect(detail.body.data.reviews).toHaveLength(0);
  });

  it('averages a dealership\'s stars over its own sales and nobody else\'s', async () => {
    const dealerId = randomUUID();
    store.dealerships = [{ id: dealerId, slug: 'sunny-motors', name: 'Sunny Motors', ownerUserId: 'seller', brands: ['Mazda'], headline: 'Women-led, no games', about: null, suburb: 'Ipswich', city: 'Ipswich', state: 'QLD', postcode: null, address: null, phone: null, website: null, email: null, womenLed: true, financeAvailable: false, financePartners: [], hours: null, isVerified: true, isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, createdAt: new Date(), updatedAt: new Date() }];
    // A private sale by someone who owns no dealership, rated one star, and
    // sold first so that it is already on the books when the dealership's own
    // average is worked out. Keeping it out of that average is the whole job
    // of `where: { listing: { dealershipId } }`, and the three ways that
    // filter can be wrong all show here: were it dropped the figures below
    // would be 3 over 2, and were it matching nothing they would be 0 over 0.
    await soldAndRated('mech', { title: '2020 Toyota Corolla hybrid', make: 'Toyota', model: 'Corolla', year: 2020, bodyType: 'HATCH', fuelType: 'HYBRID', odometerKm: 80000, price: 22000, vin: 'JTNKN3JE0L0123456', description: 'Full Toyota history, tyres and brakes done, one owner from new, garaged.' }, 1);
    const sold = await soldAndRated('seller', { title: '2021 Mazda CX-5 Maxx, one owner', make: 'Mazda', model: 'CX-5', year: 2021, bodyType: 'SUV', fuelType: 'PETROL', odometerKm: 70000, price: 27000, vin: 'JM0KF4WLA00123456', description: 'Serviced at Mazda every year, two keys, new tyres in June. Happy to meet at a workshop for an inspection.' }, 5);
    expect(sold.sellerKind).toBe('DEALER');
    expect(sold.dealership.id).toBe(dealerId);
    expect(store.purchases.filter((p) => p.reviewRating !== null)).toHaveLength(2);
    const agg = await lastAggregate(prisma.vehiclePurchase);
    expect(agg._avg.reviewRating).toBe(5);
    expect(agg._count.reviewRating).toBe(1);
    expect(store.dealerships[0].ratingAvg).toBe(agg._avg.reviewRating);
    expect(store.dealerships[0].ratingCount).toBe(agg._count.reviewRating);
    const page = await request(app).get('/api/automotive/dealerships/sunny-motors').expect(200);
    expect(page.body.data.ratingAvg).toBe(5);
    expect(page.body.data.ratingCount).toBe(1);
  });

  it('tracks a finance enquiry from draft to read, and never names a lender', async () => {
    const draft = await request(app).post('/api/automotive/finance/applications').set(as('member')).send({ purpose: 'USED', vehiclePrice: 25000, deposit: 5000, termMonths: 60, incomeAnnual: 78000, expensesMonthly: 2400, employment: 'FULL_TIME', employmentMonths: 30, residency: 'CITIZEN' }).expect(201);
    expect(draft.body.data.status).toBe('DRAFT');
    expect(draft.body.data.amount).toBe(20000);
    expect(draft.body.data.readinessScore).toBeGreaterThan(60);
    expect(draft.body.data.referenceCode).toMatch(/^CF-/);
    const submitted = await request(app).patch(`/api/automotive/finance/applications/${draft.body.data.id}`).set(as('member')).send({ deposit: 6000, submit: true }).expect(200);
    expect(submitted.body.data.status).toBe('SUBMITTED');
    expect(submitted.body.data.amount).toBe(19000);
    expect(submitted.body.data.timeline).toHaveLength(2);
    // Submitting used to set the lender to the literal string "ATHENA finance
    // desk", which is the whole of what made this read as a pre-approval.
    // There is no lender, so the field stays empty.
    expect(submitted.body.data.lender).toBeNull();
    await request(app).patch(`/api/automotive/finance/applications/${draft.body.data.id}`).set(as('member')).send({ deposit: 7000 }).expect(400);
    const read = await request(app).patch(`/api/automotive/admin/finance/${draft.body.data.id}`).set(as('admin', 'ADMIN')).send({ status: 'IN_REVIEW', decisionNote: 'Read it; the figures hold up.' }).expect(200);
    expect(read.body.data.status).toBe('IN_REVIEW');
    // No expiry is ever written now, because a validity period is what turns a
    // number on a page into an offer with a clock on it.
    expect(read.body.data.expiresAt).toBeFalsy();
    expect(read.body.data.lender).toBeNull();
    expect(store.notifications.some((n) => n.userId === 'member' && n.data.kind === 'CAR_FINANCE_STATUS')).toBe(true);
    // Nothing is owed by anyone: ATHENA introduced her to no lender, so there
    // is no introduction to be paid a commission for.
    expect(store.referrals).toHaveLength(0);
    const overview = await request(app).get('/api/automotive/overview').set(as('member')).expect(200);
    expect(overview.body.data.applications).toHaveLength(1);
    expect(overview.body.data.roles.isMechanic).toBe(false);
  });

  it('refuses to let an admin pre-approve or decline credit, and books no fee for doing so', async () => {
    const draft = await request(app).post('/api/automotive/finance/applications').set(as('member')).send({ purpose: 'USED', vehiclePrice: 25000, deposit: 5000, termMonths: 60, incomeAnnual: 78000, expensesMonthly: 2400, employment: 'FULL_TIME', employmentMonths: 30, residency: 'CITIZEN', submit: true }).expect(201);
    const denied = await request(app).patch(`/api/automotive/admin/finance/${draft.body.data.id}`).set(as('admin', 'ADMIN')).send({ status: 'PRE_APPROVED', lender: 'Panel lender', ratePct: 8.49, expiresInDays: 60 }).expect(400);
    expect(denied.body.message ?? denied.body.error).toMatch(/Australian Credit Licence/i);
    await request(app).patch(`/api/automotive/admin/finance/${draft.body.data.id}`).set(as('admin', 'ADMIN')).send({ status: 'DECLINED', decisionNote: 'No' }).expect(400);
    // Neither the status nor the commission ledger moved.
    expect(store.applications.find((a) => a.id === draft.body.data.id)!.status).toBe('SUBMITTED');
    expect(store.referrals).toHaveLength(0);
    // Closing it with a note is what is left, and it names no lender and sets no expiry.
    const closed = await request(app).patch(`/api/automotive/admin/finance/${draft.body.data.id}`).set(as('admin', 'ADMIN')).send({ status: 'WITHDRAWN', decisionNote: 'We have no lender to introduce you to yet.' }).expect(200);
    expect(closed.body.data.status).toBe('WITHDRAWN');
    expect(closed.body.data.lender).toBeNull();
    expect(closed.body.data.expiresAt).toBeFalsy();
    expect(store.referrals).toHaveLength(0);
  });

  it('shows emissions on every car, sorts and filters by them, and lets the mechanic finder cap the labour rate and the job price', async () => {
    const em = await request(app).get('/api/automotive/catalogue?sort=emissions').expect(200);
    const cars = em.body.data.cars;
    expect(cars.every((c: any) => typeof c.emissions === 'string')).toBe(true);
    expect(cars[0].co2GramsKm).not.toBeNull();
    for (let i = 1; i < cars.length; i += 1) expect(cars[i].co2GramsKm ?? 999).toBeGreaterThanOrEqual(cars[i - 1].co2GramsKm ?? 999);
    expect(cars[cars.length - 1].co2GramsKm).toBeGreaterThan(cars[0].co2GramsKm);
    const low = await request(app).get('/api/automotive/catalogue?lowEmissions=true').expect(200);
    expect(low.body.data.cars.length).toBeGreaterThan(0);
    expect(low.body.data.cars.every((c: any) => c.co2GramsKm !== null && c.co2GramsKm <= 120)).toBe(true);
    const cmp = await request(app).get('/api/automotive/catalogue/compare?slugs=toyota-rav4-hybrid,mazda-cx-5').expect(200);
    expect(cmp.body.data.rows.find((r: any) => r.key === 'emissions').values.every((v: string) => v.endsWith('g/km'))).toBe(true);
    expect((await request(app).get('/api/automotive/mechanics?maxRate=100').expect(200)).body.data.mechanics).toHaveLength(0);
    expect((await request(app).get('/api/automotive/mechanics?maxRate=150').expect(200)).body.data.mechanics).toHaveLength(1);
    expect((await request(app).get('/api/automotive/mechanics?service=logbook&maxPrice=250').expect(200)).body.data.total).toBe(0);
    const priced = await request(app).get('/api/automotive/mechanics?service=logbook&maxPrice=300').expect(200);
    expect(priced.body.data.total).toBe(1);
    expect(priced.body.data.mechanics[0].contactUserId).toBe('mech');
  });

  it('compares the insurance quotes she was given, and puts a fleet enquiry on the leads board once', async () => {
    const cmp = await request(app).post('/api/automotive/insurance/compare').send({ vehicleValue: 25000, quotes: [{ insurer: 'Cheap', annual: 900, excess: 2000 }, { insurer: 'Fair', annual: 1050, excess: 700, hireCar: true, roadside: true, windscreen: true, choiceOfRepairer: true }] }).expect(200);
    expect(cmp.body.data.bestValue).toBe('Fair');
    expect(cmp.body.data.cheapest).toBe('Cheap');
    await request(app).post('/api/automotive/insurance/compare').send({ quotes: [] }).expect(400);
    const fleet = await request(app).post('/api/automotive/fleet-enquiries').send({ business: 'Bloom Florists', contactName: 'Mei Lin', email: 'Fleet@Bloom.example', vehicles: 4, state: 'QLD', wants: ['Servicing', 'Reminders'] }).expect(201);
    expect(fleet.body.data.received).toBe(true);
    expect(fleet.body.data.programme.includes.length).toBeGreaterThan(2);
    expect(store.leads).toHaveLength(1);
    expect(store.leads[0]).toMatchObject({ email: 'fleet@bloom.example', source: 'CONTACT_SALES', organisation: 'Bloom Florists', interest: 'Automotive fleet programme' });
    expect(store.leads[0].message).toContain('4 vehicles in QLD');
    expect(store.notifications.some((n) => n.userId === 'admin' && n.data.kind === 'CAR_FLEET_ENQUIRY')).toBe(true);
    await request(app).post('/api/automotive/fleet-enquiries').send({ business: 'Bloom Florists', contactName: 'Mei Lin', email: 'fleet@bloom.example', vehicles: 6 }).expect(201);
    expect(store.leads).toHaveLength(1);
    expect(store.leads[0].message).toContain('6 vehicles');
    await request(app).post('/api/automotive/fleet-enquiries').send({ business: 'B', contactName: 'Mei', email: 'not-an-email', vehicles: 4 }).expect(400);
  });

  it('records the referral fee once when a dealership reports that a test drive became a sale, and the admin ledger reconciles it', async () => {
    const dealerId = randomUUID();
    store.dealerships = [{ id: dealerId, slug: 'sunny-motors', name: 'Sunny Motors', ownerUserId: 'seller', brands: ['Toyota'], headline: 'Women-led, no games', about: null, suburb: 'Ipswich', city: 'Ipswich', state: 'QLD', postcode: null, address: null, phone: null, website: null, email: null, womenLed: true, financeAvailable: false, financePartners: [], hours: null, isVerified: true, isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, createdAt: new Date(), updatedAt: new Date() }];
    const when = new Date(Date.now() + 3 * 86400000).toISOString();
    await request(app).post('/api/automotive/test-drives').set(as('member')).send({ dealershipId: dealerId, preferredAt: new Date(Date.now() - 86400000).toISOString() }).expect(400);
    const drive = await request(app).post('/api/automotive/test-drives').set(as('member')).send({ dealershipId: dealerId, preferredAt: when, note: 'Bringing a child seat' }).expect(201);
    expect(drive.body.data.status).toBe('REQUESTED');
    expect(store.notifications.some((n) => n.userId === 'seller' && n.data.kind === 'CAR_TEST_DRIVE')).toBe(true);
    const confirmed = await request(app).patch(`/api/automotive/dealership/test-drives/${drive.body.data.id}`).set(as('seller')).send({ status: 'CONFIRMED', dealerNote: 'Ask for Priya' }).expect(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');
    expect(confirmed.body.data.referralFee).toBeNull();
    const sold = await request(app).patch(`/api/automotive/dealership/test-drives/${drive.body.data.id}`).set(as('seller')).send({ status: 'COMPLETED', sold: true, salePrice: 42000 }).expect(200);
    expect(sold.body.data.referralFee).toBe(420);
    expect(store.referrals).toHaveLength(1);
    expect(store.referrals[0]).toMatchObject({ kind: 'DEALER_SALE', status: 'PENDING', dealershipId: dealerId, userId: 'member', basisAmount: 42000, fee: 420, partner: 'Sunny Motors' });
    expect(store.notifications.some((n) => n.userId === 'admin' && n.data.kind === 'CAR_REFERRAL')).toBe(true);
    const again = await request(app).patch(`/api/automotive/dealership/test-drives/${drive.body.data.id}`).set(as('seller')).send({ status: 'COMPLETED', sold: true, salePrice: 42000 }).expect(200);
    expect(again.body.data.referralFee).toBe(420);
    expect(store.referrals).toHaveLength(1);
    const mine = await request(app).get('/api/automotive/dealership').set(as('seller')).expect(200);
    expect(mine.body.data.referrals).toHaveLength(1);
    expect(mine.body.data.referralFee.min).toBe(200);
    const ledger = await request(app).get('/api/automotive/admin/referrals').set(as('admin', 'ADMIN')).expect(200);
    expect(ledger.body.data.totals.pending).toBe(420);
    expect(ledger.body.data.referrals[0].kindLabel).toBe('Dealership sale');
    const confirmedFee = await request(app).patch(`/api/automotive/admin/referrals/${store.referrals[0].id}`).set(as('admin', 'ADMIN')).send({ status: 'CONFIRMED' }).expect(200);
    expect(confirmedFee.body.data.status).toBe('CONFIRMED');
    expect(confirmedFee.body.data.confirmedAt).toBeTruthy();
    const added = await request(app).post('/api/automotive/admin/referrals').set(as('admin', 'ADMIN')).send({ kind: 'INSURANCE', partner: 'An insurer', basisAmount: 1200, note: 'Policy 123' }).expect(201);
    expect(added.body.data.fee).toBe(180);
    expect(added.body.data.feePercent).toBe(15);
    const overview = await request(app).get('/api/automotive/admin/overview').set(as('admin', 'ADMIN')).expect(200);
    expect(overview.body.data.referrals.totals).toMatchObject({ pending: 180, confirmed: 420, paid: 0 });
    expect(overview.body.data.referrals.open).toHaveLength(2);
    await request(app).patch(`/api/automotive/admin/referrals/${added.body.data.id}`).set(as('admin', 'ADMIN')).send({ status: 'PAID' }).expect(200);
    const after = await request(app).get('/api/automotive/admin/referrals?status=PAID').set(as('admin', 'ADMIN')).expect(200);
    expect(after.body.data.referrals).toHaveLength(1);
    expect(after.body.data.totals.paid).toBe(180);
  });

  /**
   * The mechanic directory used to append every filter onto one `where.OR`, so
   * a town and a make widened the results instead of narrowing them. A woman
   * asking for a Toyota specialist in Southport got a page that was mostly
   * neither, and nothing said so.
   */
  it('narrows the workshop directory by town and by make instead of widening it', async () => {
    store.mechanics = [workshop(), otherWorkshop()];
    const byCity = await request(app).get('/api/automotive/mechanics?city=Southport').expect(200);
    expect(byCity.body.data.mechanics.map((m: any) => m.slug)).toEqual(['southport-toyota-specialist']);
    // The keyword matches Jo's Garage and the town matches the other one, so
    // the two together match nobody. Under the old OR this returned both.
    const keywordAndCity = await request(app).get('/api/automotive/mechanics?q=Garage&city=Southport').expect(200);
    expect(keywordAndCity.body.data.mechanics).toHaveLength(0);
    expect(keywordAndCity.body.data.total).toBe(0);
    // A workshop that lists no makes works on anything, so Jo's stays in for a
    // Mazda; the Toyota-only specialist does not.
    const mazda = await request(app).get('/api/automotive/mechanics?make=Mazda').expect(200);
    expect(mazda.body.data.mechanics.map((m: any) => m.slug)).toEqual(['jos-garage']);
    const toyotaOnTheCoast = await request(app).get('/api/automotive/mechanics?make=Toyota&city=Southport').expect(200);
    expect(toyotaOnTheCoast.body.data.mechanics.map((m: any) => m.slug)).toEqual(['southport-toyota-specialist']);
  });

  /**
   * The open inspection queue is a list of women: which of them is selling
   * which car, in which suburb, and who asked for it to be looked at. A
   * workshop profile is made by its own owner and starts unverified, so the
   * only thing standing between a stranger and that list is this check.
   */
  it('keeps the open inspection queue away from a workshop nobody has verified', async () => {
    // Jo's workshop and the car are both in Queensland, so the route's
    // `listing: { state }` narrowing lets this one through. The double follows
    // that filter now that it hangs a row's relations on before it matches,
    // but the guard under test here is the one on the workshop.
    store.mechanics = [workshop()];
    const l = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2019 Kia Sportage, tidy', make: 'Kia', model: 'Sportage', year: 2019, bodyType: 'SUV', fuelType: 'PETROL', odometerKm: 95000, price: 19000, description: 'Serviced on time, second owner, no accidents, sold with a safety certificate.', state: 'QLD', suburb: 'Annerley', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], vin: 'KNAPH81BDK0123456', publish: true }).expect(201);
    await request(app).post(`/api/automotive/listings/${l.body.data.id}/inspections`).set(as('member')).send({ kind: 'ATHENA_VETTED' }).expect(201);

    // The attack the finding describes, run end to end: make yourself a
    // workshop, tick "I do inspections", and read the queue.
    const hers = await request(app).put('/api/automotive/workshop').set(as('newbie')).send({ name: 'New One Motors', headline: 'Just started', about: 'A workshop profile made a minute ago by someone nobody has checked.', doesInspections: true, state: 'QLD', city: 'Brisbane' }).expect(201);
    expect(hers.body.data.pendingVerification).toBe(true);
    const refused = await request(app).get('/api/automotive/inspections/open').set(as('newbie')).expect(403);
    expect(refused.body.message).toContain('verified workshop');

    const allowed = await request(app).get('/api/automotive/inspections/open').set(as('mech')).expect(200);
    expect(allowed.body.data).toHaveLength(1);
    expect(allowed.body.data[0].listing.title).toContain('Kia Sportage');
    expect(allowed.body.data[0].requestedBy).toBe('Mei L.');

    // Verified, and it opens; unverified again, and it closes. Whoever did
    // either of those is now on the record.
    await request(app).patch(`/api/automotive/admin/mechanics/${hers.body.data.id}`).set(as('admin', 'ADMIN')).send({ isVerified: true }).expect(200);
    await request(app).get('/api/automotive/inspections/open').set(as('newbie')).expect(200);
    await request(app).patch(`/api/automotive/admin/mechanics/${hers.body.data.id}`).set(as('admin', 'ADMIN')).send({ isVerified: false }).expect(200);
    await request(app).get('/api/automotive/inspections/open').set(as('newbie')).expect(403);
    expect(store.audits.map((a) => a.action)).toEqual(['ADMIN_VERIFICATION_APPROVE', 'ADMIN_VERIFICATION_REJECT']);
    expect(store.audits[0]).toMatchObject({ actorUserId: 'admin', targetUserId: 'newbie', metadata: { area: 'automotive', entity: 'mechanic', name: 'New One Motors', isVerified: true } });
  });

  it('records which admin verified a dealership, and only when the answer changed', async () => {
    const id = randomUUID();
    store.dealerships = [dealership(id, 'seller', 'Sunny Motors', 'sunny-motors', { isVerified: false })];
    await request(app).patch(`/api/automotive/admin/dealerships/${id}`).set(as('admin', 'ADMIN')).send({ featuredDays: 30 }).expect(200);
    expect(store.audits).toHaveLength(0);
    await request(app).patch(`/api/automotive/admin/dealerships/${id}`).set(as('admin', 'ADMIN')).send({ isVerified: true }).expect(200);
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]).toMatchObject({ action: 'ADMIN_VERIFICATION_APPROVE', actorUserId: 'admin', targetUserId: 'seller', metadata: { area: 'automotive', entity: 'dealership', entityId: id } });
    await request(app).patch(`/api/automotive/admin/dealerships/${id}`).set(as('admin', 'ADMIN')).send({ isVerified: true }).expect(200);
    expect(store.audits).toHaveLength(1);
  });

  /**
   * Reviews are ranked by something ATHENA checked — whether the writer has
   * the car in her garage — and no longer by a tap count any member could run
   * up in a loop on any review she liked or disliked.
   */
  it('ranks car reviews by ownership, and no longer takes a helpful vote at all', async () => {
    await request(app).post('/api/automotive/catalogue/toyota-rav4-hybrid/reviews').set(as('seller')).send({ rating: 3, reliability: 4, safetyFeel: 4, runningCosts: 3, title: 'Fine, a bit dull', body: 'Drove one for a fortnight while mine was in the shop. Does everything it should and nothing more.' }).expect(201);
    await request(app).post('/api/automotive/garage').set(as('member')).send({ make: 'Toyota', model: 'RAV4', year: 2023 }).expect(201);
    const hers = await request(app).post('/api/automotive/catalogue/toyota-rav4-hybrid/reviews').set(as('member')).send({ rating: 5, reliability: 5, safetyFeel: 4, runningCosts: 5, title: 'Three years, no drama', body: 'Forty thousand kilometres, one set of tyres, services under three hundred dollars each. The lane keeping is gentle.' }).expect(201);
    expect(hers.body.data.isOwner).toBe(true);
    const detail = await request(app).get('/api/automotive/catalogue/toyota-rav4-hybrid').expect(200);
    expect(detail.body.data.reviews.map((r: any) => r.isOwner)).toEqual([true, false]);
    expect(detail.body.data.reviews.every((r: any) => r.helpfulCount === undefined)).toBe(true);
    const listed = await request(app).get('/api/automotive/catalogue/toyota-rav4-hybrid/reviews').expect(200);
    expect(listed.body.data.reviews.map((r: any) => r.title)).toEqual(['Three years, no drama', 'Fine, a bit dull']);
    expect(listed.body.data.reviews.every((r: any) => r.helpfulCount === undefined)).toBe(true);
    await request(app).post(`/api/automotive/reviews/${hers.body.data.id}/helpful`).set(as('seller')).expect(404);
    expect(store.reviews.every((r) => r.helpfulCount === 0)).toBe(true);
  });

  /**
   * The dealer sale is one of the two automatic revenue lines and the whole of
   * it is the dealership's own word, so it is written as a claim: a verified
   * dealership only, the member told so there is a second pair of eyes, and a
   * note on the ledger row that says whose figure it is.
   */
  it('takes a reported sale only from a verified dealership, tells the member, and books the fee as the dealer\'s own claim', async () => {
    const id = randomUUID();
    store.dealerships = [dealership(id, 'seller', 'Sunny Motors', 'sunny-motors')];
    const drive = await request(app).post('/api/automotive/test-drives').set(as('member')).send({ dealershipId: id, preferredAt: new Date(Date.now() + 3 * 86400000).toISOString() }).expect(201);
    store.dealerships[0].isVerified = false;
    const refused = await request(app).patch(`/api/automotive/dealership/test-drives/${drive.body.data.id}`).set(as('seller')).send({ status: 'COMPLETED', sold: true, salePrice: 42000 }).expect(403);
    expect(refused.body.message).toContain('verified dealership');
    expect(store.referrals).toHaveLength(0);

    store.dealerships[0].isVerified = true;
    const sold = await request(app).patch(`/api/automotive/dealership/test-drives/${drive.body.data.id}`).set(as('seller')).send({ status: 'COMPLETED', sold: true, salePrice: 42000 }).expect(200);
    expect(sold.body.data.referralFee).toBe(420);
    expect(store.referrals).toHaveLength(1);
    expect(store.referrals[0].status).toBe('PENDING');
    expect(store.referrals[0].note).toContain('not verified by ATHENA');
    const toHer = store.notifications.find((x) => x.userId === 'member' && x.data.kind === 'CAR_DEALER_SALE_REPORTED');
    expect(toHer).toBeTruthy();
    expect(toHer!.message).toContain('$42,000');
    // Reporting it twice bills it once, and does not tell her twice either.
    await request(app).patch(`/api/automotive/dealership/test-drives/${drive.body.data.id}`).set(as('seller')).send({ status: 'COMPLETED', sold: true, salePrice: 42000 }).expect(200);
    expect(store.referrals).toHaveLength(1);
    expect(store.notifications.filter((x) => x.data.kind === 'CAR_DEALER_SALE_REPORTED')).toHaveLength(1);
  });

  /**
   * Two dealerships quoting on the same trade-in used to overwrite each other,
   * because every quote lives in one Json array that is read, edited and
   * written back whole. The member had already been told about the offer that
   * then disappeared from her page.
   */
  it('keeps both quotes when two dealerships quote on the same trade-in, and replaces only the quoter\'s own', async () => {
    const sunny = randomUUID();
    const coast = randomUUID();
    store.dealerships = [dealership(sunny, 'seller', 'Sunny Motors', 'sunny-motors'), dealership(coast, 'mech', 'Coast Toyota', 'coast-toyota')];
    const t = await request(app).post('/api/automotive/trade-ins').set(as('member')).send({ make: 'Toyota', model: 'Corolla', year: 2019, odometerKm: 90000, condition: 'GOOD' }).expect(201);
    const id = t.body.data.id;
    await request(app).post(`/api/automotive/dealership/trade-ins/${id}/quotes`).set(as('seller')).send({ amount: 18000, note: 'Drive it in this week.' }).expect(201);
    const second = await request(app).post(`/api/automotive/dealership/trade-ins/${id}/quotes`).set(as('mech')).send({ amount: 18500 }).expect(201);
    expect(second.body.data.quotes).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalled();
    const hers = await request(app).get('/api/automotive/trade-ins').set(as('member')).expect(200);
    expect(hers.body.data[0].quotes.map((x: any) => x.amount).sort()).toEqual([18000, 18500]);
    expect(store.notifications.filter((x) => x.data.kind === 'CAR_TRADE_IN_QUOTE')).toHaveLength(2);
    // Her own second thoughts replace her own quote and touch nobody else's.
    const revised = await request(app).post(`/api/automotive/dealership/trade-ins/${id}/quotes`).set(as('seller')).send({ amount: 17500 }).expect(201);
    expect(revised.body.data.quotes).toBe(2);
    const after = await request(app).get('/api/automotive/trade-ins').set(as('member')).expect(200);
    expect(after.body.data[0].quotes.map((x: any) => x.amount).sort()).toEqual([17500, 18500]);
    expect(after.body.data[0].quotes.find((x: any) => x.dealershipId === coast).name).toBe('Coast Toyota');
    // An unverified dealership cannot quote at all.
    store.dealerships[1].isVerified = false;
    await request(app).post(`/api/automotive/dealership/trade-ins/${id}/quotes`).set(as('mech')).send({ amount: 19000 }).expect(403);
  });

  /**
   * The slot check and the booking it permits are one transaction now. This
   * double runs on one connection and cannot interleave two requests, so what
   * it proves is that the handler asks for a transaction, does the check
   * inside it, and still refuses an hour that has gone. Whether Postgres
   * serialises two of them is a database's answer, not a mock's.
   */
  it('books a workshop hour inside a transaction and refuses the same hour twice', async () => {
    const page = await request(app).get('/api/automotive/mechanics/jos-garage').expect(200);
    let slot: string | null = null;
    for (const offered of page.body.data.nextAvailable as Array<{ day: string }>) {
      const candidate = await request(app).get(`/api/automotive/mechanics/m1/slots?day=${offered.day}&service=brakes`).expect(200);
      if (candidate.body.data.slots.length > 0) { slot = candidate.body.data.slots[0].start; break; }
    }
    if (!slot) throw new Error('No offered day had a brakes slot');
    const first = await request(app).post('/api/automotive/mechanics/m1/bookings').set(as('member')).send({ kind: 'brakes', scheduledAt: slot }).expect(201);
    expect(first.body.data.scheduledAt).toBe(slot);
    expect(prisma.$transaction).toHaveBeenCalled();
    const clash = await request(app).post('/api/automotive/mechanics/m1/bookings').set(as('seller')).send({ kind: 'brakes', scheduledAt: slot }).expect(400);
    expect(clash.body.message).toContain('not free');
    expect(store.bookings).toHaveLength(1);
  });

  /**
   * The third money flow, which had no test of its own at all while the
   * purchase and the workshop job both did.
   *
   * A pre-purchase inspection is the one thing standing between a woman and a
   * five-figure payment for a car she has seen once, so two things have to
   * hold together: the report has to arrive before the workshop is paid, and
   * the fee has to be held rather than handed over on trust. Both of those
   * live in handlers that nothing exercised, and the order between them is the
   * whole point — a fee released before the report is a workshop with no
   * reason to write an honest one.
   */
  it('holds an inspection fee until the report is in, then releases it with the platform cut taken', async () => {
    store.mechanics = [workshop()];
    const l = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2018 Honda CR-V VTi', make: 'Honda', model: 'CR-V', year: 2018, bodyType: 'SUV', fuelType: 'PETROL', odometerKm: 104000, price: 21500, description: 'One owner from new, serviced at Honda every year, logbooks in the glovebox, two keys.', state: 'QLD', suburb: 'Annerley', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], vin: 'JHLRE4850JC012345', publish: true }).expect(201);
    const asked = await request(app).post(`/api/automotive/listings/${l.body.data.id}/inspections`).set(as('member')).send({ kind: 'ATHENA_VETTED' }).expect(201);
    const iid = asked.body.data.id;
    expect(asked.body.data).toMatchObject({ status: 'REQUESTED', fee: 250 });
    expect(store.notifications.filter((x) => x.userId === 'mech' && x.data.kind === 'CAR_INSPECTION_OPEN')).toHaveLength(1);

    const accepted = await request(app).post(`/api/automotive/inspections/${iid}/accept`).set(as('mech')).send({ fee: 280 }).expect(200);
    expect(accepted.body.data).toMatchObject({ status: 'ASSIGNED', fee: 280 });

    // Held, not paid: the workshop's money sits with the processor and the
    // platform's fifteen per cent is set aside at the same moment.
    const paid = await request(app).post(`/api/automotive/inspections/${iid}/pay`).set(as('member')).expect(201);
    expect(paid.body.data).toMatchObject({ amount: 28000, platformFee: 4200, currency: 'aud' });
    expect(store.escrows).toHaveLength(1);
    expect(store.escrows[0]).toMatchObject({ buyerId: 'member', sellerId: 'mech', status: 'PENDING' });
    // Asking again returns the hold she already has rather than a second one.
    const again = await request(app).post(`/api/automotive/inspections/${iid}/pay`).set(as('member')).expect(200);
    expect(again.body.data.alreadyHeld).toBe(true);
    expect(store.escrows).toHaveLength(1);

    const early = await request(app).post(`/api/automotive/inspections/${iid}/release`).set(as('member')).expect(400);
    expect(early.body.message).toContain('once the report is in');
    expect(captureEscrowPayment).not.toHaveBeenCalled();

    // She paid for it, but she does not write it. A buyer who could mark her
    // own inspection complete could release the fee whenever she liked.
    const notHers = await request(app).patch(`/api/automotive/inspections/${iid}`).set(as('member')).send({ status: 'COMPLETED', summary: 'Looks fine to me' }).expect(403);
    expect(notHers.body.message).toContain('Only the workshop');

    const report = await request(app).patch(`/api/automotive/inspections/${iid}`).set(as('mech')).send({ status: 'COMPLETED', summary: 'Sound car. Front tyres near the wear bars and a weeping rocker cover gasket.', report: [{ key: 'tyres', result: 'ADVISORY', notes: '3mm across the front pair' }, { key: 'engine', result: 'ADVISORY', notes: 'Rocker cover gasket weeping, not dripping' }, { key: 'road_test', result: 'PASS' }, { key: 'documents', result: 'PASS' }] }).expect(200);
    expect(report.body.data.outcome).toBe('ADVISORIES');
    expect(report.body.data.report.map((s: any) => s.label)).toContain('Tyres and wheels');
    expect(store.notifications.filter((x) => x.userId === 'member' && x.data.kind === 'CAR_INSPECTION_DONE')).toHaveLength(1);
    expect(store.notifications.filter((x) => x.userId === 'seller' && x.data.kind === 'CAR_INSPECTION_DONE')).toHaveLength(1);

    // Nobody but the woman who paid can let the money go.
    await request(app).post(`/api/automotive/inspections/${iid}/release`).set(as('seller')).expect(404);
    await request(app).post(`/api/automotive/inspections/${iid}/release`).set(as('member')).expect(200);
    expect(store.escrows[0].status).toBe('CAPTURED');
    // And releasing twice captures once, because a double tap on a slow page
    // must not become a double charge.
    await request(app).post(`/api/automotive/inspections/${iid}/release`).set(as('member')).expect(200);
    expect(captureEscrowPayment).toHaveBeenCalledTimes(1);
  });

  /**
   * `?inspected=true` is `inspections: { some: { status: 'COMPLETED' } }`, and
   * it is the one filter on the pre-loved search with a safety claim behind
   * it: she is asking to be shown only cars a workshop has already looked
   * over. The in-memory double used to answer true to any `some` it was
   * handed, so the box could have selected nothing at all and this suite would
   * still have been green.
   */
  it('shows only the cars that have been inspected when she asks for inspected ones', async () => {
    const base = { make: 'Hyundai', model: 'i30', year: 2019, bodyType: 'HATCH' as const, fuelType: 'PETROL' as const, odometerKm: 72000, price: 17500, state: 'QLD', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], publish: true };
    const looked = await request(app).post('/api/automotive/listings').set(as('seller')).send({ ...base, title: '2019 Hyundai i30 Active, inspected', description: 'Second car, garaged, serviced on time. Happy for anyone to have it looked at before they buy.', vin: 'KMHD35LE9KU123456' }).expect(201);
    const notLooked = await request(app).post('/api/automotive/listings').set(as('seller')).send({ ...base, title: '2019 Hyundai i30 Go, no inspection yet', description: 'Same car in a lower trim, bought from the first owner, drives well and wants nothing.', vin: 'KMHD35LE9KU654321' }).expect(201);

    const before = await request(app).get('/api/automotive/listings?inspected=true').expect(200);
    expect(before.body.data.listings).toHaveLength(0);
    expect(before.body.data.total).toBe(0);

    await request(app).post(`/api/automotive/listings/${looked.body.data.id}/inspections`).set(as('seller')).send({ reportUrl: 'https://reports.example.com/i30.pdf' }).expect(201);

    const filtered = await request(app).get('/api/automotive/listings?inspected=true').expect(200);
    expect(filtered.body.data.listings.map((x: any) => x.id)).toEqual([looked.body.data.id]);
    expect(filtered.body.data.total).toBe(1);
    const unfiltered = await request(app).get('/api/automotive/listings').expect(200);
    expect(unfiltered.body.data.listings.map((x: any) => x.id).sort()).toEqual([looked.body.data.id, notLooked.body.data.id].sort());
  });

  /**
   * Accepting a trade-in quote is the end of that flow and had no test either.
   * It is the point at which a member commits to a figure, so the quote she
   * accepts has to be one that was actually made, and the dealership has to
   * hear about it — nothing else tells them to expect the car.
   */
  it('accepts a trade-in quote that was really made, and tells the dealership it won', async () => {
    const sunny = randomUUID();
    const coast = randomUUID();
    store.dealerships = [dealership(sunny, 'seller', 'Sunny Motors', 'sunny-motors'), dealership(coast, 'mech', 'Coast Toyota', 'coast-toyota')];
    const t = await request(app).post('/api/automotive/trade-ins').set(as('member')).send({ make: 'Toyota', model: 'Yaris', year: 2018, odometerKm: 64000, condition: 'GOOD' }).expect(201);
    const id = t.body.data.id;
    await request(app).post(`/api/automotive/dealership/trade-ins/${id}/quotes`).set(as('seller')).send({ amount: 13500 }).expect(201);

    // Coast Toyota never quoted, so it cannot be accepted, and nothing moves.
    const unquoted = await request(app).patch(`/api/automotive/trade-ins/${id}`).set(as('member')).send({ status: 'ACCEPTED', dealershipId: coast }).expect(400);
    expect(unquoted.body.message).toContain('Pick one of the quotes');
    expect(store.tradeIns[0].status).toBe('QUOTED');

    const accepted = await request(app).patch(`/api/automotive/trade-ins/${id}`).set(as('member')).send({ status: 'ACCEPTED', dealershipId: sunny }).expect(200);
    expect(accepted.body.data).toEqual({ status: 'ACCEPTED', dealership: 'Sunny Motors' });
    expect(store.tradeIns[0]).toMatchObject({ status: 'ACCEPTED', dealershipId: sunny });
    const won = store.notifications.find((x) => x.userId === 'seller' && x.data.kind === 'CAR_TRADE_IN_ACCEPTED');
    expect(won).toBeTruthy();
    expect(won!.message).toContain('$13,500');

    // It is her request and nobody else's to accept or withdraw.
    await request(app).patch(`/api/automotive/trade-ins/${id}`).set(as('mech')).send({ status: 'WITHDRAWN' }).expect(404);
    await request(app).patch(`/api/automotive/trade-ins/${id}`).set(as('member')).send({ status: 'WITHDRAWN' }).expect(200);
    expect(store.tradeIns[0].status).toBe('WITHDRAWN');
  });

  /**
   * /overview is the first thing a member sees on the cars dashboard and it
   * reaches into nine models at once, so a wrong relation name there is a
   * blank page rather than a wrong number. It had no test.
   */
  it('gathers the cars dashboard: her garage, what she has open, and which hats she wears', async () => {
    store.dealerships = [dealership(randomUUID(), 'seller', 'Sunny Motors', 'sunny-motors')];
    store.mechanics = [workshop()];
    await request(app).post('/api/automotive/garage').set(as('member')).send({ make: 'Mazda', model: 'CX-5', year: 2021, odometerKm: 60000, regoDueAt: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) }).expect(201);
    const l = await request(app).post('/api/automotive/listings').set(as('seller')).send({ title: '2020 Toyota Corolla Ascent Sport', make: 'Toyota', model: 'Corolla', year: 2020, bodyType: 'HATCH', fuelType: 'PETROL', odometerKm: 58000, price: 23000, description: 'Bought new, serviced at Toyota, never in an accident, selling because we have outgrown it.', state: 'QLD', photos: ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg', 'https://img.example.com/c.jpg', 'https://img.example.com/d.jpg'], vin: 'JTDBR32E900123456', publish: true }).expect(201);
    await request(app).post(`/api/automotive/listings/${l.body.data.id}/offers`).set(as('member')).send({ amount: 22000 }).expect(201);
    await request(app).post('/api/automotive/test-drives').set(as('member')).send({ dealershipId: store.dealerships[0].id, preferredAt: new Date(Date.now() + 3 * 86400000).toISOString() }).expect(201);
    await request(app).post('/api/automotive/trade-ins').set(as('member')).send({ make: 'Mazda', model: 'CX-5', year: 2021, odometerKm: 60000, condition: 'GOOD' }).expect(201);

    const mine = await request(app).get('/api/automotive/overview').set(as('member')).expect(200);
    expect(mine.body.data.vehicles).toHaveLength(1);
    expect(mine.body.data.reminders.some((r: any) => r.kind === 'REGO')).toBe(true);
    expect(mine.body.data.purchases.map((p: any) => p.status)).toEqual(['OFFERED']);
    expect(mine.body.data.counts).toEqual({ saved: 0, listings: 0, testDrives: 1, tradeIns: 1 });
    expect(mine.body.data.roles).toEqual({ isMechanic: false, mechanicVerified: false, isDealer: false, dealerVerified: false, isAdmin: false });

    // The same offer from the other end, and the two hats the seller wears.
    const hers = await request(app).get('/api/automotive/overview').set(as('seller')).expect(200);
    expect(hers.body.data.purchases.map((p: any) => p.status)).toEqual(['OFFERED']);
    expect(hers.body.data.counts).toMatchObject({ listings: 1, testDrives: 0, tradeIns: 0 });
    expect(hers.body.data.roles).toMatchObject({ isDealer: true, dealerVerified: true, isMechanic: false });
    const jo = await request(app).get('/api/automotive/overview').set(as('mech')).expect(200);
    expect(jo.body.data.roles).toMatchObject({ isMechanic: true, mechanicVerified: true, isDealer: false });
  });
});
