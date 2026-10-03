/**
 * One member against another member's things, against rows that really exist.
 *
 * Every handler that takes an id has to decide, on its own, whether the caller
 * may touch what that id names. Most do; the convention is that someone else's
 * thing reads as missing (404), never as forbidden (403), so a stranger cannot
 * use the answer to learn which ids are real. Until this suite nothing proved
 * it. The unit suites answer from a mocked database that agrees with whatever
 * the test says, which is exactly the thing an ownership bug looks like from
 * the inside; the question here is about rows: member B asks for member A's
 * message, conversation, application, order, holding, invoice, notification
 * and résumé, and each time the answer must be a refusal that contains none of
 * A's words and leaves A's row as it was.
 *
 * What each row checks:
 *   1. the control: A reaches her own thing, so a refusal below cannot be an
 *      endpoint that refuses everybody or a path that does not exist;
 *   2. every probe, as B: 403 or 404, never the catch-all "Endpoint not found"
 *      (a mistyped path would otherwise pass), and none of A's sentinel text
 *      anywhere in the response;
 *   3. every probe, with no token at all: 401;
 *   4. B's own list of the same kind of thing contains nothing of A's;
 *   5. A's row is exactly as it was after all of the above.
 *
 * A new route for one of these resources earns a line in the matching row.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
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

const PASSWORD = 'CorrectPassw0rd!26';

/** Words that exist only in A's rows. If one turns up in what B is sent, B was shown A's data. */
const SECRET = 'zebra-ledger-7731';

type Method = 'get' | 'post' | 'patch' | 'delete';
type Member = Awaited<ReturnType<typeof createMember>>;

interface Call {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
}

interface Fixtures {
  a: Member;
  b: Member;
  c: Member;
  p: Member;
  conversationId: string;
  messageId: string;
  jobId: string;
  applicationId: string;
  serviceOrderId: string;
  holdingId: string;
  invoiceId: string;
  invoiceNumber: string;
  notificationId: string;
  resumeKey: string;
}

/** What B tries. The label names the test; `build` is given the real ids once the rows exist. */
interface Probe {
  label: string;
  build: (f: Fixtures) => Call;
  /** The statuses that count as a refusal. 403 or 404 unless the route has a more exact answer (a malformed key is a 400). */
  refusedWith?: number[];
}

interface Row {
  resource: string;
  /**
   * What A does to reach her own thing. It must answer 200 and, when `shows`
   * is given, carry that text, so a refusal below cannot be an endpoint that
   * refuses everybody.
   */
  control: { build: (f: Fixtures) => Call; shows: ((f: Fixtures) => string) | null };
  probes: Probe[];
  /** B's own listing of this kind of thing, which must hold nothing of A's. */
  lists: string[];
  /** Fails if A's row is not exactly as the fixture left it. */
  unchanged: (f: Fixtures) => Promise<void>;
}

let fixtures: Fixtures;
let tokens: { a: string; b: string };

async function signIn(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return response.body.data.accessToken as string;
}

async function member(label: string, passwordHash: string): Promise<Member> {
  return createMember({
    email: `${label}-${randomUUID()}@athena.test`.toLowerCase(),
    firstName: label,
    emailVerified: true,
    passwordHash,
  });
}

