import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { IdentityAppealSchema } from '@/lib/validations';

const UNKNOWN_IP = 'unknown';

function buildGating(status: string | null) {
  const normalized = (status ?? 'VERIFIED').toUpperCase();
  const canAppeal = normalized !== 'APPEAL_SUBMITTED' && normalized !== 'VERIFIED';
  return { status: normalized, canAppeal };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { identityFlagStatus: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gating = buildGating(user.identityFlagStatus);
    return NextResponse.json({ gating });
  } catch (error) {
    logger.error('Identity appeal gating fetch failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = IdentityAppealSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, identityFlagStatus: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gating = buildGating(user.identityFlagStatus);

    if (!gating.canAppeal) {
      return NextResponse.json(
        {
          error: gating.status === 'VERIFIED' ? 'No enforcement gating detected for this account' : 'Appeal already submitted',
          gating,
        },
        { status: gating.status === 'VERIFIED' ? 400 : 409 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for') ?? UNKNOWN_IP;

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'identity_appeal_submitted',
        resource: 'identity',
        resourceId: user.id,
        changes: JSON.stringify({
          appealText: validated.appealText,
          enforcementState: validated.enforcementState,
          email: user.email,
        }),
        ipAddress,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { identityFlagStatus: 'APPEAL_SUBMITTED' },
    });

    logger.info('Identity appeal submitted', {
      userId: user.id,
      enforcementState: validated.enforcementState,
    });

    return NextResponse.json({
      status: 'submitted',
      gating: { status: 'APPEAL_SUBMITTED', canAppeal: false },
      message: 'Appeal submitted. Our safety team will review and respond.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }

    logger.error('Identity appeal submission failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
