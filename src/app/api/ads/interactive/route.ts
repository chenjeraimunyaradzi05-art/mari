import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const InteractiveEventSchema = z.object({
  type: z.enum([
    'quiz_answer', 
    'slide_change', 
    'form_submit', 
    'ar_engage', 
    'choice_select', 
    'audio_listen', 
    'stream_overlay_click'
  ]),
  creativeId: z.string(),
  payload: z.record(z.string(), z.any()),
  userId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, creativeId, payload, userId } = InteractiveEventSchema.parse(body);

    // Record the event
    await prisma.interactiveAdEvent.create({
      data: {
        type,
        creativeId,
        userId,
        payload: payload as any,
        format: 'interactive', // Generic for now, could be specific
      },
    });

    // If it's a form submit, create a Lead
    if (type === 'form_submit') {
      // Fetch creative to get organizationId
      const creative = await prisma.adCreative.findUnique({
        where: { id: creativeId },
        select: { organizationId: true }
      });

      if (creative) {
        await prisma.lead.create({
          data: {
            organizationId: creative.organizationId,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone,
            source: 'ad_form',
            status: 'new',
            score: 10, // Base score for direct form fill
            tier: 'warm',
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Interactive event error', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
