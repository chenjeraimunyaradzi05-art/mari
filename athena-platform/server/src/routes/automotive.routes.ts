/**
 * The automotive routes: the new-car catalogue with reviews from women and
 * spec-by-spec comparison; the finance, insurance and valuation
 * calculators; the garage with service history and reminders; the
 * pre-loved listings with price guides, checks, inspections and a
 * purchase held under buyer protection; the mechanic directory with
 * bookings, quotes, payment and verified reviews; dealerships with test
 * drives and trade-in quotes; finance pre-approval; and the admin queues.
 *
 * Browsing is open: the catalogue, the calculators, the listings, the
 * workshops and the dealerships can all be read before anyone signs up.
 * Anything that writes, pays, or belongs to a member needs a session.
 *
 * Money: a purchase, a paid inspection and a workshop job use the same
 * escrow as the rest of the platform (a hold on the buyer's card, captured
 * on release, cancelled or refunded otherwise). A card authorisation lasts
 * about a week with a live processor; the fourteen-day inspection period
 * therefore assumes the hold is re-authorised or converted to a captured
 * balance before that. The mock processor used until keys are configured
 * has no such limit.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Prisma, type CarModel, type Mechanic, type Dealership, type Vehicle, type CarFinanceApplication } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { logger } from '../utils/logger';
import { cancelEscrowPayment, captureEscrowPayment, createEscrowPayment, getEscrowClientSecret } from '../services/stripe-connect.service';
import { availableSlots, canCancel, nextAvailableDays, normaliseAvailability, slugify, type Availability } from '../services/wellness/practitioners.service';
import { buildBookingIcs } from '../services/wellness/wellness-calendar';
import { addDays, dayDate, localParts } from '../services/wellness/wellness-dates';
import {
  ANCAP_EXPLAINED, AUTOMOTIVE_AS_AT, AU_STATES, BODY_TYPES, BUYER_PROTECTION, CAR_CONDITIONS, CATALOGUE_AS_AT, CLAIMS_GUIDE, COVER_TYPES, EMPLOYMENT_KINDS, FINANCE_GLOSSARY, FRAUD_SIGNS, FUEL_TYPES,
  EXTENDED_WARRANTY, FLEET_PROGRAMME, INSPECTION_SECTIONS, LENDER_CHECKS, LOW_EMISSIONS_G_KM, MAINTENANCE_GUIDE, MAKES, PREMIUM_FACTORS, REFERRAL_FEES, SAFETY_FEATURES, SERVICE_KINDS, SOURCES, TRANSMISSIONS, WOMEN_AND_INSURANCE, ancapStatus, bodyLabel, co2ForCar, fuelLabel, serviceKind,
  type AuState, type BodyKey, type FuelKey,
} from '../services/automotive/automotive-library';
import { assessAffordability, assessReadiness, calculateRepayment, compareCarLoans, costOfOwnership, financeReference, monthlyPayment } from '../services/automotive/car-finance.service';
import { benchmarkPrice, estimateValue, upgradePath } from '../services/automotive/valuation.service';
import { compareInsuranceQuotes, estimatePremium, insuranceReference } from '../services/automotive/car-insurance.service';
import { REFERRAL_KIND_WORDS, referralFee, summariseReferrals, type ReferralKind } from '../services/automotive/referrals.service';
import {
  DEFAULT_INSPECTION_FEE, INSPECTION_FEE_PERCENT, PURCHASE_FEE_PERCENT, SERVICE_FEE_PERCENT, assessListingRisk, emptyInspectionReport, historyChecks, inspectionDays, inspectionEnds, inspectionOutcome, isValidVin, maskRego, maskVin,
  normaliseInspectionReport, purchaseFee, purchaseTransition, withinInspection, type Party, type PurchaseStatus,
} from '../services/automotive/marketplace.service';
import {
  bookingMinutes, nextServiceAfter, normaliseParts, normalisePriceList, normaliseQuoteLines, priceFor, projectedOdometer, quoteTotal, recomputeCarRating, recomputeMechanicRating, vehicleName, vehicleReminders,
} from '../services/automotive/garage.service';

const router = Router();

// ------------------------------------------------------------------ helpers

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
  }
  return parsed.data;
}

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const n = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));
const num0 = (d: unknown): number => Number(d) || 0;
const uuid = z.string().uuid();
const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a day as YYYY-MM-DD');
const bodyEnum = z.enum(['HATCH', 'SEDAN', 'WAGON', 'SUV', 'UTE', 'VAN', 'PEOPLE_MOVER', 'COUPE', 'CONVERTIBLE']);
const fuelEnum = z.enum(['PETROL', 'DIESEL', 'HYBRID', 'PLUG_IN_HYBRID', 'ELECTRIC']);
const transmissionEnum = z.enum(['AUTOMATIC', 'MANUAL']);
const stateEnum = z.enum(['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT']);
const conditionEnum = z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']);
const money = z.coerce.number().min(0).max(5_000_000);
const q = (req: AuthRequest, key: string): string | undefined => (typeof req.query[key] === 'string' && (req.query[key] as string).trim() ? (req.query[key] as string).trim() : undefined);
const qBool = (req: AuthRequest, key: string): boolean => req.query[key] === 'true' || req.query[key] === '1';
const qNum = (req: AuthRequest, key: string): number | undefined => { const v = Number(req.query[key]); return typeof req.query[key] === 'string' && Number.isFinite(v) ? v : undefined; };
const page = (req: AuthRequest) => Math.max(1, Math.floor(qNum(req, 'page') ?? 1));
const isAdmin = (req: AuthRequest) => req.user?.role === 'ADMIN';
const clientBase = () => (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

async function memberTimezone(userId: string | null | undefined): Promise<string> {
  if (!userId) return 'Australia/Brisbane';
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone || 'Australia/Brisbane';
}

async function note(userId: string, title: string, message: string, link: string, data: Record<string, unknown>): Promise<void> {
  await prisma.notification.create({ data: { userId, type: 'SYSTEM', title, message, link, data: data as Prisma.InputJsonValue } }).catch(() => null);
}

async function noteAdmins(title: string, message: string, link: string, data: Record<string, unknown>): Promise<void> {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 5 }).catch(() => []);
  await Promise.all(admins.map((a) => note(a.id, title, message, link, data)));
}

const personName = (u: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null | undefined, fallback = 'A member') => u?.displayName?.trim() || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || fallback;
const shortName = (u: { firstName?: string | null; lastName?: string | null } | null | undefined) => [u?.firstName, u?.lastName ? `${u.lastName[0]}.` : null].filter(Boolean).join(' ') || 'A member';
const photosOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string').slice(0, 20) : []);
const warrantyWords = (years: number | null, km: number | null) => (years ? `${years} year${years === 1 ? '' : 's'}, ${km ? `${km.toLocaleString('en-AU')} km` : 'unlimited km'}` : null);

// -------------------------------------------------------------- presenters

type CarRow = CarModel;

function carCard(c: CarRow, now = new Date()) {
  const fuel = c.fuelType as FuelKey;
  const co2 = co2ForCar(c.fuelType, n(c.fuelPer100), c.co2GramsKm);
  const energy = fuel === 'ELECTRIC' ? (c.kwhPer100 ? `${Number(c.kwhPer100)} kWh/100 km${c.rangeKm ? `, ${c.rangeKm} km range` : ''}` : c.rangeKm ? `${c.rangeKm} km range` : null) : fuel === 'PLUG_IN_HYBRID' ? `${c.rangeKm ?? '?'} km electric, then ${n(c.fuelPer100) ?? '?'} L/100 km` : c.fuelPer100 ? `${Number(c.fuelPer100)} L/100 km` : null;
  return {
    id: c.id, slug: c.slug, make: c.make, model: c.model, variant: c.variant, year: c.year, bodyType: c.bodyType, bodyLabel: bodyLabel(c.bodyType), fuelType: c.fuelType, fuelLabel: fuelLabel(c.fuelType), transmission: c.transmission, seats: c.seats,
    priceFrom: c.priceFrom, ancapStars: c.ancapStars, ancapYear: c.ancapYear, ancap: ancapStatus(c.ancapStars, c.ancapYear, now), fuelPer100: n(c.fuelPer100), kwhPer100: n(c.kwhPer100), rangeKm: c.rangeKm, energy,
    warrantyYears: c.warrantyYears, warrantyKm: c.warrantyKm, warranty: warrantyWords(c.warrantyYears, c.warrantyKm), serviceIntervalMonths: c.serviceIntervalMonths, serviceIntervalKm: c.serviceIntervalKm, servicingCostYear: c.servicingCostYear,
    safetyFeatures: c.safetyFeatures, highlights: c.highlights, asAt: c.asAt, ratingAvg: num0(c.ratingAvg), ratingCount: c.ratingCount, reliabilityAvg: num0(c.reliabilityAvg),
    co2GramsKm: co2.gramsKm, emissions: co2.label,
  };
}

/** Energy and servicing for a year at 15,000 km: the quick "what it costs to run" line on a card. */
function quickRunning(c: CarRow): number {
  const r = costOfOwnership({ price: c.priceFrom, fuelType: c.fuelType as FuelKey, bodyType: c.bodyType as BodyKey, fuelPer100: n(c.fuelPer100), kwhPer100: n(c.kwhPer100), servicingYear: c.servicingCostYear, insuranceAnnual: 0, years: 1 });
  return r.totals.energy + r.totals.servicing;
}

type MechanicRow = Mechanic;

function mechanicCard(m: MechanicRow) {
  return {
    id: m.id, slug: m.slug, name: m.name, headline: m.headline, womenOwned: m.womenOwned, womenMechanics: m.womenMechanics, services: m.services, serviceLabels: m.services.map((s) => serviceKind(s)?.label ?? s), makes: m.makes, evCapable: m.evCapable, mobile: m.mobile, loanCar: m.loanCar, afterHours: m.afterHours, doesInspections: m.doesInspections, languages: m.languages,
    suburb: m.suburb, city: m.city, state: m.state, postcode: m.postcode, phone: m.phone, website: m.website, bookingUrl: m.bookingUrl, labourRateHour: m.labourRateHour, partsWarrantyMonths: m.partsWarrantyMonths, labourWarrantyMonths: m.labourWarrantyMonths, warrantyNote: m.warrantyNote,
    slotMinutes: m.slotMinutes, acceptsBookings: m.acceptsBookings, isVerified: m.isVerified, isFeatured: m.isFeatured, ratingAvg: num0(m.ratingAvg), ratingCount: m.ratingCount, transparencyAvg: num0(m.transparencyAvg),
    contactUserId: m.ownerUserId,
  };
}

type DealershipRow = Dealership;

function dealershipCard(d: DealershipRow) {
  return { id: d.id, slug: d.slug, name: d.name, headline: d.headline, brands: d.brands, suburb: d.suburb, city: d.city, state: d.state, postcode: d.postcode, address: d.address, phone: d.phone, website: d.website, womenLed: d.womenLed, financeAvailable: d.financeAvailable, financePartners: d.financePartners, hours: d.hours, isVerified: d.isVerified, isFeatured: d.isFeatured, ratingAvg: num0(d.ratingAvg), ratingCount: d.ratingCount, contactUserId: d.ownerUserId };
}

type ListingRow = Prisma.VehicleListingGetPayload<{ include: { seller: { select: { id: true; firstName: true; lastName: true; displayName: true; createdAt: true } }; dealership: true } }>;

function listingCard(l: ListingRow, opts: { full?: boolean; viewerId?: string | null; admin?: boolean } = {}) {
  const owner = Boolean(opts.viewerId && opts.viewerId === l.sellerId) || Boolean(opts.admin);
  return {
    id: l.id, title: l.title, make: l.make, model: l.model, year: l.year, variant: l.variant, bodyType: l.bodyType, bodyLabel: bodyLabel(l.bodyType), fuelType: l.fuelType, fuelLabel: fuelLabel(l.fuelType), transmission: l.transmission, odometerKm: l.odometerKm, price: l.price,
    priceGuideLow: l.priceGuideLow, priceGuideHigh: l.priceGuideHigh, priceVerdict: l.priceVerdict, colour: l.colour, seats: l.seats, photos: photosOf(l.photos), videoUrl: l.videoUrl, suburb: l.suburb, city: l.city, state: l.state, postcode: l.postcode,
    sellerKind: l.sellerKind, serviceHistory: l.serviceHistory, accidentHistory: l.accidentHistory, ownersCount: l.ownersCount, ppsrChecked: l.ppsrChecked, roadworthy: l.roadworthy, warranty: l.warranty, warrantyNote: l.warrantyNote, regoExpires: l.regoExpires ? l.regoExpires.toISOString().slice(0, 10) : null,
    status: l.status, isFeatured: l.isFeatured, viewCount: l.viewCount, saveCount: l.saveCount, createdAt: l.createdAt, soldAt: l.soldAt,
    vin: owner ? l.vin : maskVin(l.vin), rego: owner ? l.rego : maskRego(l.rego), hasVin: isValidVin(l.vin),
    seller: { id: l.seller.id, name: l.sellerKind === 'DEALER' && l.dealership ? l.dealership.name : shortName(l.seller), memberSince: l.seller.createdAt },
    dealership: l.dealership ? dealershipCard(l.dealership) : null,
    ...(opts.full ? { description: l.description, features: l.features, ppsrCertificateUrl: l.ppsrCertificateUrl, riskFlags: owner ? l.riskFlags : undefined, riskScore: owner ? l.riskScore : undefined, suspendedReason: owner ? l.suspendedReason : undefined } : {}),
  };
}

type VehicleRow = Vehicle;

function vehicleCard(v: VehicleRow, now = new Date()) {
  const valuation = estimateValue({ year: v.year, odometerKm: projectedOdometer(v, now) ?? 0, bodyType: v.bodyType as BodyKey | null, fuelType: v.fuelType as FuelKey, newPrice: v.newPrice ?? (v.boughtNew ? v.purchasePrice : null), make: v.make, now });
  const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);
  return {
    id: v.id, name: vehicleName(v), nickname: v.nickname, make: v.make, model: v.model, year: v.year, variant: v.variant, bodyType: v.bodyType, fuelType: v.fuelType, fuelLabel: fuelLabel(v.fuelType), colour: v.colour, rego: v.rego, regoState: v.regoState, vin: v.vin,
    odometerKm: v.odometerKm, odometerAt: v.odometerAt, odometerNow: projectedOdometer(v, now), kmPerYear: v.kmPerYear, purchasePrice: v.purchasePrice, purchasedAt: d(v.purchasedAt), boughtNew: v.boughtNew, newPrice: v.newPrice,
    warrantyEndsAt: d(v.warrantyEndsAt), warrantyEndsKm: v.warrantyEndsKm, regoDueAt: d(v.regoDueAt), insuranceRenewsAt: d(v.insuranceRenewsAt), insurer: v.insurer, insurancePremium: v.insurancePremium,
    nextServiceDueAt: d(v.nextServiceDueAt), nextServiceDueKm: v.nextServiceDueKm, serviceIntervalMonths: v.serviceIntervalMonths, serviceIntervalKm: v.serviceIntervalKm, notes: v.notes, carModelId: v.carModelId,
    reminders: vehicleReminders(v, now), valuation: { low: valuation.low, mid: valuation.mid, high: valuation.high, tradeIn: valuation.tradeIn, assumed: valuation.newPriceAssumed },
  };
}

type PurchaseRow = Prisma.VehiclePurchaseGetPayload<{ include: { listing: { include: { seller: { select: { id: true; firstName: true; lastName: true; displayName: true; createdAt: true } }; dealership: true } }; buyer: { select: { id: true; firstName: true; lastName: true; displayName: true; email: true } }; seller: { select: { id: true; firstName: true; lastName: true; displayName: true; email: true } }; escrow: { select: { status: true; paymentIntentId: true; amount: true; platformFee: true } } } }>;

function purchaseCard(p: PurchaseRow, viewerId: string, admin = false, now = new Date()) {
  const role: Party = admin && p.buyerId !== viewerId && p.sellerId !== viewerId ? 'admin' : p.buyerId === viewerId ? 'buyer' : p.sellerId === viewerId ? 'seller' : 'other';
  const daysLeft = p.inspectionEndsAt ? Math.max(0, Math.ceil((p.inspectionEndsAt.getTime() - now.getTime()) / 86400000)) : null;
  const next: Record<PurchaseStatus, { buyer: string; seller: string }> = {
    OFFERED: { buyer: 'Waiting for the seller to accept or decline.', seller: 'Accept the offer to agree the price, or decline it.' },
    ACCEPTED: { buyer: 'Pay through ATHENA. The money is held, not sent, until you have the car.', seller: 'Waiting for the buyer to pay. Nothing changes hands until the money is held.' },
    PAID_HELD: { buyer: 'The money is held. Arrange the handover, check the papers, then confirm you have the car.', seller: 'The money is held. Hand the car over with the papers; the buyer confirms receipt and the inspection period starts.' },
    HANDED_OVER: { buyer: `${daysLeft} day${daysLeft === 1 ? '' : 's'} to check the car. Release the money when you are satisfied, or open a dispute if it is not as described.`, seller: `The buyer has ${daysLeft} day${daysLeft === 1 ? '' : 's'} to check the car. The money is released to you when the period ends or sooner.` },
    RELEASED: { buyer: 'Done. Leave a word for the next buyer.', seller: 'The money has been released to your payout account.' },
    DISPUTED: { buyer: 'ATHENA is reviewing the dispute. Add anything useful to the conversation.', seller: 'The buyer has opened a dispute. ATHENA will ask both of you for the facts and decide.' },
    REFUNDED: { buyer: 'The money has gone back to your card.', seller: 'The dispute was decided for the buyer and the money returned.' },
    DECLINED: { buyer: 'The seller declined. You can make another offer.', seller: 'You declined this offer.' },
    CANCELLED: { buyer: 'Cancelled. Any held money has gone back to your card.', seller: 'Cancelled.' },
  };
  return {
    id: p.id, status: p.status, role, offerAmount: p.offerAmount, agreedAmount: p.agreedAmount, platformFee: p.platformFee, message: p.message, sellerMessage: p.sellerMessage, paidAt: p.paidAt, handedOverAt: p.handedOverAt, inspectionEndsAt: p.inspectionEndsAt, daysLeft,
    releasedAt: p.releasedAt, disputeReason: p.disputeReason, disputeOpenedAt: p.disputeOpenedAt, disputeResolution: p.disputeResolution, resolvedAt: p.resolvedAt, transferNote: p.transferNote, cancelledAt: p.cancelledAt, cancelReason: p.cancelReason, reviewRating: p.reviewRating, reviewComment: p.reviewComment, createdAt: p.createdAt,
    escrow: p.escrow ? { status: p.escrow.status, amount: p.escrow.amount, platformFee: p.escrow.platformFee } : null,
    listing: listingCard(p.listing, { viewerId, admin }),
    buyer: { id: p.buyer.id, name: role === 'buyer' ? 'You' : personName(p.buyer), email: role === 'seller' && ['PAID_HELD', 'HANDED_OVER', 'RELEASED', 'DISPUTED'].includes(p.status) ? p.buyer.email : undefined },
    seller: { id: p.seller.id, name: role === 'seller' ? 'You' : personName(p.seller), email: role === 'buyer' && ['ACCEPTED', 'PAID_HELD', 'HANDED_OVER', 'RELEASED', 'DISPUTED'].includes(p.status) ? p.seller.email : undefined },
    nextStep: role === 'seller' ? next[p.status as PurchaseStatus].seller : next[p.status as PurchaseStatus].buyer,
    inspectionDays: inspectionDays(),
  };
}

type BookingRow = Prisma.MechanicBookingGetPayload<{ include: { mechanic: { select: { id: true; slug: true; name: true; suburb: true; city: true; state: true; phone: true; ownerUserId: true; partsWarrantyMonths: true; labourWarrantyMonths: true } }; vehicle: { select: { id: true; nickname: true; make: true; model: true; year: true } }; review: { select: { rating: true; transparency: true } }; escrow: { select: { status: true } } } }>;

function bookingCard(b: BookingRow, forWorkshop = false) {
  const lines = normaliseQuoteLines(b.quoteLines);
  return {
    id: b.id, kind: b.kind, kindLabel: serviceKind(b.kind)?.label ?? b.kind, scheduledAt: b.scheduledAt, durationMinutes: b.durationMinutes, dropOff: b.dropOff, address: forWorkshop ? b.address : b.address, concern: b.concern, odometerKm: b.odometerKm, status: b.status,
    quoteAmount: b.quoteAmount, quoteLines: lines, quoteTotals: quoteTotal(lines), quoteNote: b.quoteNote, quotedAt: b.quotedAt, quoteAcceptedAt: b.quoteAcceptedAt, partsRequested: normaliseParts(b.partsRequested), finalAmount: b.finalAmount, paidAt: b.paidAt, escrowStatus: b.escrow?.status ?? null,
    workshopNote: b.workshopNote, completedAt: b.completedAt, partsWarrantyMonths: b.partsWarrantyMonths ?? b.mechanic.partsWarrantyMonths, labourWarrantyMonths: b.labourWarrantyMonths ?? b.mechanic.labourWarrantyMonths, cancelReason: b.cancelReason, createdAt: b.createdAt,
    mechanic: { id: b.mechanic.id, slug: b.mechanic.slug, name: b.mechanic.name, place: [b.mechanic.suburb || b.mechanic.city, b.mechanic.state].filter(Boolean).join(', '), phone: b.mechanic.phone, takesPayment: Boolean(b.mechanic.ownerUserId) },
    vehicle: b.vehicle ? { id: b.vehicle.id, name: vehicleName(b.vehicle) } : null,
    reviewed: Boolean(b.review), canCancel: ['REQUESTED', 'QUOTED', 'CONFIRMED'].includes(b.status) && canCancel(b.scheduledAt),
  };
}

