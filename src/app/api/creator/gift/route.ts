import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendGift, GiftType } from '@/lib/gifting';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { creatorId, giftType } = body;
  const senderId = (session.user as any).id;

  if (!creatorId || !giftType) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    // In a real app, we would check sender's coin balance here first!
    const transaction = await sendGift(senderId, creatorId, giftType as GiftType);
    
    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Gift API Error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
