/*
  Warnings:

  - You are about to drop the `TranslatedContent` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `timezone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Region" AS ENUM ('ANZ', 'US', 'SEA', 'MEA');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PROCESSING', 'PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('EMPLOYER_BROADCAST', 'MENTOR_BROADCAST', 'COMMUNITY_CHANNEL', 'EDUCATION_CHANNEL', 'CREATOR_CHANNEL');

-- CreateEnum
CREATE TYPE "ApprenticeshipStatus" AS ENUM ('OPEN', 'FILLED', 'CLOSED', 'DRAFT');

-- CreateEnum
CREATE TYPE "ApprenticeshipLevel" AS ENUM ('CERTIFICATE_I', 'CERTIFICATE_II', 'CERTIFICATE_III', 'CERTIFICATE_IV', 'DIPLOMA', 'ADVANCED_DIPLOMA');

-- CreateEnum
CREATE TYPE "ApprenticeshipApplicationStatus" AS ENUM ('SUBMITTED', 'SCREENING', 'INTERVIEW', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('PROFESSIONAL', 'CREATIVE', 'TECHNICAL', 'COACHING', 'TEACHING');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "currency" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentCookies" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentDataProcessing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentDoNotSell" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "preferredCurrency" TEXT NOT NULL DEFAULT 'AUD',
ADD COLUMN     "region" "Region" NOT NULL DEFAULT 'ANZ';

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "type" "VideoType" NOT NULL DEFAULT 'REEL',
    "status" "VideoStatus" NOT NULL DEFAULT 'PROCESSING',
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "aspectRatio" TEXT,
    "audioTrackId" TEXT,
    "captionsUrl" TEXT,
    "hasAutoCaption" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION,
    "engagementScore" DOUBLE PRECISION,
    "relevanceScore" DOUBLE PRECISION,
    "opportunityScore" DOUBLE PRECISION,
    "safetyScore" DOUBLE PRECISION,
    "isMonetized" BOOLEAN NOT NULL DEFAULT false,
    "adRevenue" INTEGER NOT NULL DEFAULT 0,
    "giftRevenue" INTEGER NOT NULL DEFAULT 0,
    "productTags" JSONB,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "moderationFlags" JSONB,
    "hashtags" TEXT[],
    "mentionedUserIds" TEXT[],
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoLike" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoComment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoSave" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoView" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT,
    "watchDuration" INTEGER NOT NULL,
    "completionPct" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioTrack" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "audioUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "licenseType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChannelType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowReplies" BOOLEAN NOT NULL DEFAULT false,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrls" JSONB,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apprenticeship" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "level" "ApprenticeshipLevel" NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "wageMin" INTEGER,
    "wageMax" INTEGER,
    "wagePostCompletion" INTEGER,
    "rtoId" TEXT,
    "hostEmployerId" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Australia',
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "competencies" JSONB,
    "completionRate" INTEGER,
    "employmentRate" INTEGER,
    "womenEnrolled" INTEGER,
    "totalEnrolled" INTEGER,
    "status" "ApprenticeshipStatus" NOT NULL DEFAULT 'DRAFT',
    "positions" INTEGER NOT NULL DEFAULT 1,
    "positionsFilled" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "applicationDeadline" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apprenticeship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprenticeshipApplication" (
    "id" TEXT NOT NULL,
    "apprenticeshipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ApprenticeshipApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "answers" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprenticeshipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillService" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "hourlyRate" INTEGER NOT NULL,
    "minimumHours" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "availabilityJson" JSONB,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBooking" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "providerPayout" INTEGER NOT NULL,
    "clientNotes" TEXT,
    "providerNotes" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "payoutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReview" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "previousValue" INTEGER,
    "newValue" INTEGER,
    "changePercent" DOUBLE PRECISION,
    "jobId" TEXT,
    "courseId" TEXT,
    "apprenticeshipId" TEXT,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderOutcome" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "enrollments" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION,
    "placementCount" INTEGER NOT NULL DEFAULT 0,
    "placementRate" DOUBLE PRECISION,
    "avgSalary" INTEGER,
    "medianSalary" INTEGER,
    "womenEnrolled" INTEGER NOT NULL DEFAULT 0,
    "indigenousEnrolled" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_authorId_idx" ON "Video"("authorId");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "Video_type_idx" ON "Video"("type");

-- CreateIndex
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");

-- CreateIndex
CREATE INDEX "Video_engagementScore_idx" ON "Video"("engagementScore");

-- CreateIndex
CREATE INDEX "VideoLike_videoId_idx" ON "VideoLike"("videoId");

-- CreateIndex
CREATE INDEX "VideoLike_userId_idx" ON "VideoLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoLike_videoId_userId_key" ON "VideoLike"("videoId", "userId");

-- CreateIndex
CREATE INDEX "VideoComment_videoId_idx" ON "VideoComment"("videoId");

-- CreateIndex
CREATE INDEX "VideoComment_authorId_idx" ON "VideoComment"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoSave_videoId_userId_key" ON "VideoSave"("videoId", "userId");

-- CreateIndex
CREATE INDEX "VideoView_videoId_idx" ON "VideoView"("videoId");

-- CreateIndex
CREATE INDEX "VideoView_userId_idx" ON "VideoView"("userId");

-- CreateIndex
CREATE INDEX "VideoView_createdAt_idx" ON "VideoView"("createdAt");

-- CreateIndex
CREATE INDEX "AudioTrack_useCount_idx" ON "AudioTrack"("useCount");

-- CreateIndex
CREATE INDEX "Channel_type_idx" ON "Channel"("type");

-- CreateIndex
CREATE INDEX "Channel_ownerId_idx" ON "Channel"("ownerId");

-- CreateIndex
CREATE INDEX "ChannelMember_channelId_idx" ON "ChannelMember"("channelId");

-- CreateIndex
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMember_channelId_userId_key" ON "ChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "ChannelMessage_channelId_idx" ON "ChannelMessage"("channelId");

-- CreateIndex
CREATE INDEX "ChannelMessage_createdAt_idx" ON "ChannelMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Apprenticeship_slug_key" ON "Apprenticeship"("slug");

-- CreateIndex
CREATE INDEX "Apprenticeship_framework_idx" ON "Apprenticeship"("framework");

-- CreateIndex
CREATE INDEX "Apprenticeship_level_idx" ON "Apprenticeship"("level");

-- CreateIndex
CREATE INDEX "Apprenticeship_status_idx" ON "Apprenticeship"("status");

-- CreateIndex
CREATE INDEX "Apprenticeship_rtoId_idx" ON "Apprenticeship"("rtoId");

-- CreateIndex
CREATE INDEX "Apprenticeship_hostEmployerId_idx" ON "Apprenticeship"("hostEmployerId");

-- CreateIndex
CREATE INDEX "ApprenticeshipApplication_apprenticeshipId_idx" ON "ApprenticeshipApplication"("apprenticeshipId");

-- CreateIndex
CREATE INDEX "ApprenticeshipApplication_userId_idx" ON "ApprenticeshipApplication"("userId");

-- CreateIndex
CREATE INDEX "ApprenticeshipApplication_status_idx" ON "ApprenticeshipApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprenticeshipApplication_apprenticeshipId_userId_key" ON "ApprenticeshipApplication"("apprenticeshipId", "userId");

-- CreateIndex
CREATE INDEX "SkillService_providerId_idx" ON "SkillService"("providerId");

-- CreateIndex
CREATE INDEX "SkillService_category_idx" ON "SkillService"("category");

-- CreateIndex
CREATE INDEX "SkillService_status_idx" ON "SkillService"("status");

-- CreateIndex
CREATE INDEX "SkillService_rating_idx" ON "SkillService"("rating");

-- CreateIndex
CREATE INDEX "ServiceBooking_serviceId_idx" ON "ServiceBooking"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceBooking_clientId_idx" ON "ServiceBooking"("clientId");

-- CreateIndex
CREATE INDEX "ServiceBooking_status_idx" ON "ServiceBooking"("status");

-- CreateIndex
CREATE INDEX "ServiceBooking_scheduledAt_idx" ON "ServiceBooking"("scheduledAt");

-- CreateIndex
CREATE INDEX "ServiceReview_serviceId_idx" ON "ServiceReview"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceReview_clientId_idx" ON "ServiceReview"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReview_serviceId_clientId_bookingId_key" ON "ServiceReview"("serviceId", "clientId", "bookingId");

-- CreateIndex
CREATE INDEX "UserOutcome_userId_idx" ON "UserOutcome"("userId");

-- CreateIndex
CREATE INDEX "UserOutcome_type_idx" ON "UserOutcome"("type");

-- CreateIndex
CREATE INDEX "UserOutcome_achievedAt_idx" ON "UserOutcome"("achievedAt");

-- CreateIndex
CREATE INDEX "ProviderOutcome_organizationId_idx" ON "ProviderOutcome"("organizationId");

-- CreateIndex
CREATE INDEX "ProviderOutcome_periodStart_periodEnd_idx" ON "ProviderOutcome"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "VideoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSave" ADD CONSTRAINT "VideoSave_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSave" ADD CONSTRAINT "VideoSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoView" ADD CONSTRAINT "VideoView_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apprenticeship" ADD CONSTRAINT "Apprenticeship_rtoId_fkey" FOREIGN KEY ("rtoId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apprenticeship" ADD CONSTRAINT "Apprenticeship_hostEmployerId_fkey" FOREIGN KEY ("hostEmployerId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeshipApplication" ADD CONSTRAINT "ApprenticeshipApplication_apprenticeshipId_fkey" FOREIGN KEY ("apprenticeshipId") REFERENCES "Apprenticeship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeshipApplication" ADD CONSTRAINT "ApprenticeshipApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillService" ADD CONSTRAINT "SkillService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SkillService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SkillService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOutcome" ADD CONSTRAINT "UserOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOutcome" ADD CONSTRAINT "ProviderOutcome_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
