/**
 * What a failed request tells the member, and what it tells the operator.
 *
 * Two defects shared one file. A route that threw reached errorHandler, was
 * logged and answered 500, and Sentry never heard of it — nothing on that path
 * called it. And a refusal reached the client under whichever of `message` or
 * `error` its route happened to use, while each screen had guessed one of the
 * two, so a wrong guess replaced the member's reason with a generic sentence.
 */
jest.mock('../src/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const captureException = jest.fn();
jest.mock('../src/utils/sentry', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import express from 'express';
import request from 'supertest';
import {
  ApiError,
  errorHandler,
  normalizeErrorBodies,
  reportsToSentry,
  withBothErrorNames,
} from '../src/middleware/errorHandler';

function respond(err: Error, reqExtras: Record<string, unknown> = {}) {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const req: any = { method: 'POST', path: '/api/finance/insurance/apply', headers: {}, requestId: 'req-1', ...reqExtras };
  errorHandler(err as any, req, res, jest.fn());
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0] as Record<string, unknown> };
}

describe('errorHandler reports our failures to Sentry', () => {
  beforeEach(() => captureException.mockClear());

  it('reports an unexpected crash, with the request id and without the body', () => {
    const crash = new TypeError("Cannot read properties of undefined (reading 'id')");
    respond(crash, { body: { safetyPlan: 'the address she is moving to' }, query: { q: 'secret' } });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0];
    expect(error).toBe(crash);
    expect(context).toEqual({ requestId: 'req-1', statusCode: 500, method: 'POST', path: '/api/finance/insurance/apply' });
    expect(JSON.stringify(context)).not.toContain('the address she is moving to');
    expect(JSON.stringify(context)).not.toContain('secret');
  });

  it('reports a 500 raised on purpose', () => {
    respond(new ApiError(500, 'Ledger write failed'));
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('does not report a refusal the member can fix', () => {
    respond(new ApiError(409, 'You have already applied for this product'));
    respond(new ApiError(400, 'Amount is required'));
    respond(new ApiError(403, 'This profile is private'));
    expect(captureException).not.toHaveBeenCalled();
  });

  it('does not report a deployment gap the launch-readiness page already names, but does report an unplanned 503', () => {
    respond(new ApiError(503, 'Payments are not configured on this deployment'));
    expect(captureException).not.toHaveBeenCalled();

    const unplanned: any = new Error('upstream closed the socket');
    unplanned.statusCode = 503;
    respond(unplanned);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('draws the line in one place', () => {
    expect(reportsToSentry(499, false)).toBe(false);
    expect(reportsToSentry(500, true)).toBe(true);
    expect(reportsToSentry(502, undefined)).toBe(true);
    expect(reportsToSentry(503, true)).toBe(false);
    expect(reportsToSentry(503, false)).toBe(true);
  });
});

describe('a refusal reaches the member under both names', () => {
  it('answers a thrown ApiError with its reason under message and error alike', () => {
    const { status, body } = respond(new ApiError(409, 'You have already applied for this product'));
    expect(status).toBe(409);
    expect(body.message).toBe('You have already applied for this product');
    expect(body.error).toBe('You have already applied for this product');
  });

  it('copies an inline error across to message, and a message across to error', () => {
    expect(withBothErrorNames({ error: 'Amount, currency, and description are required' })).toEqual({
      success: false,
      error: 'Amount, currency, and description are required',
      message: 'Amount, currency, and description are required',
    });
    expect(withBothErrorNames({ success: false, message: 'Not found' })).toEqual({
      success: false,
      message: 'Not found',
      error: 'Not found',
    });
  });

  it('leaves alone a body that already has both, has neither, or uses a name for something else', () => {
    const both = { message: 'a', error: 'b' };
    expect(withBothErrorNames(both)).toBe(both);
    const neither = { success: false, errors: [{ field: 'email' }] };
    expect(withBothErrorNames(neither)).toBe(neither);
    const structured = { message: 'Validation failed', error: { fields: ['email'] } };
    expect(withBothErrorNames(structured)).toBe(structured);
    expect(withBothErrorNames(['a'])).toEqual(['a']);
    expect(withBothErrorNames(null)).toBeNull();
  });

  it('rewrites error responses only, once mounted in front of the routes', async () => {
    const app = express();
    app.use(normalizeErrorBodies);
    app.get('/refused', (_req, res) => {
      res.status(400).json({ error: 'Amount is required' });
    });
    app.get('/fine', (_req, res) => {
      res.status(200).json({ error: 'a field that happens to be called error', data: 1 });
    });

    const refused = await request(app).get('/refused').expect(400);
    expect(refused.body).toEqual({ success: false, error: 'Amount is required', message: 'Amount is required' });

    const fine = await request(app).get('/fine').expect(200);
    expect(fine.body).toEqual({ error: 'a field that happens to be called error', data: 1 });
  });
});
