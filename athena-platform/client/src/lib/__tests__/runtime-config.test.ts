/**
 * The API origin is the one piece of configuration that can point a sign-in
 * form at somebody else's server, so it gets a test of its own.
 *
 * For a long time getBackendApiUrl() fell back to https://api.athena.app in any
 * production build with nothing configured. ATHENA does not own that domain. It
 * resolves to a live third party, the Netlify site had NEXT_PUBLIC_API_URL
 * unset, and app/api/auth/login forwards the request body verbatim — so the
 * default was posting members' passwords to a stranger. These cases exist so
 * that no default like it can be reintroduced by accident.
 *
 * The module reads process.env once, at load, into STATIC_PUBLIC_ENV, which is
 * how Next inlines NEXT_PUBLIC_* at build time. So every case sets the
 * environment first and then loads a fresh copy of the module.
 */

const URL_KEYS = [
  'API_URL',
  'BACKEND_URL',
  'NEXT_PRIVATE_API_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SOCKET_URL',
  'NEXT_PUBLIC_WS_URL',
] as const;

const originalUrls: Record<string, string | undefined> = {};

// process.env.NODE_ENV is typed read-only, because in application code it is:
// Next replaces it at build time. jest.replaceProperty is the supported way to
// stand somewhere else for the length of a test, and it restores itself.
function runningIn(nodeEnv: 'development' | 'production' | 'test'): void {
  jest.replaceProperty(process.env, 'NODE_ENV', nodeEnv);
}

beforeEach(() => {
  for (const key of URL_KEYS) {
    originalUrls[key] = process.env[key];
    delete process.env[key];
  }
  jest.resetModules();
});

afterEach(() => {
  for (const key of URL_KEYS) {
    if (originalUrls[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalUrls[key];
    }
  }
  jest.restoreAllMocks();
});

// The module throws from its own top level when it is unconfigured, because
// BACKEND_API_URL is a const it computes at load. That is the behaviour under
// test: a misconfigured build has to fail where a person will see it, not on
// the first member's sign-in. So the unconfigured cases assert on the import
// rejecting, not on a call.
function loadRuntimeConfig() {
  return import('../runtime-config');
}

describe('getBackendApiUrl', () => {
  it('uses the configured origin, without its trailing slash', async () => {
    runningIn('production');
    process.env.NEXT_PUBLIC_API_URL = 'https://athena-api.onrender.com/';

    const { getBackendApiUrl } = await loadRuntimeConfig();
    expect(getBackendApiUrl()).toBe('https://athena-api.onrender.com');
  });

  it('refuses to guess an origin in production, and names the variable to set', async () => {
    runningIn('production');

    await expect(loadRuntimeConfig()).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it('never falls back to a domain ATHENA does not own', async () => {
    runningIn('production');

    const thrown = await loadRuntimeConfig().then(
      () => null,
      (error: unknown) => error
    );

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain('api.athena.app');
  });

  it('assumes the local API in development, where a wrong guess reaches nobody', async () => {
    runningIn('development');

    const { getBackendApiUrl } = await loadRuntimeConfig();
    expect(getBackendApiUrl()).toBe('http://localhost:5000');
  });
});

describe('getSocketOrigin', () => {
  it('follows the API origin when no socket origin is configured', async () => {
    runningIn('production');
    process.env.NEXT_PUBLIC_API_URL = 'https://athena-api.onrender.com';

    const { getSocketOrigin } = await loadRuntimeConfig();
    expect(getSocketOrigin()).toBe('https://athena-api.onrender.com');
  });

  it('is its own configuration when one is given', async () => {
    runningIn('production');
    process.env.NEXT_PUBLIC_API_URL = 'https://athena-api.onrender.com';
    process.env.NEXT_PUBLIC_SOCKET_URL = 'https://athena-ws.onrender.com';

    const { getSocketOrigin } = await loadRuntimeConfig();
    expect(getSocketOrigin()).toBe('https://athena-ws.onrender.com');
  });

  it('opens no socket to a guessed host either, since it inherits the API origin', async () => {
    runningIn('production');
    process.env.NEXT_PUBLIC_API_URL = 'https://athena-api.onrender.com';

    const { getSocketOrigin } = await loadRuntimeConfig();
    expect(getSocketOrigin()).not.toContain('api.athena.app');
  });
});
