-- Group posts become real posts, so they get reactions, comments, mentions,
-- media, polls and everything else a post has. Post.groupId says which group
-- a post lives in; the old GroupPost rows are copied across (same ids) and
-- left in place for the admin and export paths that still read them.

ALTER TABLE "Post" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Post_groupId_createdAt_idx" ON "Post"("groupId", "createdAt");
ALTER TABLE "Post" ADD CONSTRAINT "Post_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Post" ("id", "authorId", "type", "content", "mediaUrls", "isPublic", "groupId", "createdAt", "updatedAt")
SELECT gp."id", gp."authorId", 'TEXT', gp."content", '[]'::jsonb, true, gp."groupId", gp."createdAt", gp."createdAt"
FROM "GroupPost" gp
WHERE NOT EXISTS (SELECT 1 FROM "Post" p WHERE p."id" = gp."id");
