/**
 * scripts/check-route-auth.js: the static half of "deny by default".
 *
 * The runtime half (src/__tests__/route-auth-coverage.test.ts) sends the real
 * app an anonymous request per route. This half reads the syntax, so what it
 * counts as a guard has to be exactly what the routers use: `authenticate` in
 * the middleware list, in a `router.use` registered earlier, or in an array
 * such as `adminOnly` that the file declares and spreads in.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS script with no type declarations
const ts = require('typescript');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS script with no type declarations
const script = require('../scripts/check-route-auth') as {
  routesIn: (
    sourceFile: unknown,
    target: string
  ) => Array<{ method: string; path: string; guarded: boolean; line: number }>;
  join: (prefix: string, routePath: string) => string;
};

const read = (source: string, target = 'router') =>
  script
    .routesIn(ts.createSourceFile('example.routes.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), target)
    .map(({ method, path, guarded }) => `${guarded ? 'guarded' : 'open'} ${method} ${path}`);

describe('check-route-auth', () => {
  it('counts authenticate in the middleware list as a guard, and its absence as open', () => {
    expect(
      read(`
        router.get('/mine', authenticate, async (req, res) => {});
        router.get('/catalogue', async (req, res) => {});
        router.post('/mine', rateLimit, authenticate, [body('x')], async (req, res) => {});
      `)
    ).toEqual(['guarded GET /mine', 'open GET /catalogue', 'guarded POST /mine']);
  });

  it('does not count optionalAuth, which lets an anonymous caller through', () => {
    expect(read(`router.get('/feed', optionalAuth, async (req, res) => {});`)).toEqual(['open GET /feed']);
  });

  it('does not count a role check on its own, because it never authenticates', () => {
    expect(read(`router.get('/staff', requireRole('ADMIN'), async (req, res) => {});`)).toEqual(['open GET /staff']);
  });

  it('counts a router.use(authenticate) only for what is registered after it', () => {
    expect(
      read(`
        router.get('/before', async (req, res) => {});
        router.use(authenticate);
        router.get('/after', async (req, res) => {});
        router.delete('/after/:id', async (req, res) => {});
      `)
    ).toEqual(['open GET /before', 'guarded GET /after', 'guarded DELETE /after/:id']);
  });

  it('does not let a path-scoped router.use guard the whole router', () => {
    expect(
      read(`
        router.use('/private', authenticate);
        router.get('/public', async (req, res) => {});
      `)
    ).toEqual(['open GET /public']);
  });

  it('counts a local array that holds authenticate, spread into the route', () => {
    expect(
      read(`
        const adminOnly = [authenticate, requireRole('ADMIN')];
        const notAGuard = [requireRole('ADMIN')];
        router.get('/users', ...adminOnly, async (req, res) => {});
        router.get('/other', ...notAGuard, async (req, res) => {});
      `)
    ).toEqual(['guarded GET /users', 'open GET /other']);
  });

  it('does not count authenticate mentioned inside the handler', () => {
    expect(
      read(`router.get('/x', async (req, res) => { const note = authenticate; });`)
    ).toEqual(['open GET /x']);
  });

  it('reads app routes too, for the probes and beacons registered in index.ts', () => {
    expect(read(`app.get('/health', (req, res) => {}); app.post('/api/client-errors', limiter, (req, res) => {});`, 'app'))
      .toEqual(['open GET /health', 'open POST /api/client-errors']);
  });

  it('joins a mount to a route the way Express does', () => {
    expect(script.join('/api/users', '/')).toBe('/api/users');
    expect(script.join('/api/users', '/me/profile')).toBe('/api/users/me/profile');
    expect(script.join('', '/health')).toBe('/health');
  });
});
