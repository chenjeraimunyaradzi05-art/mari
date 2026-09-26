import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { sanitizeChatHistory, truncate, asUntrustedBlock, DEFAULT_MAX_TOKENS } from '../utils/llm';
import { recordAiSpend, type AiMeter } from './ai-budget.service';

export type { AiMeter } from './ai-budget.service';

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

/** A 0-100 reading the model offered, clamped, or null when it offered none. */
const scoreOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

/**
 * Every shape in this file follows the same rule, and it is the rule the resume
 * contract above was rewritten to obey: when the model did not run, or ran and
 * said nothing about a field, the field is null or empty and `simulated` says
 * which of the two happened. Nothing in this service may fill a gap with a
 * plausible-looking value. A member reading a career plan, a viability score or
 * a piece of interview feedback has no way to tell an invented one from a real
 * one, and the invented ones were being shown to her with no mark at all.
 */
export interface CareerPathMilestone {
  timeframe: string | null;
  title: string;
  description: string | null;
  skillsToAcquire: string[];
}

export interface CareerPathPlan {
  currentLevel: string | null;
  targetLevel: string | null;
  /** Readiness for the stated goal, 0-100, as the model judged it. Null when nothing judged it. */
  matchScore: number | null;
  milestones: CareerPathMilestone[];
  recommendedRoles: string[];
  learningPath: string[];
  careerAdvice: string | null;
  simulated: boolean;
}

/** Model JSON arrives on a promise, not a schema; clamp it to the contract. */
export function normaliseCareerPath(raw: any): CareerPathPlan {
  const milestones: CareerPathMilestone[] = Array.isArray(raw?.milestones)
    ? raw.milestones
        .map((item: unknown) => {
          const title = stringOrNull((item as any)?.title ?? (item as any)?.role);
          if (!title) return null;
          return {
            timeframe: stringOrNull((item as any)?.timeframe ?? (item as any)?.timeline),
            title,
            description: stringOrNull((item as any)?.description),
            skillsToAcquire: stringList((item as any)?.skillsToAcquire ?? (item as any)?.skills),
          };
        })
        .filter((x: unknown): x is CareerPathMilestone => !!x)
    : [];

  return {
    currentLevel: stringOrNull(raw?.currentLevel),
    targetLevel: stringOrNull(raw?.targetLevel),
    matchScore: scoreOrNull(raw?.matchScore),
    milestones,
    recommendedRoles: stringList(raw?.recommendedRoles),
    learningPath: stringList(raw?.learningPath),
    careerAdvice: stringOrNull(raw?.careerAdvice),
    simulated: false,
  };
}

export interface IdeaFacet {
  score: number | null;
  analysis: string | null;
}

export interface IdeaValidation {
  overallScore: number | null;
  marketPotential: IdeaFacet | null;
  feasibility: IdeaFacet | null;
  competition: (IdeaFacet & { competitors: string[] }) | null;
  targetAudience: { description: string | null; size: string | null; demographics: string[] } | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  nextSteps: string[];
  /** The model's prose, kept whole, for the screen that shows no score panels. */
  analysis: string | null;
  simulated: boolean;
}

const facetOrNull = (raw: unknown): IdeaFacet | null => {
  if (!raw || typeof raw !== 'object') return null;
  const score = scoreOrNull((raw as any).score);
  const analysis = stringOrNull((raw as any).analysis);
  return score === null && analysis === null ? null : { score, analysis };
};