const bookingInclude = { mechanic: { select: { id: true, slug: true, name: true, suburb: true, city: true, state: true, phone: true, ownerUserId: true, partsWarrantyMonths: true, labourWarrantyMonths: true } }, vehicle: { select: { id: true, nickname: true, make: true, model: true, year: true } }, review: { select: { rating: true, transparency: true } }, escrow: { select: { status: true } } } as const;
const listingInclude = { seller: { select: { id: true, firstName: true, lastName: true, displayName: true, createdAt: true } }, dealership: true } as const;
const purchaseInclude = { listing: { include: listingInclude }, buyer: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } }, seller: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } }, escrow: { select: { status: true, paymentIntentId: true, amount: true, platformFee: true } } } as const;

const referralKindEnum = z.enum(['DEALER_SALE', 'FINANCE', 'INSURANCE', 'WARRANTY', 'PARTS', 'FLEET']);
const referralInclude = { user: { select: { firstName: true, lastName: true, displayName: true, email: true } }, dealership: { select: { name: true, slug: true } } } as const;
type ReferralRow = Prisma.CarReferralGetPayload<{ include: typeof referralInclude }>;
const referralCard = (r: ReferralRow) => ({ id: r.id, kind: r.kind, kindLabel: REFERRAL_KIND_WORDS[r.kind as ReferralKind], status: r.status, partner: r.partner ?? r.dealership?.name ?? null, dealership: r.dealership, member: r.user ? { name: personName(r.user), email: r.user.email } : null, referenceId: r.referenceId, basisAmount: r.basisAmount, feePercent: num0(r.feePercent), fee: r.fee, note: r.note, confirmedAt: r.confirmedAt, paidAt: r.paidAt, createdAt: r.createdAt });

// ---------------------------------------------------------------- reference

router.get('/reference', (_req, res) => {
  ok(res, {
    asAt: AUTOMOTIVE_AS_AT, catalogueAsAt: CATALOGUE_AS_AT, states: AU_STATES, bodyTypes: BODY_TYPES, fuelTypes: FUEL_TYPES, transmissions: TRANSMISSIONS, makes: MAKES, conditions: CAR_CONDITIONS,
    safetyFeatures: SAFETY_FEATURES, ancap: ANCAP_EXPLAINED, maintenance: MAINTENANCE_GUIDE, serviceKinds: SERVICE_KINDS, inspectionSections: INSPECTION_SECTIONS, buyerProtection: { ...BUYER_PROTECTION, inspectionDays: inspectionDays() }, fraudSigns: FRAUD_SIGNS,
    finance: { ...financeReference(), glossary: FINANCE_GLOSSARY, lenderChecks: LENDER_CHECKS, employment: EMPLOYMENT_KINDS }, insurance: { ...insuranceReference(), coverTypes: COVER_TYPES, factors: PREMIUM_FACTORS, claims: CLAIMS_GUIDE, women: WOMEN_AND_INSURANCE }, sources: SOURCES,
    warranty: EXTENDED_WARRANTY, fleet: FLEET_PROGRAMME, referralFees: REFERRAL_FEES,
    fees: { purchasePercent: PURCHASE_FEE_PERCENT, servicePercent: SERVICE_FEE_PERCENT, inspectionPercent: INSPECTION_FEE_PERCENT, inspectionFee: DEFAULT_INSPECTION_FEE },
  });
});

// ---------------------------------------------------------------- catalogue

router.get('/catalogue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.CarModelWhereInput = { isActive: true };
    const search = q(req, 'q');
    if (search) where.OR = [{ make: { contains: search, mode: 'insensitive' } }, { model: { contains: search, mode: 'insensitive' } }, { variant: { contains: search, mode: 'insensitive' } }];
    if (q(req, 'make')) where.make = { equals: q(req, 'make'), mode: 'insensitive' };
    if (q(req, 'bodyType')) where.bodyType = q(req, 'bodyType') as never;
    if (q(req, 'fuelType')) where.fuelType = q(req, 'fuelType') as never;
    if (qBool(req, 'electrified')) where.fuelType = { in: ['HYBRID', 'PLUG_IN_HYBRID', 'ELECTRIC'] };
    if (qNum(req, 'maxPrice')) where.priceFrom = { lte: qNum(req, 'maxPrice') };
    if (qBool(req, 'sevenSeats')) where.seats = { gte: 7 };
    const rows = await prisma.carModel.findMany({ where, orderBy: [{ make: 'asc' }, { model: 'asc' }] });
    const now = new Date();
    const minStars = qNum(req, 'minStars');
    let cars = rows.map((c) => ({ ...carCard(c, now), runningCostYear: quickRunning(c) }));
    if (minStars) cars = cars.filter((c) => c.ancap.status === 'current' && (c.ancapStars ?? 0) >= minStars);
    if (qBool(req, 'currentRating')) cars = cars.filter((c) => c.ancap.status === 'current');
    const sort = q(req, 'sort') ?? 'name';
    const eff = (c: (typeof cars)[number]) => (c.fuelType === 'ELECTRIC' ? (c.kwhPer100 ?? 99) / 4 : c.fuelType === 'PLUG_IN_HYBRID' ? 2 : c.fuelPer100 ?? 99);
    if (sort === 'price') cars.sort((a, b) => a.priceFrom - b.priceFrom);
    else if (sort === 'running') cars.sort((a, b) => a.runningCostYear - b.runningCostYear);
    else if (sort === 'efficiency') cars.sort((a, b) => eff(a) - eff(b));
    else if (sort === 'safety') cars.sort((a, b) => (b.ancap.status === 'current' ? b.ancapStars ?? 0 : -1) - (a.ancap.status === 'current' ? a.ancapStars ?? 0 : -1) || (b.ancapYear ?? 0) - (a.ancapYear ?? 0));
    else if (sort === 'rating') cars.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
    else if (sort === 'reliability') cars.sort((a, b) => b.reliabilityAvg - a.reliabilityAvg || b.ratingCount - a.ratingCount);
    else if (sort === 'emissions') cars.sort((a, b) => (a.co2GramsKm ?? 999) - (b.co2GramsKm ?? 999));
    if (qBool(req, 'lowEmissions')) cars = cars.filter((c) => c.co2GramsKm !== null && c.co2GramsKm <= LOW_EMISSIONS_G_KM);
    const makes = [...new Set(rows.map((r) => r.make))].sort();
    ok(res, { cars, total: cars.length, makes, asAt: CATALOGUE_AS_AT });
  } catch (error) { next(error); }
});

router.get('/catalogue/compare', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const slugs = (q(req, 'slugs') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (slugs.length < 2) throw new ApiError(400, 'Pick at least two cars to compare');
    const rows = await prisma.carModel.findMany({ where: { slug: { in: slugs }, isActive: true } });
    const cars = slugs.map((s) => rows.find((r) => r.slug === s)).filter((r): r is CarRow => Boolean(r)).map((c) => ({ ...carCard(c), ownership: costOfOwnership({ price: c.priceFrom, fuelType: c.fuelType as FuelKey, bodyType: c.bodyType as BodyKey, fuelPer100: n(c.fuelPer100), kwhPer100: n(c.kwhPer100), servicingYear: c.servicingCostYear, years: 5 }).totals, repayment: calculateRepayment({ amount: c.priceFrom * 0.9, ratePct: financeReference().defaults.newCarSecured.typical, termMonths: 60 }).repayment }));
    const rows2 = [
      { key: 'price', label: 'From (before on-roads)', values: cars.map((c) => `$${c.priceFrom.toLocaleString('en-AU')}`) },
      { key: 'ancap', label: 'ANCAP', values: cars.map((c) => c.ancap.label) },
      { key: 'body', label: 'Body and seats', values: cars.map((c) => `${c.bodyLabel}, ${c.seats} seats`) },
      { key: 'fuel', label: 'Fuel', values: cars.map((c) => c.fuelLabel) },
      { key: 'energy', label: 'Consumption', values: cars.map((c) => c.energy ?? 'Not published') },
      { key: 'emissions', label: 'Tailpipe CO2', values: cars.map((c) => (c.co2GramsKm === null ? 'Not published' : `${c.co2GramsKm} g/km`)) },
      { key: 'warranty', label: 'Warranty', values: cars.map((c) => c.warranty ?? '') },
      { key: 'service', label: 'Service interval', values: cars.map((c) => `${c.serviceIntervalMonths} months / ${(c.serviceIntervalKm ?? 0).toLocaleString('en-AU')} km`) },
      { key: 'servicing', label: 'Servicing a year (typical)', values: cars.map((c) => (c.servicingCostYear ? `$${c.servicingCostYear}` : 'Ask')) },
      { key: 'running5', label: 'Five years of running costs', values: cars.map((c) => `$${c.ownership.total.toLocaleString('en-AU')} ($${c.ownership.perWeek} a week)`) },
      { key: 'depreciation5', label: 'Value lost in five years', values: cars.map((c) => `$${c.ownership.depreciation.toLocaleString('en-AU')}`) },
      { key: 'repayment', label: 'Repayment, 10% deposit over 5 years', values: cars.map((c) => `$${Math.round(c.repayment)} a month`) },
      { key: 'women', label: 'Women who own one say', values: cars.map((c) => (c.ratingCount ? `${c.ratingAvg} of 5 from ${c.ratingCount}, reliability ${c.reliabilityAvg}` : 'No reviews yet')) },
      { key: 'safety', label: 'Safety features (typical)', values: cars.map((c) => `${c.safetyFeatures.length} of ${SAFETY_FEATURES.length}`) },
    ];
    const featureRows = SAFETY_FEATURES.map((f) => ({ key: `f_${f.key}`, label: f.name, values: cars.map((c) => (c.safetyFeatures.includes(f.key) ? 'Yes' : 'Check')) }));
    ok(res, { cars, rows: rows2, features: featureRows });
  } catch (error) { next(error); }
});

async function loadCar(slug: string) {
  const c = await prisma.carModel.findFirst({ where: { OR: [{ slug }, { id: slug }], isActive: true } });
  if (!c) throw new ApiError(404, 'That car is not in the catalogue');
  return c;
}

router.get('/catalogue/:slug', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const c = await loadCar(req.params.slug);
    const state = (q(req, 'state') as AuState | undefined) ?? 'QLD';
    const [reviews, similar, dealerships, mine] = await Promise.all([
      prisma.carReview.findMany({ where: { carModelId: c.id, ...(isAdmin(req) ? {} : { isHidden: false }) }, orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }], take: 50, include: { user: { select: { firstName: true, lastName: true } } } }),
      prisma.carModel.findMany({ where: { isActive: true, id: { not: c.id }, bodyType: c.bodyType, priceFrom: { gte: c.priceFrom * 0.75, lte: c.priceFrom * 1.25 } }, take: 4, orderBy: { priceFrom: 'asc' } }),
      prisma.dealership.findMany({ where: { isActive: true, isVerified: true, brands: { has: c.make } }, take: 6, orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }] }),
      req.user ? prisma.carReview.findUnique({ where: { carModelId_userId: { carModelId: c.id, userId: req.user.id } } }) : null,
    ]);
    const ownership = costOfOwnership({ price: c.priceFrom, fuelType: c.fuelType as FuelKey, bodyType: c.bodyType as BodyKey, fuelPer100: n(c.fuelPer100), kwhPer100: n(c.kwhPer100), servicingYear: c.servicingCostYear, years: 5, state });
    const repayment = calculateRepayment({ amount: Math.round(c.priceFrom * 0.9), ratePct: financeReference().defaults.newCarSecured.typical, termMonths: 60 });
    const insurance = estimatePremium({ vehicleValue: c.priceFrom, driverAge: 35, state, fuelType: c.fuelType as FuelKey, vehicleAgeYears: 0 });
    ok(res, {
      ...carCard(c), safety: SAFETY_FEATURES.map((f) => ({ ...f, fitted: c.safetyFeatures.includes(f.key) })),
      reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, reliability: r.reliability, safetyFeel: r.safetyFeel, runningCosts: r.runningCosts, title: r.title, body: r.body, ownedMonths: r.ownedMonths, videoUrl: r.videoUrl, isOwner: r.isOwner, isHidden: r.isHidden, helpfulCount: r.helpfulCount, by: shortName(r.user), createdAt: r.createdAt, isYou: r.userId === req.user?.id })),
      womenSay: reviews.filter((r) => !r.isHidden).length ? { rating: num0(c.ratingAvg), reliability: num0(c.reliabilityAvg), safetyFeel: Math.round(reviews.reduce((s, r) => s + r.safetyFeel, 0) / reviews.length * 10) / 10, runningCosts: Math.round(reviews.reduce((s, r) => s + r.runningCosts, 0) / reviews.length * 10) / 10, count: reviews.filter((r) => !r.isHidden).length, owners: reviews.filter((r) => r.isOwner && !r.isHidden).length } : null,
      myReview: mine ? { id: mine.id, rating: mine.rating } : null,
      ownership: { totals: ownership.totals, years: ownership.years, assumptions: ownership.assumptions },
      finance: { repayment: repayment.repayment, deposit: Math.round(c.priceFrom * 0.1), amount: Math.round(c.priceFrom * 0.9), ratePct: financeReference().defaults.newCarSecured.typical, termMonths: 60, totalInterest: repayment.totalInterest },
      insurance: { comprehensive: insurance.covers[0].annual, low: insurance.covers[0].annualLow, high: insurance.covers[0].annualHigh, state },
      similar: similar.map((s) => carCard(s)), dealerships: dealerships.map(dealershipCard), canReview: Boolean(req.user), canModerate: isAdmin(req),
    });
  } catch (error) { next(error); }
});

router.get('/catalogue/:slug/reviews', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const c = await loadCar(req.params.slug);
    const p = page(req);
    const [rows, total] = await Promise.all([
      prisma.carReview.findMany({ where: { carModelId: c.id, isHidden: false }, orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }], skip: (p - 1) * 20, take: 20, include: { user: { select: { firstName: true, lastName: true } } } }),
      prisma.carReview.count({ where: { carModelId: c.id, isHidden: false } }),
    ]);
    ok(res, { reviews: rows.map((r) => ({ id: r.id, rating: r.rating, reliability: r.reliability, safetyFeel: r.safetyFeel, runningCosts: r.runningCosts, title: r.title, body: r.body, ownedMonths: r.ownedMonths, videoUrl: r.videoUrl, isOwner: r.isOwner, helpfulCount: r.helpfulCount, by: shortName(r.user), createdAt: r.createdAt })), total, page: p });
  } catch (error) { next(error); }
});

const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), reliability: z.coerce.number().int().min(1).max(5), safetyFeel: z.coerce.number().int().min(1).max(5), runningCosts: z.coerce.number().int().min(1).max(5), title: z.string().trim().min(3).max(120), body: z.string().trim().min(20).max(4000), ownedMonths: z.coerce.number().int().min(0).max(600).nullable().optional(), videoUrl: z.string().url().max(300).nullable().optional() });

router.post('/catalogue/:slug/reviews', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const c = await loadCar(req.params.slug);
    const data = parse(reviewSchema, req.body);
    const owned = await prisma.vehicle.findFirst({ where: { userId: req.user!.id, isActive: true, make: { equals: c.make, mode: 'insensitive' }, model: { equals: c.model, mode: 'insensitive' } }, select: { id: true } });
    const review = await prisma.carReview.upsert({
      where: { carModelId_userId: { carModelId: c.id, userId: req.user!.id } },
      create: { carModelId: c.id, userId: req.user!.id, ...data, ownedMonths: data.ownedMonths ?? null, videoUrl: data.videoUrl ?? null, isOwner: Boolean(owned) },
      update: { ...data, ownedMonths: data.ownedMonths ?? null, videoUrl: data.videoUrl ?? null, isOwner: Boolean(owned), isHidden: false },
    });
    const all = await prisma.carReview.findMany({ where: { carModelId: c.id }, select: { rating: true, reliability: true, isHidden: true } });
    await prisma.carModel.update({ where: { id: c.id }, data: recomputeCarRating(all) });
    ok(res, { id: review.id, isOwner: review.isOwner }, 201);
  } catch (error) { next(error); }
});

router.post('/reviews/:id/helpful', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.carReview.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!r) throw new ApiError(404, 'Review not found');
    if (r.userId === req.user!.id) throw new ApiError(400, 'That is your own review');
    const updated = await prisma.carReview.update({ where: { id: r.id }, data: { helpfulCount: { increment: 1 } }, select: { helpfulCount: true } });
    ok(res, updated);
  } catch (error) { next(error); }
});

router.patch('/reviews/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.carReview.findUnique({ where: { id: req.params.id } });
    if (!r) throw new ApiError(404, 'Review not found');
    if (r.userId !== req.user!.id && !isAdmin(req)) throw new ApiError(403, 'Not your review');
    const data = parse(z.object({ isHidden: z.boolean().optional(), title: z.string().trim().min(3).max(120).optional(), body: z.string().trim().min(20).max(4000).optional() }), req.body);
    if (data.isHidden !== undefined && !isAdmin(req)) throw new ApiError(403, 'Only an admin can hide a review');
    const updated = await prisma.carReview.update({ where: { id: r.id }, data });
    const all = await prisma.carReview.findMany({ where: { carModelId: r.carModelId }, select: { rating: true, reliability: true, isHidden: true } });
    await prisma.carModel.update({ where: { id: r.carModelId }, data: recomputeCarRating(all) });
    ok(res, { id: updated.id, isHidden: updated.isHidden });
  } catch (error) { next(error); }
});

router.delete('/reviews/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.carReview.findUnique({ where: { id: req.params.id } });
    if (!r) throw new ApiError(404, 'Review not found');
    if (r.userId !== req.user!.id && !isAdmin(req)) throw new ApiError(403, 'Not your review');
    await prisma.carReview.delete({ where: { id: r.id } });
    const all = await prisma.carReview.findMany({ where: { carModelId: r.carModelId }, select: { rating: true, reliability: true, isHidden: true } });
    await prisma.carModel.update({ where: { id: r.carModelId }, data: recomputeCarRating(all) });
    ok(res, { deleted: true });
  } catch (error) { next(error); }
});

// ------------------------------------------------------------- calculators

const loanSchema = z.object({ amount: money, ratePct: z.coerce.number().min(0).max(40), termMonths: z.coerce.number().int().min(6).max(120), balloonPct: z.coerce.number().min(0).max(60).optional(), establishmentFee: z.coerce.number().min(0).max(5000).optional(), monthlyFee: z.coerce.number().min(0).max(100).optional() });

router.post('/finance/repayment', (req, res, next) => { try { ok(res, calculateRepayment(parse(loanSchema, req.body))); } catch (error) { next(error); } });

router.post('/finance/compare', (req, res, next) => {
  try {
    const data = parse(z.object({ amount: money, termMonths: z.coerce.number().int().min(6).max(120), loans: z.array(z.object({ name: z.string().trim().min(1).max(60), lender: z.string().trim().max(60).optional(), ratePct: z.coerce.number().min(0).max(40), establishmentFee: z.coerce.number().min(0).max(5000).optional(), monthlyFee: z.coerce.number().min(0).max(100).optional(), balloonPct: z.coerce.number().min(0).max(60).optional(), earlyExitFee: z.coerce.number().min(0).max(5000).optional(), secured: z.boolean().optional() })).min(1).max(8) }), req.body);
    ok(res, compareCarLoans(data));
  } catch (error) { next(error); }
});

router.post('/finance/affordability', (req, res, next) => {
  try {
    ok(res, assessAffordability(parse(z.object({ incomeAnnual: money, partnerIncomeAnnual: money.optional(), expensesMonthly: money, otherDebtsMonthly: money.optional(), dependants: z.coerce.number().int().min(0).max(12).optional(), deposit: money.optional(), tradeIn: money.optional(), termMonths: z.coerce.number().int().min(12).max(84).optional(), ratePct: z.coerce.number().min(0).max(40).optional(), runningCostsMonthly: money.optional() }), req.body)));
  } catch (error) { next(error); }
});

const ownershipSchema = z.object({ price: money, fuelType: fuelEnum, bodyType: bodyEnum.optional(), fuelPer100: z.coerce.number().min(0).max(30).nullable().optional(), kwhPer100: z.coerce.number().min(0).max(60).nullable().optional(), kmPerYear: z.coerce.number().int().min(1000).max(60000).optional(), years: z.coerce.number().int().min(1).max(10).optional(), state: stateEnum.optional(), insuranceAnnual: money.nullable().optional(), servicingYear: money.nullable().optional(), driverAge: z.coerce.number().int().min(16).max(100).optional(), homeCharging: z.boolean().optional(), isNew: z.boolean().optional(), loan: z.object({ amount: money, ratePct: z.coerce.number().min(0).max(40), termMonths: z.coerce.number().int().min(6).max(120), balloonPct: z.coerce.number().min(0).max(60).optional() }).nullable().optional() });

router.post('/finance/cost-of-ownership', (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (Array.isArray(body.cars)) {
      const cars = z.array(ownershipSchema.extend({ label: z.string().trim().max(80).optional() })).min(1).max(4).parse(body.cars);
      ok(res, { cars: cars.map((c) => ({ label: c.label ?? `${c.fuelType} ${c.bodyType ?? ''}`.trim(), ...costOfOwnership(c) })) });
      return;
    }
    ok(res, costOfOwnership(parse(ownershipSchema, body)));
  } catch (error) { next(error); }
});

const readinessSchema = z.object({ vehiclePrice: money, deposit: money.optional(), tradeIn: money.optional(), incomeAnnual: money, expensesMonthly: money, otherDebtsMonthly: money.optional(), dependants: z.coerce.number().int().min(0).max(12).optional(), employment: z.string().trim().max(30), employmentMonths: z.coerce.number().int().min(0).max(600).optional(), residency: z.string().trim().max(20).optional(), hasDefaults: z.boolean().optional(), termMonths: z.coerce.number().int().min(12).max(84).optional(), ratePct: z.coerce.number().min(0).max(40).optional(), vehicleAgeYears: z.coerce.number().min(0).max(40).optional() });

router.post('/finance/readiness', (req, res, next) => { try { ok(res, assessReadiness(parse(readinessSchema, req.body))); } catch (error) { next(error); } });

