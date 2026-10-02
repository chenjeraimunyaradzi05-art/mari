import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * What src/start.ts does when the app does not come up.
 *
 * start.ts runs `prisma migrate deploy`, loads src/index.ts and calls
 * startServer(). Two failures ended badly:
 *
 *  - startServer() rejects (validateEnvironmentOrExit throws in production for
 *    a bad environment, or a worker could not start). The handler logged and
 *    returned, so the process never listened and never exited non-zero: the
 *    host saw a clean exit, or a container that hung until its health check
 *    gave up, with the reason in a log nobody was reading.
 *  - index.js crashes on load. The emergency server it starts for the health
 *    check answered 503 with the exception's own text, to anyone who could
 *    reach the port.
 *
 * start.ts does its work on import, so each test imports it afresh with the
 * migration step, dotenv, Sentry, the HTTP server and the app all replaced.
 */

const execSync = jest.fn();
jest.mock('node:child_process', () => ({ execSync: (...args: unknown[]) => execSync(...args) }));
jest.mock('dotenv', () => ({ __esModule: true, default: { config: jest.fn() } }));
jest.mock('../utils/sentry', () => ({ initSentry: jest.fn() }));

type RequestHandler = (req: unknown, res: { writeHead: jest.Mock; end: jest.Mock }) => void;
let emergencyHandler: RequestHandler | undefined;
const listen = jest.fn((_port: unknown, callback?: () => void) => callback?.());
jest.mock('node:http', () => ({
  createServer: (handler: RequestHandler) => {
    emergencyHandler = handler;
    return { listen: (...args: unknown[]) => (listen as (...a: unknown[]) => void)(...args) };
  },
}));

const startServer = jest.fn<() => Promise<void>>();
let indexLoadError: Error | null = null;
jest.mock('../index', () => {
  if (indexLoadError) throw indexLoadError;
  return { startServer: () => startServer() };
});

/** Imports start.ts afresh and waits until `done` is true, or fails after a second. */
async function boot(done: () => boolean): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- start.ts runs on import, so it is loaded afresh by require inside isolateModules
      require('../start');
    });
    const deadline = Date.now() + 1000;
    const poll = () => {
      if (done()) return resolve();
      if (Date.now() > deadline) return reject(new Error('start.ts did not reach the expected state'));
      setTimeout(poll, 5);
    };
    poll();
  });
}

describe('src/start.ts', () => {
  let exit: jest.SpiedFunction<typeof process.exit>;
  let listenersBefore: { uncaught: unknown[]; unhandled: unknown[] };

  beforeEach(() => {
    execSync.mockReset();
    startServer.mockReset();
    listen.mockClear();
    emergencyHandler = undefined;
    indexLoadError = null;
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    listenersBefore = {
      uncaught: process.listeners('uncaughtException'),
      unhandled: process.listeners('unhandledRejection'),
    };
  });

  afterEach(() => {
    // start.ts registers process-wide handlers each time it is imported.
    for (const handler of process.listeners('uncaughtException')) {
      if (!listenersBefore.uncaught.includes(handler)) process.removeListener('uncaughtException', handler as never);
    }
    for (const handler of process.listeners('unhandledRejection')) {
      if (!listenersBefore.unhandled.includes(handler)) process.removeListener('unhandledRejection', handler as never);
    }
    jest.restoreAllMocks();
  });

  it('exits with code 1 when startServer() rejects, so the deploy fails instead of hanging', async () => {
    startServer.mockRejectedValue(new Error('Invalid environment configuration'));

    await boot(() => exit.mock.calls.length > 0);

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('does not exit when startServer() resolves', async () => {
    startServer.mockResolvedValue(undefined);

    await boot(() => startServer.mock.calls.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(exit).not.toHaveBeenCalled();
  });

  it('carries on to start the server when the migration step fails, as it always did', async () => {
    execSync.mockImplementation(() => {
      throw new Error('migrate failed');
    });
    startServer.mockResolvedValue(undefined);

    await boot(() => startServer.mock.calls.length > 0);

    expect(startServer).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
  });

  it('answers a crash on load with 503 and no exception text', async () => {
    indexLoadError = new Error("Cannot find module '/app/dist/secret-internal-path' at C:\\build\\server");

    await boot(() => emergencyHandler !== undefined);

    const res = { writeHead: jest.fn(), end: jest.fn() };
    emergencyHandler!({}, res);

    expect(res.writeHead).toHaveBeenCalledWith(503, expect.anything());
    const body = String(res.end.mock.calls[0][0]);
    expect(JSON.parse(body)).toEqual({ status: 'error', message: 'Server failed to start' });
    expect(body).not.toContain('secret-internal-path');
    expect(body).not.toContain('Cannot find module');
  });
});
