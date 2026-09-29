/**
 * Plain-text copies of what ATHENA's AI tools write, for a member to keep.
 *
 * Nothing these tools produce is stored on ATHENA's side: a career plan, an
 * idea assessment, a practice interview or a draft post exists in the page and
 * nowhere else, and is gone when she leaves it. Until there is somewhere on the
 * server to keep them, the honest thing the page can do is hand her the text.
 * The copy is built here, in her browser, and saved to her device; nothing
 * about it is sent anywhere.
 *
 * Plain text rather than JSON, because the reader is her and not a program, and
 * because a text file opens on every phone and laptop she might use. The file
 * names carry the tool and the date and nothing she typed, since a downloads
 * folder is visible to anyone who picks the device up.
 */

export type CopyKind = 'career-plan' | 'idea-assessment' | 'interview-practice' | 'draft' | 'resume-review';

const HEADINGS: Record<CopyKind, string> = {
  'career-plan': 'Career path plan',
  'idea-assessment': 'Idea assessment',
  'interview-practice': 'Interview practice',
  draft: 'Draft',
  'resume-review': 'Résumé review',
};

function isoDate(when: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

function longDate(when: Date): string {
  return when.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** `athena-career-plan-2026-09-26.txt`: the tool and the day, and nothing she wrote. */
export function copyFilename(kind: CopyKind, when: Date = new Date()): string {
  return `athena-${kind}-${isoDate(when)}.txt`;
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const list = (items: ReadonlyArray<unknown> | null | undefined): string[] =>
  (items ?? []).map(clean).filter((item) => item !== '');

/**
 * A document from sections. A section with no lines is left out entirely, so a
 * field the model did not fill never becomes a heading over nothing.
 */
function document(kind: CopyKind, when: Date, sections: Array<{ heading?: string; lines: string[] }>): string {
  const header = [
    `ATHENA · ${HEADINGS[kind]}`,
    `Saved ${longDate(when)}`,
    '',
    'Written by an AI model from what you gave it. It can be wrong: treat it as a',
    'starting point, not advice. ATHENA does not keep a copy; this file is the only one.',
  ];

  const body = sections
    .filter((section) => section.lines.length > 0)
    .map((section) => (section.heading ? [section.heading, '-'.repeat(section.heading.length), ...section.lines] : section.lines).join('\n'));

  return [header.join('\n'), ...body].join('\n\n') + '\n';
}

const bullets = (items: string[]): string[] => items.map((item) => `• ${item}`);

// ----------------------------------------------------------------- career plan

export interface CareerPlanCopy {
  from: string;
  to: string;
  milestones: Array<{
    title: string;
    level?: string;
    timeline?: string;
    description?: string;
    skills?: string[];
    requirements?: string[];
  }>;
  /** The model's own readiness estimate, when it gave one. */
  readiness: number | null;
  recommendedRoles: string[];
  learningPath: string[];
  careerAdvice: string | null;
}

export function careerPlanCopy(plan: CareerPlanCopy, when: Date = new Date()): string {
  const steps = plan.milestones.flatMap((milestone, index) => {
    const lines = [`${index + 1}. ${clean(milestone.title) || `Step ${index + 1}`}`];
    const timing = [clean(milestone.level), clean(milestone.timeline)].filter(Boolean);
    // The page's own placeholder for a missing timeline is not something the
    // model said, so it is not written into her copy as though it were.
    const said = timing.filter((part) => part !== 'Timeline not estimated');
    if (said.length) lines.push(`   When: ${Array.from(new Set(said)).join(' · ')}`);
    if (clean(milestone.description)) lines.push(`   ${clean(milestone.description)}`);
    const skills = list(milestone.skills);
    if (skills.length) lines.push(`   Skills: ${skills.join(', ')}`);
    const requirements = list(milestone.requirements);
    if (requirements.length) lines.push(...requirements.map((item) => `   - ${item}`));
    return [...lines, ''];
  });
  if (steps.length) steps.pop();

  return document('career-plan', when, [
    {
      lines: [
        `From: ${clean(plan.from) || 'Not given'}`,
        `To: ${clean(plan.to) || 'Not given'}`,
        plan.readiness !== null ? `Readiness, as the model judged it: ${plan.readiness}%` : 'The model gave no readiness estimate.',
      ],
    },
    { heading: 'Steps', lines: steps },
    { heading: 'Advice', lines: clean(plan.careerAdvice) ? [clean(plan.careerAdvice)] : [] },
    { heading: 'Roles to look at', lines: bullets(list(plan.recommendedRoles)) },
    { heading: 'What to learn', lines: bullets(list(plan.learningPath)) },
  ]);
}

// ------------------------------------------------------------ idea assessment

export interface IdeaAssessmentCopy {
  idea: string;
  category: string;
  targetMarket: string;
  result: {
    analysis?: string | null;
    overallScore?: number | null;
    marketPotential?: { score?: number | null; analysis?: string | null } | null;
    feasibility?: { score?: number | null; analysis?: string | null } | null;
    competition?: { score?: number | null; analysis?: string | null; competitors?: string[] | null } | null;
    targetAudience?: { description?: string | null; size?: string | null; demographics?: string[] | null } | null;
    strengths?: string[] | null;
    weaknesses?: string[] | null;
    recommendations?: string[] | null;
    nextSteps?: string[] | null;
  };
}

const scoreLine = (label: string, score: number | null | undefined): string[] =>
  typeof score === 'number' && Number.isFinite(score) ? [`${label}: ${score}/100`] : [];

export function ideaAssessmentCopy(input: IdeaAssessmentCopy, when: Date = new Date()): string {
  const { result } = input;
  const competitors = list(result.competition?.competitors);
  const demographics = list(result.targetAudience?.demographics);

  return document('idea-assessment', when, [
    {
      heading: 'Your idea',
      lines: [
        clean(input.idea),
        ...(clean(input.category) ? [`Category: ${clean(input.category)}`] : []),
        ...(clean(input.targetMarket) ? [`Target market: ${clean(input.targetMarket)}`] : []),
      ],
    },
    {
      heading: 'Scores, as the model gave them',
      lines: [
        ...scoreLine('Overall', result.overallScore),
        ...scoreLine('Market potential', result.marketPotential?.score),
        ...scoreLine('Feasibility', result.feasibility?.score),
        ...scoreLine('Competition', result.competition?.score),
      ],
    },
    { heading: 'Analysis', lines: clean(result.analysis) ? [clean(result.analysis)] : [] },
    { heading: 'Market', lines: clean(result.marketPotential?.analysis) ? [clean(result.marketPotential?.analysis)] : [] },
    { heading: 'Feasibility', lines: clean(result.feasibility?.analysis) ? [clean(result.feasibility?.analysis)] : [] },
    {
      heading: 'Competition',
      lines: [
        ...(clean(result.competition?.analysis) ? [clean(result.competition?.analysis)] : []),
        ...(competitors.length ? [`Named: ${competitors.join(', ')}`] : []),
      ],
    },
    {
      heading: 'Who it is for',
      lines: [
        ...(clean(result.targetAudience?.description) ? [clean(result.targetAudience?.description)] : []),
        ...(clean(result.targetAudience?.size) ? [`Size: ${clean(result.targetAudience?.size)}`] : []),
        ...(demographics.length ? [`Groups: ${demographics.join(', ')}`] : []),
      ],
    },
    { heading: 'Strengths', lines: bullets(list(result.strengths)) },
    { heading: 'Weaknesses', lines: bullets(list(result.weaknesses)) },
    { heading: 'Recommendations', lines: bullets(list(result.recommendations)) },
    { heading: 'Next steps', lines: bullets(list(result.nextSteps)) },
  ]);
}

// --------------------------------------------------------- interview practice

export interface InterviewPracticeCopy {
  role: string;
  interviewType: string;
  level: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    feedback?: { rating: number | null; strengths: string[]; improvements: string[] };
  }>;
}

export function interviewPracticeCopy(session: InterviewPracticeCopy, when: Date = new Date()): string {
  const transcript = session.messages.flatMap((message) => {
    const content = clean(message.content);
    if (message.role === 'system') return content ? [`[${content}]`, ''] : [];
    const lines = [`${message.role === 'user' ? 'You' : 'Coach'}: ${content}`];
    if (message.feedback) {
      lines.push(
        typeof message.feedback.rating === 'number'
          ? `   Rating: ${message.feedback.rating} out of 5`
          : '   The coach did not rate this answer.'
      );
      const strengths = list(message.feedback.strengths);
      const improvements = list(message.feedback.improvements);
      if (strengths.length) lines.push('   Strengths:', ...strengths.map((item) => `   • ${item}`));
      if (improvements.length) lines.push('   To improve:', ...improvements.map((item) => `   • ${item}`));
    }
    return [...lines, ''];
  });
  if (transcript.length) transcript.pop();

  return document('interview-practice', when, [
    {
      lines: [
        `Role: ${clean(session.role) || 'Not given'}`,
        ...(clean(session.interviewType) ? [`Interview: ${clean(session.interviewType)}`] : []),
        ...(clean(session.level) ? [`Level: ${clean(session.level)}`] : []),
      ],
    },
    { heading: 'Transcript', lines: transcript },
  ]);
}

// --------------------------------------------------------------- résumé review

export interface ResumeReviewCopy {
  score: number | null;
  strengths: string | null;
  weaknesses: string | null;
  improvements: Array<{ section: string | null; suggestion: string }>;
  keywordsMatched: string[];
  keywordsMissing: string[];
  targetJob?: string | null;
}

/**
 * The review, not the résumé. She has her résumé; a copy of it in a second
 * file is one more place her work history sits on the device.
 */
export function resumeReviewCopy(review: ResumeReviewCopy, when: Date = new Date()): string {
  const improvements = review.improvements
    .map((item) => {
      const suggestion = clean(item.suggestion);
      if (!suggestion) return '';
      return clean(item.section) ? `• ${clean(item.section)}: ${suggestion}` : `• ${suggestion}`;
    })
    .filter(Boolean);
  const matched = list(review.keywordsMatched);
  const missing = list(review.keywordsMissing);

  return document('resume-review', when, [
    {
      lines: [
        ...(clean(review.targetJob) ? [`Reviewed against: ${clean(review.targetJob)}`] : []),
        typeof review.score === 'number' && Number.isFinite(review.score)
          ? `Score, as the model gave it: ${review.score}/100`
          : 'The model gave no score.',
      ],
    },
    { heading: 'Strengths', lines: clean(review.strengths) ? [clean(review.strengths)] : [] },
    { heading: 'Weaknesses', lines: clean(review.weaknesses) ? [clean(review.weaknesses)] : [] },
    { heading: 'Improvements', lines: improvements },
    {
      heading: 'Keywords',
      lines: [
        ...(matched.length ? [`Found: ${matched.join(', ')}`] : []),
        ...(missing.length ? [`Missing: ${missing.join(', ')}`] : []),
      ],
    },
  ]);
}

// ---------------------------------------------------------------------- draft

export interface DraftCopy {
  contentType: string;
  platform?: string | null;
  tone?: string | null;
  topic: string;
  content: string;
}

export function draftCopy(draft: DraftCopy, when: Date = new Date()): string {
  return document('draft', when, [
    {
      lines: [
        `Topic: ${clean(draft.topic) || 'Not given'}`,
        ...(clean(draft.contentType) ? [`Kind: ${clean(draft.contentType)}`] : []),
        ...(clean(draft.platform) ? [`For: ${clean(draft.platform)}`] : []),
        ...(clean(draft.tone) ? [`Tone: ${clean(draft.tone)}`] : []),
      ],
    },
    { heading: 'Draft', lines: clean(draft.content) ? [clean(draft.content)] : [] },
  ]);
}
