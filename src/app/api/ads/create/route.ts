import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "User must have a business profile" }, { status: 403 });
    }

    const { 
      campaignName, 
      objective, 
      dailyBudget, 
      startDate, 
      endDate,
      headline,
      bodyText,
      mediaUrl,
      targetUrl,
      targeting
    } = await req.json();

    // Create Campaign
    const campaign = await prisma.adCampaign.create({
      data: {
        organizationId: user.organizationId,
        name: campaignName,
        objective: objective || "AWARENESS",
        budgetCents: 0, // Placeholder
        dailyBudgetCents: BigInt(Math.round(dailyBudget * 100)),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "ACTIVE",
        targetingJson: targeting ? JSON.stringify(targeting) : null,
        creatives: {
          create: {
            organizationId: user.organizationId,
            title: headline,
            description: bodyText,
            mediaUrl: mediaUrl,
            callToAction: "LEARN_MORE",
            landingUrl: targetUrl,
            format: "FEED_CARD"
          }
        }
      },
      include: {
        creatives: true
      }
    });

    // Convert BigInt to string for JSON response
    const serializedCampaign = JSON.parse(JSON.stringify(campaign, (key, value) =>
      typeof value === 'bigint'
        ? value.toString()
        : value
    ));

    return NextResponse.json({ success: true, campaign: serializedCampaign });
  } catch (error) {
    console.error("Error creating ad campaign:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
