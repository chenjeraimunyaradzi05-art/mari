jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import multer from 'multer';
import { z } from 'zod';
import { describeKnownError, errorHandler } from '../errorHandler';

describe('errorHandler', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDebugSecret = process.env.DEBUG_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;

    if (originalDebugSecret === undefined) {
      delete process.env.DEBUG_SECRET;
    } else {
      process.env.DEBUG_SECRET = originalDebugSecret;
    }
  });

  it('omits debug payload for production 500s without debug access', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEBUG_SECRET;

    const err: any = new Error('Sensitive failure');
    err.statusCode = 500;
    err.stack = 'Error: Sensitive failure\n  at test';

    const req: any = {
      method: 'GET',
      path: '/boom',
      headers: {},
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler(err, req, res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(500);
    expect(payload.debugMessage).toBeUndefined();
    expect(payload.debugStack).toBeUndefined();
  });

  it('includes debug payload for production 500s with the debug secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEBUG_SECRET = 'debug-secret';

    const err: any = new Error('Sensitive failure');
    err.statusCode = 500;
    err.stack = 'Error: Sensitive failure\n  at test';

    const req: any = {
      method: 'GET',
      path: '/boom',
      headers: {
        'x-debug-auth': 'debug-secret',
      },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler(err, req, res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(500);
    expect(payload.debugMessage).toBe('Sensitive failure');
    expect(payload.debugStack).toContain('Sensitive failure');
  });
});

describe('errors raised in front of the handlers', () => {
  const respond = (err: any) => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(err, { method: 'POST', path: '/x', headers: {} } as any, res, jest.fn());
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  };

  it('answers a file over its limit with 413 and says so', () => {
    const { status, body } = respond(new multer.MulterError('LIMIT_FILE_SIZE', 'file'));
    expect(status).toBe(413);
    expect(body.message).toMatch(/larger than this upload allows/);
  });

  it('answers a body over the JSON limit with 413 and malformed JSON with 400', () => {
    const large: any = new Error('request entity too large');
    large.type = 'entity.too.large';
    large.statusCode = 413;
    expect(respond(large)).toMatchObject({ status: 413, body: { message: 'The request body is too large' } });

    const malformed: any = new SyntaxError('Unexpected token');
    malformed.type = 'entity.parse.failed';
    malformed.statusCode = 400;
    expect(respond(malformed)).toMatchObject({ status: 400, body: { message: 'The request body is not valid JSON' } });
  });

  it('answers a failed zod parse with 400 and the first issue, named by its field', () => {
    let caught: unknown;
    try {
      z.object({ amount: z.number().min(1) }).parse({ amount: 0 });
    } catch (error) {
      caught = error;
    }
    const { status, body } = respond(caught);
    expect(status).toBe(400);
    expect(body.message).toMatch(/^amount: /);
  });

  it('leaves everything else alone', () => {
    expect(describeKnownError(new Error('plain') as any)).toBeNull();
  });
});
