-- The schema half of live-stream moderation, whose code lands alongside this
-- migration. Everything here is additive: four nullable columns on LiveStream
-- and one new table. Nothing is dropped, renamed or retyped, because the
-- production database is shared with an application this repository does not
-- model.

-- ---------------------------------------------------------------------------
-- 1. Slow mode, and a stream staff have taken down.
--
-- slowModeSeconds is the fewest seconds between one viewer's chat lines; null
-- is off. suspendedAt/suspendedById/suspendedReason record a staff takedown:
-- the stream is ENDED as well, but a suspended one cannot be restarted, is not
-- listed, and its ingest key is refused.

ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "slowModeSeconds" INTEGER;
ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "suspendedById" TEXT;
ALTER TABLE "LiveStream" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;

-- ---------------------------------------------------------------------------
-- 2. A viewer the host has muted for a while.
--
-- One row per (stream, viewer); muting again moves `until`. The viewer can still
-- watch, only her chat is refused. userId and mutedById carry no foreign key to
-- User, as with the other tables the erasure register covers by key.

CREATE TABLE IF NOT EXISTS "LiveStreamMute" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutedById" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveStreamMute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveStreamMute_streamId_userId_key" ON "LiveStreamMute"("streamId", "userId");

CREATE INDEX IF NOT EXISTS "LiveStreamMute_until_idx" ON "LiveStreamMute"("until");

-- Dropped first so a re-run after a half-applied attempt does not stop on a
-- constraint that is already there (CREATE TABLE IF NOT EXISTS above is idempotent;
-- a bare ADD CONSTRAINT is not), as the earlier hand-written migrations do.
ALTER TABLE "LiveStreamMute" DROP CONSTRAINT IF EXISTS "LiveStreamMute_streamId_fkey";
ALTER TABLE "LiveStreamMute" ADD CONSTRAINT "LiveStreamMute_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
