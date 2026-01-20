-- CreateEnum
CREATE TYPE "VerificationBadgeType" AS ENUM ('IDENTITY', 'EMPLOYER', 'EDUCATOR', 'MENTOR', 'CREATOR');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppealType" AS ENUM ('CONTENT_MODERATION', 'ACCOUNT_SUSPENSION', 'VERIFICATION_DECISION', 'OTHER');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_VERIFICATION_APPROVE';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_VERIFICATION_REJECT';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_APPEAL_DECISION';
ALTER TYPE "AuditAction" ADD VALUE 'USER_VERIFICATION_SUBMIT';
ALTER TYPE "AuditAction" ADD VALUE 'USER_APPEAL_SUBMIT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trustScore" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "trustScoreUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VerificationBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationBadgeType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "reason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "VerificationBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AppealType" NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationBadge_userId_idx" ON "VerificationBadge"("userId");

-- CreateIndex
CREATE INDEX "VerificationBadge_type_status_idx" ON "VerificationBadge"("type", "status");

-- CreateIndex
CREATE INDEX "Appeal_userId_idx" ON "Appeal"("userId");

-- CreateIndex
CREATE INDEX "Appeal_status_idx" ON "Appeal"("status");

-- AddForeignKey
ALTER TABLE "VerificationBadge" ADD CONSTRAINT "VerificationBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationBadge" ADD CONSTRAINT "VerificationBadge_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
