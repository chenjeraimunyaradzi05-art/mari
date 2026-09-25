/**
 * ML Service Bridge
 * =================
 * Connects Node.js backend to Python ML microservice.
 * Provides typed interfaces for all ML algorithms.
 */

import { logger } from '../utils/logger';

// ===========================================
// CONFIGURATION
// ===========================================

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_SERVICE_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT || '30000', 10);
const ML_SERVICE_RETRY_ATTEMPTS = 3;
const ML_SERVICE_RETRY_DELAY = 1000;

/**
 * The health probe gets its own, much shorter deadline.
 *
 * A prediction is worth waiting thirty seconds for; asking whether the service
 * is alive never is. The probe used to share ML_SERVICE_TIMEOUT, so an ML host
 * that accepted the connection and then hung — a stuck container, a load
 * balancer with no backend — cost a full thirty seconds on the feed load that
 * happened to trigger the check, and on every /health/detailed call. The
 * negative result is cached for thirty seconds now, which bounds how often that
 * happens, but the first member through the door still paid it. Two seconds is
 * long enough for a service on the same private network to answer a handler
 * that reads two dictionaries, and short enough that a member never notices.
 */
const ML_HEALTH_TIMEOUT = Math.min(
  parseInt(process.env.ML_SERVICE_HEALTH_TIMEOUT || '2000', 10) || 2000,
  ML_SERVICE_TIMEOUT
);

// ===========================================
// TYPES
// ===========================================

export interface CareerProfile {
  user_id: string;
  years_experience: number;
  current_salary: number;
  education_level: number;
  industry_growth?: number;
  skills_score: number;
  leadership_score?: number;
  certifications?: number;
  location_index?: number;
  company_size?: number;
  target_role?: string;
  target_industry?: string;
  timeline_months?: number;
}

export interface CareerPrediction {
  user_id: string;
  career_growth_score: number;
  /**
   * Null when the model reports none, which is the case for the plain
   * regressor the Python service loads. It used to be a required number and
   * the service always sent 0.85 — the same figure whatever it had predicted.
   */
  confidence: number | null;
  salary_projection: Record<string, number>;
  role_trajectory: string[];
  skill_gaps: Array<{
    skill: string;
    current: number;
    target: number;
    priority: string;
    resources: string[];
  }>;
  recommended_actions: Array<{
    action: string;
    impact: string;
    timeframe: string;
    details: string;
  }>;
  /**
   * Null whenever nothing measured it, which is every case today.
   *
   * Both were required numbers, and the Python service filled them with four
   * hard-coded thresholds over its own output and the literal 65.0. A woman was
   * being told where she stood against her peers and her industry by a
   * comparison that had never been made. The service now sends null; anything
   * reading these has to decide what to show when there is no benchmark, which
   * is the decision that was being skipped.
   */
  peer_percentile: number | null;
  industry_benchmark: number | null;
}

export interface MenteeProfile {
  user_id: string;
  industry: string;
  role: string;
  experience_years: number;
  skills: string[];
  goals: string[];
  preferred_style?: string;
  availability_hours_per_month?: number;
  timezone?: string;
  languages?: string[];
}

export interface MentorProfile {
  user_id: string;
  industry: string;
  role: string;
  experience_years: number;
  expertise_areas: string[];
  mentoring_style: string;
  availability_hours_per_month: number;
  timezone: string;
  languages: string[];
  rating?: number;
  total_mentees?: number;
  hourly_rate?: number;
}

export interface MatchScore {
  mentor_id: string;
  overall_score: number;
  skill_alignment: number;
  goal_compatibility: number;
  style_fit: number;
  availability_match: number;
  experience_relevance: number;
  match_reasons: string[];
  potential_challenges: string[];
  mentor_summary: Record<string, any>;
}

export interface SafetyProfile {
  user_id: string;
  account_age_days: number;
  is_verified: boolean;
  verification_level: number;
  report_count_received: number;
  report_count_made: number;
  block_count_received: number;
  message_response_rate: number;
  total_interactions: number;
  positive_interactions: number;
  content_flags: number;
  content_approved: number;
}

