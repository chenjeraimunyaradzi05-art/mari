jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { aiService, normaliseResumeAnalysis } from '../ai.service';

describe('The resume analysis contract', () => {
  it('an unconfigured service says so instead of inventing an analysis', async () => {
    // No OPENAI key in the test environment, so this takes the simulated path.
    const result = await aiService.optimizeResume('My resume text');

    expect(result.simulated).toBe(true);
    // The old simulation claimed a 75% match, named missing keywords the
    // resume was never checked for, and offered a rewritten resume for a
    // fictional John Doe. None of that may come back.
    expect(result.score).toBeNull();
    expect(result.keywordsMissing).toEqual([]);
    expect(result.keywordsMatched).toEqual([]);
    expect(result).not.toHaveProperty('optimizedResume');
    expect(result).not.toHaveProperty('matchScore');
    // General advice may remain, provided it carries no per-document claims.
    expect(result.strengths).toBeNull();
    expect(result.weaknesses).toBeNull();
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it('clamps whatever number the model offers into 0-100 or nothing', () => {
    expect(normaliseResumeAnalysis({ score: 150 }).score).toBe(100);
    expect(normaliseResumeAnalysis({ score: -5 }).score).toBe(0);
    expect(normaliseResumeAnalysis({ score: '82.4' }).score).toBe(82);
    expect(normaliseResumeAnalysis({ score: 'high' }).score).toBeNull();
    expect(normaliseResumeAnalysis({}).score).toBeNull();
  });

  it('accepts improvements as strings or objects and drops the rest', () => {
    const { improvements } = normaliseResumeAnalysis({
      improvements: [
        'Use stronger verbs',
        { section: 'Experience', suggestion: 'Lead with outcomes' },
        { section: 'Skills' },
        42,
        null,
      ],
    });

    expect(improvements).toEqual([
      { section: null, suggestion: 'Use stronger verbs' },
      { section: 'Experience', suggestion: 'Lead with outcomes' },
    ]);
  });

  it('a job match without a configured model is null, not a fabricated number', async () => {
    // It used to answer 75% with "Skill A" missing; a zero on failure; or a
    // thrown error in production. Null is the only honest value: no reading.
    await expect(aiService.evaluateJobMatch('profile', 'job description')).resolves.toBeNull();
  });

  it('reads the field names the model was asked for, old and new', () => {
    const result = normaliseResumeAnalysis({
      strengthAnalysis: 'Clear structure',
      weaknessAnalysis: 'No metrics',
      keywordsMatches: ['SQL'],
      keywordsMissing: ['Python', 7],
    });

    expect(result.strengths).toBe('Clear structure');
    expect(result.weaknesses).toBe('No metrics');
    expect(result.keywordsMatched).toEqual(['SQL']);
    expect(result.keywordsMissing).toEqual(['Python']);
    expect(result.simulated).toBe(false);
  });
});
