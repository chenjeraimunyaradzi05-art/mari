import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch campaigns
    const campaigns = await prisma.adCampaign.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Calculate totals
    let totalSpend = 0;
    let totalImpressions = BigInt(0);
    let totalClicks = BigInt(0);

    campaigns.forEach(c => {
      totalSpend += Number(c.spend); // Assuming spend is BigInt cents
      totalImpressions += c.impressions;
      totalClicks += c.clicks;
    });

    // Serialize BigInts
    const serializedCampaigns = JSON.parse(JSON.stringify(campaigns, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({ 
      organization: user.organization,
      stats: {
        spend: totalSpend / 100, // Convert cents to dollars
        impressions: totalImpressions.toString(),
        clicks: totalClicks.toString()
      },
      campaigns: serializedCampaigns
    });
  } catch (error) {
    console.error("Error fetching business profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
