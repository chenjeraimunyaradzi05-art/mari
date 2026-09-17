/**
 * Salary Equity Service
 * Pay gap detection, salary benchmarking, and negotiation coaching
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface SalaryData {
  role: string;
  level: string;
  industry: string;
  location: string;
  yearsExperience: number;
  education: string;
  baseSalary: number;
  totalCompensation: number;
  gender?: 'female' | 'male' | 'other';
  isVerified: boolean;
}

export interface SalaryBenchmark {
  role: string;
  location: string;
  percentile10: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile90: number;
  sampleSize: number;
  lastUpdated: Date;
}

export interface PayGapAnalysis {
  role: string;
  location: string;
  /**
   * Percentage difference, positive when women are paid less. Null when too few
   * members of either gender have reported for the comparison to mean anything:
   * a gap computed from one woman and one man is a rumour, not a finding, and
   * this one is quoted back to employers in negotiations.
   */
  genderGap: number | null;
  sampleSize: number;
  womenReporting: number;
  menReporting: number;
  recommendations: string[];
  potentialIncrease: number;
}

export interface NegotiationScript {
  situation: string;
  openingStatement: string;
  keyPoints: string[];
  counterResponses: Record<string, string>;
  closingStatement: string;
  tips: string[];
}

/**
 * Benchmarks are read from the SalaryDataPoint table members contribute to.
 *
 * Below these counts nothing is reported at all. A woman takes these figures
 * into a salary negotiation, so a number derived from a handful of rows is
 * worse than no number: it is confidently wrong in a conversation she cannot
 * easily reopen. The gender thresholds are per gender, not combined.
 */
const MIN_SAMPLE_FOR_BENCHMARK = 5;
const MIN_PER_GENDER_FOR_GAP = 3;


/** The reported figures for a role, optionally narrowed to a city and industry. */
async function findReportedSalaries(
  role: string,
  location?: string,
  filters?: { industry?: string; yearsExperience?: number }
) {
  return prisma.salaryDataPoint.findMany({
    where: {
      normalizedTitle: { contains: role.toLowerCase().trim() },
      ...(location ? { city: { contains: location, mode: 'insensitive' as const } } : {}),
      ...(filters?.industry ? { industry: { contains: filters.industry, mode: 'insensitive' as const } } : {}),
    },
    select: {
      baseSalary: true,
      totalComp: true,
      gender: true,
      yearsExperience: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: 'desc' },
  });
}

/** Total compensation where it was given, otherwise base. */
function compensationOf(row: { baseSalary: unknown; totalComp: unknown }): number {
  return Number(row.totalComp ?? row.baseSalary);
}

/**
 * Get salary benchmark for a role and location
 */
export async function getSalaryBenchmark(
  role: string,
  location: string,
  filters?: {
    industry?: string;
    level?: string;
    yearsExperience?: number;
  }
): Promise<SalaryBenchmark | null> {
  const data = await findReportedSalaries(role, location, filters);

  if (data.length < MIN_SAMPLE_FOR_BENCHMARK) {
    return null;
  }

  const salaries = data.map(compensationOf).sort((a, b) => a - b);

  return {
    role,
    location,
    percentile10: getPercentile(salaries, 10),
    percentile25: getPercentile(salaries, 25),
    percentile50: getPercentile(salaries, 50),
    percentile75: getPercentile(salaries, 75),
    percentile90: getPercentile(salaries, 90),
    sampleSize: data.length,
    // The freshest contribution, so a stale benchmark is visibly stale rather
    // than looking as though it were compiled today.
    lastUpdated: data[0]?.submittedAt ?? new Date(),
  };
}

/**
 * Analyze pay gap for a specific role
 */
