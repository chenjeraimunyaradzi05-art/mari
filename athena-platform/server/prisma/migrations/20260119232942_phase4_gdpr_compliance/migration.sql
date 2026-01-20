/*
  Warnings:

  - The values [CONVERTED,REWARDED,FRAUD_FLAGGED] on the enum `ReferralStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `convertedAt` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `invitedAt` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `inviteeEmail` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `inviteeId` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `programId` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `rewardedAt` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the `CampaignTrackingEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MarketingCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Partnership` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralProgram` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralStats` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[stripePaymentIntentId]` on the table `MentorSession` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referredId]` on the table `Referral` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `referredId` to the `Referral` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MentorPaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'REFUNDED', 'FAILED', 'CANCELED');

-- AlterEnum
BEGIN;
CREATE TYPE "ReferralStatus_new" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');
ALTER TABLE "public"."Referral" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Referral" ALTER COLUMN "status" TYPE "ReferralStatus_new" USING ("status"::text::"ReferralStatus_new");
ALTER TYPE "ReferralStatus" RENAME TO "ReferralStatus_old";
ALTER TYPE "ReferralStatus_new" RENAME TO "ReferralStatus";
DROP TYPE "public"."ReferralStatus_old";
ALTER TABLE "Referral" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "CampaignTrackingEvent" DROP CONSTRAINT "CampaignTrackingEvent_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignTrackingEvent" DROP CONSTRAINT "CampaignTrackingEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_inviteeId_fkey";

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_programId_fkey";

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_referrerId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralStats" DROP CONSTRAINT "ReferralStats_partnershipId_fkey";

-- DropIndex
DROP INDEX "Referral_inviteeEmail_idx";

-- DropIndex
DROP INDEX "Referral_programId_inviteeId_key";

-- DropIndex
DROP INDEX "Referral_status_idx";

-- AlterTable
ALTER TABLE "MentorProfile" ADD COLUMN     "isMonetized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeAccountId" TEXT;

-- AlterTable
ALTER TABLE "MentorSession" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'AUD',
ADD COLUMN     "mentorPayout" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentAuthorizedAt" TIMESTAMP(3),
ADD COLUMN     "paymentCanceledAt" TIMESTAMP(3),
ADD COLUMN     "paymentCapturedAt" TIMESTAMP(3),
ADD COLUMN     "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "MentorPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "platformFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "sessionAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- AlterTable
ALTER TABLE "Referral" DROP COLUMN "convertedAt",
DROP COLUMN "invitedAt",
DROP COLUMN "inviteeEmail",
DROP COLUMN "inviteeId",
DROP COLUMN "programId",
DROP COLUMN "rewardedAt",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "referredId" TEXT NOT NULL,
ADD COLUMN     "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupSource" TEXT;

-- DropTable
DROP TABLE "CampaignTrackingEvent";

-- DropTable
DROP TABLE "MarketingCampaign";

-- DropTable
DROP TABLE "Partnership";

-- DropTable
DROP TABLE "ReferralProgram";

-- DropTable
DROP TABLE "ReferralStats";

-- DropEnum
DROP TYPE "CampaignStatus";

-- DropEnum
DROP TYPE "PartnerType";

-- DropEnum
DROP TYPE "PartnershipStatus";

-- DropEnum
DROP TYPE "ReferralRewardType";

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
    "allowList" TEXT[],
    "denyList" TEXT[],
    "tags" TEXT[],
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MentorSession_stripePaymentIntentId_key" ON "MentorSession"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "MentorSession_paymentStatus_idx" ON "MentorSession"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
