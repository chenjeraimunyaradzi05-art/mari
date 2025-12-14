import { prisma } from "@/lib/prisma";
import { StreamPlayer } from "@/components/streaming/StreamPlayer";
import { notFound } from "next/navigation";

interface LivePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LivePage({ params }: LivePageProps) {
  const { id } = await params;
  const stream = await prisma.liveStream.findUnique({
    where: { id },
    // include: { creator: true } // Assuming relation exists, if not we mock name
  });

  if (!stream) {
    return notFound();
  }

  // Mock creator name if relation not set up in schema yet
  const creatorName = "Creator " + stream.creatorId.substring(0, 4);

  return (
    <div className="container mx-auto py-6">
      <StreamPlayer 
        streamId={stream.id}
        playbackUrl="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" // Mock URL
        title={stream.title}
        creatorId={stream.creatorId}
        creatorName={creatorName}
      />
    </div>
  );
}
