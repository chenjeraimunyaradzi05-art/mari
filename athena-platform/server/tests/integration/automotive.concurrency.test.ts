/**
 * The automotive writes whose correctness is an argument about Postgres.
 *
 * Every automotive route suite beside the code runs on the in-memory double,
 * and three of the guards in automotive.routes.ts cannot be checked there:
 *
 *   - `serialised()` runs the workshop booking's slot check and insert, and the
 *     trade-in quote's read-modify-write of a Json array, under SERIALIZABLE
 *     and retries on P2034. A double has no isolation levels and never raises
 *     P2034, so it agrees with any claim about two members taking the same
 *     hour, or two dealerships quoting in the same second.
 *   - The per-car offer ceiling is a `count` over purchase rows in a
 *     twenty-four-hour window, cancelled offers included. The double answers
 *     whatever count the test hands it.
 *
 * So these go through the real routes on the real database. Two members are
 * signed in through /api/auth/login rather than handed forged tokens, so the
 * session checks in `authenticate` run as they do in production. The in-memory
 * rate limiters are keyed on the member, and every test uses fresh members, so
 * one test's requests never count against another's.
 */

import request from 'supertest';
import { describeIntegration, createMember, resetDatabase } from './setup/harness';

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

import { app } from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { hashPassword } from '../../src/utils/password';

const PASSWORD = 'Automotive-Integration-26!';
const TIMEZONE = 'Australia/Brisbane';
const DAY_MS = 24 * 60 * 60 * 1000;

let passwordHash = '';
let memberCounter = 0;

/** A verified member with a password, signed in; returns her id and an Authorization header. */
async function signedInMember(label: string) {
  memberCounter += 1;
  const email = `automotive-${label}-${memberCounter}-${Date.now()}@athena.test`;
  const member = await createMember({ email, emailVerified: true, passwordHash });
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { id: member.id, auth: { Authorization: `Bearer ${response.body.data.accessToken as string}` } };
}

/** A calendar day in Brisbane, `days` from now, as the slot routes take it. */
function brisbaneDay(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(Date.now() + days * DAY_MS)
  );
}

/** Nine to five on every day of the week, so the chosen day is always open. */
const EVERY_DAY_NINE_TO_FIVE = Object.fromEntries(
  ['0', '1', '2', '3', '4', '5', '6'].map((day) => [day, [['09:00', '17:00']]])
);

