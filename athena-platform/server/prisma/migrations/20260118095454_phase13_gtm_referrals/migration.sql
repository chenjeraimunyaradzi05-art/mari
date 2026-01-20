/*
  Warnings:

  - You are about to drop the `BetaTester` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MarketingCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MarketingEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MarketingEventRegistration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MarketingReferral` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Partnership` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserAcquisition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Waitlist` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BetaTester" DROP CONSTRAINT "BetaTester_userId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingEventRegistration" DROP CONSTRAINT "MarketingEventRegistration_eventId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingEventRegistration" DROP CONSTRAINT "MarketingEventRegistration_userId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingReferral" DROP CONSTRAINT "MarketingReferral_refereeId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingReferral" DROP CONSTRAINT "MarketingReferral_referralCodeId_fkey";

-- DropForeignKey
ALTER TABLE "MarketingReferral" DROP CONSTRAINT "MarketingReferral_referrerId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralCode" DROP CONSTRAINT "ReferralCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserAcquisition" DROP CONSTRAINT "UserAcquisition_userId_fkey";

-- DropTable
DROP TABLE "BetaTester";

-- DropTable
DROP TABLE "EmailCampaign";

-- DropTable
DROP TABLE "MarketingCampaign";

-- DropTable
DROP TABLE "MarketingEvent";

-- DropTable
DROP TABLE "MarketingEventRegistration";

-- DropTable
DROP TABLE "MarketingReferral";

-- DropTable
DROP TABLE "Partnership";

-- DropTable
DROP TABLE "ReferralCode";

-- DropTable
DROP TABLE "UserAcquisition";

-- DropTable
DROP TABLE "Waitlist";
