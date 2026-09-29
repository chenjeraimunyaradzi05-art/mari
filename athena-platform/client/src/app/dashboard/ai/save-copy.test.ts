import {
  careerPlanCopy,
  copyFilename,
  draftCopy,
  ideaAssessmentCopy,
  interviewPracticeCopy,
  resumeReviewCopy,
} from './save-copy';

/**
 * ATHENA keeps nothing its AI tools write, so the copy a member saves is the
 * only one there is. These hold it to three things: it says what the text is
 * and that nobody else has it, it prints what the model said and nothing the
 * page made up to fill a gap, and its file name gives nothing away about her.
 */

const WHEN = new Date(2026, 8, 26, 14, 30);

describe('copyFilename', () => {
  it('names the tool and the day, and nothing she typed', () => {
    expect(copyFilename('career-plan', WHEN)).toBe('athena-career-plan-2026-09-26.txt');
    expect(copyFilename('interview-practice', WHEN)).toBe('athena-interview-practice-2026-09-26.txt');
  });
});

describe('every copy', () => {
  it('says it was written by a model and that ATHENA holds no other copy', () => {
    const text = draftCopy({ contentType: 'LinkedIn Post', topic: 'Returning to work', content: 'Hello.' }, WHEN);
    expect(text).toMatch(/^ATHENA · Draft\nSaved 26 September 2026/);
    expect(text).toContain('Written by an AI model');
    expect(text).toContain('ATHENA does not keep a copy; this file is the only one.');
  });
});

describe('careerPlanCopy', () => {
  const plan = {
    from: 'Data Analyst',
    to: 'Analytics Lead',
    milestones: [
      {
        title: 'Own a reporting stream',
        level: '0-6 months',
        timeline: '0-6 months',
        description: 'Take one report end to end.',
        skills: ['SQL', 'Stakeholder management'],
        requirements: [],
      },
      { title: 'Lead a small team', level: 'Next step', timeline: 'Timeline not estimated', description: '', skills: [], requirements: ['Supervise two analysts'] },
    ],
    readiness: null,
    recommendedRoles: ['Analytics Lead'],
    learningPath: [],
    careerAdvice: 'Put your name on the reports you already carry.',
  };

  it('carries the steps, the advice and the roles', () => {
    const text = careerPlanCopy(plan, WHEN);
    expect(text).toContain('From: Data Analyst\nTo: Analytics Lead');
    expect(text).toContain('1. Own a reporting stream\n   When: 0-6 months\n   Take one report end to end.\n   Skills: SQL, Stakeholder management');
    expect(text).toContain('2. Lead a small team\n   When: Next step\n   - Supervise two analysts');
    expect(text).toContain('Advice\n------\nPut your name on the reports you already carry.');
    expect(text).toContain('• Analytics Lead');
  });

  it('says there was no readiness estimate rather than printing one', () => {
    expect(careerPlanCopy(plan, WHEN)).toContain('The model gave no readiness estimate.');
    expect(careerPlanCopy({ ...plan, readiness: 62 }, WHEN)).toContain('Readiness, as the model judged it: 62%');
  });

  it('writes no heading over an empty section and none of the page placeholders', () => {
    const text = careerPlanCopy(plan, WHEN);
    expect(text).not.toContain('What to learn');
    expect(text).not.toContain('Timeline not estimated');
  });
});

describe('ideaAssessmentCopy', () => {
  it('prints only the scores the model gave, and her idea above them', () => {
    const text = ideaAssessmentCopy(
      {
        idea: 'A lending library for workwear.',
        category: 'Service/Offering',
        targetMarket: '',
        result: {
          overallScore: 71,
          marketPotential: { score: 68, analysis: 'Demand is local.' },
          feasibility: { score: null },
          competition: { score: 55, analysis: '', competitors: ['Dress for Success'] },
          strengths: ['Low stock cost'],
          weaknesses: null,
          nextSteps: ['Run a pop-up'],
        },
      },
      WHEN
    );
    expect(text).toContain('Your idea\n---------\nA lending library for workwear.\nCategory: Service/Offering');
    expect(text).not.toContain('Target market');
    expect(text).toContain('Overall: 71/100\nMarket potential: 68/100\nCompetition: 55/100');
    expect(text).not.toContain('Feasibility: ');
    expect(text).toContain('Named: Dress for Success');
    expect(text).not.toContain('Weaknesses');
    expect(text).toContain('• Run a pop-up');
  });
});

describe('interviewPracticeCopy', () => {
  it('keeps the transcript in order with the feedback on each answer', () => {
    const text = interviewPracticeCopy(
      {
        role: 'Registered Nurse',
        interviewType: 'Behavioral',
        level: 'Mid Level',
        messages: [
          { role: 'system', content: 'Practice session for Registered Nurse' },
          { role: 'assistant', content: 'How have you kept a ward safe?' },
          { role: 'user', content: 'I rang the after-hours manager.' },
          {
            role: 'assistant',
            content: 'Clear escalation.',
            feedback: { rating: null, strengths: ['Escalated early'], improvements: ['Say what you did first'] },
          },
        ],
      },
      WHEN
    );
    expect(text).toContain('Role: Registered Nurse\nInterview: Behavioral\nLevel: Mid Level');
    expect(text).toContain(
      'Coach: How have you kept a ward safe?\n\nYou: I rang the after-hours manager.\n\nCoach: Clear escalation.\n   The coach did not rate this answer.\n   Strengths:\n   • Escalated early\n   To improve:\n   • Say what you did first'
    );
  });
});

describe('resumeReviewCopy', () => {
  it('is the review and never the résumé, and says when no score was given', () => {
    const text = resumeReviewCopy(
      {
        score: null,
        strengths: 'Clear timeline.',
        weaknesses: null,
        improvements: [
          { section: 'Summary', suggestion: 'Lead with the outcome.' },
          { section: null, suggestion: 'Cut the objective line.' },
        ],
        keywordsMatched: ['SQL'],
        keywordsMissing: [],
        targetJob: 'Data Analyst',
      },
      WHEN
    );
    expect(text).toContain('Reviewed against: Data Analyst\nThe model gave no score.');
    expect(text).toContain('• Summary: Lead with the outcome.\n• Cut the objective line.');
    expect(text).toContain('Found: SQL');
    expect(text).not.toContain('Missing:');
    expect(text).not.toContain('Weaknesses');
  });
});
