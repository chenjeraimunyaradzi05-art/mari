import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { sanitizeChatHistory, truncate, asUntrustedBlock, DEFAULT_MAX_TOKENS } from '../utils/llm';

/**
 * The one shape a resume analysis leaves this service in, whether the model
 * ran or not. Before this the real path and the simulated path returned two
 * unrelated shapes, the client read fields from a third, and the visible
 * result was a hardcoded 75% for everyone. `score` is null whenever there is
 * no analysed number to show; nothing downstream may invent one.
 */
export interface ResumeAnalysis {
  score: number | null;
  strengths: string | null;
  weaknesses: string | null;
  improvements: Array<{ section: string | null; suggestion: string }>;
  keywordsMatched: string[];
  keywordsMissing: string[];
  simulated: boolean;
}

const stringOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const stringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];

/** Model JSON arrives on a promise, not a schema; clamp it to the contract. */
export function normaliseResumeAnalysis(raw: any): ResumeAnalysis {
  const score = Number(raw?.score);

  const improvements: ResumeAnalysis['improvements'] = Array.isArray(raw?.improvements)
    ? raw.improvements
        .map((item: unknown) => {
          if (typeof item === 'string') return { section: null, suggestion: item.trim() };
          const suggestion = stringOrNull((item as any)?.suggestion);
          return suggestion ? { section: stringOrNull((item as any)?.section), suggestion } : null;
        })
        .filter((x: unknown): x is { section: string | null; suggestion: string } => !!x)
    : [];

  return {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
    strengths: stringOrNull(raw?.strengthAnalysis ?? raw?.strengths),
    weaknesses: stringOrNull(raw?.weaknessAnalysis ?? raw?.weaknesses),
    improvements,
    keywordsMatched: stringList(raw?.keywordsMatches ?? raw?.keywordsMatched),
    keywordsMissing: stringList(raw?.keywordsMissing),
    simulated: false,
  };
}

class AiService {
  private openai: OpenAI | null = null;
  private isProduction: boolean;
  private allowSimulation: boolean;

