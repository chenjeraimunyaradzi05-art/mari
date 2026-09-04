-- Close friends: a short list a member shares some stories with only.
CREATE TYPE "StatusAudience" AS ENUM ('EVERYONE', 'CLOSE_FRIENDS');

ALTER TABLE "Status" ADD COLUMN "audience" "StatusAudience" NOT NULL DEFAULT 'EVERYONE';

CREATE TABLE "CloseFriend" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloseFriend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CloseFriend_userId_friendId_key" ON "CloseFriend"("userId", "friendId");
CREATE INDEX "CloseFriend_friendId_idx" ON "CloseFriend"("friendId");
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_friendId_fkey"
  FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
