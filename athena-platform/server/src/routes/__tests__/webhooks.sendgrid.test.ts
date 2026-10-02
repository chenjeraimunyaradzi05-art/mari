/**
 * SendGrid's Event Webhook, which is how this platform learns that an email did
 * not arrive.
 *
 * Nothing here ever heard a bounce. A mistyped address at sign-up kept being
 * sent a confirmation link on every resend, a closed mailbox kept being sent
 * password resets, and a member who reported our mail as spam was mailed again.
 * The endpoint is open to the internet, so the cases that matter are the ones
 * where it must refuse: no key to check against, no signature, a signature made
 * by somebody else, a body altered after it was signed. An unsigned suppression
 * list would let a stranger stop a member's password-reset mail from being sent.
 */

import crypto from 'crypto';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';

type Row = { email: string; reason: string; source: string };
const store = new Map<string, Row>();

jest.mock('../../utils/prisma', () => ({
  prisma: {
    stripeWebhookEvent: { create: jest.fn(), delete: jest.fn() },
    emailSuppression: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = store.get(where.email);
        const row = existing ? { ...existing, ...update } : { ...create };
        store.set(where.email, row);
        return row;
      }),
    },
  },
}));

jest.mock('stripe', () => {
  const stripeClient = { webhooks: { constructEvent: jest.fn() } };
  const StripeMock: any = jest.fn().mockImplementation(() => stripeClient);
  StripeMock.__client = stripeClient;
  return { __esModule: true, default: StripeMock };
});

jest.mock('../../utils/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import webhookRoutes from '../webhook.routes';
import { prisma as prismaTyped } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { opsSnapshot } from '../../utils/ops-metrics';

const prisma: any = prismaTyped;

// A real key pair, so the signatures here are made the way SendGrid makes them:
// ECDSA over P-256 and SHA-256, on the timestamp followed by the raw body. The
// public half is handed over as base64 of its DER encoding, which is what
// SendGrid's settings page shows.
const signer = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicKey = signer.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const stranger = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

function sign(body: string, timestamp: string, key: crypto.KeyObject = signer.privateKey): string {
  return crypto.sign('sha256', Buffer.from(timestamp + body), key).toString('base64');
}

// The body is sent as a string, not a Buffer: with a JSON content type superagent
// serialises a Buffer to {"type":"Buffer",...}, and the signature is over the
// bytes that arrive.
function createTestApp() {
  const app = express();
  app.use('/api/webhooks', webhookRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.statusCode || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
  });
  return app;
}

function deliver(
  events: unknown,
  options: { signWith?: crypto.KeyObject; body?: string; timestamp?: string; headers?: boolean } = {}
) {
  const body = options.body ?? JSON.stringify(events);
  const timestamp = options.timestamp ?? '1789000000';
  let req = request(createTestApp()).post('/api/webhooks/sendgrid').set('Content-Type', 'application/json');
  if (options.headers !== false) {
    req = req
      .set('X-Twilio-Email-Event-Webhook-Signature', sign(body, timestamp, options.signWith))
      .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp);
  }
  return req.send(body);
}

const bounce = { email: 'Bounced@Example.org', event: 'bounce', type: 'bounce', status: '5.1.1', reason: '550 no such user', sg_event_id: 'e1' };

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = publicKey;
});

