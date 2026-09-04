-- Four social features that had UI or drafts but no schema behind them:
-- disappearing messages, reel sounds, the video processing pipeline and
-- live streams.
--
-- Hand-written, additive and non-destructive. Every new column is nullable or
-- defaulted, so existing rows keep their meaning: a conversation with a null
-- TTL keeps its messages, a video with progress 0 and no processedAt is one
-- that was published before the pipeline existed, and a gift with no streamId
-- was sent from a profile or a reel.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md.

-- ===========================================
-- Disappearing messages
-- ===========================================
-- The TTL lives on the conversation; each message is stamped with its own
-- expiry at send time so a later change of setting does not retroactively
-- delete (or resurrect) anything.
ALTER TABLE "Conversation" ADD COLUMN "disappearingTtlSeconds" INTEGER;
ALTER TABLE "Message" ADD COLUMN "expiresAt" TIMESTAMP(3);
CREATE INDEX "Message_expiresAt_idx" ON "Message"("expiresAt");

-- ===========================================
-- Sounds
-- ===========================================
ALTER TABLE "AudioTrack" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "AudioTrack" ADD COLUMN "createdById" TEXT;
ALTER TABLE "AudioTrack" ADD COLUMN "sourceVideoId" TEXT;
ALTER TABLE "AudioTrack" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "AudioTrack_sourceVideoId_key" ON "AudioTrack"("sourceVideoId");
CREATE INDEX "AudioTrack_createdById_idx" ON "AudioTrack"("createdById");
ALTER TABLE "AudioTrack" ADD CONSTRAINT "AudioTrack_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Trending sounds count the reels using each track.
CREATE INDEX "Video_audioTrackId_idx" ON "Video"("audioTrackId");

-- ===========================================
-- Video processing
-- ===========================================
ALTER TABLE "Video" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Video" ADD COLUMN "width" INTEGER;
ALTER TABLE "Video" ADD COLUMN "height" INTEGER;
ALTER TABLE "Video" ADD COLUMN "processingProgress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Video" ADD COLUMN "processingError" TEXT;
ALTER TABLE "Video" ADD COLUMN "processedAt" TIMESTAMP(3);

-- ===========================================
-- Live streams
-- ===========================================
CREATE TYPE "LiveStreamStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');

CREATE TABLE "LiveStream" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "thumbnailUrl" TEXT,
  "status" "LiveStreamStatus" NOT NULL DEFAULT 'SCHEDULED',
  "streamKey" TEXT NOT NULL,
  "ingestUrl" TEXT,
  "playbackUrl" TEXT,
  "viewerCount" INTEGER NOT NULL DEFAULT 0,
  "peakViewers" INTEGER NOT NULL DEFAULT 0,
  "totalGiftPoints" INTEGER NOT NULL DEFAULT 0,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "scheduledFor" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "replayVideoId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiveStream_streamKey_key" ON "LiveStream"("streamKey");
CREATE INDEX "LiveStream_status_startedAt_idx" ON "LiveStream"("status", "startedAt");
CREATE INDEX "LiveStream_hostId_idx" ON "LiveStream"("hostId");
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LiveStreamMessage" (
  "id" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveStreamMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiveStreamMessage_streamId_createdAt_idx" ON "LiveStreamMessage"("streamId", "createdAt");
ALTER TABLE "LiveStreamMessage" ADD CONSTRAINT "LiveStreamMessage_streamId_fkey"
  FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveStreamMessage" ADD CONSTRAINT "LiveStreamMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A gift sent during a stream is attributed to it. Existing gifts stay null.
ALTER TABLE "GiftTransaction" ADD COLUMN "streamId" TEXT;
CREATE INDEX "GiftTransaction_streamId_idx" ON "GiftTransaction"("streamId");
ALTER TABLE "GiftTransaction" ADD CONSTRAINT "GiftTransaction_streamId_fkey"
  FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;