async function seed(): Promise<void> {
  const passwordHash = await hashPassword(PASSWORD);
  const a = await member('Ada', passwordHash);
  const b = await member('Bea', passwordHash);
  const c = await member('Cleo', passwordHash);
  const p = await member('Pia', passwordHash);

  // A conversation between A and C, with one message from A. B is not in it.
  const conversation = await prisma.conversation.create({
    data: { participants: { create: [{ userId: a.id }, { userId: c.id }] } },
  });
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: a.id,
      receiverId: c.id,
      content: `${SECRET} meet at the usual place`,
      type: 'TEXT',
    },
  });

  // A job with no organisation, posted by P, and A's application to it.
  const job = await prisma.job.create({
    data: {
      title: 'Platform engineer',
      slug: `platform-engineer-${randomUUID()}`,
      description: 'Build things.',
      postedById: p.id,
      status: 'ACTIVE',
    },
  });
  const application = await prisma.jobApplication.create({
    data: { jobId: job.id, userId: a.id, status: 'PENDING', coverLetter: `${SECRET} cover letter` },
  });

  // An order A placed for a service P offers.
  const service = await prisma.skillService.create({
    data: {
      providerId: p.id,
      title: 'Brand review',
      description: 'A careful read of your brand.',
      category: 'CREATIVE',
      hourlyRate: 90,
      tags: [],
    },
  });
  const order = await prisma.serviceOrder.create({
    data: {
      serviceId: service.id,
      clientId: a.id,
      packageIndex: 0,
      requirements: `${SECRET} brief`,
      attachments: [],
      totalAmount: 100,
      platformFee: 10,
      providerPayout: 90,
    },
  });

  const holding = await prisma.portfolioHolding.create({
    data: { userId: a.id, kind: 'ASSET', category: 'INTL_SHARES', name: `${SECRET} fund`, value: 12_500 },
  });

  const invoiceNumber = `INV-${SECRET}`;
  const invoice = await prisma.invoice.create({
    data: { invoiceNumber, userId: a.id, amount: 120, currency: 'AUD', status: 'PAID', issuedAt: new Date() },
  });

  const notification = await prisma.notification.create({
    data: { userId: a.id, type: 'SYSTEM', title: `${SECRET} notice`, message: 'Only for A' },
  });

  // A résumé file on the container's disk, under the key the upload route would give it.
  const resumeKey = `resumes/${a.id}/${SECRET}.pdf`;
  const resumePath = path.resolve(process.cwd(), 'uploads', resumeKey);
  await fs.promises.mkdir(path.dirname(resumePath), { recursive: true });
  await fs.promises.writeFile(resumePath, `%PDF-1.4 ${SECRET}`);

  fixtures = {
    a,
    b,
    c,
    p,
    conversationId: conversation.id,
    messageId: message.id,
    jobId: job.id,
    applicationId: application.id,
    serviceOrderId: order.id,
    holdingId: holding.id,
    invoiceId: invoice.id,
    invoiceNumber,
    notificationId: notification.id,
    resumeKey,
  };

  tokens = { a: await signIn(a.email), b: await signIn(b.email) };
}

async function removeResumeFile(): Promise<void> {
  if (!fixtures) return;
  await fs.promises.rm(path.resolve(process.cwd(), 'uploads', 'resumes', fixtures.a.id), {
    recursive: true,
    force: true,
  });
}

function send(call: Call, token?: string) {
  const pending = request(app)[call.method](call.path);
  if (token) pending.set('Authorization', `Bearer ${token}`);
  return call.body ? pending.send(call.body) : pending;
}

/** Everything a response could show: the parsed body and the raw text. */
const wholeResponse = (res: request.Response) => `${JSON.stringify(res.body)}\n${res.text ?? ''}`;

