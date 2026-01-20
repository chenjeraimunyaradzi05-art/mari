/**
 * AI Concierge Service
 * Intelligent assistant for career coaching, FAQ handling, and proactive guidance
 */

import OpenAI from 'openai';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// Initialize OpenAI client (optional - will skip AI features if not configured)
const apiKey = process.env.AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export interface ConciergeContext {
  userId: string;
  persona?: string;
  recentActions?: string[];
  currentPage?: string;
}

export interface ConciergeResponse {
  message: string;
  suggestions?: string[];
  actions?: ConciergeAction[];
  quickReplies?: string[];
}

export interface ConciergeAction {
  type: 'navigate' | 'apply' | 'save' | 'schedule' | 'learn' | 'connect';
  label: string;
  target: string;
  metadata?: Record<string, any>;
}

// FAQ Knowledge Base for instant responses
const FAQ_KNOWLEDGE_BASE: Record<string, string> = {
  'how to update resume': 'Go to Dashboard → AI Tools → Resume Optimizer. Upload your current resume and target job description for AI-powered suggestions.',
  'find mentors': 'Visit the Mentors section in your dashboard. You can filter by specialization, rate, and availability. Premium members get priority booking.',
  'job alerts': 'Set up job alerts in Dashboard → Settings → Notifications. Enable "Job Match" notifications for personalized alerts.',
  'premium benefits': 'Premium includes: Unlimited AI tools, Priority mentor booking, Advanced job matching, Resume optimization, Interview coaching, and more.',
  'cancel subscription': 'Go to Dashboard → Settings → Billing to manage your subscription. You can cancel anytime and retain access until the billing period ends.',
  'privacy settings': 'Visit Safety Center to manage privacy controls, DV-safe mode, profile visibility, and data preferences.',
  'verification badge': 'Apply for verification at Dashboard → Settings → Verification. You can verify your identity, employer, or professional credentials.',
  'delete account': 'Go to Settings → Privacy → Delete Account. Your data will be permanently removed within 30 days per our privacy policy.',
};

/**
 * Main concierge chat handler with context-aware responses
 */
export async function chat(
  message: string,
  context: ConciergeContext,
  history: Array<{ role: string; content: string }> = []
): Promise<ConciergeResponse> {
  const lowerMessage = message.toLowerCase();

  // Check for FAQ matches first (instant response)
  const faqResponse = checkFAQ(lowerMessage);
  if (faqResponse) {
    return {
      message: faqResponse,
      quickReplies: ['Tell me more', 'Something else', 'Talk to support'],
    };
  }

  // Get user context for personalization
  const userContext = await getUserContext(context.userId);

  // Build system prompt with context
  const systemPrompt = buildSystemPrompt(userContext, context);

  try {
    if (!openai || !openai.apiKey) {
      return getSimulatedResponse(message, userContext);
    }

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      messages,
      model: process.env.AI_OPENAI_CHAT_MODEL || 'gpt-4-turbo-preview',
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Generate contextual actions and suggestions
    const actions = generateActions(message, userContext);
    const suggestions = generateSuggestions(userContext, context);

    return {
      message: responseText,
      suggestions,
      actions,
      quickReplies: generateQuickReplies(message),
    };
  } catch (error) {
    logger.error('Concierge chat error:', error);
    return getSimulatedResponse(message, userContext);
  }
}

/**
 * Proactive suggestions based on user activity
 */
