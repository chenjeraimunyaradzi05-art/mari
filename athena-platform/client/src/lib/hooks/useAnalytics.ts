'use client';

/**
 * Analytics Hooks
 * Phase 4: Web Client - Persona Studios
 * Unified analytics tracking for user interactions
 * 
 * Integrates with:
 * - PostHog for product analytics
 * - Mixpanel for event tracking
 * - Custom analytics endpoints
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// ============================================
// TYPES
// ============================================

export type AnalyticsEvent = 
  // Formation Studio Events
  | 'formation_started'
  | 'formation_step_completed'
  | 'formation_completed'
  | 'cofounder_match_viewed'
  | 'cofounder_connected'
  | 'compliance_item_completed'
  | 'document_uploaded'
  // Mentor Events
  | 'session_scheduled'
  | 'session_completed'
  | 'session_cancelled'
  | 'availability_updated'
  | 'payout_requested'
  // Jobs Events
  | 'job_created'
  | 'job_published'
  | 'job_closed'
  | 'candidate_moved'
  | 'candidate_rated'
  | 'interview_scheduled'
  | 'interview_feedback_submitted'
  // Education Events
  | 'course_created'
  | 'course_published'
  | 'lesson_completed'
  | 'assessment_started'
  | 'assessment_completed'
  | 'badge_earned'
  // Community Events
  | 'community_joined'
  | 'post_created'
  | 'event_rsvp'
  // General Events
  | 'page_view'
  | 'feature_used'
  | 'error_occurred'
  | 'search_performed';

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined | string[];
}

export interface AnalyticsUser {
  id: string;
  email?: string;
  name?: string;
  persona?: string;
  plan?: string;
  createdAt?: Date;
}

// ============================================
// TYPE DECLARATIONS FOR ANALYTICS LIBRARIES
// ============================================

interface PostHogClient {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
}

interface MixpanelClient {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string) => void;
  people: {
    set: (properties: Record<string, unknown>) => void;
  };
  reset: () => void;
}

interface WindowWithAnalytics extends Window {
  posthog?: PostHogClient;
  mixpanel?: MixpanelClient;
}

// ============================================
// ANALYTICS CONTEXT
// ============================================

interface AnalyticsConfig {
  posthogKey?: string;
  mixpanelToken?: string;
  debug?: boolean;
  disabled?: boolean;
}

let analyticsConfig: AnalyticsConfig = {
  debug: process.env.NODE_ENV === 'development',
  disabled: false,
};

export function configureAnalytics(config: AnalyticsConfig) {
  analyticsConfig = { ...analyticsConfig, ...config };
}

// ============================================
// CORE TRACKING FUNCTIONS
// ============================================

/**
 * Track an analytics event
 */
export function trackEvent(event: AnalyticsEvent, properties?: AnalyticsProperties) {
  if (analyticsConfig.disabled) return;

  const enrichedProperties = {
    ...properties,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
  };

  if (analyticsConfig.debug) {
    console.log('[Analytics] Event:', event, enrichedProperties);
  }

  // PostHog
  const analyticsWindow = typeof window !== 'undefined' ? (window as WindowWithAnalytics) : null;
  if (analyticsWindow?.posthog) {
    analyticsWindow.posthog.capture(event, enrichedProperties);
  }

  // Mixpanel
  if (analyticsWindow?.mixpanel) {
    analyticsWindow.mixpanel.track(event, enrichedProperties);
  }

  // Custom backend analytics
  if (typeof window !== 'undefined') {
    fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ event, properties: enrichedProperties }),
    }).catch(() => {
      // Silently fail for analytics
    });
  }
}

/**
 * Identify a user for analytics
 */
export function identifyUser(user: AnalyticsUser) {
  if (analyticsConfig.disabled) return;

  if (analyticsConfig.debug) {
    console.log('[Analytics] Identify:', user);
  }

  const analyticsWindow = typeof window !== 'undefined' ? (window as WindowWithAnalytics) : null;

  // PostHog
  if (analyticsWindow?.posthog) {
    analyticsWindow.posthog.identify(user.id, {
      email: user.email,
      name: user.name,
      persona: user.persona,
      plan: user.plan,
      created_at: user.createdAt?.toISOString(),
    });
  }

  // Mixpanel
  if (analyticsWindow?.mixpanel) {
    analyticsWindow.mixpanel.identify(user.id);
    analyticsWindow.mixpanel.people.set({
      $email: user.email,
      $name: user.name,
      persona: user.persona,
      plan: user.plan,
    });
  }
}

