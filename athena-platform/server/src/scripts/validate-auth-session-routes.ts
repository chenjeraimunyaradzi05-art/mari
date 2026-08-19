import fs from 'fs';
import path from 'path';

export interface AuthSessionRouteCheck {
  name: string;
  ok: boolean;
  details?: string;
}

export interface AuthSessionRouteValidationResult {
  ok: boolean;
  checks: AuthSessionRouteCheck[];
}

export function validateAuthSessionRoutes(): AuthSessionRouteValidationResult {
  const root = path.resolve(__dirname, '..', '..');
  const routeFile = path.join(root, 'src', 'routes', 'auth.routes.ts');
  const content = fs.existsSync(routeFile) ? fs.readFileSync(routeFile, 'utf8') : '';

  const checks: AuthSessionRouteCheck[] = [
    {
      name: 'change-password-route',
      ok:
        /router\.post\(\s*['"]\/change-password/.test(content) &&
        content.includes('Current password is incorrect') &&
        content.includes('revokedAt: new Date()'),
      details: 'Change-password route should verify current password and revoke other sessions',
    },
    {
      name: 'session-revoke-route',
      ok:
        /router\.delete\(\s*['"]\/sessions\/:sessionId/.test(content) &&
        content.includes('Session revoked') &&
        content.includes('sessionService.revokeSession(session.id)'),
      details: 'Session revocation route should revoke a specific active session',
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

if (require.main === module) {
  const result = validateAuthSessionRoutes();

  for (const check of result.checks) {
    const status = check.ok ? 'PASS' : 'FAIL';
    console.log(`${status} ${check.name}: ${check.details || ''}`.trim());
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}