router.post('/insurance/estimate', (req, res, next) => {
  try {
    ok(res, estimatePremium(parse(z.object({ vehicleValue: money, driverAge: z.coerce.number().int().min(16).max(100), state: stateEnum, area: z.enum(['METRO', 'REGIONAL', 'REMOTE']).optional(), garaging: z.enum(['GARAGE', 'CARPORT', 'STREET']).optional(), kmPerYear: z.coerce.number().int().min(0).max(100000).optional(), excess: z.coerce.number().int().min(0).max(5000).optional(), claimsFreeYears: z.coerce.number().int().min(0).max(60).optional(), youngDrivers: z.boolean().optional(), fuelType: fuelEnum.optional(), multiPolicy: z.boolean().optional(), financed: z.boolean().optional(), vehicleAgeYears: z.coerce.number().min(0).max(40).optional() }), req.body)));
  } catch (error) { next(error); }
});

/** The quotes she collected, ranked by what each really costs in a year. */
router.post('/insurance/compare', (req, res, next) => {
  try {
    const data = parse(z.object({
      vehicleValue: money.nullable().optional(), claimChance: z.coerce.number().min(0).max(1).optional(),
      quotes: z.array(z.object({ insurer: z.string().trim().min(1).max(60), cover: z.string().trim().max(20).optional(), annual: money, monthlyTotal: money.nullable().optional(), excess: z.coerce.number().min(0).max(10000), agreedValue: money.nullable().optional(), hireCar: z.boolean().optional(), choiceOfRepairer: z.boolean().optional(), newForOld: z.boolean().optional(), roadside: z.boolean().optional(), windscreen: z.boolean().optional() })).min(1).max(6),
    }), req.body);
    ok(res, compareInsuranceQuotes(data));
  } catch (error) { next(error); }
});

const valuationSchema = z.object({ year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1), odometerKm: z.coerce.number().int().min(0).max(1_500_000), bodyType: bodyEnum.nullable().optional(), fuelType: fuelEnum.nullable().optional(), condition: conditionEnum.nullable().optional(), newPrice: money.nullable().optional(), make: z.string().trim().max(40).nullable().optional(), model: z.string().trim().max(60).nullable().optional() });

/** The catalogue's list price for a make and model, when it has one, so a valuation starts from a real number. */
async function catalogueNewPrice(make: string | null | undefined, model: string | null | undefined): Promise<{ price: number; bodyType: BodyKey; fuelType: FuelKey } | null> {
  if (!make || !model) return null;
  const c = await prisma.carModel.findFirst({ where: { make: { equals: make, mode: 'insensitive' }, model: { contains: model, mode: 'insensitive' }, isActive: true }, orderBy: { priceFrom: 'asc' }, select: { priceFrom: true, bodyType: true, fuelType: true } }).catch(() => null);
  return c ? { price: c.priceFrom, bodyType: c.bodyType as BodyKey, fuelType: c.fuelType as FuelKey } : null;
}

router.post('/valuation/estimate', async (req, res, next) => {
  try {
    const data = parse(valuationSchema, req.body);
    const fromCatalogue = data.newPrice ? null : await catalogueNewPrice(data.make, data.model);
    const v = estimateValue({ ...data, newPrice: data.newPrice ?? fromCatalogue?.price ?? null, bodyType: data.bodyType ?? fromCatalogue?.bodyType ?? null, fuelType: data.fuelType ?? fromCatalogue?.fuelType ?? null });
    ok(res, { ...v, newPriceFromCatalogue: Boolean(fromCatalogue && !data.newPrice) });
  } catch (error) { next(error); }
});

router.post('/valuation/upgrade', async (req, res, next) => {
  try {
    const data = parse(valuationSchema.extend({ targetPrice: money, loanBalance: money.optional(), savings: money.optional(), monthlySaving: money.optional() }), req.body);
    const fromCatalogue = data.newPrice ? null : await catalogueNewPrice(data.make, data.model);
    const current = estimateValue({ ...data, newPrice: data.newPrice ?? fromCatalogue?.price ?? null, bodyType: data.bodyType ?? fromCatalogue?.bodyType ?? null, fuelType: data.fuelType ?? fromCatalogue?.fuelType ?? null });
    ok(res, { current, ...upgradePath({ current, targetPrice: data.targetPrice, loanBalance: data.loanBalance, savings: data.savings, monthlySaving: data.monthlySaving }) });
  } catch (error) { next(error); }
});

// ------------------------------------------------------------------ garage

const vehicleSchema = z.object({
  nickname: z.string().trim().max(40).nullable().optional(), make: z.string().trim().min(1).max(40), model: z.string().trim().min(1).max(60), year: z.coerce.number().int().min(1960).max(new Date().getFullYear() + 1), variant: z.string().trim().max(80).nullable().optional(),
  bodyType: bodyEnum.nullable().optional(), fuelType: fuelEnum.optional(), colour: z.string().trim().max(30).nullable().optional(), rego: z.string().trim().max(10).nullable().optional(), regoState: stateEnum.nullable().optional(), vin: z.string().trim().max(17).nullable().optional(),
  odometerKm: z.coerce.number().int().min(0).max(1_500_000).nullable().optional(), kmPerYear: z.coerce.number().int().min(0).max(100000).nullable().optional(), purchasePrice: money.nullable().optional(), purchasedAt: isoDaySchema.nullable().optional(), boughtNew: z.boolean().optional(), newPrice: money.nullable().optional(),
  warrantyEndsAt: isoDaySchema.nullable().optional(), warrantyEndsKm: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(), regoDueAt: isoDaySchema.nullable().optional(), insuranceRenewsAt: isoDaySchema.nullable().optional(), insurer: z.string().trim().max(60).nullable().optional(), insurancePremium: money.nullable().optional(),
  nextServiceDueAt: isoDaySchema.nullable().optional(), nextServiceDueKm: z.coerce.number().int().min(0).max(1_500_000).nullable().optional(), serviceIntervalMonths: z.coerce.number().int().min(1).max(36).optional(), serviceIntervalKm: z.coerce.number().int().min(1000).max(60000).optional(), notes: z.string().trim().max(2000).nullable().optional(), carModelId: uuid.nullable().optional(),
});

const dateOrNull = (s: string | null | undefined) => (s === undefined ? undefined : s === null ? null : dayDate(s));

router.get('/garage', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.vehicle.findMany({ where: { userId: req.user!.id, isActive: true }, orderBy: { createdAt: 'asc' } });
    const now = new Date();
    const vehicles = rows.map((v) => vehicleCard(v, now));
    ok(res, { vehicles, reminders: vehicles.flatMap((v) => v.reminders).sort((a, b) => (a.daysAway ?? 999) - (b.daysAway ?? 999)) });
  } catch (error) { next(error); }
});

router.post('/garage', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(vehicleSchema, req.body);
    const count = await prisma.vehicle.count({ where: { userId: req.user!.id, isActive: true } });
    if (count >= 12) throw new ApiError(400, 'Twelve cars in one garage is the limit');
    const match = data.carModelId ? null : await prisma.carModel.findFirst({ where: { make: { equals: data.make, mode: 'insensitive' }, model: { equals: data.model, mode: 'insensitive' }, isActive: true }, select: { id: true, bodyType: true, fuelType: true, serviceIntervalMonths: true, serviceIntervalKm: true, warrantyYears: true, warrantyKm: true } });
    const { purchasedAt, warrantyEndsAt, regoDueAt, insuranceRenewsAt, nextServiceDueAt, ...rest } = data;
    let warrantyEnds = dateOrNull(warrantyEndsAt);
    let warrantyKm = data.warrantyEndsKm;
    if (data.boughtNew && purchasedAt && match?.warrantyYears && warrantyEnds === undefined) { const w = dayDate(purchasedAt); w.setUTCFullYear(w.getUTCFullYear() + match.warrantyYears); warrantyEnds = w; if (warrantyKm === undefined && match.warrantyKm) warrantyKm = match.warrantyKm; }
    const v = await prisma.vehicle.create({ data: {
      ...rest, userId: req.user!.id, bodyType: (data.bodyType ?? match?.bodyType ?? null) as never, fuelType: (data.fuelType ?? match?.fuelType ?? 'PETROL') as never, carModelId: data.carModelId ?? match?.id ?? null,
      serviceIntervalMonths: data.serviceIntervalMonths ?? match?.serviceIntervalMonths ?? 12, serviceIntervalKm: data.serviceIntervalKm ?? match?.serviceIntervalKm ?? 15000, odometerAt: data.odometerKm !== null && data.odometerKm !== undefined ? new Date() : null,
      purchasedAt: dateOrNull(purchasedAt) ?? null, warrantyEndsAt: warrantyEnds ?? null, warrantyEndsKm: warrantyKm ?? null, regoDueAt: dateOrNull(regoDueAt) ?? null, insuranceRenewsAt: dateOrNull(insuranceRenewsAt) ?? null, nextServiceDueAt: dateOrNull(nextServiceDueAt) ?? null,
    } });
    ok(res, vehicleCard(v), 201);
  } catch (error) { next(error); }
});

async function ownVehicle(req: AuthRequest, id: string) {
  const v = await prisma.vehicle.findFirst({ where: { id, userId: req.user!.id, isActive: true } });
  if (!v) throw new ApiError(404, 'That car is not in your garage');
  return v;
}

router.get('/garage/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const v = await ownVehicle(req, req.params.id);
    const now = new Date();
    const [services, bookings, model, tradeIns] = await Promise.all([
      prisma.vehicleServiceRecord.findMany({ where: { vehicleId: v.id }, orderBy: { date: 'desc' }, include: { mechanic: { select: { name: true, slug: true } } } }),
      prisma.mechanicBooking.findMany({ where: { vehicleId: v.id, status: { in: ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'] } }, orderBy: { scheduledAt: 'asc' }, include: bookingInclude }),
      v.carModelId ? prisma.carModel.findUnique({ where: { id: v.carModelId } }) : null,
      prisma.tradeInRequest.findMany({ where: { vehicleId: v.id }, orderBy: { createdAt: 'desc' }, take: 3 }),
    ]);
    const valuation = estimateValue({ year: v.year, odometerKm: projectedOdometer(v, now) ?? 0, bodyType: v.bodyType as BodyKey | null, fuelType: v.fuelType as FuelKey, newPrice: v.newPrice ?? (v.boughtNew ? v.purchasePrice : null) ?? model?.priceFrom ?? null, make: v.make, now });
    const spent = services.reduce((s, r) => s + (r.cost ?? 0), 0);
    ok(res, {
      ...vehicleCard(v, now), valuation, catalogue: model ? carCard(model, now) : null,
      services: services.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), odometerKm: r.odometerKm, kind: r.kind, kindLabel: serviceKind(r.kind)?.label ?? r.kind, title: r.title, workshop: r.mechanic?.name ?? r.workshop, mechanicSlug: r.mechanic?.slug ?? null, cost: r.cost, notes: r.notes, partsWarrantyMonths: r.partsWarrantyMonths, labourWarrantyMonths: r.labourWarrantyMonths, invoiceUrl: r.invoiceUrl, bookingId: r.bookingId,
        warrantyUntil: r.partsWarrantyMonths || r.labourWarrantyMonths ? (() => { const d = new Date(r.date); d.setUTCMonth(d.getUTCMonth() + Math.max(r.partsWarrantyMonths ?? 0, r.labourWarrantyMonths ?? 0)); return d.toISOString().slice(0, 10); })() : null })),
      spent, bookings: bookings.map((b) => bookingCard(b)), tradeIns: tradeIns.map((t) => ({ id: t.id, status: t.status, estimateMid: t.estimateMid, expiresAt: t.expiresAt, quotes: Array.isArray(t.quotes) ? t.quotes.length : 0 })),
      maintenance: MAINTENANCE_GUIDE.filter((m) => (v.fuelType === 'ELECTRIC' ? m.ev !== 'none' : m.key !== 'ev_pack')),
    });
  } catch (error) { next(error); }
});

router.patch('/garage/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const v = await ownVehicle(req, req.params.id);
    const data = parse(vehicleSchema.partial(), req.body);
    const { purchasedAt, warrantyEndsAt, regoDueAt, insuranceRenewsAt, nextServiceDueAt, ...rest } = data;
    const updated = await prisma.vehicle.update({ where: { id: v.id }, data: {
      ...rest, bodyType: rest.bodyType as never, fuelType: rest.fuelType as never, purchasedAt: dateOrNull(purchasedAt), warrantyEndsAt: dateOrNull(warrantyEndsAt), regoDueAt: dateOrNull(regoDueAt), insuranceRenewsAt: dateOrNull(insuranceRenewsAt), nextServiceDueAt: dateOrNull(nextServiceDueAt),
      ...(rest.odometerKm !== undefined && rest.odometerKm !== v.odometerKm ? { odometerAt: new Date() } : {}),
    } });
    ok(res, vehicleCard(updated));
  } catch (error) { next(error); }
});

router.post('/garage/:id/odometer', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const v = await ownVehicle(req, req.params.id);
    const data = parse(z.object({ odometerKm: z.coerce.number().int().min(0).max(1_500_000) }), req.body);
    if (v.odometerKm !== null && data.odometerKm < v.odometerKm) throw new ApiError(400, 'The odometer only goes up. If the last reading was wrong, edit the car.');
    // Two readings give a yearly distance without her having to guess one.
    let kmPerYear = v.kmPerYear;
    if (v.odometerKm !== null && v.odometerAt) { const years = (Date.now() - v.odometerAt.getTime()) / (365.25 * 86400000); if (years > 0.08) kmPerYear = Math.round((data.odometerKm - v.odometerKm) / years); }
    const updated = await prisma.vehicle.update({ where: { id: v.id }, data: { odometerKm: data.odometerKm, odometerAt: new Date(), kmPerYear } });
    ok(res, vehicleCard(updated));
  } catch (error) { next(error); }
});

router.delete('/garage/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const v = await ownVehicle(req, req.params.id);
    await prisma.vehicle.delete({ where: { id: v.id } });
    ok(res, { deleted: true });
  } catch (error) { next(error); }
});

const serviceRecordSchema = z.object({ date: isoDaySchema, odometerKm: z.coerce.number().int().min(0).max(1_500_000).nullable().optional(), kind: z.string().trim().min(1).max(30), title: z.string().trim().min(2).max(120), workshop: z.string().trim().max(80).nullable().optional(), cost: money.nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(), partsWarrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional(), labourWarrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional(), invoiceUrl: z.string().url().max(300).nullable().optional() });
const SERVICE_KINDS_THAT_RESET = new Set(['logbook', 'oil', 'ev_service']);

router.post('/garage/:id/services', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const v = await ownVehicle(req, req.params.id);
    const data = parse(serviceRecordSchema, req.body);
    const record = await prisma.vehicleServiceRecord.create({ data: { ...data, vehicleId: v.id, date: dayDate(data.date) } });
    const patch: Prisma.VehicleUpdateInput = {};
    if (SERVICE_KINDS_THAT_RESET.has(data.kind)) { const nxt = nextServiceAfter(dayDate(data.date), data.odometerKm, v.serviceIntervalMonths, v.serviceIntervalKm); patch.nextServiceDueAt = nxt.dueAt; patch.nextServiceDueKm = nxt.dueKm; }
    if (data.odometerKm !== null && data.odometerKm !== undefined && (v.odometerKm === null || data.odometerKm >= v.odometerKm)) { patch.odometerKm = data.odometerKm; patch.odometerAt = dayDate(data.date); }
    if (Object.keys(patch).length) await prisma.vehicle.update({ where: { id: v.id }, data: patch });
    ok(res, { id: record.id, nextServiceDueAt: patch.nextServiceDueAt ?? v.nextServiceDueAt, nextServiceDueKm: patch.nextServiceDueKm ?? v.nextServiceDueKm }, 201);
  } catch (error) { next(error); }
});

router.delete('/garage/services/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.vehicleServiceRecord.findFirst({ where: { id: req.params.id, vehicle: { userId: req.user!.id } } });
    if (!r) throw new ApiError(404, 'Record not found');
    if (r.bookingId) throw new ApiError(400, 'This record came from a booking here and stays as the workshop wrote it');
    await prisma.vehicleServiceRecord.delete({ where: { id: r.id } });
    ok(res, { deleted: true });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------- listings

const listingSchema = z.object({
  title: z.string().trim().min(6).max(120), make: z.string().trim().min(1).max(40), model: z.string().trim().min(1).max(60), year: z.coerce.number().int().min(1960).max(new Date().getFullYear() + 1), variant: z.string().trim().max(80).nullable().optional(), bodyType: bodyEnum, fuelType: fuelEnum, transmission: transmissionEnum.optional(),
  odometerKm: z.coerce.number().int().min(0).max(1_500_000), price: z.coerce.number().int().min(500).max(2_000_000), colour: z.string().trim().max(30).nullable().optional(), seats: z.coerce.number().int().min(2).max(9).nullable().optional(), description: z.string().trim().min(30).max(6000), features: z.array(z.string().trim().max(60)).max(40).optional(),
  photos: z.array(z.string().url().max(500)).max(20).optional(), videoUrl: z.string().url().max(300).nullable().optional(), suburb: z.string().trim().max(60).nullable().optional(), city: z.string().trim().max(60).nullable().optional(), state: stateEnum, postcode: z.string().trim().max(4).nullable().optional(),
  vin: z.string().trim().max(17).nullable().optional(), rego: z.string().trim().max(10).nullable().optional(), regoExpires: isoDaySchema.nullable().optional(), serviceHistory: z.enum(['FULL', 'PARTIAL', 'NONE', 'UNKNOWN']).optional(), accidentHistory: z.enum(['NONE', 'MINOR_REPAIRED', 'MAJOR_REPAIRED', 'UNKNOWN']).optional(), ownersCount: z.coerce.number().int().min(1).max(20).nullable().optional(),
  ppsrChecked: z.boolean().optional(), ppsrCertificateUrl: z.string().url().max(500).nullable().optional(), roadworthy: z.boolean().optional(), warranty: z.enum(['NONE', 'BALANCE_OF_NEW_CAR', 'STATUTORY', 'DEALER', 'EXTENDED']).optional(), warrantyNote: z.string().trim().max(300).nullable().optional(),
  vehicleId: uuid.nullable().optional(), condition: conditionEnum.optional(), newPrice: money.nullable().optional(), publish: z.boolean().optional(),
});

/** The price guide and the checks, recomputed whenever a listing changes. */
async function assessListing(input: z.infer<typeof listingSchema>, sellerCreatedAt: Date, now = new Date()) {
  const fromCatalogue = input.newPrice ? null : await catalogueNewPrice(input.make, input.model);
  const valuation = estimateValue({ year: input.year, odometerKm: input.odometerKm, bodyType: input.bodyType, fuelType: input.fuelType, condition: input.condition ?? 'GOOD', newPrice: input.newPrice ?? fromCatalogue?.price ?? null, make: input.make, now });
  const bench = benchmarkPrice(input.price, valuation);
  const risk = assessListingRisk({ price: input.price, guideLow: bench.guideLow, guideHigh: bench.guideHigh, verdict: bench.verdict, photosCount: input.photos?.length ?? 0, vin: input.vin, ppsrChecked: Boolean(input.ppsrChecked), sellerAccountAgeDays: (now.getTime() - sellerCreatedAt.getTime()) / 86400000, description: `${input.title} ${input.description}`, odometerKm: input.odometerKm, year: input.year, serviceHistory: input.serviceHistory ?? 'UNKNOWN', accidentHistory: input.accidentHistory ?? 'NONE', now });
  return { valuation, bench, risk };
}

router.get('/listings', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.VehicleListingWhereInput = { status: { in: ['ACTIVE', 'UNDER_OFFER'] } };
    const search = q(req, 'q');
    if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { make: { contains: search, mode: 'insensitive' } }, { model: { contains: search, mode: 'insensitive' } }, { variant: { contains: search, mode: 'insensitive' } }, { suburb: { contains: search, mode: 'insensitive' } }, { city: { contains: search, mode: 'insensitive' } }];
    if (q(req, 'make')) where.make = { equals: q(req, 'make'), mode: 'insensitive' };
    if (q(req, 'model')) where.model = { contains: q(req, 'model'), mode: 'insensitive' };
    if (q(req, 'bodyType')) where.bodyType = q(req, 'bodyType') as never;
    if (q(req, 'fuelType')) where.fuelType = q(req, 'fuelType') as never;
    if (q(req, 'transmission')) where.transmission = q(req, 'transmission') as never;
    if (q(req, 'state')) where.state = q(req, 'state');
    if (q(req, 'sellerKind')) where.sellerKind = q(req, 'sellerKind') as never;
    if (qNum(req, 'minPrice') || qNum(req, 'maxPrice')) where.price = { gte: qNum(req, 'minPrice'), lte: qNum(req, 'maxPrice') };
    if (qNum(req, 'maxKm')) where.odometerKm = { lte: qNum(req, 'maxKm') };
    if (qNum(req, 'minYear')) where.year = { gte: qNum(req, 'minYear') };
    if (qBool(req, 'ppsr')) where.ppsrChecked = true;
    if (qBool(req, 'fullHistory')) where.serviceHistory = 'FULL';
    if (qBool(req, 'warranty')) where.warranty = { not: 'NONE' };
    if (qBool(req, 'inspected')) where.inspections = { some: { status: 'COMPLETED' } };
    if (qBool(req, 'electrified')) where.fuelType = { in: ['HYBRID', 'PLUG_IN_HYBRID', 'ELECTRIC'] };
    const sort = q(req, 'sort');
    const orderBy: Prisma.VehicleListingOrderByWithRelationInput[] = [{ isFeatured: 'desc' }, ...(sort === 'price_asc' ? [{ price: 'asc' as const }] : sort === 'price_desc' ? [{ price: 'desc' as const }] : sort === 'km' ? [{ odometerKm: 'asc' as const }] : sort === 'year' ? [{ year: 'desc' as const }] : [{ createdAt: 'desc' as const }])];
    const p = page(req);
    const [rows, total, saved] = await Promise.all([
      prisma.vehicleListing.findMany({ where, orderBy, skip: (p - 1) * 20, take: 20, include: { ...listingInclude, inspections: { where: { status: 'COMPLETED' }, select: { outcome: true }, take: 1 } } }),
      prisma.vehicleListing.count({ where }),
      req.user ? prisma.vehicleListingSave.findMany({ where: { userId: req.user.id }, select: { listingId: true } }) : [],
    ]);
    const savedIds = new Set(saved.map((s) => s.listingId));
    ok(res, { listings: rows.map((l) => ({ ...listingCard(l, { viewerId: req.user?.id }), inspected: l.inspections[0]?.outcome ?? null, saved: savedIds.has(l.id) })), total, page: p, makes: MAKES });
  } catch (error) { next(error); }
});

