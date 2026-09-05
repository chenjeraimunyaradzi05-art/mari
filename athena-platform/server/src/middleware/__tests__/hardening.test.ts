import { describe, it, expect } from '@jest/globals';

import { createMemoryThrottle } from '../socialLimits';
import { debugHeaderMatches } from '../errorHandler';

describe('createMemoryThrottle', () => {
  it('allows up to the ceiling inside the window and refuses the next', () => {
    const throttle = createMemoryThrottle(3, 1000);
    expect(throttle.allow('u1', 0)).toBe(true);
    expect(throttle.allow('u1', 10)).toBe(true);
    expect(throttle.allow('u1', 20)).toBe(true);
    expect(throttle.allow('u1', 30)).toBe(false);
    // Someone else is counted on their own.
    expect(throttle.allow('u2', 30)).toBe(true);
  });

  it('lets the window slide: old sends stop counting', () => {
    const throttle = createMemoryThrottle(2, 1000);
    expect(throttle.allow('u1', 0)).toBe(true);
    expect(throttle.allow('u1', 500)).toBe(true);
    expect(throttle.allow('u1', 900)).toBe(false);
    // The first send is now outside the window.
    expect(throttle.allow('u1', 1001)).toBe(true);
    // The second is still inside.
    expect(throttle.allow('u1', 1002)).toBe(false);
  });
});

describe('debugHeaderMatches', () => {
  it('matches only the exact secret, and never when none is configured', () => {
    expect(debugHeaderMatches('s3cret', 's3cret')).toBe(true);
    expect(debugHeaderMatches('s3cre', 's3cret')).toBe(false);
    expect(debugHeaderMatches('S3CRET', 's3cret')).toBe(false);
    expect(debugHeaderMatches('anything', undefined)).toBe(false);
    expect(debugHeaderMatches('', '')).toBe(false);
    expect(debugHeaderMatches(['s3cret'], 's3cret')).toBe(false);
    expect(debugHeaderMatches(undefined, 's3cret')).toBe(false);
  });
});
