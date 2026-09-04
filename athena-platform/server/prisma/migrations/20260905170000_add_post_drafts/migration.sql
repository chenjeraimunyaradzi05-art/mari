-- Post drafts: what a member is writing, kept until published or discarded.
CREATE TABLE "PostDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'TEXT',
  "content" TEXT NOT NULL,
  "mediaUrls" JSONB,
  "mediaAlt" JSONB,
  "poll" JSONB,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isSensitive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PostDraft_userId_updatedAt_idx" ON "PostDraft"("userId", "updatedAt");
ALTER TABLE "PostDraft" ADD CONSTRAINT "PostDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