router.get('/listings/mine', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.vehicleListing.findMany({ where: { sellerId: req.user!.id }, orderBy: { updatedAt: 'desc' }, include: { ...listingInclude, purchases: { select: { id: true, status: true, offerAmount: true, createdAt: true } }, inspections: { select: { id: true, status: true, outcome: true } } } });
    ok(res, rows.map((l) => ({ ...listingCard(l, { full: true, viewerId: req.user!.id }), offers: l.purchases.filter((x) => x.status === 'OFFERED').length, purchases: l.purchases, inspections: l.inspections })));
  } catch (error) { next(error); }
});

router.get('/listings/saved', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.vehicleListingSave.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: { listing: { include: listingInclude } } });
    ok(res, rows.map((s) => ({ ...listingCard(s.listing, { viewerId: req.user!.id }), saved: true, savedAt: s.createdAt })));
  } catch (error) { next(error); }
});

router.post('/listings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(listingSchema, req.body);
    const [seller, dealership, open] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { createdAt: true } }),
      prisma.dealership.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true, isVerified: true } }),
      prisma.vehicleListing.count({ where: { sellerId: req.user!.id, status: { in: ['DRAFT', 'ACTIVE', 'UNDER_OFFER'] } } }),
    ]);
    if (open >= (dealership ? 200 : 5)) throw new ApiError(400, 'That is as many open listings as one account can carry');
    if (data.vehicleId) { const v = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, userId: req.user!.id } }); if (!v) throw new ApiError(404, 'That car is not in your garage'); }
    if (data.vin && !isValidVin(data.vin)) throw new ApiError(400, 'A VIN is seventeen letters and numbers, with no I, O or Q');
    const { publish, condition: _condition, newPrice: _newPrice, vehicleId, regoExpires, ...rest } = data;
    const a = await assessListing(data, seller?.createdAt ?? new Date());
    const status = !publish ? 'DRAFT' : a.risk.holdForReview ? 'SUSPENDED' : 'ACTIVE';
    const l = await prisma.vehicleListing.create({ data: {
      ...rest, sellerId: req.user!.id, sellerKind: dealership?.isVerified ? 'DEALER' : 'PRIVATE', dealershipId: dealership?.isVerified ? dealership.id : null, vehicleId: vehicleId ?? null, photos: rest.photos ?? [], features: rest.features ?? [], regoExpires: regoExpires ? dayDate(regoExpires) : null, vin: rest.vin?.toUpperCase() ?? null,
      priceGuideLow: a.bench.guideLow, priceGuideHigh: a.bench.guideHigh, priceVerdict: a.bench.verdict, riskFlags: a.risk.flags.map((f) => f.key), riskScore: a.risk.score, status, suspendedReason: status === 'SUSPENDED' ? 'Held for a quick review before it goes live' : null,
    }, include: listingInclude });
    if (status === 'SUSPENDED') await noteAdmins('A car listing is held for review', `"${l.title}" scored ${a.risk.score} on the listing checks (${a.risk.flags.map((f) => f.label).join('; ')}).`, `/dashboard/cars/admin`, { kind: 'CAR_LISTING_REVIEW', id: l.id });
    ok(res, { ...listingCard(l, { full: true, viewerId: req.user!.id }), guide: a.bench, checks: a.risk }, 201);
  } catch (error) { next(error); }
});

async function ownListing(req: AuthRequest, id: string) {
  const l = await prisma.vehicleListing.findFirst({ where: { id, ...(isAdmin(req) ? {} : { sellerId: req.user!.id }) }, include: listingInclude });
  if (!l) throw new ApiError(404, 'Listing not found');
  return l;
}

router.patch('/listings/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await ownListing(req, req.params.id);
    if (['SOLD', 'WITHDRAWN'].includes(l.status)) throw new ApiError(400, 'A sold or withdrawn listing cannot be edited; make a new one');
    const data = parse(listingSchema.partial(), req.body);
    if (data.vin && !isValidVin(data.vin)) throw new ApiError(400, 'A VIN is seventeen letters and numbers, with no I, O or Q');
    const merged = { ...l, ...data, photos: data.photos ?? photosOf(l.photos), features: data.features ?? l.features, serviceHistory: data.serviceHistory ?? l.serviceHistory, accidentHistory: (data.accidentHistory ?? l.accidentHistory) as 'NONE', warranty: data.warranty ?? l.warranty, transmission: data.transmission ?? l.transmission, state: (data.state ?? l.state) as AuState } as z.infer<typeof listingSchema>;
    const a = await assessListing(merged, l.seller.createdAt);
    const { publish, condition: _condition, newPrice: _newPrice, vehicleId, regoExpires, ...rest } = data;
    const wantsLive = publish === true || (l.status === 'ACTIVE' && publish !== false);
    const status = l.status === 'SUSPENDED' && !isAdmin(req) ? 'SUSPENDED' : wantsLive ? (a.risk.holdForReview && !isAdmin(req) ? 'SUSPENDED' : 'ACTIVE') : publish === false ? 'DRAFT' : l.status;
    const updated = await prisma.vehicleListing.update({ where: { id: l.id }, data: {
      ...rest, vin: rest.vin === undefined ? undefined : rest.vin?.toUpperCase() ?? null, regoExpires: regoExpires === undefined ? undefined : regoExpires ? dayDate(regoExpires) : null, vehicleId: vehicleId === undefined ? undefined : vehicleId,
      priceGuideLow: a.bench.guideLow, priceGuideHigh: a.bench.guideHigh, priceVerdict: a.bench.verdict, riskFlags: a.risk.flags.map((f) => f.key), riskScore: a.risk.score, status, suspendedReason: status === 'SUSPENDED' ? l.suspendedReason ?? 'Held for a quick review before it goes live' : null,
    }, include: listingInclude });
    if (status === 'SUSPENDED' && l.status !== 'SUSPENDED') await noteAdmins('A car listing is held for review', `"${updated.title}" scored ${a.risk.score} on the listing checks.`, `/dashboard/cars/admin`, { kind: 'CAR_LISTING_REVIEW', id: updated.id });
    ok(res, { ...listingCard(updated, { full: true, viewerId: req.user!.id, admin: isAdmin(req) }), guide: a.bench, checks: a.risk });
  } catch (error) { next(error); }
});

router.post('/listings/:id/withdraw', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await ownListing(req, req.params.id);
    const live = await prisma.vehiclePurchase.count({ where: { listingId: l.id, status: { in: ['PAID_HELD', 'HANDED_OVER', 'DISPUTED'] } } });
    if (live > 0) throw new ApiError(400, 'A purchase is under way on this listing; finish or cancel that first');
    await prisma.$transaction([
      prisma.vehicleListing.update({ where: { id: l.id }, data: { status: 'WITHDRAWN' } }),
      prisma.vehiclePurchase.updateMany({ where: { listingId: l.id, status: { in: ['OFFERED', 'ACCEPTED'] } }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'The listing was withdrawn' } }),
    ]);
    ok(res, { status: 'WITHDRAWN' });
  } catch (error) { next(error); }
});

router.post('/listings/:id/sold', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await ownListing(req, req.params.id);
    await prisma.$transaction([
      prisma.vehicleListing.update({ where: { id: l.id }, data: { status: 'SOLD', soldAt: new Date() } }),
      prisma.vehiclePurchase.updateMany({ where: { listingId: l.id, status: { in: ['OFFERED', 'ACCEPTED'] } }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'The car was sold elsewhere' } }),
    ]);
    ok(res, { status: 'SOLD' });
  } catch (error) { next(error); }
});

router.post('/listings/:id/save', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await prisma.vehicleListing.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!l) throw new ApiError(404, 'Listing not found');
    const existing = await prisma.vehicleListingSave.findUnique({ where: { listingId_userId: { listingId: l.id, userId: req.user!.id } } });
    if (!existing) await prisma.$transaction([prisma.vehicleListingSave.create({ data: { listingId: l.id, userId: req.user!.id } }), prisma.vehicleListing.update({ where: { id: l.id }, data: { saveCount: { increment: 1 } } })]);
    ok(res, { saved: true }, existing ? 200 : 201);
  } catch (error) { next(error); }
});

router.delete('/listings/:id/save', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.vehicleListingSave.findUnique({ where: { listingId_userId: { listingId: req.params.id, userId: req.user!.id } } });
    if (existing) await prisma.$transaction([prisma.vehicleListingSave.delete({ where: { id: existing.id } }), prisma.vehicleListing.update({ where: { id: req.params.id }, data: { saveCount: { decrement: 1 } } })]);
    ok(res, { saved: false });
  } catch (error) { next(error); }
});

router.get('/listings/:id', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await prisma.vehicleListing.findUnique({ where: { id: req.params.id }, include: { ...listingInclude, inspections: { include: { inspector: { select: { name: true, slug: true } } }, orderBy: { createdAt: 'desc' } } } });
    if (!l) throw new ApiError(404, 'Listing not found');
    const viewer = req.user?.id ?? null;
    const owner = viewer === l.sellerId || isAdmin(req);
    if (!owner && !['ACTIVE', 'UNDER_OFFER', 'SOLD'].includes(l.status)) throw new ApiError(404, 'Listing not found');
    if (!owner) await prisma.vehicleListing.update({ where: { id: l.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);
    const [saved, myPurchase, sellerListings] = await Promise.all([
      viewer ? prisma.vehicleListingSave.findUnique({ where: { listingId_userId: { listingId: l.id, userId: viewer } } }) : null,
      viewer && !owner ? prisma.vehiclePurchase.findFirst({ where: { listingId: l.id, buyerId: viewer, status: { notIn: ['DECLINED', 'CANCELLED', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' } }) : null,
      prisma.vehicleListing.count({ where: { sellerId: l.sellerId, status: { in: ['ACTIVE', 'SOLD', 'UNDER_OFFER'] } } }),
    ]);
    const valuation = estimateValue({ year: l.year, odometerKm: l.odometerKm, bodyType: l.bodyType as BodyKey, fuelType: l.fuelType as FuelKey, make: l.make, newPrice: (await catalogueNewPrice(l.make, l.model))?.price ?? null });
    const bench = benchmarkPrice(l.price, valuation);
    const risk = assessListingRisk({ price: l.price, verdict: bench.verdict, photosCount: photosOf(l.photos).length, vin: l.vin, ppsrChecked: l.ppsrChecked, sellerAccountAgeDays: (Date.now() - l.seller.createdAt.getTime()) / 86400000, description: `${l.title} ${l.description}`, odometerKm: l.odometerKm, year: l.year, serviceHistory: l.serviceHistory, accidentHistory: l.accidentHistory });
    const canSeeInspection = (i: (typeof l.inspections)[number]) => owner || i.requestedById === viewer || (i.status === 'COMPLETED' && i.kind !== 'INDEPENDENT');
    const ownership = costOfOwnership({ price: l.price, fuelType: l.fuelType as FuelKey, bodyType: l.bodyType as BodyKey, years: 3, isNew: false, state: l.state as AuState });
    ok(res, {
      ...listingCard(l, { full: true, viewerId: viewer, admin: isAdmin(req) }), saved: Boolean(saved), isOwner: viewer === l.sellerId, canOffer: Boolean(viewer) && viewer !== l.sellerId && ['ACTIVE', 'UNDER_OFFER'].includes(l.status),
      guide: { ...bench, words: bench.words, assumed: valuation.newPriceAssumed }, beforeYouPay: risk.flags.map((f) => ({ key: f.key, label: f.label, advice: f.forBuyer })), checks: historyChecks(l.vin, l.rego, l.state), protection: { ...BUYER_PROTECTION, inspectionDays: inspectionDays(), feePercent: PURCHASE_FEE_PERCENT[l.sellerKind] },
      inspections: l.inspections.filter(canSeeInspection).map((i) => ({ id: i.id, kind: i.kind, status: i.status, outcome: i.outcome, summary: i.summary, report: i.status === 'COMPLETED' ? normaliseInspectionReport(i.report) : undefined, reportUrl: i.status === 'COMPLETED' ? i.reportUrl : null, completedAt: i.completedAt, scheduledAt: i.scheduledAt, inspector: i.inspector, isMine: i.requestedById === viewer, fee: i.fee })),
      myPurchase: myPurchase ? { id: myPurchase.id, status: myPurchase.status, offerAmount: myPurchase.offerAmount } : null, sellerListings, running: { perWeek: ownership.totals.perWeek, perYear: ownership.totals.perYear },
      finance: { repayment: Math.round(monthlyPayment(l.price * 0.9, financeReference().defaults.usedCarSecured.typical, 60)), ratePct: financeReference().defaults.usedCarSecured.typical, deposit: Math.round(l.price * 0.1) },
    });
  } catch (error) { next(error); }
});

// ------------------------------------------------------------- inspections

const inspectionInclude = { listing: { select: { id: true, title: true, sellerId: true, state: true, suburb: true, city: true, make: true, model: true, year: true } }, inspector: { select: { id: true, name: true, slug: true, ownerUserId: true, phone: true } }, requestedBy: { select: { firstName: true, lastName: true } }, escrow: { select: { status: true } } } as const;
type InspectionRow = Prisma.VehicleInspectionGetPayload<{ include: typeof inspectionInclude }>;
const inspectionCard = (i: InspectionRow, viewerId?: string) => ({ id: i.id, kind: i.kind, status: i.status, fee: i.fee, scheduledAt: i.scheduledAt, completedAt: i.completedAt, outcome: i.outcome, summary: i.summary, report: normaliseInspectionReport(i.report), reportUrl: i.reportUrl, escrowStatus: i.escrow?.status ?? null, createdAt: i.createdAt, listing: i.listing, inspector: i.inspector ? { id: i.inspector.id, name: i.inspector.name, slug: i.inspector.slug, phone: i.inspector.phone } : null, requestedBy: i.requestedById === viewerId ? 'You' : shortName(i.requestedBy), isRequester: i.requestedById === viewerId, isInspector: Boolean(viewerId && i.inspector?.ownerUserId === viewerId), sections: emptyInspectionReport() });

router.post('/listings/:id/inspections', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await prisma.vehicleListing.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, sellerId: true, state: true, status: true } });
    if (!l || !['ACTIVE', 'UNDER_OFFER'].includes(l.status)) throw new ApiError(404, 'Listing not found');
    const data = parse(z.object({ kind: z.enum(['ATHENA_VETTED', 'INDEPENDENT', 'SELLER_PROVIDED']).optional(), note: z.string().trim().max(1000).optional(), reportUrl: z.string().url().max(500).optional() }), req.body);
    const isSeller = l.sellerId === req.user!.id;
    const kind = isSeller ? 'SELLER_PROVIDED' : data.kind === 'INDEPENDENT' ? 'INDEPENDENT' : 'ATHENA_VETTED';
    const purchase = isSeller ? null : await prisma.vehiclePurchase.findFirst({ where: { listingId: l.id, buyerId: req.user!.id, status: { in: ['OFFERED', 'ACCEPTED', 'PAID_HELD'] } }, select: { id: true } });
    const open = await prisma.vehicleInspection.count({ where: { listingId: l.id, requestedById: req.user!.id, status: { in: ['REQUESTED', 'ASSIGNED', 'SCHEDULED'] } } });
    if (open > 0) throw new ApiError(400, 'You already have an inspection under way on this car');
    const i = await prisma.vehicleInspection.create({ data: { listingId: l.id, requestedById: req.user!.id, purchaseId: purchase?.id ?? null, kind, fee: kind === 'SELLER_PROVIDED' ? 0 : DEFAULT_INSPECTION_FEE, summary: data.note ?? null, reportUrl: data.reportUrl ?? null, status: kind === 'SELLER_PROVIDED' && data.reportUrl ? 'COMPLETED' : 'REQUESTED', completedAt: kind === 'SELLER_PROVIDED' && data.reportUrl ? new Date() : null }, include: inspectionInclude });
    if (kind !== 'SELLER_PROVIDED') {
      const workshops = await prisma.mechanic.findMany({ where: { isActive: true, isVerified: true, doesInspections: true, ownerUserId: { not: null }, ...(l.state ? { state: l.state } : {}) }, select: { ownerUserId: true }, take: 10 });
      await Promise.all(workshops.map((w) => note(w.ownerUserId!, 'A pre-purchase inspection is wanted', `A buyer wants "${l.title}" looked over in ${l.state}. Accept it from your workshop page.`, '/dashboard/cars/workshop', { kind: 'CAR_INSPECTION_OPEN', id: i.id })));
      await note(l.sellerId, 'A buyer has asked for an inspection', `An inspection of "${l.title}" has been requested. The workshop will arrange a time with you.`, `/dashboard/cars/sell/${l.id}`, { kind: 'CAR_INSPECTION_REQUESTED', id: i.id });
    }
    ok(res, inspectionCard(i, req.user!.id), 201);
  } catch (error) { next(error); }
});

router.get('/inspections', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mine = await prisma.mechanic.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true } });
    const rows = await prisma.vehicleInspection.findMany({ where: { OR: [{ requestedById: req.user!.id }, ...(mine ? [{ inspectorId: mine.id }] : []), { listing: { sellerId: req.user!.id }, status: 'COMPLETED' as const }] }, orderBy: { createdAt: 'desc' }, take: 100, include: inspectionInclude });
    ok(res, rows.map((i) => inspectionCard(i, req.user!.id)));
  } catch (error) { next(error); }
});

router.get('/inspections/open', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mine = await prisma.mechanic.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true, state: true, doesInspections: true, isVerified: true } });
    if (!mine || !mine.doesInspections) throw new ApiError(403, 'Only a workshop that offers inspections sees the open requests');
    const rows = await prisma.vehicleInspection.findMany({ where: { status: 'REQUESTED', kind: { not: 'SELLER_PROVIDED' }, ...(mine.state ? { listing: { state: mine.state } } : {}) }, orderBy: { createdAt: 'asc' }, take: 50, include: inspectionInclude });
    ok(res, rows.map((i) => inspectionCard(i, req.user!.id)));
  } catch (error) { next(error); }
});

router.post('/inspections/:id/accept', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mine = await prisma.mechanic.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true, name: true, doesInspections: true, isVerified: true, isActive: true } });
    if (!mine || !mine.doesInspections || !mine.isVerified || !mine.isActive) throw new ApiError(403, 'Only a verified workshop that offers inspections can accept one');
    const i = await prisma.vehicleInspection.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
    if (!i || i.status !== 'REQUESTED') throw new ApiError(404, 'That request is no longer open');
    const data = parse(z.object({ scheduledAt: z.string().datetime().optional(), fee: z.coerce.number().int().min(50).max(1000).optional() }), req.body);
    const updated = await prisma.vehicleInspection.update({ where: { id: i.id }, data: { inspectorId: mine.id, status: data.scheduledAt ? 'SCHEDULED' : 'ASSIGNED', scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null, fee: data.fee ?? i.fee }, include: inspectionInclude });
    await note(i.requestedById, `${mine.name} will inspect the car`, `${data.scheduledAt ? `Booked for ${new Date(data.scheduledAt).toLocaleString('en-AU')}.` : 'They will arrange a time with the seller.'} The fee is $${updated.fee}; pay it here and it is released when the report arrives.`, `/dashboard/cars/purchases`, { kind: 'CAR_INSPECTION_ACCEPTED', id: i.id });
    await note(i.listing.sellerId, `${mine.name} will inspect your car`, `An inspection of "${i.listing.title}" has been taken on. Expect a call to arrange access.`, `/dashboard/cars/sell/${i.listing.id}`, { kind: 'CAR_INSPECTION_ACCEPTED', id: i.id });
    ok(res, inspectionCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

router.post('/inspections/:id/pay', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const i = await prisma.vehicleInspection.findFirst({ where: { id: req.params.id, requestedById: req.user!.id }, include: inspectionInclude });
    if (!i) throw new ApiError(404, 'Inspection not found');
    if (!i.inspector?.ownerUserId) throw new ApiError(400, 'No workshop has taken this inspection on yet');
    if (i.escrowPaymentId) { const secret = i.escrow ? await getEscrowClientSecret((await prisma.escrowPayment.findUnique({ where: { id: i.escrowPaymentId }, select: { paymentIntentId: true } }))?.paymentIntentId ?? '') : null; ok(res, { alreadyHeld: true, clientSecret: secret }); return; }
    let hold;
    try { hold = await createEscrowPayment({ buyerId: req.user!.id, sellerId: i.inspector.ownerUserId, amount: i.fee * 100, currency: 'aud', description: `Pre-purchase inspection: ${i.listing.title}`, sessionType: 'vehicle_inspection', platformFeePercent: INSPECTION_FEE_PERCENT, metadata: { inspectionId: i.id, listingId: i.listing.id } }); }
    catch (error) { if (error instanceof ApiError && error.statusCode === 400) throw new ApiError(409, 'This workshop has not finished setting up payouts, so the fee is paid to them directly for now'); throw error; }
    await prisma.vehicleInspection.update({ where: { id: i.id }, data: { escrowPaymentId: hold.escrowId } });
    ok(res, { paymentIntentId: hold.paymentIntentId, clientSecret: hold.clientSecret, amount: hold.amount, platformFee: hold.platformFee, currency: 'aud' }, 201);
  } catch (error) { next(error); }
});

