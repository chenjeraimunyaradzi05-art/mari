jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { errorHandler } from '../errorHandler';

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
