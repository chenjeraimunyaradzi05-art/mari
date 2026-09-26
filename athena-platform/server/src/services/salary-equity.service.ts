/**
 * Salary Equity Service
 * Negotiation coaching and employer pay transparency.
 *
 * The benchmark, pay-gap, range and submission functions that used to live here
 * served only the four /api/salary routes nobody called, and they applied
 * weaker privacy floors than the live /api/ai-algorithms/salary-equity routes:
 * the pay-gap one took the median of however many women had reported, one
 * included, and handed it back as a potential increase. They were removed with
 * those routes; see the header of salary.routes.ts. Member-reported pay is read
 * and written by ai-algorithms.routes.ts, under its eight-per-gender floor.
 */

import { prisma } from '../utils/prisma';

export interface NegotiationScript {
  situation: string;
  openingStatement: string;
  keyPoints: string[];
  counterResponses: Record<string, string>;
  closingStatement: string;
  tips: string[];
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

export default {
  generateNegotiationScript,
  getCompanyTransparencyScore,
};
