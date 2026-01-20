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
  confidence: number;
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
  peer_percentile: number;
  industry_benchmark: number;
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

export interface FeedCandidate {
  id: string;
  item_type: string;
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
  item_type: string;
  score: number;
  position: number;
  reason: string;
  is_sponsored: boolean;
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

  constructor() {
    this.baseUrl = ML_SERVICE_URL;
    this.timeout = ML_SERVICE_TIMEOUT;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { detail?: string; message?: string };
        throw new Error(
          error.detail || error.message || `ML Service error: ${response.status}`
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
      const response = await this.fetch<{ status: string }>('/health');
      this.isHealthy = response.status === 'healthy';
      this.lastHealthCheck = Date.now();
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
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