export async function getProactiveSuggestions(
  userId: string
): Promise<ConciergeResponse> {
  const userContext = await getUserContext(userId);
  const suggestions: string[] = [];
  const actions: ConciergeAction[] = [];

  // Profile completeness check
  if (userContext.profileCompleteness < 80) {
    suggestions.push('Complete your profile to improve job matching by up to 40%');
    actions.push({
      type: 'navigate',
      label: 'Complete Profile',
      target: '/dashboard/profile/edit',
    });
  }

  // Skills update check
  if (userContext.lastSkillUpdate && daysSince(userContext.lastSkillUpdate) > 90) {
    suggestions.push('Update your skills to get better job recommendations');
    actions.push({
      type: 'navigate',
      label: 'Update Skills',
      target: '/dashboard/profile/skills',
    });
  }

  // Job application follow-ups
  if (userContext.pendingApplications > 0) {
    suggestions.push(`You have ${userContext.pendingApplications} pending applications. Follow up to increase your chances!`);
  }

  // Learning recommendations
  if (userContext.skillGaps.length > 0) {
    const topGap = userContext.skillGaps[0];
    suggestions.push(`Learning ${topGap} could open up 25% more opportunities for you`);
    actions.push({
      type: 'learn',
      label: `Learn ${topGap}`,
      target: `/dashboard/learn?skill=${encodeURIComponent(topGap)}`,
    });
  }

  // Mentor recommendation
  if (!userContext.hasMentor && userContext.persona === 'EARLY_CAREER') {
    suggestions.push('Connect with a mentor to accelerate your career growth');
    actions.push({
      type: 'connect',
      label: 'Find a Mentor',
      target: '/dashboard/mentors',
    });
  }

  return {
    message: suggestions.length > 0
      ? `Here are some suggestions to boost your career:`
      : `You're on track! Keep up the great work.`,
    suggestions,
    actions,
  };
}

/**
 * Handle specific intents
 */
export async function handleIntent(
  intent: string,
  params: Record<string, any>,
  userId: string
): Promise<ConciergeResponse> {
  switch (intent) {
    case 'find_jobs':
      return {
        message: 'I found some great opportunities matching your profile!',
        actions: [
          { type: 'navigate', label: 'View Jobs', target: '/dashboard/jobs' },
          { type: 'navigate', label: 'Use AI Radar', target: '/dashboard/ai/opportunity-radar' },
        ],
      };

    case 'schedule_mentor':
      return {
        message: 'Let me help you schedule a mentorship session.',
        actions: [
          { type: 'navigate', label: 'Browse Mentors', target: '/dashboard/mentors' },
          { type: 'schedule', label: 'Quick Book', target: '/dashboard/mentors?quickbook=true' },
        ],
      };

    case 'improve_resume':
      return {
        message: 'I can help optimize your resume for better results!',
        actions: [
          { type: 'navigate', label: 'Resume Optimizer', target: '/dashboard/ai/resume-optimizer' },
        ],
      };

    case 'safety_help':
      return {
        message: 'Your safety is our priority. Let me guide you to our safety resources.',
        actions: [
          { type: 'navigate', label: 'Safety Center', target: '/safety-center' },
        ],
        quickReplies: ['Enable Safe Mode', 'Report Concern', 'Privacy Settings'],
      };

    default:
      return {
        message: 'I\'m here to help! What would you like to do?',
        quickReplies: ['Find Jobs', 'Update Resume', 'Find Mentors', 'Learn Skills'],
      };
  }
}

// Helper functions

function checkFAQ(message: string): string | null {
  for (const [key, value] of Object.entries(FAQ_KNOWLEDGE_BASE)) {
    if (message.includes(key)) {
      return value;
    }
  }
  return null;
}

async function getUserContext(userId: string) {
  try {
    const [user, applications, skills] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          skills: { include: { skill: true } },
          experience: true,
          mentorProfile: true,
        },
      }),
      prisma.jobApplication.count({
        where: { userId, status: 'PENDING' },
      }),
      prisma.userSkill.findMany({
        where: { userId },
        take: 1,
      }),
    ]);

    // Calculate profile completeness
    let completeness = 50;
    if ((user?.profile as any)?.aboutMe) completeness += 10;
    if (user?.headline) completeness += 10;
    if (user?.avatar) completeness += 10;
    if ((user?.skills?.length || 0) >= 5) completeness += 10;
    if ((user?.experience?.length || 0) >= 1) completeness += 10;

    return {
      name: user?.displayName || user?.firstName || 'there',
      persona: user?.persona || 'EARLY_CAREER',
      headline: user?.headline,
      skillCount: user?.skills?.length || 0,
      experienceCount: user?.experience?.length || 0,
      profileCompleteness: Math.min(completeness, 100),
      pendingApplications: applications,
      hasMentor: !!user?.mentorProfile,
      lastSkillUpdate: user?.updatedAt || null,
      skillGaps: ['Data Analysis', 'Leadership', 'Project Management'], // Would be calculated from job matches
      isPremium: false, // Would check subscription
    };
  } catch (error) {
    logger.error('Error getting user context:', error);
    return {
      name: 'there',
      persona: 'EARLY_CAREER',
      profileCompleteness: 50,
      pendingApplications: 0,
      hasMentor: false,
      skillGaps: [],
      isPremium: false,
    };
  }
}

