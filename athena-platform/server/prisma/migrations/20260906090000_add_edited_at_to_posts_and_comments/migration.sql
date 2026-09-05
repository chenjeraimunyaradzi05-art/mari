-- Posts and comments remember when their words were last changed, so an
-- "Edited" label can be honest. updatedAt already moves on every like and
-- comment count, which is why it could never say this.

ALTER TABLE "Post" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN "editedAt" TIMESTAMP(3);
