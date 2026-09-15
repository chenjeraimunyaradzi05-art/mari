import { describe, expect, it } from '@jest/globals';

import { redactSensitive } from '../logger';

describe('What a log line may carry', () => {
  it('masks secrets by key at any depth, and leaves the rest', () => {
    const out = redactSensitive({
      requestId: 'r1',
      body: { email: 'her@athena.com', password: 'hunter22', nested: { refreshToken: 'abc', twoFactorCode: '123456' } },
      headers: { authorization: 'Bearer x', cookie: 'refreshToken=y', 'x-request-id': 'r1' },
      list: [{ apiKey: 'k' }, 'plain'],
    }) as any;

    expect(out.requestId).toBe('r1');
    expect(out.body.email).toBe('her@athena.com');
    expect(out.body.password).toBe('[redacted]');
    expect(out.body.nested.refreshToken).toBe('[redacted]');
    expect(out.body.nested.twoFactorCode).toBe('[redacted]');
    expect(out.headers.authorization).toBe('[redacted]');
    expect(out.headers.cookie).toBe('[redacted]');
    expect(out.headers['x-request-id']).toBe('r1');
    expect(out.list[0].apiKey).toBe('[redacted]');
    expect(out.list[1]).toBe('plain');
  });

  it('keeps errors, dates and buffers whole and survives a cycle', () => {
    const error = new Error('boom');
    const date = new Date('2026-09-15T00:00:00Z');
    const cyclic: any = { name: 'loop' };
    cyclic.self = cyclic;

    const out = redactSensitive({ error, date, buffer: Buffer.from('x'), cyclic }) as any;
    expect(out.error).toBe(error);
    expect(out.date).toBe(date);
    expect(Buffer.isBuffer(out.buffer)).toBe(true);
    expect(out.cyclic.self).toBe('[circular]');
    expect(redactSensitive('a string')).toBe('a string');
    expect(redactSensitive(null)).toBeNull();
  });
});
