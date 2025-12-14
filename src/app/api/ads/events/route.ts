/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkAndAddToAudiences } from '@/lib/audiences';
import { recordAdSpend } from '@/lib/billing';

const EventRequestSchema = z.object({
  type: z.enum(['impression', 'click', 'conversion']),
  auctionId: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, auctionId, metadata } = EventRequestSchema.parse(body);

    // 1. Fetch Auction Details to verify and get context
    const auction = await (prisma as any).adAuction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          where: { isWinner: true },
          take: 1,
        },
      },
    });

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const winningBid = auction.bids[0];
    if (!winningBid) {
      return NextResponse.json({ error: 'No winning bid for this auction' }, { status: 400 });
    }

    // 2. Record Event
    const event = await (prisma as any).adEvent.create({
      data: {
        type,
        auctionId,
        campaignId: winningBid.campaignId,
        creativeId: winningBid.creativeId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });

    // 2.5 Check and Add to Audiences (Fire and forget)
    if (auction.userId) {
      checkAndAddToAudiences(auction.userId, {
        type,
        campaignId: winningBid.campaignId,
        creativeId: winningBid.creativeId,
      }).catch((err) => console.error('Audience processing error', err));
    }

    // 3. Update Aggregates
    const campaignUpdate: any = {};
    const creativeUpdate: any = {};
    const dailyUpdate: any = {};
    
    let spendAmount = BigInt(0);

    if (type === 'impression') {
      campaignUpdate.impressions = { increment: 1 };
      creativeUpdate.impressions = { increment: 1 };
      dailyUpdate.impressions = { increment: 1 };
      
      // Charge on impression (CPM model for MVP)
      if (auction.winningPrice) {
        spendAmount = auction.winningPrice;
        campaignUpdate.spend = { increment: spendAmount };
        dailyUpdate.spendCents = { increment: spendAmount };

        // Record billing
        const campaign = await prisma.adCampaign.findUnique({
            where: { id: winningBid.campaignId },
            select: { organizationId: true }
        });
        
        if (campaign) {
            await recordAdSpend(campaign.organizationId, Number(spendAmount), `Impression: ${auctionId}`);
        }
      }
    } else if (type === 'click') {
      campaignUpdate.clicks = { increment: 1 };
      creativeUpdate.clicks = { increment: 1 };
      dailyUpdate.clicks = { increment: 1 };
    } else if (type === 'conversion') {
      campaignUpdate.conversions = { increment: 1 };
      creativeUpdate.conversions = { increment: 1 };
      dailyUpdate.conversions = { increment: 1 };

      // Track Conversion Value
      if (metadata && metadata.value) {
        const valueCents = BigInt(Math.round(Number(metadata.value) * 100)); // Assume value is in dollars/units
        campaignUpdate.conversionValue = { increment: valueCents };
        dailyUpdate.conversionValue = { increment: valueCents };
      }
    }

    if (Object.keys(campaignUpdate).length > 0) {
      let metricDate = new Date();
      
      // Attribution Logic (7-day click attribution for conversions)
      if (type === 'conversion') {
        const auctionDate = new Date(auction.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - auctionDate.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        if (diffDays > 7) {
          // Outside attribution window - record event but do not update metrics
          return NextResponse.json({ success: true, eventId: event.id, attribution: 'outside_window' });
        }
        
        // Attribute to the time of the click/auction
        metricDate = auctionDate;
      } else {
        // For impressions/clicks, use the auction time
        metricDate = new Date(auction.createdAt);
      }

      metricDate.setHours(0, 0, 0, 0);

      await Promise.all([
        (prisma as any).adCampaign.update({
          where: { id: winningBid.campaignId },
          data: campaignUpdate,
        }),
        (prisma as any).adCreative.update({
          where: { id: winningBid.creativeId },
          data: creativeUpdate,
        }),
        // Upsert Daily Metrics
        (prisma as any).adMetricsDaily.upsert({
          where: {
            campaignId_date: {
              campaignId: winningBid.campaignId,
              date: metricDate,
            },
          },
          update: dailyUpdate,
          create: {
            campaignId: winningBid.campaignId,
            date: metricDate,
            impressions: type === 'impression' ? 1 : 0,
            clicks: type === 'click' ? 1 : 0,
            conversions: type === 'conversion' ? 1 : 0,
            conversionValue: (type === 'conversion' && metadata?.value) ? BigInt(Math.round(Number(metadata.value) * 100)) : 0,
            spendCents: spendAmount,
          },
        }),
      ]);
    }

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error('Ad Event Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
