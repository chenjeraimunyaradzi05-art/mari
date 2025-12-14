import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validatePartnerRequest, unauthorizedResponse } from '@/lib/auth/partner';

// Helper to get Org ID from API Key (Mock)
async function getOrgIdFromRequest(req: NextRequest) {
  if (!validatePartnerRequest(req)) return null;
  const org = await prisma.organization.findFirst();
  return org?.id || 'org_demo';
}

export async function GET(request: NextRequest) {
  const organizationId = await getOrgIdFromRequest(request);
  
  if (!organizationId) {
    return unauthorizedResponse();
  }

  try {
    const campaigns = await prisma.adCampaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        objective: true,
        budgetCents: true,
        spend: true,
        impressions: true,
        clicks: true,
        conversions: true,
      }
    });

    return NextResponse.json({ data: campaigns });
  } catch (error) {
    console.error('Partner API Error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const organizationId = await getOrgIdFromRequest(request);
  
  if (!organizationId) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.name || !body.objective || !body.budgetCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const campaign = await prisma.adCampaign.create({
      data: {
        organizationId,
        name: body.name,
        objective: body.objective,
        budgetCents: body.budgetCents,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        status: 'draft',
      }
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    console.error('Partner API Create Error', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
