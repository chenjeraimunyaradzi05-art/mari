import Constants from 'expo-constants';

const ANALYTICS_ENABLED = !!Constants.expoConfig?.extra?.analyticsKey;

export function track(event: string, properties?: Record<string, any>) {
  if (!ANALYTICS_ENABLED) {
    return;
  }
  // Placeholder analytics hook - integrate with PostHog/Mixpanel SDK
  console.log('[Analytics]', event, properties || {});
}
