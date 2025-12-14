/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { calculateRelevanceScore, TargetingCriteria, UserProfile } from '@/lib/targeting';
import { selectCreative } from '@/lib/ab-testing';

const AuctionRequestSchema = z.object({
  placementId: z.string().min(1),
  userId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placementId, userId } = AuctionRequestSchema.parse(body);

    // 1. Create Auction Record
    const auction = await (prisma as any).adAuction.create({
      data: {
        requestId: crypto.randomUUID(),
        placementId,
        userId,
      },
    });

    // 2. Fetch User Profile (if userId provided)
    let userProfile: UserProfile = {};
    if (userId) {
      // Fetch Audience Memberships
      const audienceMemberships = await (prisma as any).adAudienceMember.findMany({
        where: { userId },
        select: { audienceId: true },
      });
      const audienceIds = audienceMemberships.map((m: any) => m.audienceId);

      // Mock profile for MVP - in real app, fetch from DB
      // const user = await prisma.user.findUnique(...)
      userProfile = {
        location: 'Sydney',
        interests: ['Technology', 'Real Estate'],
        gender: 'FEMALE',
        audienceIds,
      };
    }

    // 3. Fetch Active Campaigns
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const campaigns = await (prisma as any).adCampaign.findMany({
      where: {
        status: 'active',
      },
      include: {
        creatives: true,
        dailyMetrics: {
          where: {
            date: today,
          },
          take: 1,
        },
      },
      take: 20,
    });

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'No active campaigns' }, { status: 404 });
    }

    // 4. Generate Bids with Intelligence
    const bids = [];
    for (const campaign of campaigns) {
      // Budget Pacing Check
      // 1. Total Budget
      if (campaign.budgetCents && campaign.spend >= campaign.budgetCents) {
        continue;
      }

      // 2. Daily Budget
      if (campaign.dailyBudgetCents) {
        const dailyMetric = campaign.dailyMetrics?.[0];
        if (dailyMetric && dailyMetric.spendCents >= campaign.dailyBudgetCents) {
          continue;
        }
      }

      if (campaign.creatives.length === 0) continue;

      // Parse targeting
      let targeting: TargetingCriteria | null = null;
      try {
        if (campaign.targetingJson) {
          targeting = JSON.parse(campaign.targetingJson);
        }
      } catch (e) {
        console.warn('Failed to parse targeting JSON', e);
      }

      // Calculate Score
      const relevance = calculateRelevanceScore(targeting, userProfile);
      
      // If relevance is 0 (hard exclusion), skip
      if (relevance <= 0) continue;

      // Base bid (randomized for MVP, but scaled by relevance)
      const baseBid = Math.floor(Math.random() * 450) + 50;
      const finalBidAmount = Math.floor(baseBid * relevance);
      
      // Score combines bid amount and relevance (eCPM approximation)
      const score = finalBidAmount * relevance;

      // A/B Testing: Select best creative
      const creative = selectCreative(campaign.creatives);
      if (!creative) continue;

      const bid = await (prisma as any).adBid.create({
        data: {
          auctionId: auction.id,
          campaignId: campaign.id,
          creativeId: creative.id,
          bidAmount: BigInt(finalBidAmount),
          score: score,
        },
      });
      
      bids.push({ ...bid, creative });
    }

    if (bids.length === 0) {
      return NextResponse.json({ error: 'No eligible bids' }, { status: 404 });
    }

    // 5. Determine Winner
    bids.sort((a, b) => Number(b.score) - Number(a.score));
    const winner = bids[0];
    const runnerUp = bids[1];

    // Second price auction
    const winningPrice = runnerUp ? Number(runnerUp.bidAmount) + 1 : Number(winner.bidAmount);

    // 6. Update Auction with Result
    await (prisma as any).adAuction.update({
      where: { id: auction.id },
      data: {
        winningBidId: winner.id,
        winningPrice: BigInt(winningPrice),
      },
    });

    await (prisma as any).adBid.update({
      where: { id: winner.id },
      data: { isWinner: true },
    });

    // 7. Return Winning Creative
    return NextResponse.json({
      auctionId: auction.id,
      creative: {
        id: winner.creative.id,
        title: winner.creative.title,
        description: winner.creative.description,
        mediaUrl: winner.creative.mediaUrl,
        mediaType: winner.creative.mediaType,
      },
    });
  } catch (error) {
    console.error('Auction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
