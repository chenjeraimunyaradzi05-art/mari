import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
      return NextResponse.json({ error: "Organization required" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      campaignId, 
      title, 
      description, 
      mediaUrl, 
      callToAction, 
      landingUrl, 
      format, 
      interactiveData 
    } = body;

    // If no campaignId is provided, we might need to create a default one or error out.
    // For this demo, we'll find the most recent active campaign or create a "General" one.
    let targetCampaignId = campaignId;

    if (!targetCampaignId) {
      const campaign = await prisma.adCampaign.findFirst({
        where: { organizationId: user.organizationId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" }
      });
      
      if (campaign) {
        targetCampaignId = campaign.id;
      } else {
        // Create a default campaign
        const newCampaign = await prisma.adCampaign.create({
          data: {
            organizationId: user.organizationId,
            name: "General Campaign",
            objective: "TRAFFIC",
            status: "ACTIVE",
            budgetCents: 0,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          }
        });
        targetCampaignId = newCampaign.id;
      }
    }

    const creative = await prisma.adCreative.create({
      data: {
        organizationId: user.organizationId,
        campaignId: targetCampaignId,
        title,
        description,
        mediaUrl,
        callToAction: callToAction || "Learn More",
        landingUrl: landingUrl || "https://example.com",
        format: format || "image",
        interactiveData: interactiveData ? JSON.stringify(interactiveData) : null,
      }
    });

    return NextResponse.json({ success: true, creative });
  } catch (error) {
    console.error("Create creative error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
