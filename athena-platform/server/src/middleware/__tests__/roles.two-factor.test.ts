import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { requireMinRole, requireRole, staffTwoFactorRefusal, staffTwoFactorRequired } from '../roles';

const res = () => {
  const r: any = { statusCode: 0, body: null };
  r.status = (code: number) => { r.statusCode = code; return r; };
  r.json = (body: unknown) => { r.body = body; return r; };
  return r;
};

describe('staff accounts and their second factor', () => {
  const env = { ...process.env };
  beforeEach(() => { process.env = { ...env, NODE_ENV: 'test', STAFF_TWO_FACTOR_REQUIRED: 'true' }; });
  afterEach(() => { process.env = env; });

  it('is always required in production, off by default under test, and follows the switch elsewhere', () => {
    process.env.NODE_ENV = 'production'; delete process.env.STAFF_TWO_FACTOR_REQUIRED;
    expect(staffTwoFactorRequired()).toBe(true);
    process.env.STAFF_TWO_FACTOR_REQUIRED = 'false';
    expect(staffTwoFactorRequired()).toBe(true);
    process.env.NODE_ENV = 'test'; delete process.env.STAFF_TWO_FACTOR_REQUIRED;
    expect(staffTwoFactorRequired()).toBe(false);
    process.env.NODE_ENV = 'development';
    expect(staffTwoFactorRequired()).toBe(true);
    process.env.STAFF_TWO_FACTOR_REQUIRED = 'false';
    expect(staffTwoFactorRequired()).toBe(false);
  });

  it('refuses an admin, a moderator and a super admin without a factor, and never a member', () => {
    expect(staffTwoFactorRefusal({ id: 'a', role: 'ADMIN', twoFactorEnabled: false })?.code).toBe('TWO_FACTOR_REQUIRED');
    expect(staffTwoFactorRefusal({ id: 'm', role: 'MODERATOR' })?.code).toBe('TWO_FACTOR_REQUIRED');
    expect(staffTwoFactorRefusal({ id: 's', role: 'SUPER_ADMIN' })?.setup).toBe('/dashboard/settings/security');
    expect(staffTwoFactorRefusal({ id: 'a', role: 'ADMIN', twoFactorEnabled: true })).toBeNull();
    expect(staffTwoFactorRefusal({ id: 'u', role: 'USER' })).toBeNull();
    expect(staffTwoFactorRefusal({ id: 'c', role: 'CREATOR', twoFactorEnabled: false })).toBeNull();
  });

  it('gates the role middleware: the role is right but the factor is missing', () => {
    const next = jest.fn();
    const r = res();
    requireRole('ADMIN')({ user: { id: 'a', role: 'ADMIN', twoFactorEnabled: false } } as any, r, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(403);
    expect(r.body.code).toBe('TWO_FACTOR_REQUIRED');

    const ok = res();
    requireRole('ADMIN')({ user: { id: 'a', role: 'ADMIN', twoFactorEnabled: true } } as any, ok, next);
    expect(next).toHaveBeenCalledTimes(1);

    const min = res();
    requireMinRole('ADMIN')({ user: { id: 's', role: 'SUPER_ADMIN', twoFactorEnabled: false } } as any, min, next);
    expect(min.statusCode).toBe(403);
    expect(next).toHaveBeenCalledTimes(1);

    process.env.STAFF_TWO_FACTOR_REQUIRED = 'false';
    const off = res();
    requireRole('ADMIN')({ user: { id: 'a', role: 'ADMIN', twoFactorEnabled: false } } as any, off, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
