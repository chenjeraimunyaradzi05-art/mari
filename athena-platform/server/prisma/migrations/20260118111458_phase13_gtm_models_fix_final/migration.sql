/*
  Warnings:

  - The values [COMPLETED] on the enum `ReferralStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `completedAt` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `referredId` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `rewardGranted` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `signupSource` on the `Referral` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[programId,inviteeId]` on the table `Referral` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `programId` to the `Referral` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('CREDIT', 'CASH', 'PREMIUM_ACCESS', 'MERCH');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('UNIVERSITY', 'GOVERNMENT', 'CORPORATE', 'NON_PROFIT', 'INFLUENCER');

-- CreateEnum
CREATE TYPE "PartnershipStatus" AS ENUM ('PROSPECT', 'NEGOTIATION', 'SIGNED', 'ACTIVE', 'TERMINATED');

-- AlterEnum
BEGIN;
CREATE TYPE "ReferralStatus_new" AS ENUM ('PENDING', 'CONVERTED', 'REWARDED', 'EXPIRED', 'FRAUD_FLAGGED');
ALTER TABLE "public"."Referral" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Referral" ALTER COLUMN "status" TYPE "ReferralStatus_new" USING ("status"::text::"ReferralStatus_new");
ALTER TYPE "ReferralStatus" RENAME TO "ReferralStatus_old";
ALTER TYPE "ReferralStatus_new" RENAME TO "ReferralStatus";
DROP TYPE "public"."ReferralStatus_old";
ALTER TABLE "Referral" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_referredId_fkey";

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_referrerId_fkey";

-- DropIndex
DROP INDEX "Referral_referredId_key";

-- AlterTable
ALTER TABLE "Referral" DROP COLUMN "completedAt",
DROP COLUMN "createdAt",
DROP COLUMN "referredId",
DROP COLUMN "rewardGranted",
DROP COLUMN "signupSource",
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "inviteeEmail" TEXT,
ADD COLUMN     "inviteeId" TEXT,
ADD COLUMN     "programId" TEXT NOT NULL,
ADD COLUMN     "rewardedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReferralProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "referrerRewardAmount" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "inviteeRewardAmount" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "rewardType" "ReferralRewardType" NOT NULL DEFAULT 'CREDIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "term" TEXT,
    "content" TEXT,
    "budget" DECIMAL(65,30),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTrackingEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "visitorId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerType" "PartnerType" NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "status" "PartnershipStatus" NOT NULL DEFAULT 'NEGOTIATION',
    "agreementStart" TIMESTAMP(3),
    "agreementEnd" TIMESTAMP(3),
    "dealValue" DECIMAL(65,30),
    "commissionRate" DOUBLE PRECISION,
    "integrationType" TEXT,
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralStats" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenueGenerated" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignTrackingEvent_campaignId_eventType_idx" ON "CampaignTrackingEvent"("campaignId", "eventType");

-- CreateIndex
CREATE INDEX "CampaignTrackingEvent_userId_idx" ON "CampaignTrackingEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Partnership_apiKey_key" ON "Partnership"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralStats_partnershipId_period_key" ON "ReferralStats"("partnershipId", "period");

-- CreateIndex
CREATE INDEX "Referral_inviteeEmail_idx" ON "Referral"("inviteeEmail");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_programId_inviteeId_key" ON "Referral"("programId", "inviteeId");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTrackingEvent" ADD CONSTRAINT "CampaignTrackingEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTrackingEvent" ADD CONSTRAINT "CampaignTrackingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralStats" ADD CONSTRAINT "ReferralStats_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
