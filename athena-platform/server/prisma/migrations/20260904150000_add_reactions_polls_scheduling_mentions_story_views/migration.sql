-- Social features the feed had no columns for: reactions with a meaning,
-- polls, wins, scheduled posts, @mentions, likes on comments and seen state
-- plus captions on stories.
--
-- Hand-written, additive and non-destructive. Every existing Like becomes a
-- LIKE reaction (the default), every existing post keeps its type, and a
-- story with no views simply has no StatusView rows.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md.

-- Two more kinds of post. The values are only used by later requests, never
-- inside this migration, which is what Postgres requires of a new enum value.
ALTER TYPE "PostType" ADD VALUE 'POLL';
ALTER TYPE "PostType" ADD VALUE 'WIN';

-- Reactions: one row per member per post, typed.
ALTER TABLE "Like" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'LIKE';

-- Polls, scheduling and mentions on Post.
ALTER TABLE "Post" ADD COLUMN "poll" JSONB;
ALTER TABLE "Post" ADD COLUMN "scheduledFor" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "mentionedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Post_scheduledFor_idx" ON "Post"("scheduledFor");

CREATE TABLE "PollVote" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PollVote_postId_userId_key" ON "PollVote"("postId", "userId");
CREATE INDEX "PollVote_postId_idx" ON "PollVote"("postId");
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Likes on comments. Comment.likeCount existed with nothing writing it.
CREATE TABLE "CommentLike" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId");
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stories: a caption, and who has seen them.
ALTER TABLE "Status" ADD COLUMN "caption" TEXT;
ALTER TABLE "Status" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StatusView" (
  "id" TEXT NOT NULL,
  "statusId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StatusView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatusView_statusId_userId_key" ON "StatusView"("statusId", "userId");
CREATE INDEX "StatusView_userId_idx" ON "StatusView"("userId");
ALTER TABLE "StatusView" ADD CONSTRAINT "StatusView_statusId_fkey"
  FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusView" ADD CONSTRAINT "StatusView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
