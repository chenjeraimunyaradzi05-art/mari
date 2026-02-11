-- AlterTable: Add missing revokedAt and updatedAt columns to Session table.
-- The Prisma schema included these fields but no migration was generated.
-- revokedAt is used by sessionService to track revoked/invalidated sessions.
-- updatedAt is required by the @updatedAt Prisma directive.

ALTER TABLE "Session" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");
