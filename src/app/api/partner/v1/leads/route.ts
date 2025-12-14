import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { validatePartnerRequest, unauthorizedResponse } from '@/lib/auth/partner';
import { getCached } from '@/lib/cache';
import { rateLimit } from '@/lib/ratelimit';

// Helper to get Org ID from API Key (Mock)
async function getOrgIdFromRequest(req: NextRequest) {
  // In reality, validatePartnerRequest would return the orgId or user context
  // For now, we just check if it's valid, then fetch a demo org
  if (!validatePartnerRequest(req)) return null;
  
  const org = await prisma.organization.findFirst();
  return org?.id || 'org_demo';
}

export async function GET(request: NextRequest) {
  // 1. Rate Limit
  const limiter = rateLimit(request, { limit: 60, windowMs: 60000 }); // 60 req/min
  if (!limiter.success) return limiter.response;

  // 2. Auth
  const organizationId = await getOrgIdFromRequest(request);
  if (!organizationId) {
    return unauthorizedResponse();
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    // 3. Caching Strategy
    // Cache key includes orgId and query params to ensure data isolation and correctness
    const cacheKey = `partner:leads:${organizationId}:${limit}:${status || 'all'}`;

    const leads = await getCached(cacheKey, async () => {
      const where: Prisma.LeadWhereInput = { organizationId };
      if (status) where.status = status;

      return await prisma.lead.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          score: true,
          tier: true,
          status: true,
          createdAt: true,
        }
      });
    }, 30); // Cache for 30 seconds

    return NextResponse.json({ data: leads });
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
    // Allow partners to push leads into the system
    const lead = await prisma.lead.create({
      data: {
        organizationId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        source: 'partner_api',
        status: 'new',
        score: 5, // Default score for external leads
      }
    });

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    console.error('Partner API Create Error', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