function buildSystemPrompt(userContext: any, context: ConciergeContext): string {
  return `You are ATHENA, an AI career concierge designed specifically to empower women in their professional journeys. 

USER CONTEXT:
- Name: ${userContext.name}
- Career Stage: ${userContext.persona}
- Profile Completeness: ${userContext.profileCompleteness}%
- Current Skills: ${userContext.skillCount} skills listed
- Pending Applications: ${userContext.pendingApplications}
${context.currentPage ? `- Currently viewing: ${context.currentPage}` : ''}

PERSONALITY:
- Supportive, encouraging, and professional
- Proactive in offering relevant suggestions
- Focus on actionable advice
- Celebrate wins and provide encouragement
- Be concise but warm

CAPABILITIES:
- Career advice and guidance
- Job search strategies
- Resume and interview tips
- Skill development recommendations
- Platform navigation help
- Safety and privacy guidance

Always prioritize the user's wellbeing and career growth. If discussing sensitive topics, be extra supportive and guide to appropriate resources.`;
}

function generateActions(message: string, userContext: any): ConciergeAction[] {
  const actions: ConciergeAction[] = [];
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('job') || lowerMessage.includes('work') || lowerMessage.includes('opportunity')) {
    actions.push({
      type: 'navigate',
      label: 'Search Jobs',
      target: '/dashboard/jobs',
    });
  }

  if (lowerMessage.includes('resume') || lowerMessage.includes('cv')) {
    actions.push({
      type: 'navigate',
      label: 'Optimize Resume',
      target: '/dashboard/ai/resume-optimizer',
    });
  }

  if (lowerMessage.includes('mentor') || lowerMessage.includes('advice') || lowerMessage.includes('guidance')) {
    actions.push({
      type: 'connect',
      label: 'Find Mentors',
      target: '/dashboard/mentors',
    });
  }

  if (lowerMessage.includes('interview')) {
    actions.push({
      type: 'navigate',
      label: 'Interview Coach',
      target: '/dashboard/ai/interview-coach',
    });
  }

  if (lowerMessage.includes('learn') || lowerMessage.includes('course') || lowerMessage.includes('skill')) {
    actions.push({
      type: 'learn',
      label: 'Browse Courses',
      target: '/dashboard/learn',
    });
  }

  return actions;
}

function generateSuggestions(userContext: any, context: ConciergeContext): string[] {
  const suggestions: string[] = [];

  if (userContext.profileCompleteness < 80) {
    suggestions.push('Complete your profile for better job matches');
  }

  if (userContext.pendingApplications > 0) {
    suggestions.push('Follow up on your pending applications');
  }

  return suggestions;
}

function generateQuickReplies(message: string): string[] {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('job')) {
    return ['Show me more jobs', 'Set up job alerts', 'Optimize my resume'];
  }

  if (lowerMessage.includes('mentor')) {
    return ['Browse mentors', 'Book a session', 'Learn about mentorship'];
  }

  if (lowerMessage.includes('resume')) {
    return ['Analyze my resume', 'Download template', 'See examples'];
  }

  return ['Find jobs', 'Get career advice', 'Learn new skills', 'Browse mentors'];
}

