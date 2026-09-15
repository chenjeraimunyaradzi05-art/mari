import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';

import { acceptableRequestId, requestIdMiddleware } from '../requestId';

describe('The request id a caller may hand us', () => {
  it('is kept when it looks like an id and replaced when it does not', () => {
    expect(acceptableRequestId('req-123.abc:XYZ_1')).toBe('req-123.abc:XYZ_1');
    expect(acceptableRequestId('a'.repeat(128))).toBe('a'.repeat(128));
    expect(acceptableRequestId('a'.repeat(129))).toBeNull();
    expect(acceptableRequestId('has space')).toBeNull();
    expect(acceptableRequestId('<script>')).toBeNull();
    expect(acceptableRequestId('')).toBeNull();
    expect(acceptableRequestId(['x'])).toBeNull();
    expect(acceptableRequestId(undefined)).toBeNull();
  });

  it('echoes an acceptable id and mints one otherwise', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/', (req, res) => res.json({ id: req.requestId }));

    const kept = await request(app).get('/').set('X-Request-Id', 'trace-42').expect(200);
    expect(kept.body.id).toBe('trace-42');
    expect(kept.headers['x-request-id']).toBe('trace-42');

    const minted = await request(app).get('/').set('X-Request-Id', 'not an id at all').expect(200);
    expect(minted.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(minted.headers['x-request-id']).toBe(minted.body.id);
  });
});