const ROWS: Row[] = [
  {
    resource: 'a message and its conversation',
    control: {
      build: (f) => ({ method: 'get', path: `/api/messages/conversations/${f.conversationId}/messages` }),
      shows: () => SECRET,
    },
    probes: [
      {
        label: 'read the conversation',
        build: (f) => ({ method: 'get', path: `/api/messages/conversations/${f.conversationId}/messages` }),
      },
      {
        label: 'search inside it',
        build: (f) => ({ method: 'get', path: `/api/messages/conversations/${f.conversationId}/messages?q=zebra` }),
      },
      { label: 'unsend the message', build: (f) => ({ method: 'delete', path: `/api/messages/${f.messageId}` }) },
      {
        label: 'edit the message',
        build: (f) => ({ method: 'patch', path: `/api/messages/${f.messageId}`, body: { content: 'rewritten by a stranger' } }),
      },
      {
        label: 'react to the message',
        build: (f) => ({ method: 'post', path: `/api/messages/${f.messageId}/reactions`, body: { emoji: 'thumbs-up' } }),
      },
      {
        label: 'mute the conversation',
        build: (f) => ({
          method: 'patch',
          path: `/api/messages/conversations/${f.conversationId}/preferences`,
          body: { isMuted: true },
        }),
      },
      {
        label: 'accept a request in it',
        build: (f) => ({ method: 'post', path: `/api/messages/conversations/${f.conversationId}/request/accept` }),
      },
    ],
    lists: ['/api/messages/conversations'],
    unchanged: async (f) => {
      const message = await prisma.message.findUniqueOrThrow({ where: { id: f.messageId } });
      expect(message.content).toBe(`${SECRET} meet at the usual place`);
      expect(message.deletedAt).toBeNull();
      expect(message.editedAt).toBeNull();
      expect(await prisma.messageReaction.count({ where: { messageId: f.messageId } })).toBe(0);
      const participants = await prisma.conversationParticipant.findMany({ where: { conversationId: f.conversationId } });
      expect(participants.map((row) => row.userId).sort()).toEqual([f.a.id, f.c.id].sort());
      expect(participants.every((row) => row.isMuted === false)).toBe(true);
    },
  },
  {
    resource: 'a job application',
    control: { build: () => ({ method: 'get', path: '/api/jobs/me/applications' }), shows: (f) => f.applicationId },
    probes: [
      {
        label: 'withdraw it',
        build: (f) => ({ method: 'patch', path: `/api/jobs/me/applications/${f.applicationId}`, body: { status: 'WITHDRAWN' } }),
      },
      {
        label: 'move it through a hiring pipeline',
        build: (f) => ({
          method: 'patch',
          path: `/api/employer/applications/${f.applicationId}/status`,
          body: { status: 'REVIEWED' },
        }),
      },
    ],
    lists: ['/api/jobs/me/applications'],
    unchanged: async (f) => {
      const application = await prisma.jobApplication.findUniqueOrThrow({ where: { id: f.applicationId } });
      expect(application.status).toBe('PENDING');
      expect(application.coverLetter).toBe(`${SECRET} cover letter`);
    },
  },
  {
    resource: 'a marketplace order',
    control: {
      build: (f) => ({ method: 'get', path: `/api/skills-marketplace/orders/${f.serviceOrderId}` }),
      shows: () => SECRET,
    },
    probes: [
      { label: 'read it', build: (f) => ({ method: 'get', path: `/api/skills-marketplace/orders/${f.serviceOrderId}` }) },
      {
        label: 'read its payment',
        build: (f) => ({ method: 'get', path: `/api/skills-marketplace/orders/${f.serviceOrderId}/payment` }),
      },
      {
        label: 'cancel it',
        build: (f) => ({
          method: 'post',
          path: `/api/skills-marketplace/orders/${f.serviceOrderId}/cancel`,
          body: { reason: 'stranger' },
        }),
      },
      {
        label: 'accept it as the provider',
        build: (f) => ({ method: 'post', path: `/api/skills-marketplace/orders/${f.serviceOrderId}/accept` }),
      },
    ],
    lists: ['/api/skills-marketplace/orders/me'],
    unchanged: async (f) => {
      const order = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: f.serviceOrderId } });
      expect(order.status).toBe('PENDING');
      expect(order.cancelledAt).toBeNull();
      expect(order.requirements).toBe(`${SECRET} brief`);
    },
  },
  {
    resource: 'a portfolio holding',
    control: { build: () => ({ method: 'get', path: '/api/strategy/investing/holdings' }), shows: () => SECRET },
    probes: [
      {
        label: 'change it',
        build: (f) => ({ method: 'patch', path: `/api/strategy/investing/holdings/${f.holdingId}`, body: { value: 1 } }),
      },
      { label: 'delete it', build: (f) => ({ method: 'delete', path: `/api/strategy/investing/holdings/${f.holdingId}` }) },
    ],
    lists: ['/api/strategy/investing/holdings'],
    unchanged: async (f) => {
      const holding = await prisma.portfolioHolding.findUniqueOrThrow({ where: { id: f.holdingId } });
      expect(Number(holding.value)).toBe(12_500);
      expect(holding.name).toBe(`${SECRET} fund`);
    },
  },
  {
    resource: 'an invoice',
    control: { build: (f) => ({ method: 'get', path: `/api/invoices/${f.invoiceId}` }), shows: () => SECRET },
    probes: [
      { label: 'read it', build: (f) => ({ method: 'get', path: `/api/invoices/${f.invoiceId}` }) },
      { label: 'download it as a PDF', build: (f) => ({ method: 'get', path: `/api/invoices/${f.invoiceId}/pdf` }) },
    ],
    lists: ['/api/invoices'],
    unchanged: async (f) => {
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoiceId } });
      expect(invoice.userId).toBe(f.a.id);
      expect(invoice.invoiceNumber).toBe(f.invoiceNumber);
    },
  },
  {
    resource: 'a notification',
    control: { build: () => ({ method: 'get', path: '/api/notifications?grouped=false' }), shows: () => SECRET },
    probes: [
      { label: 'mark it read', build: (f) => ({ method: 'patch', path: `/api/notifications/${f.notificationId}/read` }) },
      { label: 'delete it', build: (f) => ({ method: 'delete', path: `/api/notifications/${f.notificationId}` }) },
    ],
    lists: ['/api/notifications?grouped=false'],
    unchanged: async (f) => {
      const notification = await prisma.notification.findUniqueOrThrow({ where: { id: f.notificationId } });
      expect(notification.readAt).toBeNull();
      expect(notification.title).toBe(`${SECRET} notice`);
    },
  },
  {
    resource: 'a résumé file',
    // The file is sent as a download, so there is no body text to look for: a
    // 200 for her and a refusal for everyone else is the whole contrast.
    control: { build: (f) => ({ method: 'get', path: `/api/media/local/${f.resumeKey}` }), shows: null },
    probes: [
      { label: 'open it', build: (f) => ({ method: 'get', path: `/api/media/local/${f.resumeKey}` }) },
      {
        label: 'ask for a link to it',
        build: (f) => ({ method: 'post', path: '/api/media/download-url', body: { key: f.resumeKey } }),
      },
      { label: 'delete it', build: (f) => ({ method: 'delete', path: '/api/media/delete', body: { key: f.resumeKey } }) },
      // A key names its owner in its second segment, and the disk resolves `..`
      // after the check has read it: B's own id first, then a climb into A's
      // folder. Each is a malformed key, refused outright, and A's file stays.
      {
        label: 'open it through a key that climbs out of her own folder',
        build: (f) => ({ method: 'get', path: `/api/media/local/resumes/${f.b.id}/..%2F${f.a.id}/${SECRET}.pdf` }),
        refusedWith: [400],
      },
      {
        label: 'ask for a link to it through a key that climbs out of her own folder',
        build: (f) => ({
          method: 'post',
          path: '/api/media/download-url',
          body: { key: `resumes/${f.b.id}/../${f.a.id}/${SECRET}.pdf` },
        }),
        refusedWith: [400],
      },
      {
        label: 'delete it through a key that climbs out of her own folder',
        build: (f) => ({
          method: 'delete',
          path: '/api/media/delete',
          body: { key: `resumes/${f.b.id}/../${f.a.id}/${SECRET}.pdf` },
        }),
        refusedWith: [400],
      },
    ],
    lists: [],
    unchanged: async (f) => {
      const onDisk = await fs.promises.readFile(path.resolve(process.cwd(), 'uploads', f.resumeKey), 'utf8');
      expect(onDisk).toContain(SECRET);
    },
  },
];

