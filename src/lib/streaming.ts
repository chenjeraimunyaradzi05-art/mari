import { prisma } from '@/lib/db';

export async function createStream(creatorId: string, title: string) {
  // In a real app, we would call Mux/AWS IVS here to get stream keys
  const streamKey = `sk_${Math.random().toString(36).substring(7)}`;
  const playbackId = `pid_${Math.random().toString(36).substring(7)}`;

  const stream = await prisma.liveStream.create({
    data: {
      creatorId,
      title,
      status: 'scheduled',
      // We would store the external IDs here if we had fields for them
      // For MVP, we assume they are derived or stored in a JSON field if needed
    },
  });

  return {
    ...stream,
    streamKey,
    playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`, // Mock URL
  };
}

export async function updateStreamStatus(streamId: string, status: 'live' | 'ended') {
  const data: any = { status };
  
  if (status === 'live') {
    data.startedAt = new Date();
  } else if (status === 'ended') {
    data.endedAt = new Date();
  }

  return await prisma.liveStream.update({
    where: { id: streamId },
    data,
  });
}
