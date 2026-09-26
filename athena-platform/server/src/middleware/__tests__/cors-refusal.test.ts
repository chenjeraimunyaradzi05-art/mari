import request from 'supertest';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
}));

import { logger } from '../../utils/logger';
import { app } from '../../index';

/**
 * The CORS gate in index.ts. A refused origin used to be rejected with a bare
 * Error('Not allowed by CORS'), which the error handler answered as a 500 and
 * logged at error level with a stack, so every scanner and every stale preview
 * deploy looked like the API breaking.
 */
describe('A request from an origin the API does not allow', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    jest.clearAllMocks();
  });

  it('is answered 403 and logged as a refusal, not as a server error', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ALLOW_PREVIEW_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://app.athena.example';

    const res = await request(app).get('/health').set('Origin', 'https://scanner.invalid').expect(403);

    expect(res.body.success).toBe(false);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('CORS rejected origin', expect.objectContaining({ origin: 'https://scanner.invalid' }));
  });

  it('leaves an allowed origin alone', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://app.athena.example';

    const res = await request(app).get('/health').set('Origin', 'https://app.athena.example').expect(200);

    expect(res.headers['access-control-allow-origin']).toBe('https://app.athena.example');
  });
});
