import { prisma } from '@/lib/db';

export type AudienceRule = {
  event: 'impression' | 'click' | 'conversion';
  campaignId?: string;
  creativeId?: string;
};

/**
 * Evaluates event against audience rules and adds user to audiences.
 */
export async function checkAndAddToAudiences(
  userId: string | undefined,
  event: {
    type: string;
    campaignId: string;
    creativeId: string;
  }
) {
  if (!userId) return;

  try {
    // 1. Fetch all retargeting audiences
    // In a real system, we would cache this or filter more efficiently
    const audiences = await prisma.adAudience.findMany({
      where: { type: 'retargeting' },
    });

    const matchedAudienceIds: string[] = [];

    for (const audience of audiences) {
      if (!audience.ruleJson) continue;

      try {
        const rule = JSON.parse(audience.ruleJson) as AudienceRule;

        // Check Event Type
        if (rule.event !== event.type) continue;

        // Check Campaign ID (if specified)
        if (rule.campaignId && rule.campaignId !== event.campaignId) continue;

        // Check Creative ID (if specified)
        if (rule.creativeId && rule.creativeId !== event.creativeId) continue;

        matchedAudienceIds.push(audience.id);
      } catch (e) {
        console.warn(`Failed to parse rule for audience ${audience.id}`, e);
      }
    }

    if (matchedAudienceIds.length > 0) {
      // Add user to audiences (ignore duplicates)
      await Promise.all(
        matchedAudienceIds.map((audienceId) =>
          prisma.adAudienceMember.upsert({
            where: {
              audienceId_userId: {
                audienceId,
                userId,
              },
            },
            update: {}, // Already exists, do nothing
            create: {
              audienceId,
              userId,
            },
          })
        )
      );
    }
  } catch (error) {
    console.error('Error processing audiences:', error);
  }
}
