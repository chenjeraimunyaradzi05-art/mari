/**
 * The automotive queries a mock cannot run: array filters, Json paths, and the
 * relation and enum names every read route hands to Prisma.
 *
 * The in-memory double used by the automotive route suites evaluates none of
 * these the way Postgres does. It has no idea what `makes: { has }` or
 * `brands: { isEmpty: true }` select from a text[] column, it matches a
 * `data: { path: ['kind'], equals }` filter however the test's fake says it
 * does, and it accepts an `include` naming a relation that does not exist.
 * Each of those has been wrong on this platform before (the workshop search
 * that collapsed its filters into one OR; the reminder dedupe that failed
 * open), and each of them looks right from inside a mocked suite.
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
import { sweepUntakenInspections, UNTAKEN_INSPECTION_AFTER } from '../../src/services/automotive/automotive-reminders.service';

const PASSWORD = 'Automotive-Integration-26!';
const DAY_MS = 24 * 60 * 60 * 1000;

let passwordHash = '';
let memberCounter = 0;
let slugCounter = 0;

async function signedInMember(label: string) {
  memberCounter += 1;
  const email = `automotive-q-${label}-${memberCounter}-${Date.now()}@athena.test`;
  const member = await createMember({ email, emailVerified: true, passwordHash });
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { id: member.id, auth: { Authorization: `Bearer ${response.body.data.accessToken as string}` } };
}

function slug(prefix: string): string {
  slugCounter += 1;
  return `${prefix}-${slugCounter}-${Date.now()}`;
}

async function workshop(name: string, fields: { makes: string[]; city: string; ownerUserId?: string; doesInspections?: boolean }) {
  return prisma.mechanic.create({
    data: {
      slug: slug('integration-workshop'),
      name,
      headline: 'A fixture workshop for the integration suite',
      about: 'Not a real business.',
      makes: fields.makes,
      city: fields.city,
      state: 'QLD',
      isActive: true,
      isVerified: true,
      ownerUserId: fields.ownerUserId,
      doesInspections: fields.doesInspections ?? false,
    },
  });
}

async function dealership(name: string, brands: string[], ownerUserId?: string) {
  return prisma.dealership.create({
    data: {
      slug: slug('integration-dealer'),
      name,
      headline: 'A fixture dealership for the integration suite',
      brands,
      ownerUserId,
      isActive: true,
      isVerified: true,
    },
  });
}

async function activeListing(sellerId: string) {
  return prisma.vehicleListing.create({
    data: {
      sellerId,
      title: '2017 Toyota Corolla sedan',
      make: 'Toyota',
      model: 'Corolla',
      year: 2017,
      bodyType: 'SEDAN',
      fuelType: 'PETROL',
      odometerKm: 90_000,
      price: 15_000,
      description: 'A fixture listing for the integration suite.',
      state: 'QLD',
      status: 'ACTIVE',
    },
  });
}

describeIntegration('automotive queries against real Postgres', () => {
  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('the workshop directory make filter', () => {
    it('finds specialists in the make and general workshops, and nobody else', async () => {
      await workshop('Toyota Southport', { makes: ['Toyota'], city: 'Southport' });
      await workshop('Anything Southport', { makes: [], city: 'Southport' });
      await workshop('Mazda Southport', { makes: ['Mazda'], city: 'Southport' });
      await workshop('Toyota Cairns', { makes: ['Toyota'], city: 'Cairns' });

      const byMake = await request(app).get('/api/automotive/mechanics').query({ make: 'Toyota' }).expect(200);
      const names = (byMake.body.data.mechanics as Array<{ name: string }>).map((m) => m.name).sort();
      // `makes: { has: 'Toyota' }` OR `makes: { isEmpty: true }`. The Mazda
      // specialist is the one a wrong array filter lets through.
      expect(names).toEqual(['Anything Southport', 'Toyota Cairns', 'Toyota Southport']);
    });

    it('ANDs the make with the town, rather than widening one OR', async () => {
      await workshop('Toyota Southport', { makes: ['Toyota'], city: 'Southport' });
      await workshop('Anything Southport', { makes: [], city: 'Southport' });
      await workshop('Mazda Southport', { makes: ['Mazda'], city: 'Southport' });
      await workshop('Toyota Cairns', { makes: ['Toyota'], city: 'Cairns' });

      const both = await request(app).get('/api/automotive/mechanics').query({ make: 'Toyota', city: 'Southport' }).expect(200);
      const names = (both.body.data.mechanics as Array<{ name: string }>).map((m) => m.name).sort();
      expect(names).toEqual(['Anything Southport', 'Toyota Southport']);
      expect(both.body.data.total).toBe(2);
    });
  });

  describe('the dealership brand filter', () => {
    it('lists only dealerships that carry the brand', async () => {
      await dealership('Toyota Dealer', ['Toyota', 'Lexus']);
      await dealership('No Brands Dealer', []);
      await dealership('Mazda Dealer', ['Mazda']);

      const response = await request(app).get('/api/automotive/dealerships').query({ brand: 'Toyota' }).expect(200);
      const names = (response.body.data.dealerships as Array<{ name: string }>).map((d) => d.name);
      // `has`, deliberately without the isEmpty alternative the workshop
      // search uses: a member browsing Toyota dealers wants dealers who sell
      // Toyotas.
      expect(names).toEqual(['Toyota Dealer']);
    });
  });

  describe('who is asked to quote on a trade-in', () => {
    it('asks dealers who carry the make or no brand in particular, and tells each of them once', async () => {
      const member = await signedInMember('trade-in');
      const toyotaOwner = await signedInMember('toyota-dealer');
      const anyOwner = await signedInMember('any-dealer');
      const mazdaOwner = await signedInMember('mazda-dealer');
      await dealership('Toyota Dealer', ['Toyota'], toyotaOwner.id);
      await dealership('Any Make Dealer', [], anyOwner.id);
      await dealership('Mazda Dealer', ['Mazda'], mazdaOwner.id);

      const response = await request(app)
        .post('/api/automotive/trade-ins')
        .set(member.auth)
        .send({ make: 'Toyota', model: 'Corolla', year: 2018, odometerKm: 80_000, condition: 'GOOD' })
        .expect(201);

      expect(response.body.data.dealersAsked).toBe(2);

      const told = await prisma.notification.findMany({
        where: { data: { path: ['kind'], equals: 'CAR_TRADE_IN' } },
        select: { userId: true },
      });
      expect(told.map((n) => n.userId).sort()).toEqual([anyOwner.id, toyotaOwner.id].sort());
    });
  });

  describe('the untaken-inspection escalation and its duplicate check', () => {
    async function staleInspection(buyerId: string, sellerId: string) {
      const listing = await activeListing(sellerId);
      return prisma.vehicleInspection.create({
        data: {
          listingId: listing.id,
          requestedById: buyerId,
          status: 'REQUESTED',
          createdAt: new Date(Date.now() - UNTAKEN_INSPECTION_AFTER - DAY_MS),
        },
      });
    }

    const buyerNotices = (userId: string, inspectionId: string) =>
      prisma.notification.count({
        where: {
          userId,
          data: { path: ['kind'], equals: 'CAR_INSPECTION_UNTAKEN' },
          AND: [{ data: { path: ['id'], equals: inspectionId } }],
        },
      });

    it('tells the buyer once, not on every sweep', async () => {
      const buyer = await createMember();
      const seller = await createMember();
      const inspection = await staleInspection(buyer.id, seller.id);

      const first = await sweepUntakenInspections();
      expect(first.untaken).toBe(1);
      expect(await buyerNotices(buyer.id, inspection.id)).toBe(1);

      // The Json-path lookup finds the notice just written, so the second
      // sweep leaves her alone. When that lookup failed open, this was the
      // same message every six hours.
      const second = await sweepUntakenInspections();
      expect(second.untaken).toBe(0);
      expect(await buyerNotices(buyer.id, inspection.id)).toBe(1);
    });

    it('matches on both the kind and the id, so a notice about something else does not silence this one', async () => {
      const buyer = await createMember();
      const seller = await createMember();
      const inspection = await staleInspection(buyer.id, seller.id);

      await prisma.notification.createMany({
        data: [
          // Same kind, another inspection.
          { userId: buyer.id, type: 'SYSTEM', title: 'Earlier notice', message: 'About another car', data: { kind: 'CAR_INSPECTION_UNTAKEN', id: '00000000-0000-4000-8000-000000000000' } },
          // Same inspection, another kind.
          { userId: buyer.id, type: 'SYSTEM', title: 'Earlier notice', message: 'About this car', data: { kind: 'CAR_OFFER', id: inspection.id } },
        ],
      });

      const swept = await sweepUntakenInspections();
      expect(swept.untaken).toBe(1);
      expect(await buyerNotices(buyer.id, inspection.id)).toBe(1);
    });

    it('reminds a workshop that does inspections in that state, once', async () => {
      const buyer = await createMember();
      const seller = await createMember();
      const workshopOwner = await createMember();
      await workshop('Inspecting Workshop', { makes: [], city: 'Brisbane', ownerUserId: workshopOwner.id, doesInspections: true });
      const inspection = await staleInspection(buyer.id, seller.id);

      expect((await sweepUntakenInspections()).reminded).toBe(1);
      expect((await sweepUntakenInspections()).reminded).toBe(0);

      const reminders = await prisma.notification.count({
        where: { userId: workshopOwner.id, data: { path: ['id'], equals: inspection.id } },
      });
      expect(reminders).toBe(1);
    });
  });

  describe('the read routes, with every include and enum filter handed to Postgres', () => {
    // A relation or enum value that does not exist is a PrismaClientValidationError
    // at the first query, which the mocked suites never make. With rows in
    // place, each route has to build and run its real query.
    it('answers every member-facing read without a query error', async () => {
      const seller = await signedInMember('seller');
      const buyer = await signedInMember('buyer');
      const workshopOwner = await signedInMember('workshop-owner');
      const dealerOwner = await signedInMember('dealer-owner');

      const listing = await activeListing(seller.id);
      const mechanic = await workshop('Readable Workshop', { makes: ['Toyota'], city: 'Brisbane', ownerUserId: workshopOwner.id, doesInspections: true });
      const dealer = await dealership('Readable Dealer', ['Toyota'], dealerOwner.id);

      await request(app).post(`/api/automotive/listings/${listing.id}/offers`).set(buyer.auth).send({ amount: 14_000 }).expect(201);
      await request(app)
        .post('/api/automotive/trade-ins')
        .set(buyer.auth)
        .send({ make: 'Toyota', model: 'Yaris', year: 2016, odometerKm: 100_000, condition: 'FAIR' })
        .expect(201);

      const reads: Array<[string, Record<string, string> | undefined]> = [
        ['/api/automotive/listings', undefined],
        [`/api/automotive/listings/${listing.id}`, buyer.auth],
        ['/api/automotive/listings/mine', seller.auth],
        ['/api/automotive/listings/saved', buyer.auth],
        ['/api/automotive/mechanics', undefined],
        [`/api/automotive/mechanics/${mechanic.slug}`, undefined],
        ['/api/automotive/dealerships', undefined],
        [`/api/automotive/dealerships/${dealer.slug}`, undefined],
        ['/api/automotive/purchases', buyer.auth],
        ['/api/automotive/purchases', seller.auth],
        ['/api/automotive/trade-ins', buyer.auth],
        ['/api/automotive/test-drives', buyer.auth],
        ['/api/automotive/bookings', buyer.auth],
        ['/api/automotive/inspections', buyer.auth],
        ['/api/automotive/inspections/open', workshopOwner.auth],
        ['/api/automotive/workshop', workshopOwner.auth],
        ['/api/automotive/workshop/bookings', workshopOwner.auth],
        ['/api/automotive/dealership', dealerOwner.auth],
        ['/api/automotive/dealership/requests', dealerOwner.auth],
        ['/api/automotive/garage', buyer.auth],
        ['/api/automotive/finance/applications', buyer.auth],
        ['/api/automotive/overview', buyer.auth],
      ];

      const failures: string[] = [];
      for (const [path, auth] of reads) {
        const call = request(app).get(path);
        const response = await (auth ? call.set(auth) : call);
        if (response.status !== 200) {
          failures.push(`${path} answered ${response.status}: ${response.body?.debugMessage ?? response.body?.message ?? ''}`);
        }
      }
      // Listed together so one run names every route that broke, not the first.
      expect(failures).toEqual([]);
    });
  });
});
