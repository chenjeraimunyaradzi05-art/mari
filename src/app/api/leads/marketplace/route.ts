import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type'); // 'job', 'course', etc.
  const minScore = parseInt(searchParams.get('minScore') || '0');

  // Fetch available leads (not yet converted/sold)
  // Look for 'scored' leads which are ready for sale
  const leads = await prisma.lead.findMany({
    where: {
      status: 'scored',
      type: type || undefined,
      score: {
        gte: minScore,
      },
    },
    take: 50,
    orderBy: {
      score: 'desc',
    },
  });

  // Calculate prices (or use stored price)
  const pricedLeads = leads.map((lead) => {
    // Use stored price if available, otherwise calculate
    let priceCents = lead.priceCents || 500; 

    return {
      ...lead,
      priceCents,
      // Mask PII for the marketplace view
      email: '***@***.com',
      phone: '***-***-***',
      lastName: lead.lastName ? lead.lastName[0] + '.' : undefined,
    };
  });

  return NextResponse.json({ leads: pricedLeads });
}

export async function POST(request: NextRequest) {
  // Buy a lead
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { leadId, billingAccountId } = body;

  if (!leadId || !billingAccountId) {
    return NextResponse.json({ error: 'Lead ID and Billing Account ID required' }, { status: 400 });
  }

  // Transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead || lead.status !== 'scored') {
        throw new Error('Lead unavailable');
      }

      const priceCents = lead.priceCents || 500;

      // Create Transaction
      await tx.adTransaction.create({
        data: {
          billingAccountId,
          type: "LEAD_PURCHASE",
          amountCents: -BigInt(priceCents),
          description: `Purchase lead ${lead.id} (${lead.tier})`,
        },
      });

      // Mark as sold and assign to buyer's organization
      // We need the organization ID. Assuming the billing account belongs to the organization or user.
      // For now, let's fetch the billing account to get the owner, or use the session user's org.
      // Ideally, we should pass organizationId in the body or derive it.
      
      // Let's assume the session user's organization is the buyer.
      const user = await tx.user.findUnique({ where: { id: session.user.id } });
      if (!user?.organizationId) {
        throw new Error("User must belong to an organization to buy leads");
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'sold',
          organizationId: user.organizationId, // Assign ownership
        },
      });

      return updatedLead;
    });

    return NextResponse.json({ success: true, lead: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
