import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    let userRole = "GUEST";
    let userInterests: string[] = [];

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
          // Assuming we might have interests in a related model, but for now we'll use role
        }
      });
      if (user) {
        userRole = user.role;
        // Mock interests for now as we don't have a direct relation populated yet
        // In a real app, we'd fetch from UserFeature or similar
        userInterests = ["Tech", "Business"]; 
      }
    }

    // 1. Fetch Active Candidates
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: new Date()
        }
      },
      include: {
        creatives: true,
        organization: true
      },
      take: 20 // Get a larger pool for filtering
    });

    if (campaigns.length === 0) {
      return NextResponse.json({ ad: null });
    }

    // 2. Filter by Targeting (Simulation)
    const eligibleCampaigns = campaigns.filter(c => {
      if (!c.targetingJson) return true; // No targeting = open to all
      try {
        const targeting = JSON.parse(c.targetingJson);
        
        // Role Check
        if (targeting.role && targeting.role !== "ALL" && targeting.role !== userRole) {
          return false;
        }

        // Interest Check (Simple overlap)
        if (targeting.interests && targeting.interests.length > 0) {
           const hasInterest = targeting.interests.some((i: string) => 
             userInterests.map(ui => ui.toLowerCase()).includes(i.toLowerCase())
           );
           // If we enforce strict interest matching, return hasInterest.
           // For now, let's be lenient to ensure ads show up.
           // return hasInterest; 
        }

        return true;
      } catch (e) {
        return true; // Fallback if JSON parse fails
      }
    });

    if (eligibleCampaigns.length === 0) {
       // Fallback to any active campaign if targeting is too strict
       // return NextResponse.json({ ad: null });
    }

    const pool = eligibleCampaigns.length > 0 ? eligibleCampaigns : campaigns;

    // 3. Auction Simulation (RTB)
    // Score = Bid * Relevance (Random for now)
    const scoredCampaigns = pool.map(c => ({
      campaign: c,
      score: (Number(c.dailyBudgetCents) / 100) * Math.random()
    }));

    // Sort by score descending
    scoredCampaigns.sort((a, b) => b.score - a.score);
    const winner = scoredCampaigns[0].campaign;
    const creative = winner.creatives[0];

    if (!creative) {
       return NextResponse.json({ ad: null });
    }

    const adData = {
      id: creative.id,
      headline: creative.title,
      body: creative.description,
      mediaUrl: creative.mediaUrl,
      cta: creative.callToAction,
      targetUrl: creative.landingUrl,
      advertiser: {
        name: winner.organization.name,
        logo: winner.organization.logo
      }
    };

    return NextResponse.json({ ad: adData });
  } catch (error) {
    console.error("Error serving ad:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