describeIntegration('automotive writes under real concurrency', () => {
  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('a workshop hour asked for by several members at once', () => {
    async function bookableWorkshop() {
      const owner = await signedInMember('workshop-owner');
      await prisma.user.update({ where: { id: owner.id }, data: { timezone: TIMEZONE } });
      const mechanic = await prisma.mechanic.create({
        data: {
          slug: `integration-workshop-${Date.now()}`,
          name: 'Integration Test Workshop',
          headline: 'A fixture workshop for the integration suite',
          about: 'Not a real business.',
          ownerUserId: owner.id,
          isVerified: true,
          isActive: true,
          acceptsBookings: true,
          slotMinutes: 60,
          services: ['oil'],
          state: 'QLD',
          availability: EVERY_DAY_NINE_TO_FIVE,
        },
      });
      return { owner, mechanic };
    }

    it('books it for exactly one of them and tells the rest it is taken', async () => {
      const { mechanic } = await bookableWorkshop();
      const day = brisbaneDay(3);

      const slots = await request(app)
        .get(`/api/automotive/mechanics/${mechanic.id}/slots`)
        .query({ day, service: 'oil' })
        .expect(200);
      const start = slots.body.data.slots[0]?.start as string | undefined;
      expect(start).toBeDefined();

      const members = await Promise.all([1, 2, 3, 4].map((n) => signedInMember(`booker-${n}`)));
      const responses = await Promise.all(
        members.map((member) =>
          request(app)
            .post(`/api/automotive/mechanics/${mechanic.id}/bookings`)
            .set(member.auth)
            .send({ kind: 'oil', scheduledAt: start })
        )
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 400, 400, 400]);
      for (const refused of responses.filter((response) => response.status === 400)) {
        expect(refused.body.message).toBe('That time is not free. Pick one of the offered slots.');
      }

      // The assertion the Serializable transaction exists for. Under READ
      // COMMITTED every one of them could read "no bookings" before any of
      // them wrote, and four cars would arrive at nine o'clock.
      const bookings = await prisma.mechanicBooking.findMany({ where: { mechanicId: mechanic.id } });
      expect(bookings).toHaveLength(1);
      expect(bookings[0].scheduledAt.toISOString()).toBe(start);
    });

    it('stops offering the hour once it is booked', async () => {
      const { mechanic } = await bookableWorkshop();
      const day = brisbaneDay(3);
      const member = await signedInMember('booker');

      const before = await request(app).get(`/api/automotive/mechanics/${mechanic.id}/slots`).query({ day, service: 'oil' }).expect(200);
      const start = before.body.data.slots[0].start as string;

      await request(app)
        .post(`/api/automotive/mechanics/${mechanic.id}/bookings`)
        .set(member.auth)
        .send({ kind: 'oil', scheduledAt: start })
        .expect(201);

      const after = await request(app).get(`/api/automotive/mechanics/${mechanic.id}/slots`).query({ day, service: 'oil' }).expect(200);
      const offered = (after.body.data.slots as Array<{ start: string }>).map((slot) => slot.start);
      expect(offered).not.toContain(start);
      expect(offered).toHaveLength(before.body.data.slots.length - 1);
    });
  });

  describe('two dealerships quoting on one trade-in at the same moment', () => {
    it('keeps both quotes, and tells the member about each', async () => {
      const member = await signedInMember('trade-in-owner');
      const tradeIn = await prisma.tradeInRequest.create({
        data: {
          userId: member.id,
          make: 'Toyota',
          model: 'Corolla',
          year: 2019,
          odometerKm: 60_000,
          condition: 'GOOD',
          estimateLow: 14_000,
          estimateMid: 16_000,
          estimateHigh: 18_000,
          status: 'OPEN',
          expiresAt: new Date(Date.now() + 30 * DAY_MS),
        },
      });

      const dealers = await Promise.all(
        ['north', 'south'].map(async (side) => {
          const owner = await signedInMember(`dealer-${side}`);
          const dealership = await prisma.dealership.create({
            data: {
              slug: `integration-dealer-${side}-${Date.now()}`,
              name: `Integration Dealer ${side}`,
              headline: 'A fixture dealership for the integration suite',
              ownerUserId: owner.id,
              isVerified: true,
              isActive: true,
              brands: ['Toyota'],
            },
          });
          return { owner, dealership };
        })
      );

      const responses = await Promise.all(
        dealers.map(({ owner }, index) =>
          request(app)
            .post(`/api/automotive/dealership/trade-ins/${tradeIn.id}/quotes`)
            .set(owner.auth)
            .send({ amount: 15_000 + index * 500 })
        )
      );

      // Both accepted. Without the retry on P2034 one of them would be a 500;
      // without Serializable both would be 201 and one quote would be gone.
      expect(responses.map((response) => response.status)).toEqual([201, 201]);

      const saved = await prisma.tradeInRequest.findUniqueOrThrow({ where: { id: tradeIn.id } });
      const quotes = (Array.isArray(saved.quotes) ? saved.quotes : []) as Array<{ dealershipId: string; amount: number }>;
      expect(saved.status).toBe('QUOTED');
      expect(quotes.map((quote) => quote.dealershipId).sort()).toEqual(dealers.map(({ dealership }) => dealership.id).sort());
      expect(quotes.map((quote) => quote.amount).sort()).toEqual([15_000, 15_500]);

      // She was told about two quotes, and both are on her page.
      const told = await prisma.notification.count({
        where: { userId: member.id, data: { path: ['kind'], equals: 'CAR_TRADE_IN_QUOTE' } },
      });
      expect(told).toBe(2);
    });
  });

  describe('offers on one car from one buyer', () => {
    async function listedCar() {
      const seller = await signedInMember('seller');
      const listing = await prisma.vehicleListing.create({
        data: {
          sellerId: seller.id,
          title: '2018 Mazda 3 hatch',
          make: 'Mazda',
          model: '3',
          year: 2018,
          bodyType: 'HATCH',
          fuelType: 'PETROL',
          odometerKm: 70_000,
          price: 20_000,
          description: 'A fixture listing for the integration suite.',
          state: 'QLD',
          status: 'ACTIVE',
        },
      });
      return { seller, listing };
    }

    async function offerAndWithdraw(buyer: { auth: Record<string, string> }, listingId: string) {
      const response = await request(app)
        .post(`/api/automotive/listings/${listingId}/offers`)
        .set(buyer.auth)
        .send({ amount: 18_000 });
      if (response.status === 201) {
        // Withdrawn straight away so the next one is not refused as "already
        // open". A withdrawn offer still counts: the seller was still told.
        await prisma.vehiclePurchase.update({ where: { id: response.body.data.id }, data: { status: 'CANCELLED' } });
      }
      return response;
    }

    it('allows three in a day, cancellations included, and refuses the fourth', async () => {
      const { seller, listing } = await listedCar();
      const buyer = await signedInMember('buyer');

      for (let n = 0; n < 3; n += 1) {
        expect((await offerAndWithdraw(buyer, listing.id)).status).toBe(201);
      }

      const fourth = await offerAndWithdraw(buyer, listing.id);
      expect(fourth.status).toBe(429);
      expect(fourth.body.message).toMatch(/3 offers on this car in the last day/);

      // Three offers, three notifications to her, and not a fourth.
      expect(await prisma.vehiclePurchase.count({ where: { listingId: listing.id, buyerId: buyer.id } })).toBe(3);
      expect(
        await prisma.notification.count({ where: { userId: seller.id, data: { path: ['kind'], equals: 'CAR_OFFER' } } })
      ).toBe(3);
    });

    it('counts only the last twenty-four hours', async () => {
      const { listing } = await listedCar();
      const buyer = await signedInMember('buyer');

      for (let n = 0; n < 3; n += 1) await offerAndWithdraw(buyer, listing.id);

      // The oldest offer ages past a day; the window now holds two.
      const oldest = await prisma.vehiclePurchase.findFirstOrThrow({
        where: { listingId: listing.id, buyerId: buyer.id },
        orderBy: { createdAt: 'asc' },
      });
      await prisma.vehiclePurchase.update({
        where: { id: oldest.id },
        data: { createdAt: new Date(Date.now() - DAY_MS - 60_000) },
      });

      expect((await offerAndWithdraw(buyer, listing.id)).status).toBe(201);
    });

    it('does not let another buyer’s offers use up hers', async () => {
      const { listing } = await listedCar();
      const first = await signedInMember('buyer-one');
      const second = await signedInMember('buyer-two');

      for (let n = 0; n < 3; n += 1) await offerAndWithdraw(first, listing.id);

      expect((await offerAndWithdraw(second, listing.id)).status).toBe(201);
    });
  });
});
