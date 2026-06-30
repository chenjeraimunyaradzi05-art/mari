import { validateLaunchReadinessDocs } from '../scripts/validate-launch-readiness';

describe('validateLaunchReadinessDocs', () => {
  it('verifies the launch readiness route and worker env configuration are present', () => {
    const result = validateLaunchReadinessDocs();

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'launch-readiness-route' }),
        expect.objectContaining({ name: 'worker-env-config' }),
      ])
    );
  });
});