/**
 * Reset analytics (on logout)
 */
export function resetAnalytics() {
  if (analyticsConfig.disabled) return;

  if (analyticsConfig.debug) {
    console.log('[Analytics] Reset');
  }

  const analyticsWindow = typeof window !== 'undefined' ? (window as WindowWithAnalytics) : null;

  // PostHog
  if (analyticsWindow?.posthog) {
    analyticsWindow.posthog.reset();
  }

  // Mixpanel
  if (analyticsWindow?.mixpanel) {
    analyticsWindow.mixpanel.reset();
  }
}

// ============================================
// REACT HOOKS
// ============================================

/**
 * Track page views automatically
 */
export function usePageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    trackEvent('page_view', {
      path: pathname,
      url,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    });
  }, [pathname, searchParams]);
}

/**
 * Track a specific event with callback
 */
export function useTrackEvent() {
  return useCallback((event: AnalyticsEvent, properties?: AnalyticsProperties) => {
    trackEvent(event, properties);
  }, []);
}

/**
 * Track time spent on a component/page
 */
export function useTimeTracking(featureName: string) {
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();

    return () => {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      trackEvent('feature_used', {
        feature: featureName,
        duration_seconds: duration,
      });
    };
  }, [featureName]);
}

/**
 * Track component visibility (for engagement metrics)
 */
export function useVisibilityTracking(
  featureName: string,
  elementRef: React.RefObject<HTMLElement>
) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let visibleStartTime: number | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visibleStartTime = Date.now();
        } else if (visibleStartTime) {
          const visibleDuration = Math.round((Date.now() - visibleStartTime) / 1000);
          trackEvent('feature_used', {
            feature: `${featureName}_visible`,
            visible_duration_seconds: visibleDuration,
          });
          visibleStartTime = null;
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (visibleStartTime) {
        const visibleDuration = Math.round((Date.now() - visibleStartTime) / 1000);
        trackEvent('feature_used', {
          feature: `${featureName}_visible`,
          visible_duration_seconds: visibleDuration,
        });
      }
    };
  }, [featureName, elementRef]);
}

// ============================================
// FORMATION STUDIO ANALYTICS
// ============================================

export function useFormationAnalytics() {
  const track = useTrackEvent();

  return {
    trackFormationStarted: (businessType: string, state: string) => {
      track('formation_started', { business_type: businessType, state });
    },
    trackStepCompleted: (step: string, businessId: string) => {
      track('formation_step_completed', { step, business_id: businessId });
    },
    trackFormationCompleted: (businessId: string, businessType: string) => {
      track('formation_completed', { business_id: businessId, business_type: businessType });
    },
    trackCofounderViewed: (matchId: string, matchScore: number) => {
      track('cofounder_match_viewed', { match_id: matchId, match_score: matchScore });
    },
    trackCofounderConnected: (matchId: string, role: string) => {
      track('cofounder_connected', { match_id: matchId, role });
    },
    trackComplianceCompleted: (itemId: string, category: string) => {
      track('compliance_item_completed', { item_id: itemId, category });
    },
    trackDocumentUploaded: (documentType: string, businessId: string) => {
      track('document_uploaded', { document_type: documentType, business_id: businessId });
    },
  };
}

// ============================================
// MENTOR ANALYTICS
// ============================================

export function useMentorAnalytics() {
  const track = useTrackEvent();

  return {
    trackSessionScheduled: (sessionType: string, duration: number, price: number) => {
      track('session_scheduled', { session_type: sessionType, duration_minutes: duration, price });
    },
    trackSessionCompleted: (sessionId: string, duration: number, rating?: number) => {
      track('session_completed', { session_id: sessionId, duration_minutes: duration, rating });
    },
    trackSessionCancelled: (sessionId: string, reason?: string, cancelledBy: 'mentor' | 'mentee' = 'mentor') => {
      track('session_cancelled', { session_id: sessionId, reason, cancelled_by: cancelledBy });
    },
    trackAvailabilityUpdated: (slotsCount: number, timezone: string) => {
      track('availability_updated', { slots_count: slotsCount, timezone });
    },
    trackPayoutRequested: (amount: number, method: string) => {
      track('payout_requested', { amount, payout_method: method });
    },
  };
}

