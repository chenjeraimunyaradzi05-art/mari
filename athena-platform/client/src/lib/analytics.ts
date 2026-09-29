/**
 * PostHog Analytics Integration
 * Step 97: Analytics Integration - User Journey KPIs
 */
import posthog from 'posthog-js';
import { readCachedCookieChoices } from './cookie-consent';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let initialized = false;

/**
 * The visitor's analytics choice from the cookie banner. False until she says
 * yes, and remembered across initAnalytics so a choice made before PostHog
 * loads is applied the moment it does.
 */
let analyticsConsented = false;

type AnalyticsEvent = {
  name: string;
  properties?: Record<string, any>;
};

/**
 * Initialize PostHog analytics.
 *
 * Nothing calls this today, and the cookie policy says no measurement tool is
 * loaded; whoever wires it up must name PostHog in that policy first. It is
 * written so that wiring it cannot capture anyone who has not agreed. It used
 * to initialise with capturing on by default, autocapture on and session
 * recording configured, so the first person to call it would have recorded
 * sessions whatever a visitor chose in the banner.
 *
 * Capturing and persistence are now off until the analytics choice is yes,
 * and session recording and autocapture stay off even then. Autocapture
 * records the text of whatever is clicked and a session recording replays the
 * screen; on a platform where members write about abuse and plan how to leave,
 * neither is something an analytics switch should turn on. What is measured
 * after consent is the named events below, and nothing else.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined' || initialized || !POSTHOG_KEY) {
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    loaded: (ph) => {
      // In development, enable debug mode
      if (process.env.NODE_ENV === 'development') {
        ph.debug();
      }
    },
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage+cookie',
    // Nothing is sent, and nothing is stored in her browser, until she agrees.
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    disable_session_recording: true,
  });

  initialized = true;
  // The banner may have been answered before this module was ever loaded, in
  // which case the choice is in the browser's consent cache rather than here.
  applyAnalyticsConsent(analyticsConsented || readCachedCookieChoices()?.analytics === true);
}

/**
 * Carry the banner's analytics choice to PostHog.
 *
 * Called by the cookie banner every time a choice is made or read back, so the
 * switch the visitor sees is the switch that decides. Before PostHog is loaded
 * the choice is remembered and applied by initAnalytics.
 */
export function applyAnalyticsConsent(granted: boolean): void {
  analyticsConsented = granted;
  if (!initialized) return;
  if (granted) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

/**
 * Identify a user, by account id and nothing that names her.
 *
 * This took her email address and her first and last names and sent them to
 * the analytics provider as person properties. Agreeing to analytics is
 * agreeing to be counted, not to have her identity copied to a measurement
 * service overseas — and for a member hiding from somebody, an email address
 * sitting in a third party's dashboard is one more place it can leak from.
 * The account id is enough to tie her events together; the rest is the kind of
 * thing a funnel is cut by, never who she is.
 */
export function identifyUser(
  userId: string,
  properties?: {
    persona?: string;
    subscriptionTier?: string;
    country?: string;
    createdAt?: string;
  }
): void {
  if (!initialized) return;

  const { persona, subscriptionTier, country, createdAt } = properties ?? {};
  posthog.identify(userId, {
    persona,
    subscriptionTier,
    country,
    createdAt,
    $set_once: {
      first_seen: new Date().toISOString(),
    },
  });
}

/**
 * Reset user identity (on logout)
 */
export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

/**
 * Track a custom event (legacy compatible)
 */
export function trackEvent({ name, properties }: AnalyticsEvent): void {
  if (!initialized) {
    // Fallback for when PostHog is not initialized
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', name, properties || {});
    }
    return;
  }
  posthog.capture(name, properties);
}

/**
 * Track page view
 */
export function trackPageView(url?: string, properties?: Record<string, any>): void {
  if (!initialized) return;
  posthog.capture('$pageview', {
    $current_url: url || window.location.href,
    ...properties,
  });
}

// ==========================================
// ATHENA-SPECIFIC TRACKING EVENTS
// ==========================================

/**
 * Track user registration
 */
export function trackRegistration(method: 'email' | 'google' | 'apple', persona: string): void {
  trackEvent({ name: 'user_registered', properties: { method, persona } });
}

/**
 * Track onboarding completion
 */
export function trackOnboardingComplete(stepsCompleted: number, totalSteps: number): void {
  trackEvent({
    name: 'onboarding_completed',
    properties: {
      steps_completed: stepsCompleted,
      total_steps: totalSteps,
      completion_rate: stepsCompleted / totalSteps,
    },
  });
}

/**
 * Track job search
 */
