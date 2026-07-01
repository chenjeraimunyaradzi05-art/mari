import { validateAuthSessionRoutes } from '../scripts/validate-auth-session-routes';

describe('validateAuthSessionRoutes', () => {
  it('verifies change-password and session-revocation routes are present', () => {
    const result = validateAuthSessionRoutes();

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'change-password-route' }),
        expect.objectContaining({ name: 'session-revoke-route' }),
      ])
    );
  });
});