describe('POST /api/webhooks/sendgrid, who may call it', () => {
  it('refuses with 503 when there is no key to check against, and writes nothing', async () => {
    delete process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;

    const res = await deliver([bounce]);

    expect(res.status).toBe(503);
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('refuses a delivery with no signature headers', async () => {
    const res = await deliver([bounce], { headers: false });

    expect(res.status).toBe(400);
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('refuses a signature made by somebody else', async () => {
    const res = await deliver([bounce], { signWith: stranger.privateKey });

    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it('refuses a body that was changed after it was signed', async () => {
    const signedFor = [bounce];
    const tampered = JSON.stringify([{ ...bounce, email: 'victim@example.org' }]);

    const res = await request(createTestApp())
      .post('/api/webhooks/sendgrid')
      .set('Content-Type', 'application/json')
      .set('X-Twilio-Email-Event-Webhook-Signature', sign(JSON.stringify(signedFor), '1789000000'))
      .set('X-Twilio-Email-Event-Webhook-Timestamp', '1789000000')
      .send(tampered);

    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it('refuses a signature that was made for a different timestamp', async () => {
    const body = JSON.stringify([bounce]);

    const res = await request(createTestApp())
      .post('/api/webhooks/sendgrid')
      .set('Content-Type', 'application/json')
      .set('X-Twilio-Email-Event-Webhook-Signature', sign(body, '1789000000'))
      .set('X-Twilio-Email-Event-Webhook-Timestamp', '1789000999')
      .send(body);

    expect(res.status).toBe(400);
  });

  it('counts a refused delivery without putting it in the failure list a stranger could fill', async () => {
    await deliver([bounce], { signWith: stranger.privateKey });

    const snapshot = opsSnapshot();
    expect(snapshot.operations['sendgrid_webhook.bad_signature']?.ignored).toBeGreaterThanOrEqual(1);
    expect(snapshot.recentFailures.some((failure) => failure.operation === 'sendgrid_webhook.bad_signature')).toBe(false);
  });
});

describe('POST /api/webhooks/sendgrid, what it records', () => {
  it('writes one suppression for a hard bounce, with the address lower-cased', async () => {
    const res = await deliver([bounce]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, suppressed: 1 });
    expect(Array.from(store.values())).toEqual([{ email: 'bounced@example.org', reason: 'bounce', source: 'sendgrid' }]);
  });

  it('is idempotent: the same delivery twice leaves one row', async () => {
    await deliver([bounce]);
    await deliver([bounce]);

    expect(store.size).toBe(1);
    // Each time it is the same keyed write, never a second insert.
    for (const [args] of prisma.emailSuppression.upsert.mock.calls) {
      expect(args.where).toEqual({ email: 'bounced@example.org' });
    }
  });

  it('records a spam report and a drop for a bounced address', async () => {
    const res = await deliver([
      { email: 'reporter@example.org', event: 'spamreport' },
      { email: 'old@example.org', event: 'dropped', reason: 'Bounced Address' },
      { email: 'invalid@example.org', event: 'dropped', reason: 'Invalid' },
    ]);

    expect(res.body).toMatchObject({ suppressed: 3 });
    expect(Object.fromEntries(Array.from(store.values()).map((row) => [row.email, row.reason]))).toEqual({
      'reporter@example.org': 'spamreport',
      'old@example.org': 'dropped',
      'invalid@example.org': 'dropped',
    });
  });

  it('leaves alone everything that is not permanent or not about the address', async () => {
    const res = await deliver([
      { email: 'a@example.org', event: 'delivered' },
      { email: 'b@example.org', event: 'open' },
      { email: 'c@example.org', event: 'click' },
      { email: 'd@example.org', event: 'deferred' },
      // A block is the receiving server refusing for now, not the mailbox being gone.
      { email: 'e@example.org', event: 'bounce', type: 'blocked', status: '5.7.1' },
      // A 4.x.x status is temporary by definition.
      { email: 'f@example.org', event: 'bounce', type: 'bounce', status: '4.2.2' },
      // Dropped for what the message says, or because she unsubscribed, says nothing about the address.
      { email: 'g@example.org', event: 'dropped', reason: 'Spam Content' },
      { email: 'h@example.org', event: 'dropped', reason: 'Unsubscribed Address' },
      // A header we built wrongly is our fault, not the address's; only a bare
      // "Invalid" is SendGrid saying the address itself is no good.
      { email: 'i@example.org', event: 'dropped', reason: 'Invalid SMTPAPI header' },
      { email: 'j@example.org', event: 'dropped', reason: 'Recipient List over Package Quota' },
    ]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ suppressed: 0 });
    expect(store.size).toBe(0);
  });

  it('skips entries with no usable address and keeps one row per address in a batch', async () => {
    const res = await deliver([
      { event: 'bounce', type: 'bounce' },
      { email: 'not an address', event: 'bounce', type: 'bounce' },
      { email: 42, event: 'spamreport' },
      null,
      bounce,
      { ...bounce, email: 'BOUNCED@example.org', sg_event_id: 'e2' },
    ]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ suppressed: 1 });
    expect(Array.from(store.keys())).toEqual(['bounced@example.org']);
  });

  it('does not write an address into a log line', async () => {
    await deliver([bounce]);

    const logged = JSON.stringify([...(logger.info as jest.Mock).mock.calls, ...(logger.warn as jest.Mock).mock.calls]);
    expect(logged).not.toContain('example.org');
  });

  it('is not acknowledged when the database write fails, so SendGrid sends the batch again', async () => {
    prisma.emailSuppression.upsert.mockRejectedValueOnce(new Error('connection reset'));

    const res = await deliver([bounce]);

    expect(res.status).toBe(500);
    expect(opsSnapshot().operations['sendgrid_webhook.suppression']?.failure).toBeGreaterThanOrEqual(1);
  });

  it('refuses a signed body that is not JSON', async () => {
    const res = await deliver(undefined, { body: 'not json at all' });

    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it('accepts an empty batch and writes nothing', async () => {
    const res = await deliver([]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ suppressed: 0 });
  });
});