export function trackJobSearch(query: string, filters: Record<string, any>, resultsCount: number): void {
  trackEvent({
    name: 'job_searched',
    properties: { query, filters, results_count: resultsCount },
  });
}

/**
 * Track job view
 */
export function trackJobView(jobId: string, jobTitle: string, company: string): void {
  trackEvent({
    name: 'job_viewed',
    properties: { job_id: jobId, job_title: jobTitle, company },
  });
}

/**
 * Track job application
 */
export function trackJobApplication(jobId: string, jobTitle: string, company: string): void {
  trackEvent({
    name: 'job_applied',
    properties: { job_id: jobId, job_title: jobTitle, company },
  });
}

/**
 * Track mentor search
 */
export function trackMentorSearch(filters: Record<string, any>, resultsCount: number): void {
  trackEvent({
    name: 'mentor_searched',
    properties: { filters, results_count: resultsCount },
  });
}

/**
 * Track mentor profile view
 */
export function trackMentorView(mentorId: string, mentorName: string, specialization: string): void {
  trackEvent({
    name: 'mentor_viewed',
    properties: { mentor_id: mentorId, mentor_name: mentorName, specialization },
  });
}

/**
 * Track mentor booking
 */
export function trackMentorBooking(
  mentorId: string,
  sessionType: string,
  price: number,
  currency: string
): void {
  trackEvent({
    name: 'mentor_booked',
    properties: { mentor_id: mentorId, session_type: sessionType, price, currency },
  });
}

/**
 * Track video watched
 */
export function trackVideoWatch(
  videoId: string,
  videoTitle: string,
  watchDuration: number,
  totalDuration: number
): void {
  trackEvent({
    name: 'video_watched',
    properties: {
      video_id: videoId,
      video_title: videoTitle,
      watch_duration: watchDuration,
      total_duration: totalDuration,
      completion_rate: watchDuration / totalDuration,
    },
  });
}

/**
 * Track content engagement
 */
export function trackContentEngagement(
  contentId: string,
  contentType: 'video' | 'post' | 'article',
  action: 'like' | 'comment' | 'share' | 'save'
): void {
  trackEvent({
    name: 'content_engaged',
    properties: { content_id: contentId, content_type: contentType, action },
  });
}

/**
 * Track message sent
 */
export function trackMessageSent(conversationType: 'direct' | 'group', hasMedia: boolean): void {
  trackEvent({
    name: 'message_sent',
    properties: { conversation_type: conversationType, has_media: hasMedia },
  });
}

/**
 * Track course enrollment
 */
export function trackCourseEnrollment(courseId: string, courseName: string, price: number): void {
  trackEvent({
    name: 'course_enrolled',
    properties: { course_id: courseId, course_name: courseName, price },
  });
}

/**
 * Track course completion
 */
export function trackCourseCompletion(courseId: string, courseName: string, completionTime: number): void {
  trackEvent({
    name: 'course_completed',
    properties: { course_id: courseId, course_name: courseName, completion_time_hours: completionTime },
  });
}

/**
 * Track subscription event
 */
export function trackSubscription(
  action: 'started' | 'upgraded' | 'downgraded' | 'cancelled',
  tier: string,
  price: number,
  currency: string
): void {
  trackEvent({
    name: 'subscription_changed',
    properties: { action, tier, price, currency },
  });
}

/**
 * Track error
 */
export function trackError(errorType: string, errorMessage: string, context?: Record<string, any>): void {
  trackEvent({
    name: 'error_occurred',
    properties: { error_type: errorType, error_message: errorMessage, ...context },
  });
}

// ==========================================
// FEATURE FLAGS
// ==========================================

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagName: string): boolean {
  if (!initialized) return false;
  return posthog.isFeatureEnabled(flagName) ?? false;
}

/**
 * Get feature flag value
 */
export function getFeatureFlag(flagName: string): string | boolean | undefined {
  if (!initialized) return undefined;
  return posthog.getFeatureFlag(flagName);
}

// ==========================================
// GDPR COMPLIANCE
// ==========================================

/**
 * Opt user out of tracking
 */
export function optOut(): void {
  if (!initialized) return;
  posthog.opt_out_capturing();
}

/**
 * Opt user back into tracking
 */
export function optIn(): void {
  if (!initialized) return;
  posthog.opt_in_capturing();
}

/**
 * Check if user has opted out
 */
export function hasOptedOut(): boolean {
  if (!initialized) return true;
  return posthog.has_opted_out_capturing();
}

/**
 * Clear all stored data
 */
export function clearData(): void {
  if (!initialized) return;
  posthog.reset();
}

// Export PostHog instance for advanced use
export { posthog };