// ============================================
// JOBS ANALYTICS
// ============================================

export function useJobsAnalytics() {
  const track = useTrackEvent();

  return {
    trackJobCreated: (jobType: string, department: string) => {
      track('job_created', { job_type: jobType, department });
    },
    trackJobPublished: (jobId: string, title: string) => {
      track('job_published', { job_id: jobId, title });
    },
    trackJobClosed: (jobId: string, reason: string, totalApplicants: number, hiredCount: number) => {
      track('job_closed', { 
        job_id: jobId, 
        reason, 
        total_applicants: totalApplicants,
        hired_count: hiredCount
      });
    },
    trackCandidateMoved: (candidateId: string, fromStage: string, toStage: string) => {
      track('candidate_moved', { 
        candidate_id: candidateId, 
        from_stage: fromStage, 
        to_stage: toStage 
      });
    },
    trackCandidateRated: (candidateId: string, rating: number) => {
      track('candidate_rated', { candidate_id: candidateId, rating });
    },
    trackInterviewScheduled: (candidateId: string, interviewType: string) => {
      track('interview_scheduled', { candidate_id: candidateId, interview_type: interviewType });
    },
    trackInterviewFeedbackSubmitted: (candidateId: string, recommendation: string) => {
      track('interview_feedback_submitted', { candidate_id: candidateId, recommendation });
    },
  };
}

// ============================================
// EDUCATION ANALYTICS
// ============================================

export function useEducationAnalytics() {
  const track = useTrackEvent();

  return {
    trackCourseCreated: (courseId: string, category: string, level: string) => {
      track('course_created', { course_id: courseId, category, level });
    },
    trackCoursePublished: (courseId: string, price: number, lessonsCount: number) => {
      track('course_published', { course_id: courseId, price, lessons_count: lessonsCount });
    },
    trackLessonCompleted: (lessonId: string, courseId: string, lessonType: string) => {
      track('lesson_completed', { lesson_id: lessonId, course_id: courseId, lesson_type: lessonType });
    },
    trackAssessmentStarted: (assessmentId: string, type: string) => {
      track('assessment_started', { assessment_id: assessmentId, type });
    },
    trackAssessmentCompleted: (assessmentId: string, score: number, passed: boolean) => {
      track('assessment_completed', { assessment_id: assessmentId, score, passed });
    },
    trackBadgeEarned: (badgeId: string, badgeCategory: string, level: string) => {
      track('badge_earned', { badge_id: badgeId, badge_category: badgeCategory, level });
    },
  };
}

// ============================================
// COMMUNITY ANALYTICS
// ============================================

export function useCommunityAnalytics() {
  const track = useTrackEvent();

  return {
    trackCommunityJoined: (communityId: string, communityType: string) => {
      track('community_joined', { community_id: communityId, community_type: communityType });
    },
    trackPostCreated: (communityId: string, hasMedia: boolean) => {
      track('post_created', { community_id: communityId, has_media: hasMedia });
    },
    trackEventRSVP: (eventId: string, eventType: string, rsvpStatus: string) => {
      track('event_rsvp', { event_id: eventId, event_type: eventType, rsvp_status: rsvpStatus });
    },
  };
}

// ============================================
// ERROR TRACKING
// ============================================

export function useErrorTracking() {
  const track = useTrackEvent();

  return useCallback((error: Error, context?: AnalyticsProperties) => {
    track('error_occurred', {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack?.slice(0, 500), // Limit stack trace length
      ...context,
    });
  }, [track]);
}

// ============================================
// SEARCH ANALYTICS
// ============================================

export function useSearchAnalytics() {
  const track = useTrackEvent();

  return {
    trackSearch: (query: string, resultCount: number, filters?: AnalyticsProperties) => {
      track('search_performed', { 
        query, 
        result_count: resultCount, 
        has_filters: !!filters,
        ...filters 
      });
    },
  };
}
