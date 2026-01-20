"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
class AiService {
    openai = null;
    constructor() {
        // Prefer the specific AI_ vars if available, fallback to generic OPENAI_API_KEY
        const apiKey = process.env.AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new openai_1.default({
                apiKey: apiKey,
                organization: process.env.AI_OPENAI_ORG,
            });
        }
        else {
            logger_1.logger.warn('AI_OPENAI_API_KEY not found. AI features will be simulated.');
        }
    }
    async optimizeResume(resumeText, jobDescription) {
        if (!this.openai) {
            return this.getSimulatedResumeResponse();
        }
        try {
            const systemPrompt = `You are an expert ATS (Applicant Tracking System) optimizer and resume coach. 
      Analyze the provided resume against best practices and the target job description (if provided).
      Return a JSON object with:
      {
        "score": number (0-100),
        "strengthAnalysis": "Brief summary of strong points",
        "weaknessAnalysis": "Brief summary of weak points",
        "improvements": [
          { "section": "Experience", "suggestion": "Use stronger action verbs" }
        ],
        "keywordsMatches": ["keyword1", "keyword2"],
        "keywordsMissing": ["keyword3", "keyword4"]
      }`;
            const userPrompt = `RESUME:\n${resumeText}\n\n${jobDescription ? `TARGET JOB DESCRIPTION:\n${jobDescription}` : ''}`;
            const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: model,
                response_format: { type: 'json_object' },
                temperature: 0.7,
            });
            const content = completion.choices[0].message.content;
            if (!content)
                throw new Error('No response from AI');
            return JSON.parse(content);
        }
        catch (error) {
            logger_1.logger.error('AI Resume Optimization failed:', error);
            throw error;
        }
    }
    async generateCareerPath(profileData, goal) {
        if (!this.openai) {
            return this.getSimulatedCareerPathResponse();
        }
        try {
            const systemPrompt = `You are an expert career strategist specializing in helping women advance their careers in tech, business, and creative industries. Analyze the user's profile and provide strategic career guidance.
      
      Return a VALID JSON object with:
      {
        "currentLevel": "Assessment of current standing",
        "targetLevel": "Likely target in 3-5 years",
        "matchScore": number (0-100 readiness for goal),
        "milestones": [
           {
             "timeframe": "e.g., 0-6 months",
             "title": "Short term goal",
             "description": "What to focus on",
             "skillsToAcquire": ["Skill 1", "Skill 2"]
           }
        ],
        "recommendedRoles": ["Role 1", "Role 2"],
        "learningPath": ["Course/Topic 1", "Cert 2"],
        "careerAdvice": "General strategic advice based on their specific background"
      }`;
            // If profileData is a string, use it. If object, stringify it (or formatted by caller)
            const profileContext = typeof profileData === 'string' ? profileData : JSON.stringify(profileData);
            const userPrompt = `Analyze this professional profile and provide career advancement recommendations:
      
      Profile Context: ${profileContext}
      Specific Goal: ${goal || 'Advancement in current field'}
      
      Provide recommendations focusing on:
      1. Current career stage assessment
      2. 3 potential career paths with timelines
      3. Skills to develop for each path
      4. Recommended certifications`;
            const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: model,
                response_format: { type: 'json_object' },
            });
            const content = completion.choices[0].message.content;
            if (!content)
                throw new Error('No response from AI');
            return JSON.parse(content);
        }
        catch (error) {
            logger_1.logger.error('AI Career Path failed:', error);
            throw error;
        }
    }
    async enrichSocialContent(content, mediaUrls) {
        if (!this.openai || process.env.AI_SOCIAL_CONTENT_ENABLED !== 'true') {
            const fallbackScore = parseInt(process.env.AI_SOCIAL_FALLBACK_SCORE || '40', 10);
            return {
                qualityScore: fallbackScore,
                tags: [],
                sentiment: 'neutral',
                isSafe: true
            };
        }
        try {
            const systemPrompt = `You are a social media content moderator and strategist. Analyze this post content.
        Return a valid JSON object:
        {
            "qualityScore": number (0-100, based on engagement potential/clarity),
            "tags": ["tag1", "tag2"] (max ${process.env.AI_SOCIAL_MAX_TAGS || 5} tags),
            "sentiment": "positive" | "negative" | "neutral",
            "isSafe": boolean (content moderation check)
        }`;
            const userPrompt = `Content: "${content}"\nHas Media: ${mediaUrls?.length ? 'Yes' : 'No'}`;
            const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: model,
                response_format: { type: 'json_object' },
                temperature: 0.5,
            });
            const result = completion.choices[0].message.content;
            if (!result)
                throw new Error("No AI response");
            return JSON.parse(result);
        }
        catch (error) {
            logger_1.logger.error('AI Content Enrichment failed:', error);
            return {
                qualityScore: parseInt(process.env.AI_SOCIAL_FALLBACK_SCORE || '40', 10),
                tags: [],
                sentiment: 'neutral',
                isSafe: true
            };
        }
    }
    async generateInterviewQuestions(jobDescription, type = 'mixed') {
        if (!this.openai) {
            return {
                questions: [
                    "Tell me about a time you faced a challenge.",
                    "What are your strengths and weaknesses?"
                ],
                tips: "Use the STAR method."
            };
        }
        try {
            const systemPrompt = `You are an expert technical interviewer and career coach. Generate interview questions based on the job description.
        Return valid JSON:
        {
            "questions": ["Question 1", "Question 2"],
            "tips": "General advice for this role",
            "answers": ["Key points to hit for Q1", "Key points for Q2"]
        }`;
            const userPrompt = `Job Description: ${jobDescription}\nType: ${type}`;
            const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: model,
                response_format: { type: 'json_object' },
            });
            const content = completion.choices[0].message.content;
            if (!content)
                throw new Error("No response");
            return JSON.parse(content);
        }
        catch (err) {
            logger_1.logger.error("Interview Coach AI failed", err);
            throw err;
        }
    }
    async generateContent(topic, contentType = 'post', platform = 'LinkedIn') {
        if (!this.openai)
            return "Simulated content generation response.";
        try {
            const systemPrompt = `You are a professional content creator specializing in empowering women in their careers and brief businesses. Create engaging, authentic content.`;
            const userPrompt = `Create ${contentType} content about: ${topic} for ${platform}. Include hook, body, CTA, and hashtags.`;
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
            });
            return completion.choices[0]?.message?.content || '';
        }
        catch (e) {
            logger_1.logger.error('AI Content Gen failed', e);
            throw e;
        }
    }
    async validateBusinessIdea(idea, targetMarket, problemSolved) {
        if (!this.openai)
            return "Simulated idea validation response.";
        try {
            const systemPrompt = "You are a startup advisor. Validate this business idea.";
            const userPrompt = `Idea: ${idea}\nTarget: ${targetMarket}\nProblem: ${problemSolved}\nProvide Viability Score (0-100), Market Size, Competition, SWOT, and Action Plan.`;
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
            });
            return completion.choices[0]?.message?.content || '';
        }
        catch (e) {
            logger_1.logger.error('AI Idea Validation failed', e);
            throw e;
        }
    }
    async chat(message, history = []) {
        if (!this.openai)
            return "I am ATHENA (Simulated). How can I help?";
        try {
            const systemPrompt = "You are ATHENA, an AI career assistant designed to empower women in their professional journeys. Be supportive but professional.";
            // Validate history structure to be safe
            const validHistory = Array.isArray(history) ? history.map(h => ({ role: h.role || 'user', content: h.content || '' })) : [];
            const messages = [
                { role: 'system', content: systemPrompt },
                ...validHistory,
                { role: 'user', content: message }
            ];
            const completion = await this.openai.chat.completions.create({
                messages,
                model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
            });
            return completion.choices[0]?.message?.content || '';
        }
        catch (e) {
            logger_1.logger.error('AI Chat failed', e);
            throw e;
        }
    }
    async evaluateJobMatch(userProfile, jobDescription) {
        if (!this.openai) {
            return {
                score: 75,
                analysis: "Simulated match analysis: Good skill overlap.",
                missingSkills: ["Skill A"]
            };
        }
        try {
            const systemPrompt = "You are a recruiter. Evaluate the match between a candidate and a job. Return JSON: { score: 0-100, analysis: string, missingSkills: string[] }";
            const userPrompt = `Candidate: ${userProfile}\nJob: ${jobDescription}`;
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
                response_format: { type: 'json_object' }
            });
            const content = completion.choices[0]?.message?.content || '{}';
            return JSON.parse(content);
        }
        catch (e) {
            logger_1.logger.error('AI Job Match failed', e);
            return { score: 0, analysis: "Error analyzing match", missingSkills: [] };
        }
    }
    // Simulated responses for dev mode without API keys
    getSimulatedResumeResponse() {
        return {
            matchScore: 75,
            summary: "This is a simulated AI response. Your resume looks good but lacks specific metrics.",
            missingKeywords: ["Python", "Data Analysis", "Cloud Computing"],
            improvements: [
                "Add numbers to your achievements (e.g., 'Managed budget of $50k')",
                "Include a 'Skills' section at the top",
                "Use more active verbs like 'Led', 'Developed', 'Architected'"
            ],
            optimizedResume: "John Doe\nSoftware Engineer\n\nSummary:\nExperienced engineer...\n\nExperience:\n- Led team of 5..."
        };
    }
    getSimulatedCareerPathResponse() {
        return {
            currentLevel: "Mid-Level Professional",
            targetLevel: "Senior Manager",
            matchScore: 65,
            milestones: [
                { timeframe: "0-12 months", title: "Senior Contributor", description: "Take ownership of large projects", skillsToAcquire: ["Leadership", "System Design"] },
                { timeframe: "1-2 years", title: "Team Lead", description: "Manage a small team", skillsToAcquire: ["People Management", "Mentoring"] }
            ],
            recommendedRoles: ["Senior Developer", "Tech Lead"],
            learningPath: ["Advanced Architecture", "Management 101"]
        };
    }
}
exports.aiService = new AiService();
//# sourceMappingURL=ai.service.js.map