  constructor() {
    this.isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production';
    this.allowSimulation = process.env.AI_ALLOW_SIMULATION === 'true';

    // Prefer the specific AI_ vars if available, fallback to generic OPENAI_API_KEY
    const apiKey = process.env.AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
        organization: process.env.AI_OPENAI_ORG, 
      });
    } else {
      logger.warn('AI_OPENAI_API_KEY not found. AI features will be simulated when allowed.');
      if (this.isProduction && !this.allowSimulation) {
        logger.error('AI service not configured in production. Set AI_OPENAI_API_KEY or OPENAI_API_KEY.');
      }
    }
  }

  private shouldSimulate(): boolean {
    return !this.openai && (!this.isProduction || this.allowSimulation);
  }

  private ensureOpenAI(feature: string): void {
    if (this.openai) return;
    if (this.shouldSimulate()) return;
    throw new Error(`AI service not configured for ${feature}. Configure AI_OPENAI_API_KEY or OPENAI_API_KEY.`);
  }

  async optimizeResume(resumeText: string, jobDescription?: string): Promise<ResumeAnalysis> {
    if (!this.openai) {
      this.ensureOpenAI('resume optimization');
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

      const parts = [
        asUntrustedBlock('resume', resumeText, 20000),
        jobDescription ? asUntrustedBlock('target job description', jobDescription, 8000) : '',
      ];
      const userPrompt = parts.filter(Boolean).join('\n\n');

      const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: model,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: DEFAULT_MAX_TOKENS,
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('No response from AI');

      return normaliseResumeAnalysis(JSON.parse(content));

    } catch (error) {
      logger.error('AI Resume Optimization failed:', error);
      throw error;
    }
  }

  async generateCareerPath(profileData: any, goal?: string): Promise<any> {
     if (!this.openai) {
       this.ensureOpenAI('career path generation');
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
      if (!content) throw new Error('No response from AI');

      return JSON.parse(content);
    } catch (error) {
      logger.error('AI Career Path failed:', error);
      throw error;
    }
  }

  async enrichSocialContent(content: string, mediaUrls?: string[]): Promise<any> {
    if (process.env.AI_SOCIAL_CONTENT_ENABLED !== 'true') {
      const fallbackScore = parseInt(process.env.AI_SOCIAL_FALLBACK_SCORE || '40', 10);
      return {
        qualityScore: fallbackScore,
        tags: [],
        sentiment: 'neutral',
        isSafe: true
      };
    }

    if (!this.openai) {
      this.ensureOpenAI('social content enrichment');
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
        if(!result) throw new Error("No AI response");
        
        return JSON.parse(result);
    } catch (error) {
        logger.error('AI Content Enrichment failed:', error);
        return { 
            qualityScore: parseInt(process.env.AI_SOCIAL_FALLBACK_SCORE || '40', 10), 
            tags: [], 
            sentiment: 'neutral', 
            isSafe: true 
        };
    }
  }

  async generateInterviewQuestions(jobDescription: string, type: 'behavioral' | 'technical' | 'mixed' = 'mixed'): Promise<any> {
    if (!this.openai) {
      this.ensureOpenAI('interview question generation');
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
        if (!content) throw new Error("No response");
        return JSON.parse(content);
    } catch (err) {
        logger.error("Interview Coach AI failed", err);
        throw err;
    }
  }

  async evaluateInterviewAnswer(params: {
    question: string;
    answer: string;
    jobRole?: string;
    interviewType?: string;
    difficulty?: string;
  }): Promise<{
    feedback: string;
    analysis: { rating: number; strengths: string[]; improvements: string[] };
    nextQuestion: string;
  }> {
    if (!this.openai) {
      this.ensureOpenAI('interview answer feedback');
      return {
        feedback:
          'Development simulation: connect AI_OPENAI_API_KEY or OPENAI_API_KEY for production interview feedback.',
        analysis: {
          rating: 3,
          strengths: ['Answer submitted successfully'],
          improvements: ['Configure AI provider credentials for detailed coaching'],
        },
        nextQuestion: 'What outcome did your answer create, and how did you measure it?',
      };
    }

    try {
      const systemPrompt = `You are an expert interview coach. Evaluate the candidate answer and return valid JSON only:
{
  "feedback": "Concise coaching feedback",
  "analysis": {
    "rating": number between 1 and 5,
    "strengths": ["strength"],
    "improvements": ["improvement"]
  },
  "nextQuestion": "A relevant follow-up interview question"
}`;

      const userPrompt = `Job role: ${params.jobRole || 'Not specified'}
Interview type: ${params.interviewType || 'mixed'}
Difficulty: ${params.difficulty || 'mid'}
Question: ${params.question}
Candidate answer: ${params.answer}`;

      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      return JSON.parse(content);
    } catch (error) {
      logger.error('AI Interview Answer Feedback failed:', error);
      throw error;
    }
  }

  /**
   * The tones the generator screen offers. An allowlist rather than free text,
   * because the tone is spoken to the model as an instruction: raw caller text
   * in that position would be an injection point dressed as a style picker.
   */
  static readonly CONTENT_TONES = new Set([
    'professional', 'friendly', 'confident', 'inspiring', 'casual', 'formal',
  ]);

  async generateContent(
    topic: string,
    contentType: string = 'post',
    platform: string = 'LinkedIn',
    tone?: string,
    context?: string
  ): Promise<string> {
     if (!this.openai) {
       this.ensureOpenAI('content generation');
       return "Simulated content generation response.";
     }

     const spokenTone =
       tone && AiService.CONTENT_TONES.has(tone.toLowerCase()) ? tone.toLowerCase() : null;

     try {
       const systemPrompt = `You are a professional content creator specializing in empowering women in their careers and brief businesses. Create engaging, authentic content.`;
       const parts = [
         `Create ${contentType} content about: ${truncate(topic, 2000)} for ${platform}.`,
         spokenTone ? `Write it in a ${spokenTone} tone.` : '',
         'Include hook, body, CTA, and hashtags.',
         context?.trim() ? asUntrustedBlock('background', context, 4000) : '',
       ];
       const userPrompt = parts.filter(Boolean).join('\n');

       const completion = await this.openai.chat.completions.create({
         messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
         model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
         max_tokens: DEFAULT_MAX_TOKENS,
       });
       return completion.choices[0]?.message?.content || '';
     } catch (e) {
       logger.error('AI Content Gen failed', e);
       throw e;
     }
  }

  async validateBusinessIdea(idea: string, targetMarket?: string, problemSolved?: string): Promise<string> {
    if (!this.openai) {
      this.ensureOpenAI('idea validation');
      return "Simulated idea validation response.";
    }

    try {
      const systemPrompt = "You are a startup advisor. Validate this business idea.";
      const userPrompt = `Idea: ${idea}\nTarget: ${targetMarket}\nProblem: ${problemSolved}\nProvide Viability Score (0-100), Market Size, Competition, SWOT, and Action Plan.`;
      
      const completion = await this.openai.chat.completions.create({
         messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
         model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
      });
      return completion.choices[0]?.message?.content || '';
    } catch (e) {
        logger.error('AI Idea Validation failed', e);
        throw e;
    }
  }

  async chat(message: string, history: any[] = []): Promise<string> {
     if (!this.openai) {
       this.ensureOpenAI('chat');
       return "I am ATHENA (Simulated). How can I help?";
     }
     
     try {
         const systemPrompt = "You are ATHENA, an AI career assistant designed to empower women in their professional journeys. Be supportive but professional.";
         // The previous version defaulted a missing role to 'user' but passed a
         // supplied one through untouched, so a caller could send role 'system'
         // and replace the prompt above. sanitizeChatHistory drops anything
         // that is not a well-formed user/assistant turn.
         const validHistory = sanitizeChatHistory(history);

         const messages: any[] = [
             { role: 'system', content: systemPrompt },
             ...validHistory,
             { role: 'user', content: truncate(message, 8000) }
         ];

         const completion = await this.openai.chat.completions.create({
             messages,
             model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
             max_tokens: DEFAULT_MAX_TOKENS,
         });
         return completion.choices[0]?.message?.content || '';
     } catch (e) {
         logger.error('AI Chat failed', e);
         throw e;
     }
  }

  async evaluateJobMatch(userProfile: string, jobDescription: string): Promise<any> {
    if (!this.openai) {
      this.ensureOpenAI('job match evaluation');
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
    } catch (e) {
        logger.error('AI Job Match failed', e);
        return { score: 0, analysis: "Error analyzing match", missingSkills: [] };
    }
  }

  // Simulated responses for dev mode without API keys
  /**
   * What comes back when no model is configured. It used to be a fabricated
   * 75% match, invented missing keywords and a rewritten resume for a fictional
   * John Doe, none of it marked as simulated. Now: no score, no keywords, no
   * rewrite, and general advice plainly framed as general. A member is told
   * her resume was not analysed rather than shown an analysis that never ran.
   */
  private getSimulatedResumeResponse(): ResumeAnalysis {
    return {
      score: null,
      strengths: null,
      weaknesses: null,
      improvements: [
        { section: null, suggestion: 'Quantify achievements with real numbers, such as budgets managed or growth delivered.' },
        { section: null, suggestion: 'Lead each role with the outcome, not the duty.' },
        { section: null, suggestion: 'Mirror the exact wording of the skills the job advertisement asks for, where they are true of you.' },
      ],
      keywordsMatched: [],
      keywordsMissing: [],
      simulated: true,
    };
  }

  private getSimulatedCareerPathResponse() {
    return {
      currentLevel: "Mid-Level Professional",
      targetLevel: "Senior Manager",
      matchScore: 65,
      milestones: [
        { timeframe: "0-12 months", title: "Senior Contributor", description: "Take ownership of large projects", skillsToAcquire: ["Leadership", "System Design"]},
        { timeframe: "1-2 years", title: "Team Lead", description: "Manage a small team", skillsToAcquire: ["People Management", "Mentoring"]}
      ],
      recommendedRoles: ["Senior Developer", "Tech Lead"],
      learningPath: ["Advanced Architecture", "Management 101"]
    };
  }
}

export const aiService = new AiService();
