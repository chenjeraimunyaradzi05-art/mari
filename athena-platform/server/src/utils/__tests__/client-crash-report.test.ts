import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
}));

import { logger } from '../logger';
import { parseClientCrashReport, recordClientCrash } from '../client-crash-report';
import { app } from '../../index';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseClientCrashReport', () => {
  it('keeps what a crash needs and caps every field', () => {
    const report = parseClientCrashReport({
      kind: 'render',
      message: 'x'.repeat(2000),
      stack: 'at Screen (bundle.js:1:2)\n'.repeat(1000),
      componentStack: 'in SafetyScreen',
      platform: 'ios',
      appVersion: '1.4.0',
      occurredAt: '2026-09-26T01:02:03.000Z',
    });

    expect(report).toMatchObject({ source: 'mobile', kind: 'render', platform: 'ios', appVersion: '1.4.0', componentStack: 'in SafetyScreen' });
    expect(report!.message.length).toBeLessThanOrEqual(501);
    expect(report!.stack!.length).toBeLessThanOrEqual(4001);
  });

  it('refuses a report with no message, and drops fields that are not what they claim to be', () => {
    expect(parseClientCrashReport({})).toBeNull();
    expect(parseClientCrashReport({ message: '   ' })).toBeNull();
    expect(parseClientCrashReport(['message'])).toBeNull();

    const report = parseClientCrashReport({ message: 'boom', kind: 'nonsense', platform: 'ios; DROP TABLE', occurredAt: 'yesterday' });
    expect(report).toEqual({ source: 'mobile', kind: 'error', message: 'boom' });
  });

  it('takes no identity, whatever the phone sends', () => {
    const report = parseClientCrashReport({ message: 'boom', userId: 'u1', email: 'her@example.com' });
    expect(report).not.toHaveProperty('userId');
    expect(report).not.toHaveProperty('email');
  });
});

describe('recordClientCrash', () => {
  it('logs at error level, where a crash will be seen', () => {
    recordClientCrash({ source: 'mobile', kind: 'fatal', message: 'boom', platform: 'android' }, 'req-1');
    expect(logger.error).toHaveBeenCalledWith('Mobile app crash reported', expect.objectContaining({ kind: 'fatal', crashMessage: 'boom', requestId: 'req-1' }));
  });
});

describe('POST /api/client-errors', () => {
  it('accepts a report without anyone signed in, and records it', async () => {
    const res = await request(app).post('/api/client-errors').send({ kind: 'render', message: 'Cannot read property of null', platform: 'ios' }).expect(202);
    expect(res.body.success).toBe(true);
    expect(logger.error).toHaveBeenCalledWith('Mobile app crash reported', expect.objectContaining({ crashMessage: 'Cannot read property of null' }));
  });

  it('answers 400 to a body that is not a crash report', async () => {
    await request(app).post('/api/client-errors').send({ nothing: true }).expect(400);
    expect(logger.error).not.toHaveBeenCalledWith('Mobile app crash reported', expect.anything());
  });
});
