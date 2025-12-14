import { prisma } from "@/lib/prisma";

export type LeadTier = 'hot' | 'warm' | 'cold';

export interface LeadScoreResult {
  score: number;
  tier: LeadTier;
  explanation: string[];
  priceCents: number;
}

export async function scoreLead(leadId: string): Promise<LeadScoreResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  let score = 0;
  const explanation: string[] = [];

  // 1. Contact Info Completeness (Base Score)
  if (lead.email) score += 10;
  if (lead.phone) {
    score += 20;
    explanation.push('Has phone number (+20)');
  }
  if (lead.firstName && lead.lastName) {
    score += 10;
    explanation.push('Has full name (+10)');
  }

  // 2. Propensity Integration (if linked to a user)
  // We try to find a user with this email
  const user = await prisma.user.findUnique({
    where: { email: lead.email },
  });

  if (user) {
    const propensity = await prisma.userPropensity.findUnique({
      where: { userId: user.id },
    });

    if (propensity) {
      // Contextual scoring based on lead type
      if (lead.type === 'job' || lead.type === 'apprenticeship') {
        if (propensity.jobSeeking > 0.7) {
          score += 30;
          explanation.push('High job seeking intent (+30)');
        } else if (propensity.jobSeeking > 0.4) {
          score += 15;
          explanation.push('Moderate job seeking intent (+15)');
        }
      } else if (lead.type === 'course') {
        if (propensity.courseInterest > 0.7) {
          score += 30;
          explanation.push('High course interest (+30)');
        }
      }
      
      if (propensity.spendingPower > 0.7) {
        score += 10;
        explanation.push('High spending power (+10)');
      }
    }
  }

  // 3. Engagement (Mock logic for now)
  // In real app, check last login, email opens, etc.
  
  // Cap score at 100
  score = Math.min(100, score);

  // Determine Tier
  let tier: LeadTier = 'cold';
  if (score >= 75) tier = 'hot';
  else if (score >= 40) tier = 'warm';

  // Determine Price
  let priceCents = 500; // Base $5
  if (tier === 'hot') priceCents = 2500; // $25
  else if (tier === 'warm') priceCents = 1000; // $10

  // Update Lead Record
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      score,
      tier,
      priceCents,
      explanation: explanation.join(', '),
      status: 'scored',
    },
  });

  return { score, tier, explanation, priceCents };
}
