-- Reposts and quote posts, post impressions, saved-post collections and
-- story highlights. Additive only: every column is nullable or defaulted.

-- Reposts
ALTER TABLE "Post" ADD COLUMN "repostOfId" TEXT;
ALTER TABLE "Post" ADD COLUMN "repostCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN "impressionCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Post_repostOfId_idx" ON "Post"("repostOfId");
ALTER TABLE "Post" ADD CONSTRAINT "Post_repostOfId_fkey"
  FOREIGN KEY ("repostOfId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Impressions: one row per viewer per post
CREATE TABLE "PostImpression" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "userId" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostImpression_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostImpression_postId_viewerKey_key" ON "PostImpression"("postId", "viewerKey");
CREATE INDEX "PostImpression_postId_createdAt_idx" ON "PostImpression"("postId", "createdAt");
ALTER TABLE "PostImpression" ADD CONSTRAINT "PostImpression_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Saved collections
CREATE TABLE "SavedCollection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedCollection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedCollection_userId_idx" ON "SavedCollection"("userId");
ALTER TABLE "SavedCollection" ADD CONSTRAINT "SavedCollection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostSave" ADD COLUMN "collectionId" TEXT;
CREATE INDEX "PostSave_collectionId_idx" ON "PostSave"("collectionId");
ALTER TABLE "PostSave" ADD CONSTRAINT "PostSave_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "SavedCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Story highlights
CREATE TABLE "StoryHighlight" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "coverUrl" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryHighlight_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoryHighlight_userId_idx" ON "StoryHighlight"("userId");
ALTER TABLE "StoryHighlight" ADD CONSTRAINT "StoryHighlight_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoryHighlightItem" (
  "id" TEXT NOT NULL,
  "highlightId" TEXT NOT NULL,
  "statusId" TEXT,
  "type" "StatusType" NOT NULL DEFAULT 'IMAGE',
  "mediaUrl" TEXT NOT NULL,
  "caption" TEXT,
  "takenAt" TIMESTAMP(3) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryHighlightItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoryHighlightItem_highlightId_statusId_key" ON "StoryHighlightItem"("highlightId", "statusId");
CREATE INDEX "StoryHighlightItem_highlightId_idx" ON "StoryHighlightItem"("highlightId");
ALTER TABLE "StoryHighlightItem" ADD CONSTRAINT "StoryHighlightItem_highlightId_fkey"
  FOREIGN KEY ("highlightId") REFERENCES "StoryHighlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