router.post('/inspections/:id/release', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const i = await prisma.vehicleInspection.findFirst({ where: { id: req.params.id, requestedById: req.user!.id }, include: { escrow: { select: { paymentIntentId: true, status: true } } } });
    if (!i) throw new ApiError(404, 'Inspection not found');
    if (i.status !== 'COMPLETED') throw new ApiError(400, 'The fee is released once the report is in');
    if (!i.escrow?.paymentIntentId) throw new ApiError(400, 'Nothing is held for this inspection');
    if (i.escrow.status === 'CAPTURED') { ok(res, { released: true }); return; }
    await captureEscrowPayment(i.escrow.paymentIntentId, { id: req.user!.id, role: req.user!.role });
    ok(res, { released: true });
  } catch (error) { next(error); }
});

router.patch('/inspections/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const i = await prisma.vehicleInspection.findUnique({ where: { id: req.params.id }, include: inspectionInclude });
    if (!i) throw new ApiError(404, 'Inspection not found');
    const isRequester = i.requestedById === req.user!.id;
    const isInspector = Boolean(i.inspector?.ownerUserId && i.inspector.ownerUserId === req.user!.id);
    if (!isRequester && !isInspector && !isAdmin(req)) throw new ApiError(403, 'Not yours');
    const data = parse(z.object({ status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(), scheduledAt: z.string().datetime().nullable().optional(), report: z.array(z.object({ key: z.string(), result: z.enum(['PASS', 'ADVISORY', 'FAIL']), notes: z.string().max(2000).optional() })).optional(), summary: z.string().trim().max(3000).nullable().optional(), reportUrl: z.string().url().max(500).nullable().optional() }), req.body);
    if (isRequester && !isInspector && !isAdmin(req) && data.status && data.status !== 'CANCELLED') throw new ApiError(403, 'Only the workshop writes the report');
    if (data.status === 'CANCELLED' && i.status === 'COMPLETED') throw new ApiError(400, 'A completed inspection stays');
    const report = data.report ? normaliseInspectionReport(data.report) : undefined;
    const completing = data.status === 'COMPLETED';
    if (completing && !report && !i.report && !data.reportUrl) throw new ApiError(400, 'A completed inspection needs the section-by-section report or a report file');
    const finalReport = report ?? normaliseInspectionReport(i.report);
    const updated = await prisma.vehicleInspection.update({ where: { id: i.id }, data: {
      status: data.status, scheduledAt: data.scheduledAt === undefined ? undefined : data.scheduledAt ? new Date(data.scheduledAt) : null, report: report ? (report as unknown as Prisma.InputJsonValue) : undefined, summary: data.summary, reportUrl: data.reportUrl,
      ...(completing ? { completedAt: new Date(), outcome: finalReport.length ? inspectionOutcome(finalReport) : 'ADVISORIES' } : {}),
    }, include: inspectionInclude });
    if (completing) {
      await note(i.requestedById, 'The inspection report is in', `${i.inspector?.name ?? 'The inspector'} has reported on "${i.listing.title}": ${updated.outcome === 'PASS' ? 'no faults found' : updated.outcome === 'FAIL' ? 'at least one section failed' : 'some advisories'}. Read it before you release any money.`, `/dashboard/cars/purchases`, { kind: 'CAR_INSPECTION_DONE', id: i.id });
      if (i.listing.sellerId !== i.requestedById) await note(i.listing.sellerId, 'An inspection of your car is complete', `The report on "${i.listing.title}" is with the buyer${updated.kind !== 'INDEPENDENT' ? ' and shown on the listing' : ''}.`, `/dashboard/cars/sell/${i.listing.id}`, { kind: 'CAR_INSPECTION_DONE', id: i.id });
    }
    if (data.status === 'CANCELLED' && i.escrow && i.escrowPaymentId) { const e = await prisma.escrowPayment.findUnique({ where: { id: i.escrowPaymentId }, select: { paymentIntentId: true, status: true } }); if (e?.paymentIntentId && !['CANCELED', 'REFUNDED', 'FAILED'].includes(e.status)) await cancelEscrowPayment(e.paymentIntentId, { id: req.user!.id, role: req.user!.role }, 'Inspection cancelled').catch((err) => logger.warn('Inspection hold could not be cancelled', { id: i.id, error: (err as Error).message })); }
    ok(res, inspectionCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

// --------------------------------------------------------------- purchases

async function loadPurchase(req: AuthRequest, id: string) {
  const p = await prisma.vehiclePurchase.findUnique({ where: { id }, include: purchaseInclude });
  if (!p) throw new ApiError(404, 'Purchase not found');
  const party: Party = p.buyerId === req.user!.id ? 'buyer' : p.sellerId === req.user!.id ? 'seller' : isAdmin(req) ? 'admin' : 'other';
  if (party === 'other') throw new ApiError(404, 'Purchase not found');
  return { p, party };
}

function transition(action: Parameters<typeof purchaseTransition>[0], p: { status: string }, party: Party) {
  const t = purchaseTransition(action, p.status as PurchaseStatus, party);
  if (!t.ok) throw new ApiError(400, t.reason);
  return t.to;
}

router.post('/listings/:id/offers', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await prisma.vehicleListing.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, sellerId: true, sellerKind: true, price: true, status: true } });
    if (!l || !['ACTIVE', 'UNDER_OFFER'].includes(l.status)) throw new ApiError(404, 'Listing not found');
    if (l.sellerId === req.user!.id) throw new ApiError(400, 'That is your own listing');
    const data = parse(z.object({ amount: z.coerce.number().int().min(100).max(2_000_000), message: z.string().trim().max(1000).optional() }), req.body);
    if (data.amount < l.price * 0.5) throw new ApiError(400, 'An offer under half the asking price will not be sent; make a serious one');
    const open = await prisma.vehiclePurchase.findFirst({ where: { listingId: l.id, buyerId: req.user!.id, status: { notIn: ['DECLINED', 'CANCELLED', 'REFUNDED', 'RELEASED'] } } });
    if (open) throw new ApiError(400, 'You already have an offer or purchase open on this car');
    const p = await prisma.vehiclePurchase.create({ data: { listingId: l.id, buyerId: req.user!.id, sellerId: l.sellerId, offerAmount: data.amount, platformFee: purchaseFee(l.sellerKind, data.amount), message: data.message ?? null }, include: purchaseInclude });
    await note(l.sellerId, `An offer of $${data.amount.toLocaleString('en-AU')} on your car`, `${data.amount >= l.price ? 'At your asking price' : `Under the $${l.price.toLocaleString('en-AU')} asked`} for "${l.title}". Accept or decline it.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_OFFER', id: p.id });
    ok(res, purchaseCard(p, req.user!.id), 201);
  } catch (error) { next(error); }
});

router.get('/purchases', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.vehiclePurchase.findMany({ where: { OR: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] }, orderBy: { updatedAt: 'desc' }, take: 100, include: purchaseInclude });
    const cards = rows.map((p) => purchaseCard(p, req.user!.id));
    ok(res, { buying: cards.filter((c) => c.role === 'buyer'), selling: cards.filter((c) => c.role === 'seller') });
  } catch (error) { next(error); }
});

router.get('/purchases/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p } = await loadPurchase(req, req.params.id);
    const inspections = await prisma.vehicleInspection.findMany({ where: { listingId: p.listingId, OR: [{ requestedById: p.buyerId }, { status: 'COMPLETED', kind: { not: 'INDEPENDENT' } }] }, orderBy: { createdAt: 'desc' }, include: inspectionInclude });
    ok(res, { ...purchaseCard(p, req.user!.id, isAdmin(req)), inspections: inspections.map((i) => inspectionCard(i, req.user!.id)), checks: historyChecks(p.listing.vin, p.listing.rego, p.listing.state) });
  } catch (error) { next(error); }
});

router.post('/purchases/:id/accept', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    const to = transition('accept', p, party);
    const data = parse(z.object({ message: z.string().trim().max(1000).optional() }), req.body ?? {});
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, agreedAmount: p.offerAmount, platformFee: purchaseFee(p.listing.sellerKind, p.offerAmount), sellerMessage: data.message ?? null }, include: purchaseInclude });
    await prisma.vehicleListing.update({ where: { id: p.listingId }, data: { status: 'UNDER_OFFER' } });
    await note(p.buyerId, 'Your offer was accepted', `$${p.offerAmount.toLocaleString('en-AU')} for "${p.listing.title}". Pay through ATHENA to hold the money; nothing goes to the seller until you have the car.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_OFFER_ACCEPTED', id: p.id });
    ok(res, purchaseCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

router.post('/purchases/:id/decline', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    const to = transition('decline', p, party);
    const data = parse(z.object({ message: z.string().trim().max(1000).optional() }), req.body ?? {});
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, sellerMessage: data.message ?? null }, include: purchaseInclude });
    await note(p.buyerId, 'Your offer was declined', `The seller of "${p.listing.title}" declined $${p.offerAmount.toLocaleString('en-AU')}.${data.message ? ` They said: ${data.message.slice(0, 140)}` : ''}`, `/cars/preloved/${p.listingId}`, { kind: 'CAR_OFFER_DECLINED', id: p.id });
    ok(res, purchaseCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

router.post('/purchases/:id/pay', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    const to = transition('pay', p, party);
    const amount = p.agreedAmount ?? p.offerAmount;
    let hold;
    try { hold = await createEscrowPayment({ buyerId: p.buyerId, sellerId: p.sellerId, amount: amount * 100, currency: 'aud', description: `${p.listing.title} (buyer protection)`, sessionType: 'vehicle_purchase', platformFeePercent: PURCHASE_FEE_PERCENT[p.listing.sellerKind], metadata: { purchaseId: p.id, listingId: p.listingId } }); }
    catch (error) { if (error instanceof ApiError && error.statusCode === 400) throw new ApiError(409, 'The seller has not finished setting up payouts, so the money cannot be held yet. Ask them to finish that from their payouts page.'); throw error; }
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, escrowPaymentId: hold.escrowId, paidAt: new Date(), platformFee: Math.round(hold.platformFee / 100) }, include: purchaseInclude });
    await note(p.sellerId, 'The buyer has paid; the money is held', `$${amount.toLocaleString('en-AU')} for "${p.listing.title}" is held by ATHENA. Arrange the handover with the papers; it is released to you after the buyer's inspection period.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PAID', id: p.id });
    ok(res, { ...purchaseCard(updated, req.user!.id), payment: { paymentIntentId: hold.paymentIntentId, clientSecret: hold.clientSecret, amount: hold.amount, platformFee: hold.platformFee, currency: 'aud' } });
  } catch (error) { next(error); }
});

router.get('/purchases/:id/payment', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    if (party !== 'buyer') throw new ApiError(403, 'Only the buyer sees the payment');
    if (!p.escrow?.paymentIntentId) throw new ApiError(404, 'Nothing has been paid yet');
    ok(res, { clientSecret: await getEscrowClientSecret(p.escrow.paymentIntentId), status: p.escrow.status, amount: p.escrow.amount });
  } catch (error) { next(error); }
});

router.post('/purchases/:id/handover', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    const to = transition('handover', p, party);
    const data = parse(z.object({ note: z.string().trim().max(1000).optional() }), req.body ?? {});
    const now = new Date();
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, handedOverAt: now, inspectionEndsAt: inspectionEnds(now), transferNote: data.note ?? null }, include: purchaseInclude });
    await prisma.vehicleListing.update({ where: { id: p.listingId }, data: { status: 'SOLD', soldAt: now } });
    await prisma.vehiclePurchase.updateMany({ where: { listingId: p.listingId, id: { not: p.id }, status: { in: ['OFFERED', 'ACCEPTED'] } }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: 'The car was sold to another buyer' } });
    await note(p.sellerId, 'The buyer has confirmed she has the car', `The ${inspectionDays()}-day inspection period on "${p.listing.title}" has started. The money is released to you when it ends, or sooner if she releases it.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_HANDED_OVER', id: p.id });
    ok(res, purchaseCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

router.post('/purchases/:id/release', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    const to = transition('release', p, party);
    if (p.escrow?.paymentIntentId && (p.escrow.status === 'PENDING' || p.escrow.status === 'AUTHORIZED')) await captureEscrowPayment(p.escrow.paymentIntentId, { id: p.buyerId, role: party === 'admin' ? 'ADMIN' : undefined });
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, releasedAt: new Date() }, include: purchaseInclude });
    await note(p.sellerId, 'The money has been released to you', `The buyer released $${(p.agreedAmount ?? p.offerAmount).toLocaleString('en-AU')} for "${p.listing.title}". It is on its way to your payout account.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_RELEASED', id: p.id });
    ok(res, purchaseCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

router.post('/purchases/:id/dispute', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    const to = transition('dispute', p, party);
    if (!withinInspection(p.inspectionEndsAt)) throw new ApiError(400, 'The inspection period has ended');
    const data = parse(z.object({ reason: z.string().trim().min(20).max(4000) }), req.body);
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, disputeReason: data.reason, disputeOpenedAt: new Date() }, include: purchaseInclude });
    await note(p.sellerId, 'The buyer has opened a dispute', `On "${p.listing.title}": ${data.reason.slice(0, 200)}. The money stays held while ATHENA looks at it; you will be asked for your side.`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_DISPUTE', id: p.id });
    await noteAdmins('A car purchase is in dispute', `"${p.listing.title}", $${(p.agreedAmount ?? p.offerAmount).toLocaleString('en-AU')}: ${data.reason.slice(0, 200)}`, `/dashboard/cars/admin`, { kind: 'CAR_DISPUTE', id: p.id });
    ok(res, purchaseCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

router.post('/purchases/:id/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    const to = transition('cancel', p, party);
    const data = parse(z.object({ reason: z.string().trim().max(1000).optional() }), req.body ?? {});
    if (p.escrow?.paymentIntentId && !['CANCELED', 'REFUNDED', 'FAILED'].includes(p.escrow.status)) await cancelEscrowPayment(p.escrow.paymentIntentId, { id: req.user!.id, role: req.user!.role }, data.reason);
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, cancelledAt: new Date(), cancelReason: data.reason ?? null }, include: purchaseInclude });
    const others = await prisma.vehiclePurchase.count({ where: { listingId: p.listingId, status: { in: ['ACCEPTED', 'PAID_HELD', 'HANDED_OVER', 'DISPUTED'] } } });
    if (others === 0 && p.listing.status === 'UNDER_OFFER') await prisma.vehicleListing.update({ where: { id: p.listingId }, data: { status: 'ACTIVE' } });
    const other = party === 'buyer' ? p.sellerId : p.buyerId;
    await note(other, 'A purchase was cancelled', `"${p.listing.title}"${data.reason ? `: ${data.reason.slice(0, 200)}` : ''}. ${p.escrow ? 'Any held money goes back to the buyer\'s card.' : ''}`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_PURCHASE_CANCELLED', id: p.id });
    ok(res, purchaseCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

router.post('/purchases/:id/resolve', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p } = await loadPurchase(req, req.params.id);
    const data = parse(z.object({ outcome: z.enum(['RELEASE', 'REFUND']), note: z.string().trim().min(5).max(2000) }), req.body);
    const to = transition(data.outcome === 'RELEASE' ? 'resolve_release' : 'resolve_refund', p, 'admin');
    if (p.escrow?.paymentIntentId) {
      if (data.outcome === 'RELEASE' && (p.escrow.status === 'PENDING' || p.escrow.status === 'AUTHORIZED')) await captureEscrowPayment(p.escrow.paymentIntentId, { id: req.user!.id, role: 'ADMIN' });
      if (data.outcome === 'REFUND' && !['CANCELED', 'REFUNDED', 'FAILED'].includes(p.escrow.status)) await cancelEscrowPayment(p.escrow.paymentIntentId, { id: req.user!.id, role: 'ADMIN' }, data.note);
    }
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { status: to, disputeResolution: data.note, resolvedAt: new Date(), resolvedById: req.user!.id, ...(to === 'RELEASED' ? { releasedAt: new Date() } : {}) }, include: purchaseInclude });
    const words = data.outcome === 'RELEASE' ? 'The money has been released to the seller.' : 'The money has been returned to the buyer.';
    await Promise.all([p.buyerId, p.sellerId].map((u) => note(u, 'The dispute has been decided', `${words} ${data.note.slice(0, 300)}`, `/dashboard/cars/purchases/${p.id}`, { kind: 'CAR_DISPUTE_RESOLVED', id: p.id })));
    ok(res, purchaseCard(updated, req.user!.id, true));
  } catch (error) { next(error); }
});

router.post('/purchases/:id/review', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { p, party } = await loadPurchase(req, req.params.id);
    if (party !== 'buyer') throw new ApiError(403, 'Only the buyer reviews a purchase');
    if (p.status !== 'RELEASED') throw new ApiError(400, 'A purchase is reviewed once it is complete');
    const data = parse(z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), req.body);
    const updated = await prisma.vehiclePurchase.update({ where: { id: p.id }, data: { reviewRating: data.rating, reviewComment: data.comment ?? null }, include: purchaseInclude });
    if (p.listing.dealershipId) { const all = await prisma.vehiclePurchase.findMany({ where: { listing: { dealershipId: p.listing.dealershipId }, reviewRating: { not: null } }, select: { reviewRating: true } }); await prisma.dealership.update({ where: { id: p.listing.dealershipId }, data: { ratingAvg: Math.round(all.reduce((s, r) => s + (r.reviewRating ?? 0), 0) / all.length * 10) / 10, ratingCount: all.length } }); }
    ok(res, purchaseCard(updated, req.user!.id));
  } catch (error) { next(error); }
});

// --------------------------------------------------------------- mechanics

router.get('/mechanics', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.MechanicWhereInput = { isActive: true, isVerified: true };
    const search = q(req, 'q');
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { headline: { contains: search, mode: 'insensitive' } }, { suburb: { contains: search, mode: 'insensitive' } }, { city: { contains: search, mode: 'insensitive' } }, { makes: { has: search } }];
    if (q(req, 'state')) where.state = q(req, 'state');
    if (q(req, 'city')) where.OR = [...(where.OR ?? []), { city: { contains: q(req, 'city'), mode: 'insensitive' } }, { suburb: { contains: q(req, 'city'), mode: 'insensitive' } }];
    if (q(req, 'service')) where.services = { has: q(req, 'service') };
    if (q(req, 'make')) where.OR = [...(where.OR ?? []), { makes: { has: q(req, 'make') } }, { makes: { isEmpty: true } }];
    for (const flag of ['womenOwned', 'womenMechanics', 'evCapable', 'mobile', 'loanCar', 'afterHours', 'doesInspections', 'acceptsBookings'] as const) if (qBool(req, flag)) where[flag] = true;
    if (q(req, 'language')) where.languages = { has: q(req, 'language') };
    if (qNum(req, 'maxRate')) where.labourRateHour = { lte: qNum(req, 'maxRate') };
    const p = page(req);
    const service = q(req, 'service');
    const maxPrice = qNum(req, 'maxPrice');
    const orderBy: Prisma.MechanicOrderByWithRelationInput[] = [{ isFeatured: 'desc' }, { ratingCount: 'desc' }, { name: 'asc' }];
    let rows: Mechanic[];
    let total: number;
    if (service && maxPrice) {
      // A ceiling on the job's price is read off each workshop's own list (or the typical range), so it is applied after the query.
      const within = (await prisma.mechanic.findMany({ where, orderBy, take: 200 })).filter((m) => { const pr = priceFor(m.priceList, service); return pr.from !== null && pr.from <= maxPrice; });
      total = within.length;
      rows = within.slice((p - 1) * 20, p * 20);
    } else {
      [rows, total] = await Promise.all([prisma.mechanic.findMany({ where, orderBy, skip: (p - 1) * 20, take: 20 }), prisma.mechanic.count({ where })]);
    }
    const today = localParts(new Date(), 'Australia/Brisbane').day;
    const cards = await Promise.all(rows.map(async (m) => {
      let nextFree: string | null = null;
      if (m.acceptsBookings && m.ownerUserId) {
        const booked = await prisma.mechanicBooking.findMany({ where: { mechanicId: m.id, status: { in: ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'] }, scheduledAt: { gte: dayDate(today) } }, select: { scheduledAt: true, durationMinutes: true } });
        nextFree = nextAvailableDays({ availability: m.availability as Availability | null, slotMinutes: m.slotMinutes, from: today, booked, days: 14 })[0]?.day ?? null;
      }
      return { ...mechanicCard(m), nextFree, price: service ? priceFor(m.priceList, service) : null };
    }));
    ok(res, { mechanics: cards, total, page: p, serviceKinds: SERVICE_KINDS, makes: MAKES });
  } catch (error) { next(error); }
});

router.get('/mechanics/:slug', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.mechanic.findFirst({ where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] } });
    if (!m) throw new ApiError(404, 'Workshop not found');
    const isOwner = Boolean(req.user && m.ownerUserId === req.user.id);
    if (!m.isActive || (!m.isVerified && !isOwner && !isAdmin(req))) throw new ApiError(404, 'Workshop not found');
    const [reviews, tz] = await Promise.all([prisma.mechanicReview.findMany({ where: { mechanicId: m.id, ...(isAdmin(req) ? {} : { isHidden: false }) }, orderBy: { createdAt: 'desc' }, take: 30, include: { user: { select: { firstName: true, lastName: true } }, booking: { select: { kind: true } } } }), memberTimezone(m.ownerUserId)]);
    const today = localParts(new Date(), tz).day;
    const booked = m.acceptsBookings ? await prisma.mechanicBooking.findMany({ where: { mechanicId: m.id, status: { in: ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'] }, scheduledAt: { gte: dayDate(today) } }, select: { scheduledAt: true, durationMinutes: true } }) : [];
    ok(res, {
      ...mechanicCard(m), about: m.about, address: m.address, licenceNumber: m.licenceNumber, isOwner, canModerate: isAdmin(req), timezone: tz,
      prices: (m.services.length ? m.services : SERVICE_KINDS.map((s) => s.key)).map((k) => ({ kind: k, label: serviceKind(k)?.label ?? k, ...priceFor(m.priceList, k) })),
      reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, transparency: r.transparency, comment: r.comment, isHidden: r.isHidden, by: shortName(r.user), job: serviceKind(r.booking.kind)?.label ?? r.booking.kind, createdAt: r.createdAt })),
      nextAvailable: m.acceptsBookings && m.ownerUserId ? nextAvailableDays({ availability: m.availability as Availability | null, slotMinutes: m.slotMinutes, timezone: tz, from: today, booked }) : [],
    });
  } catch (error) { next(error); }
});

router.get('/mechanics/:id/slots', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.mechanic.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }], isActive: true } });
    if (!m) throw new ApiError(404, 'Workshop not found');
    const day = parse(isoDaySchema, req.query.day);
    const tz = await memberTimezone(m.ownerUserId);
    const kind = q(req, 'service');
    const minutes = kind ? bookingMinutes(kind, m.slotMinutes) : m.slotMinutes;
    const booked = await prisma.mechanicBooking.findMany({ where: { mechanicId: m.id, status: { in: ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'] }, scheduledAt: { gte: dayDate(addDays(day, -1)), lte: dayDate(addDays(day, 2)) } }, select: { scheduledAt: true, durationMinutes: true } });
    ok(res, { day, slots: availableSlots({ availability: m.availability as Availability | null, slotMinutes: minutes, timezone: tz, day, booked }), timezone: tz, minutes });
  } catch (error) { next(error); }
});

const bookingSchema = z.object({ kind: z.string().trim().min(1).max(30), scheduledAt: z.string().datetime(), vehicleId: uuid.nullable().optional(), concern: z.string().trim().max(2000).nullable().optional(), dropOff: z.boolean().optional(), address: z.string().trim().max(200).nullable().optional(), odometerKm: z.coerce.number().int().min(0).max(1_500_000).nullable().optional(), parts: z.array(z.object({ name: z.string().trim().min(1).max(120), qty: z.coerce.number().int().min(1).max(99).optional(), note: z.string().trim().max(300).optional() })).max(20).optional() });

router.post('/mechanics/:id/bookings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.mechanic.findFirst({ where: { OR: [{ id: req.params.id }, { slug: req.params.id }], isActive: true, isVerified: true } });
    if (!m) throw new ApiError(404, 'Workshop not found');
    if (!m.acceptsBookings || !m.ownerUserId) throw new ApiError(400, 'This workshop takes bookings by phone or on its own site');
    if (m.ownerUserId === req.user!.id) throw new ApiError(400, 'That is your own workshop');
    const data = parse(bookingSchema, req.body);
    if (!serviceKind(data.kind)) throw new ApiError(400, 'Pick a kind of work from the list');
    if (data.dropOff === false && !m.mobile) throw new ApiError(400, 'This workshop does not come to you');
    if (data.vehicleId) { const v = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, userId: req.user!.id } }); if (!v) throw new ApiError(404, 'That car is not in your garage'); }
    const start = new Date(data.scheduledAt);
    const tz = await memberTimezone(m.ownerUserId);
    const day = localParts(start, tz).day;
    const minutes = bookingMinutes(data.kind, m.slotMinutes);
    const booked = await prisma.mechanicBooking.findMany({ where: { mechanicId: m.id, status: { in: ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'] }, scheduledAt: { gte: dayDate(addDays(day, -1)), lte: dayDate(addDays(day, 2)) } }, select: { scheduledAt: true, durationMinutes: true } });
    if (!availableSlots({ availability: m.availability as Availability | null, slotMinutes: minutes, timezone: tz, day, booked }).some((s) => s.start === start.toISOString())) throw new ApiError(400, 'That time is not free. Pick one of the offered slots.');
    const b = await prisma.mechanicBooking.create({ data: { mechanicId: m.id, userId: req.user!.id, vehicleId: data.vehicleId ?? null, kind: data.kind, scheduledAt: start, durationMinutes: minutes, dropOff: data.dropOff !== false, address: data.address ?? null, concern: data.concern ?? null, odometerKm: data.odometerKm ?? null, partsRequested: data.parts?.length ? (normaliseParts(data.parts) as unknown as Prisma.InputJsonValue) : undefined }, include: bookingInclude });
    await note(m.ownerUserId, 'A new booking request', `${serviceKind(data.kind)?.label ?? data.kind}, ${start.toLocaleString('en-AU', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Quote it or confirm it from your workshop page.`, '/dashboard/cars/workshop', { kind: 'CAR_BOOKING', id: b.id });
    ok(res, bookingCard(b), 201);
  } catch (error) { next(error); }
});

router.get('/bookings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.mechanicBooking.findMany({ where: { userId: req.user!.id }, orderBy: { scheduledAt: 'desc' }, take: 100, include: bookingInclude });
    ok(res, rows.map((b) => bookingCard(b)));
  } catch (error) { next(error); }
});

async function ownBooking(req: AuthRequest, id: string) {
  const b = await prisma.mechanicBooking.findFirst({ where: { id, userId: req.user!.id }, include: bookingInclude });
  if (!b) throw new ApiError(404, 'Booking not found');
  return b;
}

router.get('/bookings/:id/ics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = await ownBooking(req, req.params.id);
    const ics = buildBookingIcs({ id: b.id, scheduledAt: b.scheduledAt, durationMinutes: b.durationMinutes, mode: 'IN_PERSON', practitionerName: b.mechanic.name, kindLabel: serviceKind(b.kind)?.label ?? 'Car service', location: [b.mechanic.suburb || b.mechanic.city, b.mechanic.state].filter(Boolean).join(', ') || null, appUrl: `${clientBase()}/dashboard/cars/bookings` });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="car-service-${b.id.slice(0, 8)}.ics"`);
    res.send(ics);
  } catch (error) { next(error); }
});

