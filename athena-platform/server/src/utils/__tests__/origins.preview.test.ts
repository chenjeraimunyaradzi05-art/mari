/**
 * With CORS_ALLOW_PREVIEW_ORIGINS on, the API used to admit any
 * https://<anything>.netlify.app, so any free Netlify page got credentialed
 * CORS against production. The preview rule now admits only deploys of this
 * deployment's own site.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { isCorsOriginAllowed, ownNetlifySiteNames } from '../origins';

const KEYS = [
  'NODE_ENV',
  'CORS_ALLOW_PREVIEW_ORIGINS',
  'CLIENT_URL',
  'FRONTEND_URL',
  'NEXT_PUBLIC_APP_URL',
  'NETLIFY_URL',
  'URL',
  'ALLOWED_ORIGINS',
  'DEPLOY_URL',
  'DEPLOY_PRIME_URL',
] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.NODE_ENV = 'production';
  process.env.CORS_ALLOW_PREVIEW_ORIGINS = 'true';
  process.env.CLIENT_URL = 'https://athena-empress.netlify.app';
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('preview origins', () => {
  it('reads the site name from the configured front end', () => {
    expect(ownNetlifySiteNames()).toEqual(['athena-empress']);
  });

  it("admits this site's deploy previews, branch deploys and permalinks", () => {
    expect(isCorsOriginAllowed('https://deploy-preview-42--athena-empress.netlify.app')).toBe(true);
    expect(isCorsOriginAllowed('https://staging--athena-empress.netlify.app')).toBe(true);
    expect(isCorsOriginAllowed('https://66f1c0ffee12ab34--athena-empress.netlify.app')).toBe(true);
  });

  it('refuses every other Netlify site, which it used to admit', () => {
    expect(isCorsOriginAllowed('https://anyone-at-all.netlify.app')).toBe(false);
    expect(isCorsOriginAllowed('https://deploy-preview-1--someone-else.netlify.app')).toBe(false);
    expect(isCorsOriginAllowed('https://athena-empress-phish.netlify.app')).toBe(false);
  });

  it('refuses look-alikes: a doubled separator, plain http, a port, another domain', () => {
    expect(isCorsOriginAllowed('https://a--b--athena-empress.netlify.app')).toBe(false);
    expect(isCorsOriginAllowed('http://deploy-preview-42--athena-empress.netlify.app')).toBe(false);
    expect(isCorsOriginAllowed('https://deploy-preview-42--athena-empress.netlify.app:8443')).toBe(false);
    expect(isCorsOriginAllowed('https://deploy-preview-42--athena-empress.netlify.app.evil.example')).toBe(false);
  });

  it('admits no previews when the front end is on a custom domain', () => {
    process.env.CLIENT_URL = 'https://athena.example';
    expect(ownNetlifySiteNames()).toEqual([]);
    expect(isCorsOriginAllowed('https://deploy-preview-42--athena-empress.netlify.app')).toBe(false);
  });

  it('admits no previews in production while the flag is off', () => {
    delete process.env.CORS_ALLOW_PREVIEW_ORIGINS;
    expect(isCorsOriginAllowed('https://deploy-preview-42--athena-empress.netlify.app')).toBe(false);
    // The site itself is configured, so it is allowed on its own merit.
    expect(isCorsOriginAllowed('https://athena-empress.netlify.app')).toBe(true);
  });
});