export interface SafetyScoreResult {
  user_id: string;
  safety_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  components: Record<string, number>;
  risk_factors: Array<{ factor: string; severity: string }>;
  mitigations: string[];
}

export interface RankingCandidate {
  id: string;
  content_type: 'job' | 'post' | 'video' | 'course' | 'mentor' | 'user';
  features: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UserContext {
  user_id: string;
  persona?: string;
  interests?: string[];
  skills?: string[];
  location?: string;
  interaction_history?: Array<Record<string, any>>;
}

export interface RankedItem {
  id: string;
  content_type: string;
  score: number;
  rank: number;
  score_breakdown: Record<string, number>;
  explanation: string;
}

/**
 * The vocabulary the Python service will accept for a feed item. It is a closed
 * pydantic enum over there (`FeedItemType` in ml/src/api/routers/feed.py), so a
 * value outside this union is not "unknown to the model", it is a 422 that
 * fails the whole batch. Typing it here rather than as `string` is what stops
 * another of this platform's vocabularies from being posted through by accident.
 */
export type FeedItemType =
  | 'post'
  | 'video'
  | 'job'
  | 'course'
  | 'ad'
  | 'mentor'
  | 'event'
  | 'story';

export interface FeedCandidate {
  id: string;
  item_type: FeedItemType;
  author_id: string;
  created_at: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  content_quality_score?: number;
  tags?: string[];
  is_sponsored?: boolean;
}

export interface FeedItem {
  id: string;
  item_type: FeedItemType;
  score: number;
  position: number;
  reason: string;
  is_sponsored: boolean;
}

/**
 * A refusal the ML service itself sent back, as opposed to a socket that never
 * connected or a request that timed out. `status` is what lets a caller tell
 * the two apart: a 4xx means the service read the request and rejected it, so
 * the request is what has to change, while a 5xx or a transport failure is
 * worth waiting out.
 */
/**
 * What the last health probe found, in enough detail for /health/detailed to
 * print it.
 *
 * `reachable` and `ready` are two different questions and used to be one. The
 * Python service answered /health with the literal string "healthy" whatever
 * its model status was, so this client reported a service that had loaded
 * nothing as fully ready; `models` is the map that service publishes, and
 * `ready` now follows what it says rather than the word next to it.
 */
export interface MlServiceHealth {
  /** An operator has set ML_SERVICE_URL. Without it there is no deployment to ask about. */
  configured: boolean;
  url: string;
  /** The service answered at all. */
  reachable: boolean;
  /** The service answered and reported itself able to serve every endpoint. */
  ready: boolean;
  /** Per-model load status as the service reports it, or null if it did not answer. */
  models: Record<string, boolean> | null;
  checkedAt: string | null;
  /** Why the last probe failed, when it did. */
  error: string | null;
}

export class MlServiceError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly detail: unknown;

  constructor(message: string, status: number, endpoint: string, detail?: unknown) {
    super(message);
    this.name = 'MlServiceError';
    this.status = status;
    this.endpoint = endpoint;
    this.detail = detail;
  }
}

// ===========================================
// ML SERVICE CLIENT
// ===========================================

class MLServiceClient {
  private baseUrl: string;
  private timeout: number;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds
  private lastModels: Record<string, boolean> | null = null;
  private lastError: string | null = null;

  constructor() {
    this.baseUrl = ML_SERVICE_URL;
    this.timeout = ML_SERVICE_TIMEOUT;
  }

