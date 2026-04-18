import request from 'supertest';
import { isCorsOriginAllowed } from '../utils/origins';

// Ensure we don't require auth for metrics in this test suite
delete process.env.METRICS_TOKEN;

import { app } from '../index';

describe('ops endpoints', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMetricsToken = process.env.METRICS_TOKEN;
  const originalDiagnosticsToken = process.env.HEALTH_DIAGNOSTICS_TOKEN;
  const originalDebugSecret = process.env.DEBUG_SECRET;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalNetlifyUrl = process.env.NETLIFY_URL;
  const originalRailwayUrl = process.env.RAILWAY_URL;
  const originalCorsAllowPreviewOrigins = process.env.CORS_ALLOW_PREVIEW_ORIGINS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMetricsToken === undefined) {
      delete process.env.METRICS_TOKEN;
    } else {
      process.env.METRICS_TOKEN = originalMetricsToken;
    }

    if (originalDiagnosticsToken === undefined) {
      delete process.env.HEALTH_DIAGNOSTICS_TOKEN;
    } else {
      process.env.HEALTH_DIAGNOSTICS_TOKEN = originalDiagnosticsToken;
    }

    if (originalDebugSecret === undefined) {
      delete process.env.DEBUG_SECRET;
    } else {
      process.env.DEBUG_SECRET = originalDebugSecret;
    }

    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }

    if (originalNetlifyUrl === undefined) {
      delete process.env.NETLIFY_URL;
    } else {
      process.env.NETLIFY_URL = originalNetlifyUrl;
    }

    if (originalRailwayUrl === undefined) {
      delete process.env.RAILWAY_URL;
    } else {
      process.env.RAILWAY_URL = originalRailwayUrl;
    }

    if (originalCorsAllowPreviewOrigins === undefined) {
      delete process.env.CORS_ALLOW_PREVIEW_ORIGINS;
    } else {
      process.env.CORS_ALLOW_PREVIEW_ORIGINS = originalCorsAllowPreviewOrigins;
    }
  });

  it('GET /health returns 200', async () => {
    await request(app).get('/health').expect(200);
  });

  it('GET /livez returns 200', async () => {
    await request(app).get('/livez').expect(200);
  });

  it('GET /metrics returns 200 and includes http_requests_total', async () => {
    const res = await request(app).get('/metrics').expect(200);
    expect(res.text).toContain('http_requests_total');
  });

  it('GET /metrics returns 404 in production when no token is configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.METRICS_TOKEN;

    await request(app).get('/metrics').expect(404);
  });

  it('GET /health/auth-diag returns 404 in production without diagnostics access', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.METRICS_TOKEN;
    delete process.env.HEALTH_DIAGNOSTICS_TOKEN;
    delete process.env.DEBUG_SECRET;

    await request(app).get('/health/auth-diag').expect(404);
  });

  it('rejects preview deployment origins in production unless explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ALLOW_PREVIEW_ORIGINS;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.NETLIFY_URL;
    delete process.env.RAILWAY_URL;

    expect(isCorsOriginAllowed('https://preview-demo.netlify.app')).toBe(false);
    expect(isCorsOriginAllowed('https://preview-demo.up.railway.app')).toBe(false);
  });

  it('allows explicitly configured production origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://app.athena.example';
    process.env.NETLIFY_URL = 'https://athena.netlify.app';

    expect(isCorsOriginAllowed('https://app.athena.example')).toBe(true);
    expect(isCorsOriginAllowed('https://athena.netlify.app')).toBe(true);
  });
});
