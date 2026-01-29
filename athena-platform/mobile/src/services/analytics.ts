/**
 * Analytics Service - Mobile
 * Phase 5: Mobile Parity & Production - Step 97
 * 
 * Tracks user journey KPIs defined in the Blueprint:
 * - User engagement metrics
 * - Feature adoption
 * - Conversion funnels
 * - Performance metrics
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Analytics configuration
const ANALYTICS_CONFIG = {
  posthogKey: Constants.expoConfig?.extra?.posthogKey,
  mixpanelToken: Constants.expoConfig?.extra?.mixpanelToken,
  enabled: __DEV__ ? false : true,
  debug: __DEV__,
};

// User properties for segmentation
interface UserProperties {
  userId?: string;
  persona?: string;
  subscriptionTier?: string;
  onboardingComplete?: boolean;
  safetyScore?: number;
}

// Event categories from Blueprint KPIs
export enum EventCategory {
  ONBOARDING = 'onboarding',
  ENGAGEMENT = 'engagement',
  MONETIZATION = 'monetization',
  SOCIAL = 'social',
  CAREER = 'career',
  CONTENT = 'content',
  NAVIGATION = 'navigation',
  ERROR = 'error',
}

// Predefined events for consistent tracking
export const AnalyticsEvents = {
  // Onboarding funnel
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',

  // User engagement
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  DAILY_ACTIVE: 'daily_active',
  FEATURE_USED: 'feature_used',
  SCREEN_VIEW: 'screen_view',

  // Content engagement
  VIDEO_VIEWED: 'video_viewed',
  VIDEO_COMPLETED: 'video_completed',
  VIDEO_SHARED: 'video_shared',
  POST_CREATED: 'post_created',
  POST_LIKED: 'post_liked',
  POST_COMMENTED: 'post_commented',

  // Career actions
  JOB_VIEWED: 'job_viewed',
  JOB_SAVED: 'job_saved',
  JOB_APPLIED: 'job_applied',
  APPLICATION_SUBMITTED: 'application_submitted',

  // Mentorship
  MENTOR_VIEWED: 'mentor_viewed',
  MENTOR_SESSION_BOOKED: 'mentor_session_booked',
  MENTOR_SESSION_COMPLETED: 'mentor_session_completed',
  MENTOR_RATED: 'mentor_rated',

  // Monetization
  SUBSCRIPTION_VIEWED: 'subscription_viewed',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  PAYMENT_COMPLETED: 'payment_completed',

  // Social
  PROFILE_VIEWED: 'profile_viewed',
  CONNECTION_SENT: 'connection_sent',
  CONNECTION_ACCEPTED: 'connection_accepted',
  MESSAGE_SENT: 'message_sent',
  GROUP_JOINED: 'group_joined',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  CRASH_DETECTED: 'crash_detected',
} as const;

// Singleton state
let userProperties: UserProperties = {};
let sessionId: string | null = null;
let sessionStartTime: number | null = null;

// Generate unique session ID
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get device context
async function getDeviceContext() {
  return {
    deviceType: Device.deviceType,
    deviceName: Device.deviceName,
    osName: Device.osName,
    osVersion: Device.osVersion,
    appVersion: Application.nativeApplicationVersion,
    buildVersion: Application.nativeBuildVersion,
    platform: Device.osName?.toLowerCase(),
  };
}

// Initialize analytics
export async function initAnalytics() {
  if (!ANALYTICS_CONFIG.enabled) {
    if (ANALYTICS_CONFIG.debug) {
      console.log('[Analytics] Disabled in development');
    }
    return;
  }

  // Initialize PostHog
  if (ANALYTICS_CONFIG.posthogKey) {
    // In production, initialize PostHog SDK here
    // import posthog from 'posthog-react-native';
    // posthog.init(ANALYTICS_CONFIG.posthogKey);
  }

  // Start session
  sessionId = generateSessionId();
  sessionStartTime = Date.now();

  // Track session start with device context
  const deviceContext = await getDeviceContext();
  track(AnalyticsEvents.SESSION_START, {
    sessionId,
    ...deviceContext,
  });

  // Track daily active
  const today = new Date().toISOString().split('T')[0];
  const lastActive = await AsyncStorage.getItem('analytics_last_active');
  if (lastActive !== today) {
    track(AnalyticsEvents.DAILY_ACTIVE, { date: today });
    await AsyncStorage.setItem('analytics_last_active', today);
  }
}

// Identify user
export function identify(userId: string, properties?: Partial<UserProperties>) {
  userProperties = {
    ...userProperties,
    userId,
    ...properties,
  };

  if (ANALYTICS_CONFIG.debug) {
    console.log('[Analytics] Identify:', userId, properties);
  }

  // In production, call SDK identify methods
  // posthog.identify(userId, properties);
  // mixpanel.identify(userId);
  // mixpanel.people.set(properties);
}

// Reset user (on logout)
export function resetUser() {
  userProperties = {};
  
  if (ANALYTICS_CONFIG.debug) {
    console.log('[Analytics] User reset');
  }

  // posthog.reset();
  // mixpanel.reset();
}

// Track event
export function track(
  event: string,
  properties?: Record<string, any>,
  category?: EventCategory
) {
  if (!ANALYTICS_CONFIG.enabled && !ANALYTICS_CONFIG.debug) {
    return;
  }

  const enrichedProperties = {
    ...properties,
    ...userProperties,
    sessionId,
    timestamp: new Date().toISOString(),
    category: category || inferCategory(event),
  };

  if (ANALYTICS_CONFIG.debug) {
    console.log('[Analytics] Track:', event, enrichedProperties);
  }

  // In production, send to analytics providers
  // posthog.capture(event, enrichedProperties);
  // mixpanel.track(event, enrichedProperties);
}

// Track screen view
export function trackScreen(screenName: string, properties?: Record<string, any>) {
  track(AnalyticsEvents.SCREEN_VIEW, {
    screen: screenName,
    ...properties,
  }, EventCategory.NAVIGATION);
}

// Track feature usage
export function trackFeature(featureName: string, properties?: Record<string, any>) {
  track(AnalyticsEvents.FEATURE_USED, {
    feature: featureName,
    ...properties,
  }, EventCategory.ENGAGEMENT);
}

// Track conversion funnel step
export function trackFunnel(
  funnelName: string,
  stepName: string,
  stepNumber: number,
  properties?: Record<string, any>
) {
  track(`${funnelName}_${stepName}`, {
    funnel: funnelName,
    step: stepName,
    stepNumber,
    ...properties,
  });
}

// Track timing (performance)
export function trackTiming(
  name: string,
  durationMs: number,
  properties?: Record<string, any>
) {
  track('timing', {
    name,
    duration_ms: durationMs,
    ...properties,
  });
}

// Track error
export function trackError(
  error: Error,
  context?: Record<string, any>
) {
  track(AnalyticsEvents.ERROR_OCCURRED, {
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack?.substring(0, 500),
    ...context,
  }, EventCategory.ERROR);
}

// End session (on app background/close)
export function endSession() {
  if (!sessionId || !sessionStartTime) return;

  const sessionDuration = Date.now() - sessionStartTime;
  track(AnalyticsEvents.SESSION_END, {
    sessionId,
    duration_ms: sessionDuration,
    duration_minutes: Math.round(sessionDuration / 60000),
  });

  sessionId = null;
  sessionStartTime = null;
}

// Infer event category
function inferCategory(event: string): EventCategory {
  if (event.includes('onboarding')) return EventCategory.ONBOARDING;
  if (event.includes('video') || event.includes('post')) return EventCategory.CONTENT;
  if (event.includes('job') || event.includes('application') || event.includes('mentor')) return EventCategory.CAREER;
  if (event.includes('subscription') || event.includes('payment')) return EventCategory.MONETIZATION;
  if (event.includes('connection') || event.includes('message') || event.includes('group')) return EventCategory.SOCIAL;
  if (event.includes('screen') || event.includes('navigation')) return EventCategory.NAVIGATION;
  if (event.includes('error') || event.includes('crash')) return EventCategory.ERROR;
  return EventCategory.ENGAGEMENT;
}

// Blueprint KPI helpers
export const KPITracking = {
  // D1/D7/D30 retention is calculated server-side from daily_active events
  
  trackJobConversion: (jobId: string, stage: 'view' | 'save' | 'apply' | 'submit') => {
    const events = {
      view: AnalyticsEvents.JOB_VIEWED,
      save: AnalyticsEvents.JOB_SAVED,
      apply: AnalyticsEvents.JOB_APPLIED,
      submit: AnalyticsEvents.APPLICATION_SUBMITTED,
    };
    track(events[stage], { jobId }, EventCategory.CAREER);
  },

  trackMentorConversion: (mentorId: string, stage: 'view' | 'book' | 'complete' | 'rate') => {
    const events = {
      view: AnalyticsEvents.MENTOR_VIEWED,
      book: AnalyticsEvents.MENTOR_SESSION_BOOKED,
      complete: AnalyticsEvents.MENTOR_SESSION_COMPLETED,
      rate: AnalyticsEvents.MENTOR_RATED,
    };
    track(events[stage], { mentorId }, EventCategory.CAREER);
  },

  trackContentEngagement: (contentId: string, type: 'video' | 'post', action: 'view' | 'like' | 'comment' | 'share') => {
    const eventMap = {
      video: {
        view: AnalyticsEvents.VIDEO_VIEWED,
        like: AnalyticsEvents.POST_LIKED,
        comment: AnalyticsEvents.POST_COMMENTED,
        share: AnalyticsEvents.VIDEO_SHARED,
      },
      post: {
        view: AnalyticsEvents.SCREEN_VIEW,
        like: AnalyticsEvents.POST_LIKED,
        comment: AnalyticsEvents.POST_COMMENTED,
        share: AnalyticsEvents.VIDEO_SHARED,
      },
    };
    track(eventMap[type][action], { contentId, contentType: type }, EventCategory.CONTENT);
  },

  trackSubscriptionFunnel: (stage: 'view' | 'start' | 'complete' | 'cancel', tier?: string) => {
    const events = {
      view: AnalyticsEvents.SUBSCRIPTION_VIEWED,
      start: AnalyticsEvents.SUBSCRIPTION_STARTED,
      complete: AnalyticsEvents.PAYMENT_COMPLETED,
      cancel: AnalyticsEvents.SUBSCRIPTION_CANCELLED,
    };
    track(events[stage], { tier }, EventCategory.MONETIZATION);
  },
};

export default {
  init: initAnalytics,
  identify,
  reset: resetUser,
  track,
  trackScreen,
  trackFeature,
  trackFunnel,
  trackTiming,
  trackError,
  endSession,
  events: AnalyticsEvents,
  categories: EventCategory,
  kpi: KPITracking,
};