  /**
   * Whether anyone has actually deployed this dependency.
   *
   * ML_SERVICE_URL falls back to http://localhost:8000 above so a developer can
   * run the Python service alongside the API without configuring anything. That
   * default is a convenience and never a deployment: read at call time, like
   * feed-ml.service's mlRankingEnabled(), so that a health check and a test can
   * both tell "nobody configured this" from "it is configured and down" instead
   * of reporting a dependency nobody chose to run as a broken one.
   */
  isConfigured(): boolean {
    return Boolean(process.env.ML_SERVICE_URL);
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = this.timeout
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // The ML service answers only callers that carry the shared key, once one is configured on both sides.
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ML_SERVICE_KEY ? { 'x-ml-key': process.env.ML_SERVICE_KEY } : {}),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { detail?: unknown; message?: unknown };
        const reported = typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : null;
        throw new MlServiceError(
          reported || `ML Service error: ${response.status}`,
          response.status,
          endpoint,
          body.detail ?? body.message
        );
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('ML Service request timeout');
      }
      throw error;
    }
  }

  private async retryFetch<T>(
    endpoint: string,
    options: RequestInit = {},
    attempts: number = ML_SERVICE_RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < attempts; i++) {
      try {
        return await this.fetch<T>(endpoint, options);
      } catch (error: any) {
        lastError = error;

        // A 4xx is the service telling us the request itself is wrong: a body
        // that does not match its schema, or a missing shared key. Sending the
        // identical body twice more cannot change the answer, it only adds the
        // back-off delays to whatever the caller is waiting on — which is how a
        // rejected feed batch came to cost about three seconds on every feed
        // load. Give up at once, and say so at error level, because a contract
        // that has drifted apart is a defect and not weather.
        if (error instanceof MlServiceError && error.status >= 400 && error.status < 500) {
          logger.error('ML Service rejected the request; the Node and Python contracts have drifted apart', {
            endpoint,
            status: error.status,
            detail: error.detail ?? error.message,
          });
          throw error;
        }

        // 501 is in the 5xx band but it is not weather either: the service is
        // saying this endpoint does not exist as a capability, which is the
        // permanent answer from /api/v1/mentor-match/match now that it no
        // longer invents mentors. Retrying it only spends the back-off delays.
        if (error instanceof MlServiceError && error.status === 501) {
          logger.error('ML Service does not implement this endpoint', {
            endpoint,
            detail: error.detail ?? error.message,
          });
          throw error;
        }

        logger.warn(`ML Service request failed (attempt ${i + 1}/${attempts})`, {
          endpoint,
          error: error.message,
        });

        if (i < attempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, ML_SERVICE_RETRY_DELAY * (i + 1))
          );
        }
      }
    }

    throw lastError;
  }

  // ===========================================
  // HEALTH CHECKS
  // ===========================================

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.fetch<{ status: string; models_loaded?: Record<string, boolean> }>(
        '/health',
        {},
        ML_HEALTH_TIMEOUT
      );
      // "healthy" is the only word that means every endpoint over there can
      // answer. The service also says "degraded", which it uses when it started
      // without a model artefact some endpoint needs — it is alive and most of
      // its routers work, but treating that as ready is how a deployment with
      // nothing loaded came to look identical to one serving real predictions.
      this.isHealthy = response.status === 'healthy';
      this.lastModels =
        response.models_loaded && typeof response.models_loaded === 'object' ? response.models_loaded : null;
      this.lastError = null;
      this.lastHealthCheck = Date.now();
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.lastModels = null;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.lastHealthCheck = Date.now();
      return false;
    }
  }

  async isReady(): Promise<boolean> {
    // Use cached health status if recent
    if (Date.now() - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isHealthy;
    }
    return this.checkHealth();
  }

  /**
   * The same probe isReady() makes, with everything it learned kept rather than
   * reduced to a boolean. /health/detailed needs the detail: "degraded because
   * career_compass has no artefact" and "the host does not resolve" are both
   * `false` from isReady(), and an operator cannot act on either without being
   * told which one it is.
   */
  async describeHealth(): Promise<MlServiceHealth> {
    const configured = this.isConfigured();
    if (!configured) {
      return {
        configured: false,
        url: this.baseUrl,
        reachable: false,
        ready: false,
        models: null,
        checkedAt: null,
        error: null,
      };
    }

    const ready = await this.isReady();
    return {
      configured: true,
      url: this.baseUrl,
      // A refusal is still an answer: the service is reachable whenever the
      // last probe came back without a transport error, whatever it said.
      reachable: ready || this.lastError === null,
      ready,
      models: this.lastModels,
      checkedAt: this.lastHealthCheck ? new Date(this.lastHealthCheck).toISOString() : null,
      error: this.lastError,
    };
  }

  // ===========================================
  // CAREER COMPASS
  // ===========================================

  async predictCareerGrowth(profile: CareerProfile): Promise<CareerPrediction> {
    return this.retryFetch<CareerPrediction>('/api/v1/career-compass/predict', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  async batchPredictCareer(
    profiles: CareerProfile[]
  ): Promise<{ predictions: CareerPrediction[]; processing_time_ms: number }> {
    return this.retryFetch('/api/v1/career-compass/batch-predict', {
      method: 'POST',
      body: JSON.stringify({ profiles }),
    });
  }

  async getCareerFeatureImportance(): Promise<{
    features: Array<{ name: string; importance: number }>;
  }> {
    return this.retryFetch('/api/v1/career-compass/feature-importance');
  }

  // ===========================================
  // MENTOR MATCH
  // ===========================================

  /**
   * Answers 501 and will keep doing so. The Python service has no database and
   * therefore no mentor directory; what it used to return here was five people
   * who do not exist, scored and given names, ratings and mentee counts. The
   * mentor matching this platform actually does runs in
   * algorithm.service getMentorMatch, over live rows, behind
   * GET /api/algorithms/mentor-match.
   *
   * Kept rather than deleted because the ML inference worker still names
   * 'mentor_match' as an algorithm, and a caller that reaches it should get the
   * refusal and its explanation rather than a missing-method TypeError.
   */
  async findMentorMatches(
    mentee: MenteeProfile,
    options?: { mentor_pool?: string[]; max_results?: number; min_score?: number }
  ): Promise<{ mentee_id: string; matches: MatchScore[]; total_considered: number }> {
    return this.retryFetch('/api/v1/mentor-match/match', {
      method: 'POST',
      body: JSON.stringify({
        mentee,
        ...options,
      }),
    });
  }

  async calculateMentorMatchScore(
    mentee: MenteeProfile,
    mentor: MentorProfile
  ): Promise<MatchScore> {
    return this.retryFetch('/api/v1/mentor-match/score', {
      method: 'POST',
      body: JSON.stringify({ mentee, mentor }),
    });
  }

  // ===========================================
  // SAFETY SCORE
  // ===========================================

  async calculateSafetyScore(profile: SafetyProfile): Promise<SafetyScoreResult> {
    return this.retryFetch<SafetyScoreResult>('/api/v1/safety-score/calculate', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  async evaluateInteractionSafety(
    initiator_id: string,
    recipient_id: string,
    interaction_type: string,
    context?: Record<string, any>
  ): Promise<{
    is_safe: boolean;
    risk_level: string;
    risk_score: number;
    warnings: string[];
    recommendations: string[];
  }> {
    return this.retryFetch('/api/v1/safety-score/interaction', {
      method: 'POST',
      body: JSON.stringify({
        initiator_id,
        recipient_id,
        interaction_type,
        context: context || {},
      }),
    });
  }

  async moderateContent(
    content_id: string,
    content_type: string,
    author_id: string,
    content_text?: string,
    content_url?: string
  ): Promise<{
    content_id: string;
    is_approved: boolean;
    risk_level: string;
    categories_flagged: string[];
    requires_human_review: boolean;
  }> {
    return this.retryFetch('/api/v1/safety-score/moderate-content', {
      method: 'POST',
      body: JSON.stringify({
        content_id,
        content_type,
        author_id,
        content_text,
        content_url,
      }),
    });
  }

  // ===========================================
  // RANKER
  // ===========================================

  async rankCandidates(
    candidates: RankingCandidate[],
    userContext: UserContext,
    options?: {
      ranking_model?: 'light' | 'heavy';
      top_k?: number;
      diversity_factor?: number;
    }
  ): Promise<{
    ranked_items: RankedItem[];
    model_used: string;
    processing_time_ms: number;
  }> {
    return this.retryFetch('/api/v1/ranker/rank', {
      method: 'POST',
      body: JSON.stringify({
        candidates,
        user_context: userContext,
        ranking_model: options?.ranking_model || 'light',
        top_k: options?.top_k,
        diversity_factor: options?.diversity_factor ?? 0.2,
      }),
    });
  }

  // ===========================================
  // FEED (OpportunityVerse)
  // ===========================================

  async generateFeed(
    userContext: {
      user_id: string;
      persona: string;
      interests?: string[];
      followed_users?: string[];
      followed_organizations?: string[];
      feed_context?: string;
    },
    candidates: FeedCandidate[],
    options?: {
      page?: number;
      page_size?: number;
      mix_config?: Record<string, number>;
    }
  ): Promise<{
    feed_items: FeedItem[];
    page: number;
    has_more: boolean;
    mix_ratios: Record<string, number>;
    generation_time_ms: number;
  }> {
    return this.retryFetch('/api/v1/feed/generate', {
      method: 'POST',
      body: JSON.stringify({
        user_context: userContext,
        candidates,
        page: options?.page || 1,
        page_size: options?.page_size || 20,
        mix_config: options?.mix_config,
      }),
    });
  }

  async recordEngagement(
    user_id: string,
    item_id: string,
    engagement_type: 'view' | 'like' | 'comment' | 'share' | 'click' | 'dwell',
    dwell_time_seconds?: number
  ): Promise<{ status: string }> {
    return this.retryFetch('/api/v1/feed/engagement-signal', {
      method: 'POST',
      body: JSON.stringify({
        user_id,
        item_id,
        engagement_type,
        dwell_time_seconds,
      }),
    });
  }

  // ===========================================
  // INCOME STREAM
  // ===========================================

  async predictIncomeOpportunities(profile: {
    user_id: string;
    current_income: number;
    skills: string[];
    industry: string;
    experience_years: number;
    available_hours_per_week?: number;
    risk_tolerance?: 'low' | 'medium' | 'high';
  }): Promise<{
    user_id: string;
    current_monthly_income: number;
    predicted_potential: number;
    income_gap: number;
    opportunities: Array<{
      opportunity_id: string;
      stream_type: string;
      title: string;
      estimated_monthly_income: { min: number; max: number; expected: number };
      time_investment_hours: number;
      skill_match: number;
    }>;
    diversification_score: number;
    recommendations: string[];
  }> {
    return this.retryFetch('/api/v1/income-stream/predict', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }
}

// ===========================================
// SINGLETON EXPORT
// ===========================================

export const mlService = new MLServiceClient();

// ===========================================
// CONVENIENCE FUNCTIONS
// ===========================================

export async function getCareerPrediction(
  userId: string,
  profile: Omit<CareerProfile, 'user_id'>
): Promise<CareerPrediction> {
  return mlService.predictCareerGrowth({ user_id: userId, ...profile });
}

export async function findMentors(
  menteeProfile: MenteeProfile,
  maxResults: number = 10
): Promise<MatchScore[]> {
  const result = await mlService.findMentorMatches(menteeProfile, {
    max_results: maxResults,
    min_score: 50,
  });
  return result.matches;
}

export async function getUserSafetyScore(
  profile: SafetyProfile
): Promise<SafetyScoreResult> {
  return mlService.calculateSafetyScore(profile);
}

export async function rankContent(
  candidates: RankingCandidate[],
  userId: string,
  persona: string,
  options?: { useHeavyRanker?: boolean }
): Promise<RankedItem[]> {
  const result = await mlService.rankCandidates(
    candidates,
    { user_id: userId, persona },
    { ranking_model: options?.useHeavyRanker ? 'heavy' : 'light' }
  );
  return result.ranked_items;
}

export async function generateUserFeed(
  userId: string,
  persona: string,
  candidates: FeedCandidate[],
  page: number = 1
): Promise<FeedItem[]> {
  const result = await mlService.generateFeed(
    { user_id: userId, persona },
    candidates,
    { page }
  );
  return result.feed_items;
}
