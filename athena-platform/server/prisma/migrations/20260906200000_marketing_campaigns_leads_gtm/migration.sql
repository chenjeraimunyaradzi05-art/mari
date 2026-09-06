-- The records behind the marketing hub and the go-to-market board:
-- campaigns, leads (waitlist, sales enquiries, partners, press, influencers)
-- and launch initiatives.
CREATE TYPE "CampaignChannel" AS ENUM ('EMAIL', 'SOCIAL', 'PAID_SOCIAL', 'SEARCH', 'PARTNER', 'EVENT', 'PRESS', 'REFERRAL', 'IN_APP', 'INFLUENCER');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "LeadSource" AS ENUM ('WAITLIST', 'CONTACT_SALES', 'PARTNER', 'PRESS', 'INFLUENCER', 'EVENT', 'REFERRAL', 'WEBSITE', 'IMPORT', 'OTHER');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');
CREATE TYPE "InitiativeStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'BLOCKED', 'DONE');

CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "channel" "CampaignChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" TEXT,
    "budgetCents" INTEGER,
    "spentCents" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "utmCampaign" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingCampaign_utmCampaign_key" ON "MarketingCampaign"("utmCampaign");
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");
CREATE INDEX "MarketingCampaign_channel_idx" ON "MarketingCampaign"("channel");

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "organisation" TEXT,
    "role" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "interest" TEXT,
    "message" TEXT,
    "campaignId" TEXT,
    "ownerId" TEXT,
    "notes" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "convertedUserId" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Lead_email_source_key" ON "Lead"("email", "source");
CREATE INDEX "Lead_source_status_idx" ON "Lead"("source", "status");
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GtmInitiative" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" TEXT NOT NULL DEFAULT 'launch',
    "status" "InitiativeStatus" NOT NULL DEFAULT 'PLANNED',
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GtmInitiative_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GtmInitiative_status_idx" ON "GtmInitiative"("status");
CREATE INDEX "GtmInitiative_area_position_idx" ON "GtmInitiative"("area", "position");
