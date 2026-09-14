import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Row = Record<string, any>;
const store: { cars: Row[]; reviews: Row[]; vehicles: Row[]; records: Row[]; listings: Row[]; purchases: Row[]; inspections: Row[]; mechanics: Row[]; bookings: Row[]; mechanicReviews: Row[]; dealerships: Row[]; applications: Row[]; notifications: Row[]; escrows: Row[]; testDrives: Row[]; referrals: Row[]; leads: Row[] } = { cars: [], reviews: [], vehicles: [], records: [], listings: [], purchases: [], inspections: [], mechanics: [], bookings: [], mechanicReviews: [], dealerships: [], applications: [], notifications: [], escrows: [], testDrives: [], referrals: [], leads: [] };
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
      if ('some' in v || 'isEmpty' in v || 'path' in v) return true;
      return matches(row[k] ?? {}, v);
    }
    return row[k] === v;
  });
};
const table = (rows: () => Row[], defaults: () => Row = () => ({})) => ({
  findMany: jest.fn(async ({ where, take, skip, orderBy }: any = {}) => { let out = rows().filter((r) => matches(r, where)); if (Array.isArray(orderBy)) { for (const o of [...orderBy].reverse()) { const [k, dir] = Object.entries(o)[0] as [string, string]; out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); } } return out.slice(skip ?? 0, (skip ?? 0) + (take ?? out.length)).map((r) => ({ ...r })); }),
  findFirst: jest.fn(async ({ where }: any = {}) => { const r = rows().find((x) => matches(x, where)); return r ? { ...r } : null; }),
  findUnique: jest.fn(async ({ where }: any) => { const w = { ...where }; for (const k of Object.keys(w)) if (k.includes('_') && w[k] && typeof w[k] === 'object') { Object.assign(w, w[k]); delete w[k]; } const r = rows().find((x) => matches(x, w)); return r ? { ...r } : null; }),
  count: jest.fn(async ({ where }: any = {}) => rows().filter((r) => matches(r, where)).length),
  create: jest.fn(async ({ data }: any) => { const row = { id: id('r'), createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...data }; rows().push(row); return row; }),
  update: jest.fn(async ({ where, data }: any) => { const row = rows().find((r) => matches(r, where)); if (!row) throw new Error('not found'); for (const [k, v] of Object.entries(data as Row)) { if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && ('increment' in v || 'decrement' in v)) row[k] = (row[k] ?? 0) + ((v as any).increment ?? 0) - ((v as any).decrement ?? 0); else if (v !== undefined) row[k] = v; } row.updatedAt = new Date(); return row; }),
  updateMany: jest.fn(async ({ where, data }: any) => { const hit = rows().filter((r) => matches(r, where)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length }; }),
  upsert: jest.fn(async ({ where, create, update }: any) => { const w = { ...where }; for (const k of Object.keys(w)) if (k.includes('_') && w[k] && typeof w[k] === 'object') { Object.assign(w, w[k]); delete w[k]; } const row = rows().find((r) => matches(r, w)); if (row) { Object.assign(row, update); return row; } const made = { id: id('r'), createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...create }; rows().push(made); return made; }),
  delete: jest.fn(async ({ where }: any) => { const i = rows().findIndex((r) => matches(r, where)); const [row] = rows().splice(i, 1); return row; }),
  deleteMany: jest.fn(async () => ({ count: 0 })),
  groupBy: jest.fn(async () => []),
});

