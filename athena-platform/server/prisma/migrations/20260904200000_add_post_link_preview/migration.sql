-- Link previews: the Open Graph card for the first link in a post, fetched
-- after the post is stored so posting never waits on someone else's server.
--
-- Hand-written, additive and non-destructive; existing posts have no card
-- until they are edited. See docs/runbooks/SHARED-DATABASE-HAZARD.md.

ALTER TABLE "Post" ADD COLUMN "linkPreview" JSONB;
