import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { creativeId, type } = await req.json();

    if (!creativeId || !type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const creative = await prisma.adCreative.findUnique({
      where: { id: creativeId },
      include: { campaign: true }
    });

    if (!creative) {
      return NextResponse.json({ error: "Creative not found" }, { status: 404 });
    }

    if (type === "IMPRESSION") {
      // Increment creative and campaign impressions
      await prisma.$transaction([
        prisma.adCreative.update({
          where: { id: creativeId },
          data: { impressions: { increment: 1 } }
        }),
        prisma.adCampaign.update({
          where: { id: creative.campaignId },
          data: { impressions: { increment: 1 } }
        })
      ]);
    } else if (type === "CLICK") {
      // Increment creative and campaign clicks
      await prisma.$transaction([
        prisma.adCreative.update({
          where: { id: creativeId },
          data: { clicks: { increment: 1 } }
        }),
        prisma.adCampaign.update({
          where: { id: creative.campaignId },
          data: { clicks: { increment: 1 } }
        })
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking ad:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
