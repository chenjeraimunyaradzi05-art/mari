-- Reel duets and sensitive-content posts.
--
-- Hand-written, additive and non-destructive. Existing reels are not duets
-- (null) and have no duets made with them (0); existing posts are not
-- sensitive. See docs/runbooks/SHARED-DATABASE-HAZARD.md.

ALTER TABLE "Video" ADD COLUMN "duetOfVideoId" TEXT;
ALTER TABLE "Video" ADD COLUMN "duetCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Video_duetOfVideoId_idx" ON "Video"("duetOfVideoId");

ALTER TABLE "Post" ADD COLUMN "isSensitive" BOOLEAN NOT NULL DEFAULT false;