router.patch('/bookings/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = await ownBooking(req, req.params.id);
    const data = parse(z.object({ status: z.literal('CANCELLED').optional(), acceptQuote: z.boolean().optional(), concern: z.string().trim().max(2000).nullable().optional(), cancelReason: z.string().trim().max(500).optional() }), req.body);
    const patch: Prisma.MechanicBookingUpdateInput = {};
    if (data.concern !== undefined) patch.concern = data.concern;
    if (data.acceptQuote) {
      if (b.status !== 'QUOTED' || !b.quoteAmount) throw new ApiError(400, 'There is no quote to accept yet');
      patch.status = 'CONFIRMED'; patch.quoteAcceptedAt = new Date();
    }
    if (data.status === 'CANCELLED') {
      if (!['REQUESTED', 'QUOTED', 'CONFIRMED'].includes(b.status)) throw new ApiError(400, 'This booking can no longer be cancelled here; call the workshop');
      if (b.status === 'CONFIRMED' && !canCancel(b.scheduledAt)) throw new ApiError(400, 'Inside twenty-four hours, cancel by phone so the workshop can fill the slot');
      patch.status = 'CANCELLED'; patch.cancelReason = data.cancelReason ?? null;
      if (b.escrow && b.escrowPaymentId) { const e = await prisma.escrowPayment.findUnique({ where: { id: b.escrowPaymentId }, select: { paymentIntentId: true, status: true } }); if (e?.paymentIntentId && !['CANCELED', 'REFUNDED', 'FAILED'].includes(e.status)) await cancelEscrowPayment(e.paymentIntentId, { id: req.user!.id, role: req.user!.role }, data.cancelReason); }
    }
    const updated = await prisma.mechanicBooking.update({ where: { id: b.id }, data: patch, include: bookingInclude });
    if (b.mechanic.ownerUserId && (data.acceptQuote || data.status === 'CANCELLED')) await note(b.mechanic.ownerUserId, data.acceptQuote ? 'A quote was accepted' : 'A booking was cancelled', `${serviceKind(b.kind)?.label ?? b.kind}, ${b.scheduledAt.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${data.acceptQuote ? '. Go ahead on the day.' : ' is free again.'}`, '/dashboard/cars/workshop', { kind: data.acceptQuote ? 'CAR_QUOTE_ACCEPTED' : 'CAR_BOOKING_CANCELLED', id: b.id });
    ok(res, bookingCard(updated));
  } catch (error) { next(error); }
});

router.post('/bookings/:id/pay', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = await ownBooking(req, req.params.id);
    const amount = b.finalAmount ?? b.quoteAmount;
    if (!amount || amount <= 0) throw new ApiError(400, 'There is no quote to pay yet');
    if (!['QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status)) throw new ApiError(400, 'This booking is not at a stage where it can be paid');
    if (!b.mechanic.ownerUserId) throw new ApiError(400, 'This workshop is paid directly');
    if (b.escrowPaymentId) { const e = await prisma.escrowPayment.findUnique({ where: { id: b.escrowPaymentId }, select: { paymentIntentId: true } }); ok(res, { alreadyHeld: true, clientSecret: e?.paymentIntentId ? await getEscrowClientSecret(e.paymentIntentId) : null }); return; }
    let hold;
    try { hold = await createEscrowPayment({ buyerId: req.user!.id, sellerId: b.mechanic.ownerUserId, amount: Math.round(amount * 100), currency: 'aud', description: `${serviceKind(b.kind)?.label ?? b.kind} at ${b.mechanic.name}`, sessionType: 'car_service', platformFeePercent: SERVICE_FEE_PERCENT, metadata: { bookingId: b.id } }); }
    catch (error) { if (error instanceof ApiError && error.statusCode === 400) throw new ApiError(409, 'This workshop has not finished setting up payouts; pay them directly on the day'); throw error; }
    const updated = await prisma.mechanicBooking.update({ where: { id: b.id }, data: { escrowPaymentId: hold.escrowId, paidAt: new Date(), ...(b.status === 'QUOTED' ? { status: 'CONFIRMED', quoteAcceptedAt: new Date() } : {}) }, include: bookingInclude });
    await note(b.mechanic.ownerUserId, 'A job has been paid into holding', `$${amount.toLocaleString('en-AU')} for ${serviceKind(b.kind)?.label ?? b.kind} is held and released when the member confirms the work is done.`, '/dashboard/cars/workshop', { kind: 'CAR_BOOKING_PAID', id: b.id });
    ok(res, { ...bookingCard(updated), payment: { paymentIntentId: hold.paymentIntentId, clientSecret: hold.clientSecret, amount: hold.amount, platformFee: hold.platformFee, currency: 'aud' } }, 201);
  } catch (error) { next(error); }
});

router.post('/bookings/:id/release', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = await ownBooking(req, req.params.id);
    if (b.status !== 'COMPLETED') throw new ApiError(400, 'Release the payment once the workshop has marked the job done');
    if (!b.escrowPaymentId) throw new ApiError(400, 'Nothing is held for this job');
    const e = await prisma.escrowPayment.findUnique({ where: { id: b.escrowPaymentId }, select: { paymentIntentId: true, status: true } });
    if (e?.paymentIntentId && (e.status === 'PENDING' || e.status === 'AUTHORIZED')) await captureEscrowPayment(e.paymentIntentId, { id: req.user!.id, role: req.user!.role });
    if (b.mechanic.ownerUserId) await note(b.mechanic.ownerUserId, 'Payment released', `The member released the payment for ${serviceKind(b.kind)?.label ?? b.kind}.`, '/dashboard/cars/workshop', { kind: 'CAR_BOOKING_RELEASED', id: b.id });
    ok(res, { released: true });
  } catch (error) { next(error); }
});

router.post('/bookings/:id/review', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = await ownBooking(req, req.params.id);
    if (b.status !== 'COMPLETED') throw new ApiError(400, 'Only a completed job can be rated. That is what makes the ratings mean something.');
    const data = parse(z.object({ rating: z.coerce.number().int().min(1).max(5), transparency: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), req.body);
    const review = await prisma.mechanicReview.upsert({ where: { bookingId: b.id }, create: { mechanicId: b.mechanicId, userId: req.user!.id, bookingId: b.id, rating: data.rating, transparency: data.transparency, comment: data.comment ?? null }, update: { rating: data.rating, transparency: data.transparency, comment: data.comment ?? null } });
    const all = await prisma.mechanicReview.findMany({ where: { mechanicId: b.mechanicId }, select: { rating: true, transparency: true, isHidden: true } });
    await prisma.mechanic.update({ where: { id: b.mechanicId }, data: recomputeMechanicRating(all) });
    ok(res, { id: review.id }, 201);
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------- workshop

const workshopSchema = z.object({
  name: z.string().trim().min(2).max(80), headline: z.string().trim().min(5).max(140), about: z.string().trim().min(20).max(4000), womenOwned: z.boolean().optional(), womenMechanics: z.boolean().optional(), services: z.array(z.string().trim().max(30)).max(20).optional(), makes: z.array(z.string().trim().max(40)).max(30).optional(),
  evCapable: z.boolean().optional(), mobile: z.boolean().optional(), loanCar: z.boolean().optional(), afterHours: z.boolean().optional(), doesInspections: z.boolean().optional(), languages: z.array(z.string().trim().max(40)).max(10).optional(),
  suburb: z.string().trim().max(60).nullable().optional(), city: z.string().trim().max(60).nullable().optional(), state: stateEnum.nullable().optional(), postcode: z.string().trim().max(4).nullable().optional(), address: z.string().trim().max(200).nullable().optional(), phone: z.string().trim().max(20).nullable().optional(), website: z.string().url().max(300).nullable().optional(), bookingUrl: z.string().url().max(300).nullable().optional(), licenceNumber: z.string().trim().max(30).nullable().optional(),
  priceList: z.array(z.object({ kind: z.string(), from: z.coerce.number().min(0), to: z.coerce.number().min(0).nullable().optional(), note: z.string().max(160).nullable().optional() })).max(30).optional(), labourRateHour: z.coerce.number().int().min(0).max(1000).nullable().optional(), partsWarrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional(), labourWarrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional(), warrantyNote: z.string().trim().max(300).nullable().optional(),
  availability: z.record(z.array(z.tuple([z.string(), z.string()]))).optional(), slotMinutes: z.coerce.number().int().min(15).max(480).optional(), acceptsBookings: z.boolean().optional(),
});

router.get('/workshop', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.mechanic.findUnique({ where: { ownerUserId: req.user!.id } });
    const counts = m ? await prisma.mechanicBooking.groupBy({ by: ['status'], where: { mechanicId: m.id }, _count: { _all: true } }) : [];
    const openInspections = m?.doesInspections ? await prisma.vehicleInspection.count({ where: { status: 'REQUESTED', kind: { not: 'SELLER_PROVIDED' }, ...(m.state ? { listing: { state: m.state } } : {}) } }) : 0;
    ok(res, { profile: m ? { ...mechanicCard(m), about: m.about, address: m.address, licenceNumber: m.licenceNumber, priceList: normalisePriceList(m.priceList), availability: m.availability, isActive: m.isActive } : null, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), openInspections, serviceKinds: SERVICE_KINDS, makes: MAKES });
  } catch (error) { next(error); }
});

router.put('/workshop', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(workshopSchema, req.body);
    const existing = await prisma.mechanic.findUnique({ where: { ownerUserId: req.user!.id } });
    const services = (data.services ?? []).filter((s) => serviceKind(s));
    const { availability, priceList, ...rest } = data;
    const payload = { ...rest, services, priceList: priceList ? (normalisePriceList(priceList) as unknown as Prisma.InputJsonValue) : undefined, availability: availability ? (normaliseAvailability(availability) as Prisma.InputJsonValue) : undefined };
    let m;
    if (existing) m = await prisma.mechanic.update({ where: { id: existing.id }, data: payload });
    else {
      let slug = slugify(data.name);
      if (await prisma.mechanic.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString('hex')}`;
      m = await prisma.mechanic.create({ data: { ...payload, slug, ownerUserId: req.user!.id, isVerified: false } });
      logger.info('A workshop profile was created and awaits verification', { mechanicId: m.id });
      await noteAdmins('A workshop wants to join the directory', `${m.name}${m.state ? `, ${m.state}` : ''} has created a profile. Verify it from the automotive admin page.`, '/dashboard/cars/admin', { kind: 'CAR_MECHANIC_VERIFY', id: m.id });
    }
    ok(res, { ...mechanicCard(m), about: m.about, priceList: normalisePriceList(m.priceList), availability: m.availability, pendingVerification: !m.isVerified }, existing ? 200 : 201);
  } catch (error) { next(error); }
});

router.get('/workshop/bookings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.mechanic.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true } });
    if (!m) throw new ApiError(404, 'You have no workshop profile yet');
    const rows = await prisma.mechanicBooking.findMany({ where: { mechanicId: m.id }, orderBy: { scheduledAt: 'desc' }, take: 200, include: { ...bookingInclude, user: { select: { firstName: true, lastName: true, email: true } } } });
    ok(res, rows.map((b) => ({ ...bookingCard(b, true), member: { name: personName(b.user), email: b.user.email } })));
  } catch (error) { next(error); }
});

router.patch('/workshop/bookings/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.mechanic.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true, name: true, partsWarrantyMonths: true, labourWarrantyMonths: true } });
    if (!m) throw new ApiError(404, 'You have no workshop profile yet');
    const b = await prisma.mechanicBooking.findFirst({ where: { id: req.params.id, mechanicId: m.id }, include: bookingInclude });
    if (!b) throw new ApiError(404, 'Booking not found');
    const data = parse(z.object({ status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'NO_SHOW']).optional(), quoteLines: z.array(z.object({ label: z.string(), amount: z.coerce.number().min(0), kind: z.enum(['PARTS', 'LABOUR', 'OTHER']).optional() })).max(40).optional(), quoteNote: z.string().trim().max(1000).nullable().optional(), workshopNote: z.string().trim().max(2000).nullable().optional(), finalAmount: money.nullable().optional(), odometerKm: z.coerce.number().int().min(0).max(1_500_000).nullable().optional(), partsWarrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional(), labourWarrantyMonths: z.coerce.number().int().min(0).max(120).nullable().optional() }), req.body);
    const patch: Prisma.MechanicBookingUpdateInput = { workshopNote: data.workshopNote, odometerKm: data.odometerKm, partsWarrantyMonths: data.partsWarrantyMonths, labourWarrantyMonths: data.labourWarrantyMonths, finalAmount: data.finalAmount };
    if (data.quoteLines) { const lines = normaliseQuoteLines(data.quoteLines); patch.quoteLines = lines as unknown as Prisma.InputJsonValue; patch.quoteAmount = quoteTotal(lines).total; patch.quoteNote = data.quoteNote ?? null; patch.quotedAt = new Date(); if (b.status === 'REQUESTED' && !data.status) patch.status = 'QUOTED'; }
    if (data.status) { patch.status = data.status; if (data.status === 'COMPLETED') patch.completedAt = new Date(); }
    const updated = await prisma.mechanicBooking.update({ where: { id: b.id }, data: patch, include: bookingInclude });
    if (updated.status === 'COMPLETED' && b.status !== 'COMPLETED' && b.vehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: b.vehicleId } });
      if (v) {
        const cost = updated.finalAmount ?? updated.quoteAmount ?? null;
        await prisma.vehicleServiceRecord.upsert({ where: { bookingId: b.id }, create: { vehicleId: v.id, bookingId: b.id, mechanicId: m.id, date: new Date(), odometerKm: updated.odometerKm, kind: b.kind, title: serviceKind(b.kind)?.label ?? b.kind, workshop: m.name, cost, notes: updated.workshopNote, partsWarrantyMonths: updated.partsWarrantyMonths ?? m.partsWarrantyMonths, labourWarrantyMonths: updated.labourWarrantyMonths ?? m.labourWarrantyMonths }, update: { cost, notes: updated.workshopNote, odometerKm: updated.odometerKm } });
        const vp: Prisma.VehicleUpdateInput = {};
        if (SERVICE_KINDS_THAT_RESET.has(b.kind)) { const nxt = nextServiceAfter(new Date(), updated.odometerKm, v.serviceIntervalMonths, v.serviceIntervalKm); vp.nextServiceDueAt = nxt.dueAt; vp.nextServiceDueKm = nxt.dueKm; }
        if (updated.odometerKm !== null && (v.odometerKm === null || updated.odometerKm >= v.odometerKm)) { vp.odometerKm = updated.odometerKm; vp.odometerAt = new Date(); }
        if (Object.keys(vp).length) await prisma.vehicle.update({ where: { id: v.id }, data: vp });
      }
    }
    if ((data.status && data.status !== b.status) || data.quoteLines) {
      const words: Record<string, string> = { QUOTED: `quoted at $${(patch.quoteAmount as number | undefined)?.toLocaleString('en-AU') ?? ''}`, CONFIRMED: 'confirmed', IN_PROGRESS: 'under way', COMPLETED: 'done', DECLINED: 'declined', NO_SHOW: 'marked as missed' };
      const status = (patch.status as string | undefined) ?? b.status;
      await note(b.userId, `Your booking is ${words[status] ?? status.toLowerCase()}`, `${m.name}, ${serviceKind(b.kind)?.label ?? b.kind}.${status === 'QUOTED' ? ' Read the lines and accept the quote before the work starts.' : status === 'COMPLETED' ? `Release the payment once you have the car back, and rate the job.` : status === 'DECLINED' ? ' Another workshop in the directory may have the time.' : ''}`, '/dashboard/cars/bookings', { kind: 'CAR_BOOKING_STATUS', id: b.id });
    }
    ok(res, bookingCard(updated, true));
  } catch (error) { next(error); }
});

// ------------------------------------------------------------- dealerships

const dealershipSchema = z.object({ name: z.string().trim().min(2).max(80), headline: z.string().trim().min(5).max(140), about: z.string().trim().max(4000).nullable().optional(), brands: z.array(z.string().trim().max(40)).max(20).optional(), suburb: z.string().trim().max(60).nullable().optional(), city: z.string().trim().max(60).nullable().optional(), state: stateEnum.nullable().optional(), postcode: z.string().trim().max(4).nullable().optional(), address: z.string().trim().max(200).nullable().optional(), phone: z.string().trim().max(20).nullable().optional(), website: z.string().url().max(300).nullable().optional(), email: z.string().email().max(120).nullable().optional(), womenLed: z.boolean().optional(), financeAvailable: z.boolean().optional(), financePartners: z.array(z.string().trim().max(60)).max(10).optional(), hours: z.record(z.array(z.tuple([z.string(), z.string()]))).optional() });

router.get('/dealerships', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.DealershipWhereInput = { isActive: true, isVerified: true };
    if (q(req, 'state')) where.state = q(req, 'state');
    if (q(req, 'brand')) where.brands = { has: q(req, 'brand') };
    if (q(req, 'q')) where.OR = [{ name: { contains: q(req, 'q'), mode: 'insensitive' } }, { city: { contains: q(req, 'q'), mode: 'insensitive' } }, { suburb: { contains: q(req, 'q'), mode: 'insensitive' } }];
    if (qBool(req, 'womenLed')) where.womenLed = true;
    const rows = await prisma.dealership.findMany({ where, orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }], take: 100, include: { _count: { select: { listings: { where: { status: { in: ['ACTIVE', 'UNDER_OFFER'] } } } } } } });
    ok(res, { dealerships: rows.map((d) => ({ ...dealershipCard(d), stock: d._count.listings })), total: rows.length });
  } catch (error) { next(error); }
});

router.get('/dealerships/:slug', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const d = await prisma.dealership.findFirst({ where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] } });
    if (!d) throw new ApiError(404, 'Dealership not found');
    const isOwner = Boolean(req.user && d.ownerUserId === req.user.id);
    if (!d.isActive || (!d.isVerified && !isOwner && !isAdmin(req))) throw new ApiError(404, 'Dealership not found');
    const [listings, models] = await Promise.all([
      prisma.vehicleListing.findMany({ where: { dealershipId: d.id, status: { in: ['ACTIVE', 'UNDER_OFFER'] } }, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }], take: 40, include: listingInclude }),
      d.brands.length ? prisma.carModel.findMany({ where: { isActive: true, make: { in: d.brands } }, orderBy: [{ make: 'asc' }, { priceFrom: 'asc' }], take: 40 }) : [],
    ]);
    ok(res, { ...dealershipCard(d), about: d.about, email: d.email, isOwner, listings: listings.map((l) => listingCard(l, { viewerId: req.user?.id })), models: models.map((c) => carCard(c)), canRequest: Boolean(req.user) && !isOwner });
  } catch (error) { next(error); }
});

router.get('/dealership', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const d = await prisma.dealership.findUnique({ where: { ownerUserId: req.user!.id } });
    const counts = d ? { testDrives: await prisma.testDriveRequest.count({ where: { dealershipId: d.id, status: 'REQUESTED' } }), tradeIns: await prisma.tradeInRequest.count({ where: { status: 'OPEN', OR: [{ dealershipId: d.id }, { dealershipId: null, ...(d.brands.length ? { make: { in: d.brands } } : {}) }] } }), stock: await prisma.vehicleListing.count({ where: { dealershipId: d.id, status: { in: ['ACTIVE', 'UNDER_OFFER'] } } }) } : null;
    const referrals = d ? await prisma.carReferral.findMany({ where: { dealershipId: d.id, status: { not: 'VOID' } }, orderBy: { createdAt: 'desc' }, take: 50, include: referralInclude }) : [];
    ok(res, { profile: d ? { ...dealershipCard(d), about: d.about, email: d.email, isActive: d.isActive } : null, counts, makes: MAKES, referrals: referrals.map(referralCard), referralFee: REFERRAL_FEES.dealerSale });
  } catch (error) { next(error); }
});

router.put('/dealership', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(dealershipSchema, req.body);
    const existing = await prisma.dealership.findUnique({ where: { ownerUserId: req.user!.id } });
    const { hours, ...rest } = data;
    const payload = { ...rest, hours: hours ? (normaliseAvailability(hours) as Prisma.InputJsonValue) : undefined };
    let d;
    if (existing) d = await prisma.dealership.update({ where: { id: existing.id }, data: payload });
    else {
      let slug = slugify(data.name);
      if (await prisma.dealership.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString('hex')}`;
      d = await prisma.dealership.create({ data: { ...payload, slug, ownerUserId: req.user!.id, isVerified: false } });
      await noteAdmins('A dealership wants to join', `${d.name}${d.state ? `, ${d.state}` : ''} has created a profile. Verify it from the automotive admin page.`, '/dashboard/cars/admin', { kind: 'CAR_DEALERSHIP_VERIFY', id: d.id });
    }
    ok(res, { ...dealershipCard(d), about: d.about, email: d.email, pendingVerification: !d.isVerified }, existing ? 200 : 201);
  } catch (error) { next(error); }
});

