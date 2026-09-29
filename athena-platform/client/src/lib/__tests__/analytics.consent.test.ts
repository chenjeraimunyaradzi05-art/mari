/**
 * The cookie banner's Analytics switch is the switch.
 *
 * The banner recorded a choice that controlled nothing, and the analytics
 * module was written so that the first person to call initAnalytics would
 * capture sessions, autocapture every click's text and record the screen
 * whatever a visitor had chosen. These tests hold it to capturing nothing
 * until she says yes, to carrying a yes or a no made before PostHog loads,
 * and to never sending who she is.
 */

type PosthogMock = {
  init: jest.Mock;
  opt_in_capturing: jest.Mock;
  opt_out_capturing: jest.Mock;
  identify: jest.Mock;
};

type AnalyticsModule = typeof import('../analytics');

let posthog: PosthogMock;
let cachedChoices: { analytics: boolean } | null = null;

function load(): AnalyticsModule {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
  let loaded: AnalyticsModule | undefined;
  jest.isolateModules(() => {
    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn(),
        opt_in_capturing: jest.fn(),
        opt_out_capturing: jest.fn(),
        identify: jest.fn(),
        capture: jest.fn(),
        reset: jest.fn(),
      },
    }));
    jest.doMock('../cookie-consent', () => ({ readCachedCookieChoices: () => cachedChoices }));
    // The module reads its key when it loads, so each case needs a fresh copy,
    // and only a synchronous require can load one inside isolateModules.
    /* eslint-disable @typescript-eslint/no-require-imports */
    loaded = require('../analytics') as AnalyticsModule;
    posthog = (require('posthog-js') as { default: PosthogMock }).default;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return loaded!;
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  cachedChoices = null;
});

describe('Analytics and the cookie choice', () => {
  it('starts with nothing captured, nothing stored, no autocapture and no session recording', () => {
    const analytics = load();
    analytics.initAnalytics();

    const options = posthog.init.mock.calls[0][1];
    expect(options).toMatchObject({
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      autocapture: false,
      disable_session_recording: true,
    });
    // No choice made yet: explicitly out.
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
  });

  it('applies a yes given before PostHog loaded', () => {
    const analytics = load();
    analytics.applyAnalyticsConsent(true);
    analytics.initAnalytics();

    expect(posthog.opt_in_capturing).toHaveBeenCalled();
  });

  it('reads a yes from the consent cache when the banner was answered on an earlier visit', () => {
    cachedChoices = { analytics: true };
    const analytics = load();
    analytics.initAnalytics();

    expect(posthog.opt_in_capturing).toHaveBeenCalled();
  });

  it('turns capturing off the moment she changes her mind', () => {
    const analytics = load();
    analytics.applyAnalyticsConsent(true);
    analytics.initAnalytics();
    posthog.opt_out_capturing.mockClear();

    analytics.applyAnalyticsConsent(false);

    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
  });

  it('identifies her by account id and never by name or email', () => {
    const analytics = load();
    analytics.initAnalytics();
    const identifyWith = analytics.identifyUser as unknown as (id: string, properties: Record<string, unknown>) => void;

    identifyWith('user-1', { email: 'her@example.org', firstName: 'Ana', lastName: 'Smith', persona: 'founder' });

    const [id, properties] = posthog.identify.mock.calls[0];
    expect(id).toBe('user-1');
    expect(properties).toMatchObject({ persona: 'founder' });
    expect(JSON.stringify(properties)).not.toMatch(/her@example\.org|Ana|Smith/);
  });
});
