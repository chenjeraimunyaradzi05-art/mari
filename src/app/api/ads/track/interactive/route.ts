import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLeadToCRM } from "@/lib/integrations/crm/manager";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { adId, type, payload, auctionId } = body;

    if (!adId || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch creative to get campaignId and organizationId
    const creative = await prisma.adCreative.findUnique({
      where: { id: adId },
      select: { campaignId: true, organizationId: true }
    });

    if (!creative) {
      return NextResponse.json({ error: "Creative not found" }, { status: 404 });
    }

    const event = await prisma.adEvent.create({
      data: {
        type,
        creativeId: adId,
        campaignId: creative.campaignId,
        auctionId: auctionId || null,
        metadata: payload ? JSON.stringify(payload) : null,
      },
    });

    // Handle Lead Form Submission
    if (type === "lead_form_submit" && payload) {
      try {
        const lead = await prisma.lead.create({
          data: {
            organizationId: creative.organizationId,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            source: "interactive_ad",
            status: "new",
            score: 10, // Higher score for direct form fill
            dataJson: JSON.stringify(payload),
          }
        });
        
        // Trigger async CRM sync (fire and forget)
        syncLeadToCRM(lead.id).catch(console.error);
      } catch (leadError) {
        console.error("Failed to create lead from interactive ad:", leadError);
        // Don't fail the event tracking if lead creation fails, but log it
      }
    }

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error("Track interactive error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