export async function analyzePayGap(
  role: string,
  location: string,
  currentSalary?: number
): Promise<PayGapAnalysis> {
  const roleData = await findReportedSalaries(role, location);

  // The table stores the values the submission form collects, which are
  // upper-case and include PREFER_NOT and NON_BINARY. Only the two that can be
  // compared are counted here; the rest still count toward the sample.
  const womenSalaries = roleData.filter(s => s.gender === 'WOMAN').map(compensationOf);
  const menSalaries = roleData.filter(s => s.gender === 'MAN').map(compensationOf);

  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return getPercentile(sorted, 50);
  };

  const comparable =
    womenSalaries.length >= MIN_PER_GENDER_FOR_GAP && menSalaries.length >= MIN_PER_GENDER_FOR_GAP;

  const womenMedian = womenSalaries.length ? median(womenSalaries) : 0;
  const menMedian = menSalaries.length ? median(menSalaries) : 0;

  // Medians rather than means: one very senior outlier should not move the
  // number a member is about to quote in a negotiation.
  const genderGap = comparable && menMedian > 0 ? ((menMedian - womenMedian) / menMedian) * 100 : null;

  let potentialIncrease = 0;
  if (currentSalary && womenMedian > 0 && currentSalary < womenMedian) {
    potentialIncrease = womenMedian - currentSalary;
  } else if (currentSalary && genderGap !== null && genderGap > 0) {
    potentialIncrease = currentSalary * (genderGap / 100);
  }

  const recommendations: string[] = [];

  if (roleData.length < MIN_SAMPLE_FOR_BENCHMARK) {
    recommendations.push(
      `Only ${roleData.length} ${roleData.length === 1 ? 'person has' : 'people have'} reported pay for ${role} in ${location}, which is too few to draw a conclusion from. Adding yours helps the next woman who looks.`
    );
  } else if (genderGap === null) {
    recommendations.push(
      'There are not yet enough reports from both women and men in this role to compare them fairly, so no gap is shown.'
    );
  } else if (genderGap > 15) {
    recommendations.push(
      `Women reporting this role in ${location} are paid ${genderGap.toFixed(1)}% less at the median. That is worth raising directly in your next pay conversation.`
    );
  }

  if (currentSalary && womenMedian > 0 && currentSalary < womenMedian) {
    recommendations.push(
      `You are below the median for women reporting this role. The difference is about $${Math.round(potentialIncrease).toLocaleString()}.`
    );
  }

  recommendations.push('Document your achievements and impact with specific metrics.');
  recommendations.push('Practice the conversation with our AI Interview Coach.');

  return {
    role,
    location,
    genderGap: genderGap === null ? null : Math.round(genderGap * 10) / 10,
    sampleSize: roleData.length,
    womenReporting: womenSalaries.length,
    menReporting: menSalaries.length,
    recommendations,
    potentialIncrease: Math.round(potentialIncrease),
  };
}

/**
 * Get salary range for job posting transparency
 */
export async function getSalaryRange(
  role: string,
  location: string,
  level: string
): Promise<{ min: number; max: number; median: number; sampleSize: number } | null> {
  // `level` narrows by years of experience rather than a stored level, because
  // the table records experience and not a seniority label.
  const bands: Record<string, { gte?: number; lt?: number }> = {
    junior: { lt: 3 },
    mid: { gte: 3, lt: 6 },
    senior: { gte: 6 },
  };
  const band = bands[level.toLowerCase()];

  const data = await findReportedSalaries(role, location);

  const inBand = band
    ? data.filter(s => {
        const years = s.yearsExperience;
        if (years === null || years === undefined) return false;
        if (band.gte !== undefined && years < band.gte) return false;
        if (band.lt !== undefined && years >= band.lt) return false;
        return true;
      })
    : data;

  if (inBand.length < MIN_SAMPLE_FOR_BENCHMARK) {
    return null;
  }

  const salaries = inBand.map(s => Number(s.baseSalary)).sort((a, b) => a - b);

  return {
    min: salaries[0],
    max: salaries[salaries.length - 1],
    median: getPercentile(salaries, 50),
    sampleSize: inBand.length,
  };
}

/**
 * Generate negotiation script based on situation
 */