describeIntegration('member B against member A’s things', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterEach(removeResumeFile);

  for (const row of ROWS) {
    describe(row.resource, () => {
      it('is reachable by the member it belongs to, so a refusal below means something', async () => {
        const res = await send(row.control.build(fixtures), tokens.a);
        expect(res.status).toBe(200);
        if (row.control.shows) {
          expect(wholeResponse(res)).toContain(row.control.shows(fixtures));
        }
      });

      for (const probe of row.probes) {
        it(`refuses another member who tries to ${probe.label}`, async () => {
          const res = await send(probe.build(fixtures), tokens.b);

          expect(probe.refusedWith ?? [403, 404]).toContain(res.status);
          // A path that does not exist answers 404 to everybody and would pass.
          expect(res.body?.message ?? '').not.toMatch(/endpoint not found/i);
          expect(wholeResponse(res)).not.toContain(SECRET);
          expect(wholeResponse(res)).not.toContain(fixtures.a.email);
        });

        it(`refuses a caller with no token who tries to ${probe.label}`, async () => {
          const res = await send(probe.build(fixtures));
          expect(res.status).toBe(401);
        });
      }

      for (const list of row.lists) {
        it(`shows another member none of it in ${list}`, async () => {
          const res = await send({ method: 'get', path: list }, tokens.b);
          expect(res.status).toBe(200);
          expect(wholeResponse(res)).not.toContain(SECRET);
          expect(wholeResponse(res)).not.toContain(fixtures.a.id);
        });
      }

      it('is exactly as it was after every attempt', async () => {
        for (const probe of row.probes) {
          await send(probe.build(fixtures), tokens.b);
          await send(probe.build(fixtures));
        }
        await row.unchanged(fixtures);
      });
    });
  }

  describe('the people who may', () => {
    it('lets the poster of a listing with no organisation move its applicants, and not a stranger', async () => {
      const poster = await signIn(fixtures.p.email);

      await request(app)
        .patch(`/api/employer/applications/${fixtures.applicationId}/status`)
        .set('Authorization', `Bearer ${tokens.b}`)
        .send({ status: 'REVIEWED' })
        .expect(403);
      expect((await prisma.jobApplication.findUniqueOrThrow({ where: { id: fixtures.applicationId } })).status).toBe('PENDING');

      await request(app)
        .patch(`/api/employer/applications/${fixtures.applicationId}/status`)
        .set('Authorization', `Bearer ${poster}`)
        .send({ status: 'REVIEWED' })
        .expect(200);
      expect((await prisma.jobApplication.findUniqueOrThrow({ where: { id: fixtures.applicationId } })).status).toBe('REVIEWED');
    });

    it('lets the provider of a service see an order for it', async () => {
      const provider = await signIn(fixtures.p.email);
      const res = await request(app)
        .get(`/api/skills-marketplace/orders/${fixtures.serviceOrderId}`)
        .set('Authorization', `Bearer ${provider}`)
        .expect(200);
      expect(res.body.data.id).toBe(fixtures.serviceOrderId);
    });

    it('lets A change and then remove her own holding', async () => {
      await request(app)
        .patch(`/api/strategy/investing/holdings/${fixtures.holdingId}`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ value: 13_000 })
        .expect(200);
      expect(Number((await prisma.portfolioHolding.findUniqueOrThrow({ where: { id: fixtures.holdingId } })).value)).toBe(13_000);

      await request(app)
        .delete(`/api/strategy/investing/holdings/${fixtures.holdingId}`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .expect(204);
      expect(await prisma.portfolioHolding.count({ where: { id: fixtures.holdingId } })).toBe(0);
    });

    it('lets A mark her own notification read', async () => {
      await request(app)
        .patch(`/api/notifications/${fixtures.notificationId}/read`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .expect(200);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: fixtures.notificationId } })).readAt).not.toBeNull();
    });

    it('lets A withdraw her own application', async () => {
      await request(app)
        .patch(`/api/jobs/me/applications/${fixtures.applicationId}`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ status: 'WITHDRAWN' })
        .expect(200);
      expect((await prisma.jobApplication.findUniqueOrThrow({ where: { id: fixtures.applicationId } })).status).toBe('WITHDRAWN');
    });
  });
});
