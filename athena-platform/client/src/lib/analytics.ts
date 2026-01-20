/**
 * PostHog Analytics Integration
 * Step 97: Analytics Integration - User Journey KPIs
 */
import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let initialized = false;

type AnalyticsEvent = {
  name: string;
  properties?: Record<string, any>;
};

/**
 * Initialize PostHog analytics
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
    autocapture: true,
    persistence: 'localStorage+cookie',
    // Respect user privacy preferences
    opt_out_capturing_by_default: false,
    // Session recording settings
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-mask]',
    },
  });

  initialized = true;
}

/**
 * Identify a user
 */
export function identifyUser(
  userId: string,
  properties?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    persona?: string;
    subscriptionTier?: string;
    country?: string;
    createdAt?: string;
  }
): void {
  if (!initialized) return;

  posthog.identify(userId, {
    ...properties,
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