/** Model JSON arrives on a promise, not a schema; clamp it to the contract. */
export function normaliseIdeaValidation(raw: any): IdeaValidation {
  const competitionFacet = facetOrNull(raw?.competition);
  const competitors = stringList(raw?.competition?.competitors);

  const audienceRaw = raw?.targetAudience;
  const audience =
    audienceRaw && typeof audienceRaw === 'object'
      ? {
          description: stringOrNull(audienceRaw.description),
          size: stringOrNull(audienceRaw.size),
          demographics: stringList(audienceRaw.demographics),
        }
      : null;

  return {
    overallScore: scoreOrNull(raw?.overallScore),
    marketPotential: facetOrNull(raw?.marketPotential),
    feasibility: facetOrNull(raw?.feasibility),
    competition: competitionFacet || competitors.length ? { ...(competitionFacet ?? { score: null, analysis: null }), competitors } : null,
    targetAudience:
      audience && (audience.description || audience.size || audience.demographics.length) ? audience : null,
    strengths: stringList(raw?.strengths),
    weaknesses: stringList(raw?.weaknesses),
    recommendations: stringList(raw?.recommendations),
    nextSteps: stringList(raw?.nextSteps),
    analysis: stringOrNull(raw?.analysis ?? raw?.summary),
    simulated: false,
  };
}

export interface GeneratedContent {
  content: string | null;
  simulated: boolean;
}

export interface InterviewQuestionSet {
  questions: string[];
  tips: string | null;
  answers: string[];
  simulated: boolean;
}

