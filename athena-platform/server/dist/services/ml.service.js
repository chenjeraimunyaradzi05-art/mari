"use strict";
/**
 * ML Service Bridge
 * =================
 * Connects Node.js backend to Python ML microservice.
 * Provides typed interfaces for all ML algorithms.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlService = void 0;
exports.getCareerPrediction = getCareerPrediction;
exports.findMentors = findMentors;
exports.getUserSafetyScore = getUserSafetyScore;
exports.rankContent = rankContent;
exports.generateUserFeed = generateUserFeed;
const logger_1 = require("../utils/logger");
// ===========================================
// CONFIGURATION
// ===========================================
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_SERVICE_TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT || '30000', 10);
const ML_SERVICE_RETRY_ATTEMPTS = 3;
const ML_SERVICE_RETRY_DELAY = 1000;
// ===========================================
// ML SERVICE CLIENT
// ===========================================
class MLServiceClient {
    baseUrl;
    timeout;
    isHealthy = false;
    lastHealthCheck = 0;
    healthCheckInterval = 30000; // 30 seconds
    constructor() {
        this.baseUrl = ML_SERVICE_URL;
        this.timeout = ML_SERVICE_TIMEOUT;
    }
    async fetch(endpoint, options = {}) {
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
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || error.message || `ML Service error: ${response.status}`);
            }
            return response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('ML Service request timeout');
            }
            throw error;
        }
    }
    async retryFetch(endpoint, options = {}, attempts = ML_SERVICE_RETRY_ATTEMPTS) {
        let lastError = null;
        for (let i = 0; i < attempts; i++) {
            try {
                return await this.fetch(endpoint, options);
            }
            catch (error) {
                lastError = error;
                logger_1.logger.warn(`ML Service request failed (attempt ${i + 1}/${attempts})`, {
                    endpoint,
                    error: error.message,
                });
                if (i < attempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, ML_SERVICE_RETRY_DELAY * (i + 1)));
                }
            }
        }
        throw lastError;
    }
    // ===========================================
    // HEALTH CHECKS
    // ===========================================
    async checkHealth() {
        try {
            const response = await this.fetch('/health');
            this.isHealthy = response.status === 'healthy';
            this.lastHealthCheck = Date.now();
            return this.isHealthy;
        }
        catch (error) {
            this.isHealthy = false;
            return false;
        }
    }
    async isReady() {
        // Use cached health status if recent
        if (Date.now() - this.lastHealthCheck < this.healthCheckInterval) {
            return this.isHealthy;
        }
        return this.checkHealth();
    }
    // ===========================================
    // CAREER COMPASS
    // ===========================================
    async predictCareerGrowth(profile) {
        return this.retryFetch('/api/v1/career-compass/predict', {
            method: 'POST',
            body: JSON.stringify(profile),
        });
    }
    async batchPredictCareer(profiles) {
        return this.retryFetch('/api/v1/career-compass/batch-predict', {
            method: 'POST',
            body: JSON.stringify({ profiles }),
        });
    }
    async getCareerFeatureImportance() {
        return this.retryFetch('/api/v1/career-compass/feature-importance');
    }
    // ===========================================
    // MENTOR MATCH
    // ===========================================
    async findMentorMatches(mentee, options) {
        return this.retryFetch('/api/v1/mentor-match/match', {
            method: 'POST',
            body: JSON.stringify({
                mentee,
                ...options,
            }),
        });
    }
    async calculateMentorMatchScore(mentee, mentor) {
        return this.retryFetch('/api/v1/mentor-match/score', {
            method: 'POST',
            body: JSON.stringify({ mentee, mentor }),
        });
    }
    // ===========================================
    // SAFETY SCORE
    // ===========================================
    async calculateSafetyScore(profile) {
        return this.retryFetch('/api/v1/safety-score/calculate', {
            method: 'POST',
            body: JSON.stringify(profile),
        });
    }
    async evaluateInteractionSafety(initiator_id, recipient_id, interaction_type, context) {
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
    async moderateContent(content_id, content_type, author_id, content_text, content_url) {
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
    async rankCandidates(candidates, userContext, options) {
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
    async generateFeed(userContext, candidates, options) {
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
    async recordEngagement(user_id, item_id, engagement_type, dwell_time_seconds) {
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
    async predictIncomeOpportunities(profile) {
        return this.retryFetch('/api/v1/income-stream/predict', {
            method: 'POST',
            body: JSON.stringify(profile),
        });
    }
}
// ===========================================
// SINGLETON EXPORT
// ===========================================
exports.mlService = new MLServiceClient();
// ===========================================
// CONVENIENCE FUNCTIONS
// ===========================================
async function getCareerPrediction(userId, profile) {
    return exports.mlService.predictCareerGrowth({ user_id: userId, ...profile });
}
async function findMentors(menteeProfile, maxResults = 10) {
    const result = await exports.mlService.findMentorMatches(menteeProfile, {
        max_results: maxResults,
        min_score: 50,
    });
    return result.matches;
}
async function getUserSafetyScore(profile) {
    return exports.mlService.calculateSafetyScore(profile);
}
async function rankContent(candidates, userId, persona, options) {
    const result = await exports.mlService.rankCandidates(candidates, { user_id: userId, persona }, { ranking_model: options?.useHeavyRanker ? 'heavy' : 'light' });
    return result.ranked_items;
}
async function generateUserFeed(userId, persona, candidates, page = 1) {
    const result = await exports.mlService.generateFeed({ user_id: userId, persona }, candidates, { page });
    return result.feed_items;
}
//# sourceMappingURL=ml.service.js.map