export function generateNegotiationScript(
  situation: 'new_job' | 'raise' | 'promotion' | 'counter_offer',
  context: {
    currentSalary?: number;
    targetSalary: number;
    role: string;
    achievements?: string[];
    yearsAtCompany?: number;
  }
): NegotiationScript {
  const scripts: Record<string, NegotiationScript> = {
    new_job: {
      situation: 'New Job Offer Negotiation',
      openingStatement: `Thank you for the offer. I'm very excited about the opportunity to join as ${context.role}. I'd like to discuss the compensation package.`,
      keyPoints: [
        `Based on my research, the market rate for this role is $${context.targetSalary.toLocaleString()}.`,
        'I bring [X years] of experience and a track record of [specific achievements].',
        'I\'m confident I can deliver significant value in this role.',
      ],
      counterResponses: {
        'budget_constraints': 'I understand budget constraints. Could we discuss a signing bonus or earlier review date to bridge the gap?',
        'need_to_check': 'Of course, I\'ll give you time to review. When can I expect to hear back?',
        'final_offer': 'I appreciate that. Could we explore other benefits like additional PTO or professional development budget?',
      },
      closingStatement: 'I\'m committed to making this work. What flexibility do you have on the total compensation?',
      tips: [
        'Always negotiate - 70% of employers expect it.',
        'Focus on your value, not your needs.',
        'Get the offer in writing before accepting.',
        'Consider the full package: salary, bonus, equity, benefits.',
      ],
    },
    raise: {
      situation: 'Salary Raise Negotiation',
      openingStatement: `I'd like to discuss my compensation. Over the past ${context.yearsAtCompany || 'year'}, I've made significant contributions.`,
      keyPoints: [
        ...(context.achievements || ['Led key project', 'Exceeded targets']).map(a => `I ${a}`),
        `I'm requesting an adjustment to $${context.targetSalary.toLocaleString()} to align with my contributions and market rates.`,
      ],
      counterResponses: {
        'not_in_budget': 'I understand budget cycles. Can we schedule a review in 3 months with specific targets?',
        'need_approval': 'What information would help you make the case to leadership?',
        'partial_raise': 'Thank you. Can we also discuss a path to reaching my target salary?',
      },
      closingStatement: 'I\'m committed to continuing to deliver results. What can we agree on today?',
      tips: [
        'Time your ask after a major win or during review cycles.',
        'Know your worth - use market data.',
        'Quantify your achievements with specific numbers.',
        'Have a backup plan if the answer is no.',
      ],
    },
    promotion: {
      situation: 'Promotion Negotiation',
      openingStatement: `I'd like to discuss my career progression and the ${context.role} role.`,
      keyPoints: [
        'I\'ve consistently exceeded expectations in my current role.',
        'I\'ve already been taking on responsibilities at the next level.',
        `The market rate for ${context.role} is $${context.targetSalary.toLocaleString()}.`,
      ],
      counterResponses: {
        'not_ready': 'I\'d appreciate specific feedback on what I need to develop. Can we create a 90-day plan?',
        'no_openings': 'I understand. Can we discuss a title change and compensation adjustment to reflect my current contributions?',
        'prove_yourself': 'I\'m happy to take on a stretch assignment. Can we agree on criteria for success and a timeline?',
      },
      closingStatement: 'I\'m ready for this challenge. What are the next steps to formalize this?',
      tips: [
        'Document your achievements throughout the year.',
        'Build relationships with decision-makers.',
        'Volunteer for visible projects.',
        'Ask for feedback regularly.',
      ],
    },
    counter_offer: {
      situation: 'Counter Offer Negotiation',
      openingStatement: `I've received an offer from another company, and I wanted to discuss this with you before making a decision.`,
      keyPoints: [
        `The offer is for $${context.targetSalary.toLocaleString()}, which is ${Math.round(((context.targetSalary - (context.currentSalary || 0)) / (context.currentSalary || 1)) * 100)}% above my current salary.`,
        'I value my work here and would prefer to stay.',
        'I\'m looking for a competitive counter offer.',
      ],
      counterResponses: {
        'let_you_go': 'I appreciate our time together. I\'ll work to ensure a smooth transition.',
        'match_offer': 'Thank you. Can we also discuss my growth path here?',
        'partial_match': 'I appreciate the effort. Can we bridge the gap with a retention bonus or accelerated review?',
      },
      closingStatement: 'I need to give them an answer by [date]. What can you offer?',
      tips: [
        'Only use this if you\'re willing to leave.',
        'Don\'t bluff - it can backfire.',
        'Consider why you wanted to leave in the first place.',
        'Get any counter offer in writing.',
      ],
    },
  };

  return scripts[situation] || scripts.new_job;
}

