import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createStream, updateStreamStatus } from '@/lib/streaming';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, title, streamId } = body;
  const userId = (session.user as any).id;

  try {
    if (action === 'create') {
      const stream = await createStream(userId, title || 'Untitled Stream');
      return NextResponse.json({ stream });
    } else if (action === 'start') {
      const stream = await updateStreamStatus(streamId, 'live');
      return NextResponse.json({ stream });
    } else if (action === 'end') {
      const stream = await updateStreamStatus(streamId, 'ended');
      return NextResponse.json({ stream });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Stream API Error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