const testDriveCard = (t: Prisma.TestDriveRequestGetPayload<{ include: { dealership: { select: { id: true; name: true; slug: true; phone: true } }; carModel: { select: { slug: true; make: true; model: true; variant: true } }; listing: { select: { id: true; title: true } }; user: { select: { firstName: true; lastName: true; email: true; phone: true } } } }>, forDealer = false) => ({ id: t.id, status: t.status, preferredAt: t.preferredAt, alternativeAt: t.alternativeAt, note: t.note, dealerNote: t.dealerNote, confirmedAt: t.confirmedAt, createdAt: t.createdAt, dealership: t.dealership, car: t.carModel ? `${t.carModel.make} ${t.carModel.model}${t.carModel.variant ? ` ${t.carModel.variant}` : ''}` : t.listing?.title ?? null, carSlug: t.carModel?.slug ?? null, listingId: t.listing?.id ?? null, member: forDealer ? { name: personName(t.user), email: t.user.email, phone: t.user.phone } : undefined });
const testDriveInclude = { dealership: { select: { id: true, name: true, slug: true, phone: true } }, carModel: { select: { slug: true, make: true, model: true, variant: true } }, listing: { select: { id: true, title: true } }, user: { select: { firstName: true, lastName: true, email: true, phone: true } } } as const;

router.get('/dealership/requests', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const d = await prisma.dealership.findUnique({ where: { ownerUserId: req.user!.id } });
    if (!d) throw new ApiError(404, 'You have no dealership profile yet');
    const [testDrives, tradeIns] = await Promise.all([
      prisma.testDriveRequest.findMany({ where: { dealershipId: d.id }, orderBy: { preferredAt: 'desc' }, take: 100, include: testDriveInclude }),
      prisma.tradeInRequest.findMany({ where: { status: { in: ['OPEN', 'QUOTED'] }, OR: [{ dealershipId: d.id }, { dealershipId: null, ...(d.brands.length ? { make: { in: d.brands } } : {}) }] }, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { firstName: true, lastName: true } } } }),
    ]);
    ok(res, { testDrives: testDrives.map((t) => testDriveCard(t, true)), tradeIns: tradeIns.map((t) => ({ id: t.id, make: t.make, model: t.model, year: t.year, variant: t.variant, odometerKm: t.odometerKm, condition: t.condition, notes: t.notes, photos: photosOf(t.photos), estimateLow: t.estimateLow, estimateMid: t.estimateMid, estimateHigh: t.estimateHigh, status: t.status, expiresAt: t.expiresAt, addressedToYou: t.dealershipId === d.id, by: shortName(t.user), myQuote: (Array.isArray(t.quotes) ? (t.quotes as Array<{ dealershipId: string }>) : []).find((x) => x.dealershipId === d.id) ?? null })) });
  } catch (error) { next(error); }
});

router.patch('/dealership/test-drives/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const d = await prisma.dealership.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true, name: true } });
    if (!d) throw new ApiError(404, 'You have no dealership profile yet');
    const t = await prisma.testDriveRequest.findFirst({ where: { id: req.params.id, dealershipId: d.id } });
    if (!t) throw new ApiError(404, 'Request not found');
    const { sold, salePrice, ...data } = parse(z.object({ status: z.enum(['CONFIRMED', 'DECLINED', 'COMPLETED']).optional(), dealerNote: z.string().trim().max(1000).nullable().optional(), sold: z.boolean().optional(), salePrice: money.optional() }), req.body);
    const updated = await prisma.testDriveRequest.update({ where: { id: t.id }, data: { ...data, ...(data.status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}) }, include: testDriveInclude });
    if (data.status && data.status !== t.status) await note(t.userId, `Your test drive was ${data.status.toLowerCase()}`, `${d.name}${data.dealerNote ? `: ${data.dealerNote.slice(0, 200)}` : ''}`, '/dashboard/cars/requests', { kind: 'CAR_TEST_DRIVE', id: t.id });
    // A test drive that became a sale earns the referral fee the blueprint sets. The dealership reports it; the ledger records it once.
    let referral: { fee: number } | null = null;
    if (updated.status === 'COMPLETED' && sold && salePrice && salePrice > 0) {
      const existing = await prisma.carReferral.findFirst({ where: { kind: 'DEALER_SALE', referenceId: t.id } });
      if (existing) referral = { fee: existing.fee };
      else {
        const f = referralFee('DEALER_SALE', salePrice);
        const car = testDriveCard(updated).car ?? 'a car';
        const created = await prisma.carReferral.create({ data: { kind: 'DEALER_SALE', userId: t.userId, dealershipId: d.id, referenceId: t.id, partner: d.name, basisAmount: Math.round(salePrice), feePercent: f.percent, fee: f.fee, note: `${car} sold for $${Math.round(salePrice).toLocaleString('en-AU')} after a test drive booked on ATHENA` } });
        referral = { fee: created.fee };
        await noteAdmins('A dealership reported a sale', `${d.name} sold ${car} for $${Math.round(salePrice).toLocaleString('en-AU')} after a test drive booked here. The referral fee is $${f.fee}; confirm it on the ledger.`, '/dashboard/cars/admin', { kind: 'CAR_REFERRAL', id: created.id });
      }
    }
    ok(res, { ...testDriveCard(updated, true), referralFee: referral?.fee ?? null });
  } catch (error) { next(error); }
});

router.post('/dealership/trade-ins/:id/quotes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const d = await prisma.dealership.findUnique({ where: { ownerUserId: req.user!.id }, select: { id: true, name: true, isVerified: true } });
    if (!d || !d.isVerified) throw new ApiError(403, 'Only a verified dealership can quote');
    const t = await prisma.tradeInRequest.findUnique({ where: { id: req.params.id } });
    if (!t || !['OPEN', 'QUOTED'].includes(t.status) || t.expiresAt < new Date()) throw new ApiError(404, 'That request is no longer open');
    const data = parse(z.object({ amount: z.coerce.number().int().min(100).max(2_000_000), validDays: z.coerce.number().int().min(1).max(30).optional(), note: z.string().trim().max(500).optional() }), req.body);
    const quotes = (Array.isArray(t.quotes) ? (t.quotes as Array<Record<string, unknown>>) : []).filter((x) => x.dealershipId !== d.id);
    quotes.push({ dealershipId: d.id, name: d.name, amount: data.amount, validUntil: new Date(Date.now() + (data.validDays ?? 7) * 86400000).toISOString(), note: data.note ?? null, at: new Date().toISOString() });
    await prisma.tradeInRequest.update({ where: { id: t.id }, data: { quotes: quotes as unknown as Prisma.InputJsonValue, status: 'QUOTED' } });
    await note(t.userId, `A trade-in quote of $${data.amount.toLocaleString('en-AU')}`, `${d.name} has quoted on your ${t.year} ${t.make} ${t.model}. The guide put it at $${t.estimateLow.toLocaleString('en-AU')} to $${t.estimateHigh.toLocaleString('en-AU')} privately.`, '/dashboard/cars/requests', { kind: 'CAR_TRADE_IN_QUOTE', id: t.id });
    ok(res, { quotes: quotes.length }, 201);
  } catch (error) { next(error); }
});

// -------------------------------------------------- test drives, trade-ins

router.post('/test-drives', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(z.object({ dealershipId: uuid.optional(), carModelId: uuid.optional(), listingId: uuid.optional(), preferredAt: z.string().datetime(), alternativeAt: z.string().datetime().optional(), note: z.string().trim().max(1000).optional() }), req.body);
    if (!data.dealershipId && !data.listingId) throw new ApiError(400, 'Pick a dealership, or a dealer\'s listing');
    let dealershipId = data.dealershipId ?? null;
    if (data.listingId) { const l = await prisma.vehicleListing.findUnique({ where: { id: data.listingId }, select: { dealershipId: true, sellerId: true } }); if (!l) throw new ApiError(404, 'Listing not found'); if (!l.dealershipId) throw new ApiError(400, 'Private sellers arrange a look at the car by message; test drives are booked with dealerships'); dealershipId = l.dealershipId; }
    const d = await prisma.dealership.findFirst({ where: { id: dealershipId!, isActive: true, isVerified: true }, select: { id: true, name: true, ownerUserId: true } });
    if (!d) throw new ApiError(404, 'Dealership not found');
    if (new Date(data.preferredAt).getTime() < Date.now()) throw new ApiError(400, 'Pick a time in the future');
    const t = await prisma.testDriveRequest.create({ data: { userId: req.user!.id, dealershipId: d.id, carModelId: data.carModelId ?? null, listingId: data.listingId ?? null, preferredAt: new Date(data.preferredAt), alternativeAt: data.alternativeAt ? new Date(data.alternativeAt) : null, note: data.note ?? null }, include: testDriveInclude });
    if (d.ownerUserId) await note(d.ownerUserId, 'A test drive request', `${testDriveCard(t).car ?? 'A car'} on ${new Date(data.preferredAt).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Confirm it from your dealership page.`, '/dashboard/cars/dealership', { kind: 'CAR_TEST_DRIVE', id: t.id });
    ok(res, testDriveCard(t), 201);
  } catch (error) { next(error); }
});

router.get('/test-drives', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.testDriveRequest.findMany({ where: { userId: req.user!.id }, orderBy: { preferredAt: 'desc' }, take: 50, include: testDriveInclude });
    ok(res, rows.map((t) => testDriveCard(t)));
  } catch (error) { next(error); }
});

router.patch('/test-drives/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await prisma.testDriveRequest.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: testDriveInclude });
    if (!t) throw new ApiError(404, 'Request not found');
    if (!['REQUESTED', 'CONFIRMED'].includes(t.status)) throw new ApiError(400, 'That request is closed');
    const updated = await prisma.testDriveRequest.update({ where: { id: t.id }, data: { status: 'CANCELLED' }, include: testDriveInclude });
    ok(res, testDriveCard(updated));
  } catch (error) { next(error); }
});

router.post('/trade-ins', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(z.object({ vehicleId: uuid.optional(), dealershipId: uuid.optional(), make: z.string().trim().max(40).optional(), model: z.string().trim().max(60).optional(), year: z.coerce.number().int().min(1960).max(new Date().getFullYear() + 1).optional(), variant: z.string().trim().max(80).optional(), odometerKm: z.coerce.number().int().min(0).max(1_500_000).optional(), condition: conditionEnum, notes: z.string().trim().max(1000).optional(), photos: z.array(z.string().url().max(500)).max(12).optional(), newPrice: money.optional() }), req.body);
    let make = data.make; let model = data.model; let year = data.year; let km = data.odometerKm; let variant = data.variant ?? null; let body: BodyKey | null = null; let fuel: FuelKey | null = null; let newPrice = data.newPrice ?? null;
    if (data.vehicleId) { const v = await ownVehicle(req, data.vehicleId); make = v.make; model = v.model; year = v.year; km = km ?? projectedOdometer(v) ?? 0; variant = variant ?? v.variant; body = v.bodyType as BodyKey | null; fuel = v.fuelType as FuelKey; newPrice = newPrice ?? v.newPrice ?? (v.boughtNew ? v.purchasePrice : null); }
    if (!make || !model || !year || km === undefined) throw new ApiError(400, 'The make, model, year and kilometres are needed, or a car from your garage');
    const fromCatalogue = newPrice ? null : await catalogueNewPrice(make, model);
    const v = estimateValue({ year, odometerKm: km, bodyType: body ?? fromCatalogue?.bodyType ?? null, fuelType: fuel ?? fromCatalogue?.fuelType ?? null, condition: data.condition, newPrice: newPrice ?? fromCatalogue?.price ?? null, make });
    const t = await prisma.tradeInRequest.create({ data: { userId: req.user!.id, vehicleId: data.vehicleId ?? null, dealershipId: data.dealershipId ?? null, make, model, year, variant, odometerKm: km, condition: data.condition, photos: data.photos ?? [], notes: data.notes ?? null, estimateLow: v.low, estimateMid: v.mid, estimateHigh: v.high, expiresAt: new Date(Date.now() + 30 * 86400000) } });
    const dealers = data.dealershipId ? await prisma.dealership.findMany({ where: { id: data.dealershipId, isActive: true, isVerified: true }, select: { ownerUserId: true } }) : await prisma.dealership.findMany({ where: { isActive: true, isVerified: true, ownerUserId: { not: null } }, select: { ownerUserId: true }, take: 10 });
    await Promise.all(dealers.filter((d) => d.ownerUserId).map((d) => note(d.ownerUserId!, 'A trade-in quote is wanted', `${year} ${make} ${model}, ${km!.toLocaleString('en-AU')} km, ${data.condition.toLowerCase()} condition. Quote from your dealership page.`, '/dashboard/cars/dealership', { kind: 'CAR_TRADE_IN', id: t.id })));
    ok(res, { id: t.id, estimate: v, tradeIn: v.tradeIn, expiresAt: t.expiresAt, dealersAsked: dealers.length }, 201);
  } catch (error) { next(error); }
});

router.get('/trade-ins', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.tradeInRequest.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 30, include: { dealership: { select: { name: true, slug: true } } } });
    ok(res, rows.map((t) => ({ id: t.id, make: t.make, model: t.model, year: t.year, variant: t.variant, odometerKm: t.odometerKm, condition: t.condition, status: t.status, estimateLow: t.estimateLow, estimateMid: t.estimateMid, estimateHigh: t.estimateHigh, tradeInGuide: Math.round(t.estimateMid * 0.85 / 100) * 100, expiresAt: t.expiresAt, createdAt: t.createdAt, dealership: t.dealership, quotes: Array.isArray(t.quotes) ? t.quotes : [] })));
  } catch (error) { next(error); }
});

router.patch('/trade-ins/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await prisma.tradeInRequest.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!t) throw new ApiError(404, 'Request not found');
    const data = parse(z.object({ status: z.enum(['WITHDRAWN', 'ACCEPTED']), dealershipId: uuid.optional() }), req.body);
    if (data.status === 'ACCEPTED') {
      const quote = (Array.isArray(t.quotes) ? (t.quotes as Array<{ dealershipId: string; name: string; amount: number }>) : []).find((x) => x.dealershipId === data.dealershipId);
      if (!quote) throw new ApiError(400, 'Pick one of the quotes');
      const d = await prisma.dealership.findUnique({ where: { id: quote.dealershipId }, select: { ownerUserId: true, name: true } });
      await prisma.tradeInRequest.update({ where: { id: t.id }, data: { status: 'ACCEPTED', dealershipId: quote.dealershipId } });
      if (d?.ownerUserId) await note(d.ownerUserId, 'Your trade-in quote was accepted', `$${quote.amount.toLocaleString('en-AU')} for the ${t.year} ${t.make} ${t.model}. The member will be in touch to bring it in.`, '/dashboard/cars/dealership', { kind: 'CAR_TRADE_IN_ACCEPTED', id: t.id });
      ok(res, { status: 'ACCEPTED', dealership: d?.name ?? null });
      return;
    }
    await prisma.tradeInRequest.update({ where: { id: t.id }, data: { status: 'WITHDRAWN' } });
    ok(res, { status: 'WITHDRAWN' });
  } catch (error) { next(error); }
});

// ------------------------------------------------------ finance applications

const applicationSchema = z.object({ purpose: z.enum(['NEW', 'USED', 'REFINANCE']), vehiclePrice: money, deposit: money.optional(), tradeIn: money.optional(), termMonths: z.coerce.number().int().min(12).max(84), balloonPct: z.coerce.number().min(0).max(60).optional(), ratePct: z.coerce.number().min(0).max(40).optional(), incomeAnnual: money, expensesMonthly: money, otherDebtsMonthly: money.optional(), dependants: z.coerce.number().int().min(0).max(12).optional(), employment: z.string().trim().max(30), employmentMonths: z.coerce.number().int().min(0).max(600).nullable().optional(), residency: z.enum(['CITIZEN', 'PR', 'VISA']).nullable().optional(), hasDefaults: z.boolean().optional(), listingId: uuid.nullable().optional(), carModelId: uuid.nullable().optional(), submit: z.boolean().optional() });

function applicationCard(a: CarFinanceApplication) {
  return { id: a.id, referenceCode: a.referenceCode, status: a.status, purpose: a.purpose, vehiclePrice: a.vehiclePrice, deposit: a.deposit, tradeIn: a.tradeIn, amount: a.amount, termMonths: a.termMonths, balloonPct: num0(a.balloonPct), ratePct: num0(a.ratePct), repaymentMonthly: a.repaymentMonthly, incomeAnnual: a.incomeAnnual, expensesMonthly: a.expensesMonthly, otherDebtsMonthly: a.otherDebtsMonthly, dependants: a.dependants, employment: a.employment, employmentMonths: a.employmentMonths, residency: a.residency, readinessScore: a.readinessScore, readinessNotes: a.readinessNotes, lender: a.lender, submittedAt: a.submittedAt, decisionAt: a.decisionAt, expiresAt: a.expiresAt, decisionNote: a.decisionNote, timeline: Array.isArray(a.timeline) ? a.timeline : [], listingId: a.listingId, carModelId: a.carModelId, createdAt: a.createdAt, updatedAt: a.updatedAt };
}