export interface InterviewAnswerFeedback {
  feedback: string | null;
  analysis: { rating: number | null; strengths: string[]; improvements: string[] };
  nextQuestion: string | null;
  simulated: boolean;
}

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

  /**
   * Every completion this service makes goes through here, for two reasons.
   *
   * The reply cap. Four call sites — the career path, both interview calls
   * and the post enrichment — set no max_tokens, so each ran as long as the
   * model chose to on the platform's key. A call site may still ask for less
   * than DEFAULT_MAX_TOKENS; none may leave it unset.
   *
   * The count. Nothing read `completion.usage`, so nothing could say what a
   * day of AI had cost or whose it was. It is recorded against the member the
   * call was made for (see ai-budget.service), which is also what the daily
   * budgets in front of the AI routes read.
   */
  private async complete(
    feature: string,
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
    meter?: AiMeter
  ): Promise<OpenAI.Chat.ChatCompletion> {
    if (!this.openai) {
      throw new Error(`AI service not configured for ${feature}.`);
    }
    const completion = await this.openai.chat.completions.create({
      ...params,
      max_tokens: Math.min(params.max_tokens ?? DEFAULT_MAX_TOKENS, DEFAULT_MAX_TOKENS),
    });
    await recordAiSpend(meter, feature, completion.usage);
    return completion;
  }

  async optimizeResume(resumeText: string, jobDescription?: string, meter?: AiMeter): Promise<ResumeAnalysis> {
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

      const completion = await this.complete(
        'resume_optimizer',
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          model: model,
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: DEFAULT_MAX_TOKENS,
        },
        meter
      );

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('No response from AI');

      return normaliseResumeAnalysis(JSON.parse(content));

    } catch (error) {
      logger.error('AI Resume Optimization failed:', error);
      throw error;
    }
  }

  async generateCareerPath(profileData: string, goal?: string, meter?: AiMeter): Promise<CareerPathPlan> {
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

      // The profile is assembled by the route from what she typed and what her
      // profile holds — a role title, her experience lines — so it is quoted
      // as data, the way the resume and the business idea already were.
      const userPrompt = [
        'Analyze this professional profile and provide career advancement recommendations.',
        asUntrustedBlock('profile', profileData, 6000),
        goal?.trim() ? asUntrustedBlock('specific goal', goal, 1000) : 'Specific goal: advancement in current field.',
        'Provide recommendations focusing on:\n1. Current career stage assessment\n2. 3 potential career paths with timelines\n3. Skills to develop for each path\n4. Recommended certifications',
      ].join('\n\n');

      const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';

      const completion = await this.complete(
        'career_path',
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          model: model,
          response_format: { type: 'json_object' },
          max_tokens: DEFAULT_MAX_TOKENS,
        },
        meter
      );

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('No response from AI');

      return normaliseCareerPath(JSON.parse(content));
    } catch (error) {
      logger.error('AI Career Path failed:', error);
      throw error;
    }
  }

  /**
   * The search-ranking score a post gets when no model read it.
   *
   * It was `parseInt(AI_SOCIAL_FALLBACK_SCORE, 10)` against a scale of 0-100,
   * while .env.example ships the value 0.5 — so every deployment copied from
   * the example indexed every unread post at 0, the bottom of the scale, and
   * the setting's own documentation was the thing breaking it. Both spellings
   * are now read the way an operator means them: a fraction up to 1 is a share
   * of 100, anything else is taken as a score, and the result is clamped.
   */
  private socialFallbackScore(): number {
    const raw = Number(process.env.AI_SOCIAL_FALLBACK_SCORE ?? '40');
    if (!Number.isFinite(raw) || raw < 0) return 40;
    const score = raw > 0 && raw <= 1 ? raw * 100 : raw;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /** The tag count the prompt asks for, as a bounded integer rather than raw env text. */
  private socialMaxTags(): number {
    const parsed = Number.parseInt(process.env.AI_SOCIAL_MAX_TAGS ?? '5', 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10) : 5;
  }

  async enrichSocialContent(content: string, mediaUrls?: string[]): Promise<any> {
    const fallback = () => ({
      qualityScore: this.socialFallbackScore(),
      tags: [] as string[],
      sentiment: 'neutral',
      isSafe: true,
    });

    if (process.env.AI_SOCIAL_CONTENT_ENABLED !== 'true') {
      return fallback();
    }

    if (!this.openai) {
      this.ensureOpenAI('social content enrichment');
      return fallback();
    }

    const maxTags = this.socialMaxTags();

    try {
        const systemPrompt = `You are a social media content moderator and strategist. Analyze this post content.
        Return a valid JSON object:
        {
            "qualityScore": number (0-100, based on engagement potential/clarity),
            "tags": ["tag1", "tag2"] (max ${maxTags} tags),
            "sentiment": "positive" | "negative" | "neutral",
            "isSafe": boolean (content moderation check)
        }`;

        // The post used to be pasted between two quotation marks, so a post
        // that closed the quote could write the rest of the prompt. It is
        // quoted as data like every other member-written field in this file.
        const userPrompt = [
          asUntrustedBlock('post', content, 8000),
          `Has media: ${mediaUrls?.length ? 'Yes' : 'No'}`,
        ].join('\n');
        const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';

        const completion = await this.complete('post_enrichment', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: model,
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: 200,
        });

        const result = completion.choices[0].message.content;
        if(!result) throw new Error("No AI response");

        // What comes back is written into the search index, so it is held to
        // the shape the index expects rather than passed through whole.
        const raw = JSON.parse(result);
        const sentiment = ['positive', 'negative', 'neutral'].includes(raw?.sentiment) ? raw.sentiment : 'neutral';
        return {
          qualityScore: scoreOrNull(raw?.qualityScore) ?? this.socialFallbackScore(),
          tags: stringList(raw?.tags).map((tag) => tag.slice(0, 50)).slice(0, maxTags),
          sentiment,
          isSafe: typeof raw?.isSafe === 'boolean' ? raw.isSafe : true,
        };
    } catch (error) {
        logger.error('AI Content Enrichment failed:', error);
        return fallback();
    }
  }

  /**
   * The kinds of interview the coach screen offers, plus the route's own
   * 'mixed' default. Spoken to the model as an instruction, so it is an
   * allowlist and never raw caller text.
   */
  static readonly INTERVIEW_TYPES = new Set(['behavioral', 'technical', 'case', 'situational', 'mixed']);

  async generateInterviewQuestions(
    jobDescription: string,
    type: string = 'mixed',
    meter?: AiMeter
  ): Promise<InterviewQuestionSet> {
    if (!this.openai) {
      this.ensureOpenAI('interview question generation');
        // Two questions that hold for any interview anywhere. They were being
        // returned unmarked beside the job title and employer name the route
        // adds, on a screen that sells "questions tailored to your target
        // role"; `simulated` is what stops that reading as tailoring.
        return {
            questions: [
                "Tell me about a time you faced a challenge.",
                "What are your strengths and weaknesses?"
            ],
            tips: "Use the STAR method: situation, task, action, result.",
            answers: [],
            simulated: true,
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

        const spokenType = AiService.INTERVIEW_TYPES.has(type) ? type : 'mixed';
        const userPrompt = [
          asUntrustedBlock('job description', jobDescription, 8000),
          `Interview type: ${spokenType}`,
        ].join('\n\n');
        const model = process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106';

        const completion = await this.complete(
          'interview_questions',
          {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: model,
            response_format: { type: 'json_object' },
            max_tokens: DEFAULT_MAX_TOKENS,
          },
          meter
        );

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No response");
        const raw = JSON.parse(content);
        return {
          questions: stringList(raw?.questions),
          tips: stringOrNull(raw?.tips),
          answers: stringList(raw?.answers),
          simulated: false,
        };
    } catch (err) {
        logger.error("Interview Coach AI failed", err);
        throw err;
    }
  }

  async evaluateInterviewAnswer(
    params: {
      question: string;
      answer: string;
      jobRole?: string;
      interviewType?: string;
      difficulty?: string;
    },
    meter?: AiMeter
  ): Promise<InterviewAnswerFeedback> {
    if (!this.openai) {
      this.ensureOpenAI('interview answer feedback');
      // The rating used to be 3, with "Answer submitted successfully" listed
      // as a strength of the answer. The screen draws the rating as three
      // filled stars out of five next to the words she typed, so a member
      // practising for a real interview was being graded by nothing at all.
      // Null rating, no strengths, no improvements: there is no assessment.
      return {
        feedback: null,
        analysis: { rating: null, strengths: [], improvements: [] },
        nextQuestion: null,
        simulated: true,
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

      // Her answer, the question it answers and the role she typed all come
      // from the browser, so each is quoted as data rather than spliced into
      // the instructions, and the two free-form labels are held to lists.
      const interviewType =
        params.interviewType && AiService.INTERVIEW_TYPES.has(params.interviewType) ? params.interviewType : 'mixed';
      const difficulty = ['entry', 'mid', 'senior', 'executive'].includes(params.difficulty ?? '')
        ? params.difficulty
        : 'mid';
      const userPrompt = [
        params.jobRole?.trim() ? asUntrustedBlock('job role', params.jobRole, 200) : 'Job role: not specified',
        `Interview type: ${interviewType}`,
        `Difficulty: ${difficulty}`,
        asUntrustedBlock('interview question', params.question, 2000),
        asUntrustedBlock('candidate answer', params.answer, 8000),
      ].join('\n\n');

      const completion = await this.complete(
        'interview_feedback',
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
          response_format: { type: 'json_object' },
          max_tokens: DEFAULT_MAX_TOKENS,
        },
        meter
      );

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      const raw = JSON.parse(content);
      // The prompt asks for 1-5, so this one is not clamped through
      // scoreOrNull; anything outside the band is the model ignoring the
      // instruction, and a rating nobody can place on the star row is worse
      // than no rating.
      const rating = Number(raw?.analysis?.rating);
      return {
        feedback: stringOrNull(raw?.feedback),
        analysis: {
          rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
          strengths: stringList(raw?.analysis?.strengths),
          improvements: stringList(raw?.analysis?.improvements),
        },
        nextQuestion: stringOrNull(raw?.nextQuestion),
        simulated: false,
      };
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
    context?: string,
    meter?: AiMeter
  ): Promise<GeneratedContent> {
     if (!this.openai) {
       this.ensureOpenAI('content generation');
       // The sentence that used to come back here — "Simulated content
       // generation response." — was rendered into the generator's output pane
       // and offered to the member with a copy button, indistinguishable from
       // a draft the model had written for her. No draft exists, so none is
       // returned, and `simulated` tells the screen to say why.
       return { content: null, simulated: true };
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

       const completion = await this.complete(
         'content_generator',
         {
           messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
           model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
           max_tokens: DEFAULT_MAX_TOKENS,
         },
         meter
       );
       return { content: stringOrNull(completion.choices[0]?.message?.content), simulated: false };
     } catch (e) {
       logger.error('AI Content Gen failed', e);
       throw e;
     }
  }

  /**
   * Two things were wrong here at once, and they compounded.
   *
   * The prompt was assembled by interpolating three variables of which two are
   * optional, so an idea submitted without a target market and a problem
   * statement — which is every submission the screen can make, because it has
   * no problem field — reached the model reading "Target: undefined\nProblem:
   * undefined". The parts are now assembled from what was actually supplied.
   *
   * And the completion asked for no JSON, so this returned prose. The screen's
   * scored view requires overallScore, marketPotential, feasibility,
   * competition and targetAudience before it will render, so roughly 280 lines
   * of viability dial, score tiles and SWOT panels were unreachable and every
   * member landed in the plain-text fallback. The model is now asked for the
   * object the screen was built for, and `analysis` still carries the prose so
   * a partial answer degrades to the fallback rather than to nothing.
   */
  async validateBusinessIdea(
    idea: string,
    targetMarket?: string,
    problemSolved?: string,
    category?: string,
    meter?: AiMeter
  ): Promise<IdeaValidation> {
    if (!this.openai) {
      this.ensureOpenAI('idea validation');
      return this.getSimulatedIdeaValidation();
    }

    try {
      const systemPrompt = `You are a startup advisor evaluating a business idea for a member of a women's professional platform in Queensland, Australia.
      Return a VALID JSON object with:
      {
        "overallScore": number (0-100 viability),
        "marketPotential": { "score": number (0-100), "analysis": "Why" },
        "feasibility": { "score": number (0-100), "analysis": "Why" },
        "competition": { "score": number (0-100, higher means a more favourable competitive position), "analysis": "Why", "competitors": ["Named competitor"] },
        "targetAudience": { "description": "Who this is for", "size": "Your best characterisation of how many they are", "demographics": ["Trait"] },
        "strengths": ["Strength"],
        "weaknesses": ["Weakness"],
        "recommendations": ["Recommendation"],
        "nextSteps": ["Step"],
        "analysis": "A short prose summary of the whole assessment"
      }
      Omit any field you cannot answer from what you were given. Do not invent a competitor, a market size or a statistic to fill a field.`;

      const parts = [
        asUntrustedBlock('business idea', idea, 6000),
        targetMarket?.trim() ? asUntrustedBlock('target market', targetMarket, 2000) : '',
        problemSolved?.trim() ? asUntrustedBlock('problem it solves', problemSolved, 4000) : '',
        category?.trim() ? asUntrustedBlock('idea category', category, 200) : '',
      ];

      const completion = await this.complete(
        'idea_validator',
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: parts.filter(Boolean).join('\n\n') },
          ],
          model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
          response_format: { type: 'json_object' },
          max_tokens: DEFAULT_MAX_TOKENS,
        },
        meter
      );

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      return normaliseIdeaValidation(JSON.parse(content));
    } catch (e) {
        logger.error('AI Idea Validation failed', e);
        throw e;
    }
  }

  /**
   * It used to be the single sentence "Simulated idea validation response.",
   * which the screen rendered into its analysis panel as though a startup
   * advisor had written it. Nothing is scored here because nothing was read.
   */
  private getSimulatedIdeaValidation(): IdeaValidation {
    return {
      overallScore: null,
      marketPotential: null,
      feasibility: null,
      competition: null,
      targetAudience: null,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      nextSteps: [],
      analysis: null,
      simulated: true,
    };
  }

  async chat(message: string, history: unknown[] = [], meter?: AiMeter): Promise<string> {
     if (!this.openai) {
       this.ensureOpenAI('chat');
       return "I am ATHENA (Simulated). How can I help?";
     }
     
     try {
         // The prompt used to be the first sentence alone. On a platform whose
         // members include women living with violence, a general-purpose model
         // told only to be "supportive but professional" will happily hold a
         // conversation about self-harm, hand out legal and medical opinions,
         // and invent a helpline number that rings nobody. The route screens
         // the message before it ever reaches here and answers a crisis itself
         // (see ai-safety.service), so what these lines do is cover everything
         // the screen lets through: they keep the model inside what it is, and
         // they forbid it from producing contact details of its own, because a
         // wrong number given to a frightened woman is worse than no number.
         const systemPrompt = [
           'You are ATHENA, an AI career assistant designed to empower women in their professional journeys. Be supportive but professional.',
           'You are not a counsellor, doctor, lawyer or financial adviser. Do not diagnose, do not give medical, legal or financial advice, and say plainly when something needs a qualified person.',
           'If someone describes self-harm, abuse or being unsafe, do not counsel her and do not talk her through it. Say that you are an automated assistant, that this needs a real person, and point her to the crisis lines shown beneath this chat.',
           'Never invent a phone number, an organisation, a web address or a statistic. If you do not know, say so.',
         ].join(' ');
         // The previous version defaulted a missing role to 'user' but passed a
         // supplied one through untouched, so a caller could send role 'system'
         // and replace the prompt above. sanitizeChatHistory drops anything
         // that is not a well-formed user/assistant turn.
         const validHistory = sanitizeChatHistory(history);

         const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
             { role: 'system', content: systemPrompt },
             ...validHistory,
             { role: 'user', content: truncate(message, 8000) }
         ];

         const completion = await this.complete(
           'chat',
           {
             messages,
             model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
             max_tokens: DEFAULT_MAX_TOKENS,
           },
           meter
         );
         return completion.choices[0]?.message?.content || '';
     } catch (e) {
         logger.error('AI Chat failed', e);
         throw e;
     }
  }

  /**
   * Null means "no AI reading exists", and the caller keeps whatever heuristic
   * it already had. The previous version answered three ways when it could not
   * run, all of them fabrications: a 75% with "Skill A" missing when
   * simulating, a thrown error in production without a key (taking the whole
   * recommendations request down with it), and a score of 0 on failure, which
   * reads as "you are not a match" when the truth is "nothing was evaluated".
   */
  async evaluateJobMatch(
    userProfile: string,
    jobDescription: string,
    meter?: AiMeter
  ): Promise<{ score: number | null; analysis: string | null; missingSkills: string[] } | null> {
    if (!this.openai) {
      return null;
    }

    try {
        const systemPrompt = "You are a recruiter. Evaluate the match between a candidate and a job. Return JSON: { score: 0-100, analysis: string, missingSkills: string[] }";
        const parts = [
          asUntrustedBlock('candidate profile', userProfile, 6000),
          asUntrustedBlock('job description', jobDescription, 8000),
        ];

        const completion = await this.complete(
          'job_match',
          {
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: parts.join('\n\n') }],
            model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-3.5-turbo-1106',
            response_format: { type: 'json_object' },
            max_tokens: DEFAULT_MAX_TOKENS,
          },
          meter
        );
        const raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
        const score = Number(raw?.score);

        return {
          score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
          analysis: stringOrNull(raw?.analysis),
          missingSkills: stringList(raw?.missingSkills),
        };
    } catch (e) {
        logger.error('AI Job Match failed', e);
        return null;
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

  /**
   * What comes back when no model is configured, and the twin of
   * getSimulatedResumeResponse above.
   *
   * It used to return a plan: "Mid-Level Professional" advancing to "Senior
   * Manager", 65% ready, two dated milestones, and "Senior Developer" and
   * "Tech Lead" as her recommended next roles — for every member, whatever she
   * had typed, with no simulated flag anywhere in the object for the screen to
   * notice. The resume path had already been rewritten to say nothing rather
   * than invent a reading; this one was left behind and kept fabricating a
   * career for women who were asked to plan around it.
   *
   * Nothing here is a judgement of her, because nothing judged her. The screen
   * reads `simulated` and says so.
   */
  private getSimulatedCareerPathResponse(): CareerPathPlan {
    return {
      currentLevel: null,
      targetLevel: null,
      matchScore: null,
      milestones: [],
      recommendedRoles: [],
      learningPath: [],
      careerAdvice: null,
      simulated: true,
    };
  }
}

export const aiService = new AiService();