/**
 * Submit anonymous salary data
 */
export async function submitSalaryData(
  userId: string,
  data: Omit<SalaryData, 'isVerified'>
): Promise<boolean> {
  // The gender values this service speaks are lower case; the table stores the
  // same set the submission form uses.
  const genderColumn: Record<string, string> = {
    female: 'WOMAN',
    male: 'MAN',
    other: 'NON_BINARY',
  };

  try {
    await prisma.salaryDataPoint.create({
      data: {
        userId,
        jobTitle: data.role,
        normalizedTitle: data.role.toLowerCase().trim(),
        industry: data.industry,
        city: data.location,
        baseSalary: data.baseSalary,
        totalComp: data.totalCompensation,
        yearsExperience: data.yearsExperience,
        educationLevel: data.education,
        ...(data.gender ? { gender: genderColumn[data.gender] } : {}),
        // Self-reported until someone produces a payslip, which is what
        // verificationMethod is for.
        isVerified: false,
      },
    });

    logger.info('Salary data submitted', { role: data.role, location: data.location });
    return true;
  } catch (error) {
    logger.error('Failed to submit salary data', { error });
    return false;
  }
}

/**
 * How openly a company posts pay, measured only from what ATHENA can observe.
 *
 * This is deliberately narrow. The previous version returned the same four
 * invented scores for every employer, including things nobody here can see such
 * as "equal pay certification", which meant naming a real company alongside a
 * number nobody had measured. What is actually knowable is what share of that
 * employer's roles on ATHENA publish a salary range, and how many of its
 * employees have reported pay. Where there is nothing to measure, this returns
 * null rather than a score.
 */
export async function getCompanyTransparencyScore(companyName: string): Promise<{
  companyName: string;
  score: number;
  rolesPosted: number;
  rolesWithPayPublished: number;
  employeesReporting: number;
  factors: { name: string; score: number; weight: number }[];
  recommendations: string[];
} | null> {
  const name = companyName.trim();
  if (!name) return null;

  const [jobs, employeesReporting] = await Promise.all([
    prisma.job.findMany({
      where: { organization: { name: { contains: name, mode: 'insensitive' } } },
      select: { salaryMin: true, salaryMax: true },
    }),
    prisma.salaryDataPoint.count({
      where: { company: { contains: name, mode: 'insensitive' } },
    }),
  ]);

  if (jobs.length === 0) {
    return null;
  }

  const rolesWithPayPublished = jobs.filter(j => j.salaryMin !== null || j.salaryMax !== null).length;
  const publishedShare = (rolesWithPayPublished / jobs.length) * 100;

  // One factor, because one factor is all that is observable. The weight stays
  // in the shape so a second measurable factor can join it later.
  const factors = [
    { name: 'Roles on ATHENA that publish a salary range', score: Math.round(publishedShare), weight: 1 },
  ];

  const recommendations: string[] = [];

  if (publishedShare < 70) {
    recommendations.push(
      `${Math.round(publishedShare)}% of this employer's roles here name the pay. Ask for the range before your first interview.`
    );
  }
  if (employeesReporting === 0) {
    recommendations.push('Nobody has reported pay for this employer yet. Yours would be the first.');
  }

  return {
    companyName: name,
    score: Math.round(publishedShare),
    rolesPosted: jobs.length,
    rolesWithPayPublished,
    employeesReporting,
    factors,
    recommendations,
  };
}

// Helper functions

function getPercentile(sortedArr: number[], percentile: number): number {
  const index = (percentile / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) {
    return sortedArr[lower];
  }
  
  return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (index - lower);
}

export default {
  getSalaryBenchmark,
  analyzePayGap,
  getSalaryRange,
  generateNegotiationScript,
  submitSalaryData,
  getCompanyTransparencyScore,
};