function withReadiness(data: z.infer<typeof applicationSchema>, vehicleAgeYears: number) {
  const r = assessReadiness({ ...data, employmentMonths: data.employmentMonths ?? undefined, residency: data.residency ?? undefined, vehicleAgeYears });
  return { amount: r.amount, ratePct: r.ratePct, repaymentMonthly: Math.round(monthlyPayment(r.amount, r.ratePct, data.termMonths, r.amount * (data.balloonPct ?? 0) / 100)), readinessScore: r.score, readinessNotes: r.notes };
}

router.get('/finance/applications', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.carFinanceApplication.findMany({ where: { userId: req.user!.id }, orderBy: { updatedAt: 'desc' }, take: 20 });
    ok(res, rows.map(applicationCard));
  } catch (error) { next(error); }
});

router.post('/finance/applications', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(applicationSchema, req.body);
    const open = await prisma.carFinanceApplication.count({ where: { userId: req.user!.id, status: { in: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PRE_APPROVED'] } } });
    if (open >= 3) throw new ApiError(400, 'Three open applications is enough; withdraw one first');
    const calc = withReadiness(data, data.purpose === 'NEW' ? 0 : 5);
    const { submit, ...rest } = data;
    const now = new Date();
    const a = await prisma.carFinanceApplication.create({ data: { ...rest, employmentMonths: rest.employmentMonths ?? null, residency: rest.residency ?? null, userId: req.user!.id, deposit: rest.deposit ?? 0, tradeIn: rest.tradeIn ?? 0, otherDebtsMonthly: rest.otherDebtsMonthly ?? 0, dependants: rest.dependants ?? 0, balloonPct: rest.balloonPct ?? 0, ...calc, ratePct: rest.ratePct ?? calc.ratePct, referenceCode: `CF-${randomBytes(3).toString('hex').toUpperCase()}`, status: submit ? 'SUBMITTED' : 'DRAFT', submittedAt: submit ? now : null, lender: submit ? 'ATHENA finance desk' : null, timeline: [{ at: now.toISOString(), status: submit ? 'SUBMITTED' : 'DRAFT', note: submit ? 'Sent to the finance desk' : 'Saved as a draft' }] } });
    if (submit) await noteAdmins('A car finance pre-approval was submitted', `${a.referenceCode}: $${a.amount.toLocaleString('en-AU')} over ${a.termMonths} months, readiness ${a.readinessScore}.`, '/dashboard/cars/admin', { kind: 'CAR_FINANCE_SUBMITTED', id: a.id });
    ok(res, applicationCard(a), 201);
  } catch (error) { next(error); }
});

router.patch('/finance/applications/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const a = await prisma.carFinanceApplication.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!a) throw new ApiError(404, 'Application not found');
    const data = parse(applicationSchema.partial().extend({ withdraw: z.boolean().optional() }), req.body);
    const timeline = Array.isArray(a.timeline) ? [...(a.timeline as unknown[])] : [];
    const now = new Date();
    if (data.withdraw) {
      if (['DECLINED', 'EXPIRED', 'WITHDRAWN'].includes(a.status)) throw new ApiError(400, 'That application is already closed');
      timeline.push({ at: now.toISOString(), status: 'WITHDRAWN', note: 'Withdrawn by you' });
      ok(res, applicationCard(await prisma.carFinanceApplication.update({ where: { id: a.id }, data: { status: 'WITHDRAWN', timeline: timeline as unknown as Prisma.InputJsonValue } })));
      return;
    }
    if (a.status !== 'DRAFT') throw new ApiError(400, 'A submitted application is read by the desk as it stands; withdraw it and start again to change it');
    const merged = { ...applicationCard(a), ...data, employmentMonths: data.employmentMonths ?? a.employmentMonths, residency: (data.residency ?? a.residency) as 'CITIZEN' | 'PR' | 'VISA' | null } as unknown as z.infer<typeof applicationSchema>;
    const calc = withReadiness(merged, merged.purpose === 'NEW' ? 0 : 5);
    const { submit, withdraw: _withdraw, ...rest } = data;
    if (submit) timeline.push({ at: now.toISOString(), status: 'SUBMITTED', note: 'Sent to the finance desk' });
    const updated = await prisma.carFinanceApplication.update({ where: { id: a.id }, data: { ...rest, ...calc, ratePct: rest.ratePct ?? calc.ratePct, ...(submit ? { status: 'SUBMITTED', submittedAt: now, lender: 'ATHENA finance desk' } : {}), timeline: timeline as unknown as Prisma.InputJsonValue } });
    if (submit) await noteAdmins('A car finance pre-approval was submitted', `${updated.referenceCode}: $${updated.amount.toLocaleString('en-AU')} over ${updated.termMonths} months, readiness ${updated.readinessScore}.`, '/dashboard/cars/admin', { kind: 'CAR_FINANCE_SUBMITTED', id: updated.id });
    ok(res, applicationCard(updated));
  } catch (error) { next(error); }
});

// -------------------------------------------------------------------- admin

router.get('/admin/overview', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [mechanics, dealerships, listings, disputes, applications, inspections] = await Promise.all([
      prisma.mechanic.findMany({ where: { isVerified: false, isActive: true }, orderBy: { createdAt: 'asc' }, take: 50 }),
      prisma.dealership.findMany({ where: { isVerified: false, isActive: true }, orderBy: { createdAt: 'asc' }, take: 50 }),
      prisma.vehicleListing.findMany({ where: { status: 'SUSPENDED' }, orderBy: { updatedAt: 'asc' }, take: 50, include: listingInclude }),
      prisma.vehiclePurchase.findMany({ where: { status: 'DISPUTED' }, orderBy: { disputeOpenedAt: 'asc' }, take: 50, include: purchaseInclude }),
      prisma.carFinanceApplication.findMany({ where: { status: { in: ['SUBMITTED', 'IN_REVIEW'] } }, orderBy: { submittedAt: 'asc' }, take: 50, include: { user: { select: { firstName: true, lastName: true, email: true } } } }),
      prisma.vehicleInspection.findMany({ where: { status: 'REQUESTED', kind: { not: 'SELLER_PROVIDED' } }, orderBy: { createdAt: 'asc' }, take: 50, include: inspectionInclude }),
    ]);
    const [verifiedMechanics, verifiedDealers, liveListings, openPurchases, referralRows, pendingReferrals] = await Promise.all([prisma.mechanic.count({ where: { isVerified: true, isActive: true } }), prisma.dealership.count({ where: { isVerified: true, isActive: true } }), prisma.vehicleListing.count({ where: { status: { in: ['ACTIVE', 'UNDER_OFFER'] } } }), prisma.vehiclePurchase.count({ where: { status: { in: ['PAID_HELD', 'HANDED_OVER'] } } }), prisma.carReferral.findMany({ select: { kind: true, status: true, fee: true } }), prisma.carReferral.findMany({ where: { status: { in: ['PENDING', 'CONFIRMED'] } }, orderBy: { createdAt: 'desc' }, take: 50, include: referralInclude })]);
    ok(res, {
      counts: { verifiedMechanics, verifiedDealers, liveListings, openPurchases },
      referrals: { totals: summariseReferrals(referralRows), open: pendingReferrals.map(referralCard), fees: REFERRAL_FEES },
      mechanics: mechanics.map((m) => ({ ...mechanicCard(m), about: m.about, licenceNumber: m.licenceNumber, createdAt: m.createdAt })), dealerships: dealerships.map((d) => ({ ...dealershipCard(d), about: d.about, email: d.email, createdAt: d.createdAt })),
      listings: listings.map((l) => ({ ...listingCard(l, { full: true, admin: true }) })), disputes: disputes.map((p) => purchaseCard(p, '', true)),
      applications: applications.map((a) => ({ ...applicationCard(a), applicant: { name: personName(a.user), email: a.user.email } })), inspections: inspections.map((i) => inspectionCard(i)),
    });
  } catch (error) { next(error); }
});

const featured = (days?: number | null) => (days === undefined ? {} : days === null || days <= 0 ? { isFeatured: false, featuredUntil: null } : { isFeatured: true, featuredUntil: new Date(Date.now() + days * 86400000) });

router.patch('/admin/mechanics/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const m = await prisma.mechanic.findUnique({ where: { id: req.params.id } });
    if (!m) throw new ApiError(404, 'Workshop not found');
    const data = parse(z.object({ isVerified: z.boolean().optional(), isActive: z.boolean().optional(), featuredDays: z.coerce.number().int().min(0).max(365).nullable().optional() }), req.body);
    const updated = await prisma.mechanic.update({ where: { id: m.id }, data: { isVerified: data.isVerified, isActive: data.isActive, ...featured(data.featuredDays) } });
    if (m.ownerUserId && data.isVerified !== undefined && data.isVerified !== m.isVerified) await note(m.ownerUserId, data.isVerified ? 'Your workshop is live in the directory' : 'Your workshop has been taken out of the directory', data.isVerified ? 'Members can now find and book you.' : 'Check the workshop page for what to fix.', '/dashboard/cars/workshop', { kind: 'CAR_MECHANIC_VERIFIED', id: m.id });
    ok(res, mechanicCard(updated));
  } catch (error) { next(error); }
});

router.patch('/admin/dealerships/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const d = await prisma.dealership.findUnique({ where: { id: req.params.id } });
    if (!d) throw new ApiError(404, 'Dealership not found');
    const data = parse(z.object({ isVerified: z.boolean().optional(), isActive: z.boolean().optional(), featuredDays: z.coerce.number().int().min(0).max(365).nullable().optional() }), req.body);
    const updated = await prisma.dealership.update({ where: { id: d.id }, data: { isVerified: data.isVerified, isActive: data.isActive, ...featured(data.featuredDays) } });
    if (d.ownerUserId && data.isVerified !== undefined && data.isVerified !== d.isVerified) await note(d.ownerUserId, data.isVerified ? 'Your dealership is live' : 'Your dealership has been hidden', data.isVerified ? 'Members can now book test drives and ask for trade-in quotes.' : 'Check the dealership page for what to fix.', '/dashboard/cars/dealership', { kind: 'CAR_DEALERSHIP_VERIFIED', id: d.id });
    ok(res, dealershipCard(updated));
  } catch (error) { next(error); }
});

router.patch('/admin/listings/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const l = await prisma.vehicleListing.findUnique({ where: { id: req.params.id }, include: listingInclude });
    if (!l) throw new ApiError(404, 'Listing not found');
    const data = parse(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'WITHDRAWN']).optional(), suspendedReason: z.string().trim().max(500).nullable().optional(), featuredDays: z.coerce.number().int().min(0).max(365).nullable().optional() }), req.body);
    const updated = await prisma.vehicleListing.update({ where: { id: l.id }, data: { status: data.status, suspendedReason: data.status === 'ACTIVE' ? null : data.suspendedReason, ...featured(data.featuredDays) }, include: listingInclude });
    if (data.status && data.status !== l.status) await note(l.sellerId, data.status === 'ACTIVE' ? 'Your listing is live' : data.status === 'SUSPENDED' ? 'Your listing has been paused' : 'Your listing has been taken down', data.status === 'ACTIVE' ? `"${l.title}" passed review and is showing.` : `"${l.title}": ${data.suspendedReason ?? 'see the listing for what to fix'}.`, `/dashboard/cars/sell/${l.id}`, { kind: 'CAR_LISTING_STATUS', id: l.id });
    ok(res, listingCard(updated, { full: true, admin: true }));
  } catch (error) { next(error); }
});

router.patch('/admin/finance/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const a = await prisma.carFinanceApplication.findUnique({ where: { id: req.params.id } });
    if (!a) throw new ApiError(404, 'Application not found');
    const data = parse(z.object({ status: z.enum(['IN_REVIEW', 'PRE_APPROVED', 'DECLINED']), lender: z.string().trim().max(80).optional(), decisionNote: z.string().trim().max(2000).optional(), expiresInDays: z.coerce.number().int().min(7).max(180).optional(), ratePct: z.coerce.number().min(0).max(40).optional(), amount: money.optional() }), req.body);
    const now = new Date();
    const timeline = [...(Array.isArray(a.timeline) ? (a.timeline as unknown[]) : []), { at: now.toISOString(), status: data.status, note: data.decisionNote ?? (data.status === 'IN_REVIEW' ? 'Being read by the desk' : data.status === 'PRE_APPROVED' ? 'Pre-approved' : 'Declined') }];
    const updated = await prisma.carFinanceApplication.update({ where: { id: a.id }, data: { status: data.status, lender: data.lender ?? a.lender, decisionNote: data.decisionNote, ratePct: data.ratePct, amount: data.amount, ...(data.status !== 'IN_REVIEW' ? { decisionAt: now } : {}), ...(data.status === 'PRE_APPROVED' ? { expiresAt: new Date(now.getTime() + (data.expiresInDays ?? 60) * 86400000) } : {}), timeline: timeline as unknown as Prisma.InputJsonValue } });
    // A pre-approval with a lender is what the finance partnership pays for; the fee is owed when the loan settles, which the admin confirms on the ledger.
    if (data.status === 'PRE_APPROVED') {
      const existing = await prisma.carReferral.findFirst({ where: { kind: 'FINANCE', referenceId: a.id } });
      if (!existing) { const f = referralFee('FINANCE', updated.amount); await prisma.carReferral.create({ data: { kind: 'FINANCE', userId: a.userId, referenceId: a.id, partner: data.lender ?? a.lender ?? null, basisAmount: updated.amount, feePercent: f.percent, fee: f.fee, note: `${updated.referenceCode}: pre-approved; the fee is owed once the loan settles` } }); }
    }
    const words = data.status === 'PRE_APPROVED' ? `Pre-approved for $${updated.amount.toLocaleString('en-AU')}${data.lender ? ` with ${data.lender}` : ''}. Good for ${data.expiresInDays ?? 60} days.` : data.status === 'DECLINED' ? `Not this time.${data.decisionNote ? ` ${data.decisionNote.slice(0, 200)}` : ''}` : 'The desk is reading your application.';
    await note(a.userId, `Your car finance application: ${data.status.toLowerCase().replace('_', ' ')}`, words, '/dashboard/cars/finance', { kind: 'CAR_FINANCE_STATUS', id: a.id });
    ok(res, applicationCard(updated));
  } catch (error) { next(error); }
});

router.patch('/admin/mechanic-reviews/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.mechanicReview.findUnique({ where: { id: req.params.id } });
    if (!r) throw new ApiError(404, 'Review not found');
    const data = parse(z.object({ isHidden: z.boolean() }), req.body);
    await prisma.mechanicReview.update({ where: { id: r.id }, data });
    const all = await prisma.mechanicReview.findMany({ where: { mechanicId: r.mechanicId }, select: { rating: true, transparency: true, isHidden: true } });
    await prisma.mechanic.update({ where: { id: r.mechanicId }, data: recomputeMechanicRating(all) });
    ok(res, { id: r.id, isHidden: data.isHidden });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------- referrals

router.get('/admin/referrals', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: Prisma.CarReferralWhereInput = {};
    if (q(req, 'status')) where.status = q(req, 'status') as never;
    if (q(req, 'kind')) where.kind = q(req, 'kind') as never;
    const [rows, all] = await Promise.all([prisma.carReferral.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: referralInclude }), prisma.carReferral.findMany({ select: { kind: true, status: true, fee: true } })]);
    ok(res, { referrals: rows.map(referralCard), totals: summariseReferrals(all), fees: REFERRAL_FEES });
  } catch (error) { next(error); }
});

/** A fee agreed with a partner outside the flows that record their own: an insurer, a warranty provider, a parts supplier. */
router.post('/admin/referrals', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(z.object({ kind: referralKindEnum, partner: z.string().trim().min(1).max(80), basisAmount: money, fee: money.optional(), userId: uuid.nullable().optional(), dealershipId: uuid.nullable().optional(), referenceId: z.string().trim().max(80).nullable().optional(), note: z.string().trim().max(500).nullable().optional(), status: z.enum(['PENDING', 'CONFIRMED', 'PAID']).optional() }), req.body);
    const f = referralFee(data.kind, data.basisAmount);
    const now = new Date();
    const r = await prisma.carReferral.create({ data: { kind: data.kind, partner: data.partner, basisAmount: Math.round(data.basisAmount), feePercent: f.percent, fee: data.fee !== undefined ? Math.round(data.fee) : f.fee, userId: data.userId ?? null, dealershipId: data.dealershipId ?? null, referenceId: data.referenceId ?? null, note: data.note ?? null, createdById: req.user!.id, status: data.status ?? 'PENDING', confirmedAt: data.status && data.status !== 'PENDING' ? now : null, paidAt: data.status === 'PAID' ? now : null }, include: referralInclude });
    ok(res, referralCard(r), 201);
  } catch (error) { next(error); }
});

router.patch('/admin/referrals/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.carReferral.findUnique({ where: { id: req.params.id } });
    if (!r) throw new ApiError(404, 'Referral not found');
    const data = parse(z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'PAID', 'VOID']).optional(), fee: money.optional(), note: z.string().trim().max(500).nullable().optional(), partner: z.string().trim().max(80).nullable().optional() }), req.body);
    const now = new Date();
    const updated = await prisma.carReferral.update({ where: { id: r.id }, data: { status: data.status, fee: data.fee !== undefined ? Math.round(data.fee) : undefined, note: data.note, partner: data.partner, ...(data.status === 'CONFIRMED' ? { confirmedAt: r.confirmedAt ?? now } : {}), ...(data.status === 'PAID' ? { confirmedAt: r.confirmedAt ?? now, paidAt: now } : {}) }, include: referralInclude });
    ok(res, referralCard(updated));
  } catch (error) { next(error); }
});

// -------------------------------------------------------------------- fleet

/** A business asking about the fleet programme. It lands on the marketing leads board, where the team already works, and the admins are told. */
router.post('/fleet-enquiries', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parse(z.object({ business: z.string().trim().min(2).max(120), contactName: z.string().trim().min(2).max(80), email: z.string().trim().email().max(120), phone: z.string().trim().max(20).optional(), vehicles: z.coerce.number().int().min(1).max(500), state: stateEnum.optional(), needs: z.string().trim().max(2000).optional(), wants: z.array(z.string().trim().max(60)).max(10).optional() }), req.body);
    const email = data.email.toLowerCase();
    const plural = data.vehicles === 1 ? '' : 's';
    const message = [`Fleet programme enquiry: ${data.vehicles} vehicle${plural}${data.state ? ` in ${data.state}` : ''}.`, data.wants?.length ? `Wants: ${data.wants.join(', ')}.` : null, data.needs || null, data.phone ? `Phone ${data.phone}.` : null].filter(Boolean).join(' ');
    const lead = await prisma.lead.upsert({
      where: { email_source: { email, source: 'CONTACT_SALES' } },
      create: { email, name: data.contactName, organisation: data.business, role: 'Fleet contact', source: 'CONTACT_SALES', interest: 'Automotive fleet programme', message, convertedUserId: req.user?.id ?? null },
      update: { name: data.contactName, organisation: data.business, interest: 'Automotive fleet programme', message, status: 'NEW' },
    });
    await noteAdmins('A fleet programme enquiry', `${data.business} (${data.contactName}), ${data.vehicles} vehicle${plural}${data.state ? ` in ${data.state}` : ''}. It is on the leads board.`, '/admin/marketing/leads', { kind: 'CAR_FLEET_ENQUIRY', id: lead.id });
    ok(res, { received: true, programme: FLEET_PROGRAMME }, 201);
  } catch (error) { next(error); }
});

// ----------------------------------------------------------------- overview

router.get('/overview', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const me = req.user!.id;
    const [vehicles, purchases, bookings, applications, saved, listings, mechanic, dealership, testDrives, tradeIns] = await Promise.all([
      prisma.vehicle.findMany({ where: { userId: me, isActive: true } }),
      prisma.vehiclePurchase.findMany({ where: { OR: [{ buyerId: me }, { sellerId: me }], status: { in: ['OFFERED', 'ACCEPTED', 'PAID_HELD', 'HANDED_OVER', 'DISPUTED'] } }, include: purchaseInclude, orderBy: { updatedAt: 'desc' }, take: 10 }),
      prisma.mechanicBooking.findMany({ where: { userId: me, status: { in: ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }, OR: [{ scheduledAt: { gte: new Date(Date.now() - 7 * 86400000) } }, { status: 'COMPLETED', review: null }] }, include: bookingInclude, orderBy: { scheduledAt: 'asc' }, take: 10 }),
      prisma.carFinanceApplication.findMany({ where: { userId: me, status: { in: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PRE_APPROVED'] } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      prisma.vehicleListingSave.count({ where: { userId: me } }),
      prisma.vehicleListing.count({ where: { sellerId: me, status: { in: ['DRAFT', 'ACTIVE', 'UNDER_OFFER', 'SUSPENDED'] } } }),
      prisma.mechanic.findUnique({ where: { ownerUserId: me }, select: { id: true, isVerified: true, name: true } }),
      prisma.dealership.findUnique({ where: { ownerUserId: me }, select: { id: true, isVerified: true, name: true } }),
      prisma.testDriveRequest.count({ where: { userId: me, status: { in: ['REQUESTED', 'CONFIRMED'] } } }),
      prisma.tradeInRequest.count({ where: { userId: me, status: { in: ['OPEN', 'QUOTED'] } } }),
    ]);
    const now = new Date();
    const cards = vehicles.map((v) => vehicleCard(v, now));
    ok(res, {
      vehicles: cards, reminders: cards.flatMap((v) => v.reminders).sort((a, b) => (a.daysAway ?? 999) - (b.daysAway ?? 999)).slice(0, 8),
      purchases: purchases.map((p) => purchaseCard(p, me)), bookings: bookings.map((b) => bookingCard(b)), applications: applications.map(applicationCard),
      counts: { saved, listings, testDrives, tradeIns }, roles: { isMechanic: Boolean(mechanic), mechanicVerified: mechanic?.isVerified ?? false, isDealer: Boolean(dealership), dealerVerified: dealership?.isVerified ?? false, isAdmin: isAdmin(req) },
    });
  } catch (error) { next(error); }
});

export default router;
