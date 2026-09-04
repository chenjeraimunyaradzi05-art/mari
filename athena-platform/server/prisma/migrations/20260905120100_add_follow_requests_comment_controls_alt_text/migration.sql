-- Follow requests for members who approve their followers, comment controls
-- for authors (comments off, one pinned comment) and alt text for post
-- images. Additive only.

CREATE TYPE "FollowRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "FollowRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "status" "FollowRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FollowRequest_requesterId_targetId_key" ON "FollowRequest"("requesterId", "targetId");
CREATE INDEX "FollowRequest_targetId_status_idx" ON "FollowRequest"("targetId", "status");
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Post" ADD COLUMN "commentsOff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "mediaAlt" JSONB;
ALTER TABLE "Comment" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