function getSimulatedResponse(message: string, userContext: any): ConciergeResponse {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('job') || lowerMessage.includes('work')) {
    return {
      message: `Hi ${userContext.name}! Based on your profile, I can help you find great opportunities. Would you like me to scan for jobs matching your skills, or would you prefer to use our AI-powered Opportunity Radar for more personalized results?`,
      actions: [
        { type: 'navigate', label: 'Search Jobs', target: '/dashboard/jobs' },
        { type: 'navigate', label: 'AI Opportunity Radar', target: '/dashboard/ai/opportunity-radar' },
      ],
      quickReplies: ['Show me matching jobs', 'Set up alerts', 'Update my preferences'],
    };
  }

  if (lowerMessage.includes('mentor')) {
    return {
      message: `I'd be happy to help you connect with a mentor! We have experienced professionals across various fields. What area would you like mentorship in?`,
      actions: [
        { type: 'connect', label: 'Browse Mentors', target: '/dashboard/mentors' },
      ],
      quickReplies: ['Career development', 'Technical skills', 'Leadership', 'Entrepreneurship'],
    };
  }

  if (lowerMessage.includes('resume') || lowerMessage.includes('cv')) {
    return {
      message: `Great question! Our AI Resume Optimizer can analyze your resume and provide tailored suggestions to help you stand out. Would you like to get started?`,
      actions: [
        { type: 'navigate', label: 'Optimize Resume', target: '/dashboard/ai/resume-optimizer' },
      ],
      quickReplies: ['Analyze my resume', 'See tips', 'Download templates'],
    };
  }

  return {
    message: `Hi ${userContext.name}! I'm ATHENA, your AI career concierge. I'm here to help you with job searching, resume optimization, finding mentors, or anything else to advance your career. What would you like help with today?`,
    quickReplies: ['Find jobs', 'Optimize resume', 'Find mentors', 'Career advice'],
  };
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Search FAQ knowledge base
 */
export function searchFAQ(query: string): Array<{ question: string; answer: string }> {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ question: string; answer: string; score: number }> = [];

  for (const [key, answer] of Object.entries(FAQ_KNOWLEDGE_BASE)) {
    const words = lowerQuery.split(/\s+/);
    const matches = words.filter(w => key.includes(w) || answer.toLowerCase().includes(w)).length;
    if (matches > 0) {
      results.push({
        question: key,
        answer,
        score: matches / words.length,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ question, answer }) => ({ question, answer }));
}

/**
 * Get personalized onboarding steps based on user profile
 */
export async function getOnboardingSteps(userId: string): Promise<Array<{
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action: string;
  priority: number;
}>> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        skills: true,
      },
    });

    if (!user) {
      return [];
    }

    const profile = user.profile as any;
    const steps = [];

    // Check profile completion
    if (!profile?.headline || !profile?.bio) {
      steps.push({
        id: 'complete-profile',
        title: 'Complete Your Profile',
        description: 'Add a headline and bio to make your profile stand out',
        completed: false,
        action: '/dashboard/profile/edit',
        priority: 1,
      });
    } else {
      steps.push({
        id: 'complete-profile',
        title: 'Complete Your Profile',
        description: 'Your profile is looking great!',
        completed: true,
        action: '/dashboard/profile/edit',
        priority: 1,
      });
    }

    // Check skills
    if (!user.skills || user.skills.length < 3) {
      steps.push({
        id: 'add-skills',
        title: 'Add Your Skills',
        description: 'Add at least 3 skills to improve job matching',
        completed: false,
        action: '/dashboard/profile/skills',
        priority: 2,
      });
    } else {
      steps.push({
        id: 'add-skills',
        title: 'Add Your Skills',
        description: `You have ${user.skills.length} skills listed`,
        completed: true,
        action: '/dashboard/profile/skills',
        priority: 2,
      });
    }

    // Check resume
    if (!profile?.resumeUrl) {
      steps.push({
        id: 'upload-resume',
        title: 'Upload Your Resume',
        description: 'Upload your resume for AI-powered optimization',
        completed: false,
        action: '/dashboard/ai/resume-optimizer',
        priority: 3,
      });
    } else {
      steps.push({
        id: 'upload-resume',
        title: 'Upload Your Resume',
        description: 'Resume uploaded and ready for optimization',
        completed: true,
        action: '/dashboard/ai/resume-optimizer',
        priority: 3,
      });
    }

    // Set job preferences
    steps.push({
      id: 'set-preferences',
      title: 'Set Job Preferences',
      description: 'Tell us what kind of opportunities you\'re looking for',
      completed: !!profile?.jobPreferences,
      action: '/dashboard/settings/job-preferences',
      priority: 4,
    });

    // Explore features
    steps.push({
      id: 'explore-features',
      title: 'Explore ATHENA Features',
      description: 'Discover AI tools, mentors, and learning opportunities',
      completed: false,
      action: '/dashboard/discover',
      priority: 5,
    });

    return steps.sort((a, b) => a.priority - b.priority);
  } catch (error) {
    logger.error('Failed to get onboarding steps', { error, userId });
    return [];
  }
}