const users: Record<string, Row> = { member: { id: 'member', firstName: 'Mei', lastName: 'Lin', displayName: null, email: 'mei@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date('2025-01-01') }, seller: { id: 'seller', firstName: 'Ana', lastName: 'Ruiz', displayName: null, email: 'ana@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date('2025-01-01') }, mech: { id: 'mech', firstName: 'Jo', lastName: 'Park', displayName: null, email: 'jo@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date('2025-01-01') }, admin: { id: 'admin', firstName: 'Ad', lastName: 'Min', displayName: null, email: 'admin@athena.com', role: 'ADMIN', timezone: 'Australia/Brisbane', createdAt: new Date('2024-01-01') }, newbie: { id: 'newbie', firstName: 'New', lastName: 'One', displayName: null, email: 'new@athena.com', role: 'USER', timezone: 'Australia/Brisbane', createdAt: new Date() } };

jest.mock('../../utils/prisma', () => {
  const withRelations = (t: ReturnType<typeof table>, relate: (row: Row, args: any) => Row) => ({ ...t, findMany: jest.fn(async (args: any = {}) => (await t.findMany(args)).map((r: Row) => relate(r, args))), findFirst: jest.fn(async (args: any = {}) => { const r = await t.findFirst(args); return r ? relate(r, args) : null; }), findUnique: jest.fn(async (args: any) => { const r = await t.findUnique(args); return r ? relate(r, args) : null; }), create: jest.fn(async (args: any) => relate(await t.create(args), args)), update: jest.fn(async (args: any) => relate(await t.update(args), args)) });
  const listingRel = (r: Row) => ({ ...r, seller: users[r.sellerId], dealership: r.dealershipId ? store.dealerships.find((d) => d.id === r.dealershipId) ?? null : null, inspections: store.inspections.filter((i) => i.listingId === r.id), purchases: store.purchases.filter((p) => p.listingId === r.id) });
  const purchaseRel = (r: Row) => ({ ...r, listing: listingRel(store.listings.find((l) => l.id === r.listingId)!), buyer: users[r.buyerId], seller: users[r.sellerId], escrow: r.escrowPaymentId ? store.escrows.find((e) => e.id === r.escrowPaymentId) ?? null : null });
  const bookingRel = (r: Row) => ({ ...r, mechanic: store.mechanics.find((m) => m.id === r.mechanicId), vehicle: r.vehicleId ? store.vehicles.find((v) => v.id === r.vehicleId) ?? null : null, review: store.mechanicReviews.find((x) => x.bookingId === r.id) ?? null, escrow: r.escrowPaymentId ? store.escrows.find((e) => e.id === r.escrowPaymentId) ?? null : null, user: users[r.userId] });
  const inspectionRel = (r: Row) => ({ ...r, listing: store.listings.find((l) => l.id === r.listingId), inspector: r.inspectorId ? store.mechanics.find((m) => m.id === r.inspectorId) ?? null : null, requestedBy: users[r.requestedById], escrow: r.escrowPaymentId ? store.escrows.find((e) => e.id === r.escrowPaymentId) ?? null : null });
  const carModelT = table(() => store.cars);
  return { prisma: {
    user: { findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null), findMany: jest.fn(async ({ where }: any) => Object.values(users).filter((u) => matches(u, where))) },
    carModel: carModelT,
    carReview: withRelations(table(() => store.reviews, () => ({ isHidden: false, helpfulCount: 0 })), (r) => ({ ...r, user: users[r.userId] })),
    vehicle: table(() => store.vehicles, () => ({ isActive: true, nickname: null, variant: null, bodyType: null, colour: null, rego: null, regoState: null, vin: null, odometerKm: null, odometerAt: null, kmPerYear: null, purchasePrice: null, purchasedAt: null, boughtNew: false, newPrice: null, warrantyEndsAt: null, warrantyEndsKm: null, regoDueAt: null, insuranceRenewsAt: null, insurer: null, insurancePremium: null, nextServiceDueAt: null, nextServiceDueKm: null, notes: null, lastReminderKeys: null, carModelId: null })),
    vehicleServiceRecord: withRelations(table(() => store.records), (r) => ({ ...r, mechanic: r.mechanicId ? store.mechanics.find((m) => m.id === r.mechanicId) ?? null : null })),
    vehicleListing: withRelations(table(() => store.listings, () => ({ status: 'DRAFT', isFeatured: false, viewCount: 0, saveCount: 0, soldAt: null, suspendedReason: null, variant: null, colour: null, seats: null, videoUrl: null, suburb: null, city: null, postcode: null, vin: null, rego: null, regoExpires: null, ownersCount: null, ppsrCertificateUrl: null, warrantyNote: null, dealershipId: null, vehicleId: null, transmission: 'AUTOMATIC', serviceHistory: 'UNKNOWN', accidentHistory: 'NONE', ppsrChecked: false, roadworthy: false, warranty: 'NONE', riskFlags: [], riskScore: 0 })), listingRel),
    vehicleListingSave: table(() => []),
    vehiclePurchase: withRelations(table(() => store.purchases, () => ({ status: 'OFFERED', agreedAmount: null, platformFee: 0, message: null, sellerMessage: null, escrowPaymentId: null, paidAt: null, handedOverAt: null, inspectionEndsAt: null, releasedAt: null, disputeReason: null, disputeOpenedAt: null, disputeResolution: null, resolvedAt: null, resolvedById: null, transferNote: null, cancelledAt: null, cancelReason: null, reviewRating: null, reviewComment: null })), purchaseRel),
    vehicleInspection: withRelations(table(() => store.inspections, () => ({ status: 'REQUESTED', inspectorId: null, purchaseId: null, scheduledAt: null, completedAt: null, outcome: null, summary: null, report: null, reportUrl: null, escrowPaymentId: null })), inspectionRel),
    mechanic: table(() => store.mechanics, () => ({ isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, transparencyAvg: 0, languages: ['English'], makes: [], services: [], acceptsBookings: true, slotMinutes: 60, availability: null, priceList: null })),
    mechanicBooking: withRelations(table(() => store.bookings, () => ({ status: 'REQUESTED', dropOff: true, address: null, concern: null, odometerKm: null, quoteAmount: null, quoteLines: null, quoteNote: null, quotedAt: null, quoteAcceptedAt: null, partsRequested: null, finalAmount: null, escrowPaymentId: null, paidAt: null, workshopNote: null, completedAt: null, partsWarrantyMonths: null, labourWarrantyMonths: null, cancelReason: null, vehicleId: null })), bookingRel),
    mechanicReview: table(() => store.mechanicReviews, () => ({ isHidden: false })),
    dealership: table(() => store.dealerships, () => ({ isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, brands: [], financePartners: [], hours: null })),
    testDriveRequest: withRelations(table(() => store.testDrives, () => ({ status: 'REQUESTED', dealerNote: null, confirmedAt: null, alternativeAt: null, note: null, carModelId: null, listingId: null })), (r) => ({ ...r, dealership: r.dealershipId ? store.dealerships.find((d) => d.id === r.dealershipId) ?? null : null, carModel: r.carModelId ? store.cars.find((c) => c.id === r.carModelId) ?? null : null, listing: r.listingId ? store.listings.find((l) => l.id === r.listingId) ?? null : null, user: users[r.userId] })),
    tradeInRequest: table(() => []),
    carReferral: withRelations(table(() => store.referrals, () => ({ status: 'PENDING', userId: null, dealershipId: null, referenceId: null, partner: null, note: null, createdById: null, confirmedAt: null, paidAt: null, feePercent: 0 })), (r) => ({ ...r, user: r.userId ? users[r.userId] ?? null : null, dealership: r.dealershipId ? store.dealerships.find((d) => d.id === r.dealershipId) ?? null : null })),
    lead: table(() => store.leads, () => ({ status: 'NEW' })),
    carFinanceApplication: table(() => store.applications),
    notification: { create: jest.fn(async ({ data }: any) => { store.notifications.push(data); return data; }), findFirst: jest.fn(async () => null) },
    escrowPayment: table(() => store.escrows),
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  } };
});

jest.mock('../../services/stripe-connect.service', () => ({
  createEscrowPayment: jest.fn(async (input: any) => { const row = { id: `esc${++seq}`, paymentIntentId: `pi_${seq}`, status: 'PENDING', amount: input.amount, platformFee: Math.round(input.amount * (input.platformFeePercent ?? 15) / 100), buyerId: input.buyerId, sellerId: input.sellerId }; store.escrows.push(row); return { escrowId: row.id, paymentIntentId: row.paymentIntentId, clientSecret: `${row.paymentIntentId}_secret`, amount: row.amount, platformFee: row.platformFee }; }),
  captureEscrowPayment: jest.fn(async (pi: string) => { const e = store.escrows.find((x) => x.paymentIntentId === pi)!; e.status = 'CAPTURED'; return { status: 'captured', amountCaptured: e.amount }; }),
  cancelEscrowPayment: jest.fn(async (pi: string) => { const e = store.escrows.find((x) => x.paymentIntentId === pi)!; e.status = 'CANCELED'; return { status: 'canceled' }; }),
  getEscrowClientSecret: jest.fn(async (pi: string) => `${pi}_secret`),
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: req.headers['x-test-user'] || 'member', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' }; next(); },
  optionalAuth: (req: any, _res: any, next: any) => { if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' }; next(); },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { app } from '../../index';
import { CAR_SEEDS } from '../../services/automotive/automotive-library';
import { createEscrowPayment } from '../../services/stripe-connect.service';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });
const seedCars = () => { store.cars = CAR_SEEDS.slice(0, 12).map((s, i) => ({ id: `car${i}`, ...s, variant: s.variant ?? null, transmission: s.transmission ?? 'AUTOMATIC', seats: s.seats ?? 5, ancapStars: s.ancapStars ?? null, ancapYear: s.ancapYear ?? null, fuelPer100: s.fuelPer100 ?? null, kwhPer100: s.kwhPer100 ?? null, rangeKm: s.rangeKm ?? null, servicingCostYear: s.servicingCostYear ?? null, co2GramsKm: null, sourceUrl: null, asAt: 'test', isActive: true, ratingAvg: 0, ratingCount: 0, reliabilityAvg: 0, createdAt: new Date(), updatedAt: new Date() })); };
const workshop = () => ({ id: 'm1', slug: 'jos-garage', name: "Jo's Garage", ownerUserId: 'mech', headline: 'Women-owned, plain-spoken', about: 'We explain every charge before we touch the car.', womenOwned: true, womenMechanics: true, services: ['logbook', 'brakes', 'pre_purchase'], makes: [], evCapable: false, mobile: false, loanCar: true, afterHours: false, doesInspections: true, languages: ['English'], suburb: 'Annerley', city: 'Brisbane', state: 'QLD', postcode: '4103', address: null, phone: '07 3000 0000', website: null, bookingUrl: null, licenceNumber: null, priceList: [{ kind: 'logbook', from: 299, to: 399 }], labourRateHour: 120, partsWarrantyMonths: 12, labourWarrantyMonths: 6, warrantyNote: null, availability: { '1': [['08:00', '16:00']], '2': [['08:00', '16:00']], '3': [['08:00', '16:00']], '4': [['08:00', '16:00']], '5': [['08:00', '16:00']] }, slotMinutes: 60, acceptsBookings: true, isVerified: true, isActive: true, isFeatured: false, featuredUntil: null, ratingAvg: 0, ratingCount: 0, transparencyAvg: 0, createdAt: new Date(), updatedAt: new Date() });

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
    expect(paid.body.data.status).toBe('PAID_HELD');
    expect(paid.body.data.payment.clientSecret).toContain('_secret');
    expect((createEscrowPayment as jest.Mock).mock.calls[0][0]).toMatchObject({ amount: 2100000, platformFeePercent: 6, sessionType: 'vehicle_purchase' });
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

  it('finds a workshop, books inside its hours, takes a quote line by line, and writes the job into the garage when it is done', async () => {
    const dir = await request(app).get('/api/automotive/mechanics?womenOwned=true&service=logbook').expect(200);
    expect(dir.body.data.mechanics).toHaveLength(1);
    expect(dir.body.data.mechanics[0].price).toMatchObject({ from: 299, own: true });
    const page = await request(app).get('/api/automotive/mechanics/jos-garage').expect(200);
    expect(page.body.data.nextAvailable.length).toBeGreaterThan(0);
    expect(page.body.data.prices.find((p: any) => p.kind === 'brakes').own).toBe(false);
    const day = page.body.data.nextAvailable[0].day;
    const slots = await request(app).get(`/api/automotive/mechanics/m1/slots?day=${day}&service=logbook`).expect(200);
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
    expect(store.mechanics[0].ratingAvg).toBe(5);
    expect(store.mechanics[0].transparencyAvg).toBe(5);
    const ics = await request(app).get(`/api/automotive/bookings/${bid}/ics`).set(as('member')).expect(200);
    expect(ics.text).toContain('BEGIN:VCALENDAR');
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
    expect(car.ratingAvg).toBe(4);
    expect(car.ratingCount).toBe(2);
    const detail = await request(app).get('/api/automotive/catalogue/toyota-rav4-hybrid').set(as('member')).expect(200);
    expect(detail.body.data.womenSay.owners).toBe(1);
    expect(detail.body.data.myReview.rating).toBe(5);
    await request(app).patch(`/api/automotive/reviews/${r.body.data.id}`).set(as('seller')).send({ isHidden: true }).expect(403);
    await request(app).patch(`/api/automotive/reviews/${r.body.data.id}`).set(as('admin', 'ADMIN')).send({ isHidden: true }).expect(200);
    expect(car.ratingCount).toBe(1);
  });

  it('tracks a finance pre-approval from draft to a decision', async () => {
    const draft = await request(app).post('/api/automotive/finance/applications').set(as('member')).send({ purpose: 'USED', vehiclePrice: 25000, deposit: 5000, termMonths: 60, incomeAnnual: 78000, expensesMonthly: 2400, employment: 'FULL_TIME', employmentMonths: 30, residency: 'CITIZEN' }).expect(201);
    expect(draft.body.data.status).toBe('DRAFT');
    expect(draft.body.data.amount).toBe(20000);
    expect(draft.body.data.readinessScore).toBeGreaterThan(60);
    expect(draft.body.data.referenceCode).toMatch(/^CF-/);
    const submitted = await request(app).patch(`/api/automotive/finance/applications/${draft.body.data.id}`).set(as('member')).send({ deposit: 6000, submit: true }).expect(200);
    expect(submitted.body.data.status).toBe('SUBMITTED');
    expect(submitted.body.data.amount).toBe(19000);
    expect(submitted.body.data.timeline).toHaveLength(2);
    await request(app).patch(`/api/automotive/finance/applications/${draft.body.data.id}`).set(as('member')).send({ deposit: 7000 }).expect(400);
    const decided = await request(app).patch(`/api/automotive/admin/finance/${draft.body.data.id}`).set(as('admin', 'ADMIN')).send({ status: 'PRE_APPROVED', lender: 'Panel lender', ratePct: 8.49, expiresInDays: 60 }).expect(200);
    expect(decided.body.data.status).toBe('PRE_APPROVED');
    expect(decided.body.data.expiresAt).toBeTruthy();
    expect(store.notifications.some((n) => n.userId === 'member' && n.data.kind === 'CAR_FINANCE_STATUS')).toBe(true);
    // The lender's fee is owed once the loan settles; the pre-approval puts it on the ledger as pending.
    expect(store.referrals).toHaveLength(1);
    expect(store.referrals[0]).toMatchObject({ kind: 'FINANCE', status: 'PENDING', fee: 190, partner: 'Panel lender', referenceId: draft.body.data.id });
    const overview = await request(app).get('/api/automotive/overview').set(as('member')).expect(200);
    expect(overview.body.data.applications).toHaveLength(1);
    expect(overview.body.data.roles.isMechanic).toBe(false);
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
});
