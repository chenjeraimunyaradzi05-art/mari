-- Health and wellness: the trackers (encrypted at rest), medications, notes
-- and share links; the mental load log; the moderated forums; the support
-- circles; the practitioner directory with bookings and verified reviews;
-- habits, challenges and wellness goals.

-- CreateEnum
CREATE TYPE "HealthEntryKind" AS ENUM ('CHECKIN', 'SLEEP', 'ACTIVITY', 'NUTRITION', 'HYDRATION', 'PERIOD', 'SYMPTOM', 'MEDICATION_DOSE');

-- CreateEnum
CREATE TYPE "MentalLoadCategory" AS ENUM ('HOUSEHOLD', 'CHILDCARE', 'ADMIN', 'EMOTIONAL', 'CARE', 'PLANNING', 'WORK_OVERFLOW', 'OTHER');

-- CreateEnum
CREATE TYPE "MentalLoadCarrier" AS ENUM ('ME', 'PARTNER', 'SHARED', 'OTHER');

-- CreateEnum
CREATE TYPE "CircleFormat" AS ENUM ('VIDEO', 'ASYNC', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "CircleStatus" AS ENUM ('OPEN', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CircleRole" AS ENUM ('FACILITATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "PractitionerKind" AS ENUM ('GP', 'OBGYN', 'PSYCHOLOGIST', 'PSYCHIATRIST', 'COUNSELLOR', 'THERAPIST', 'NUTRITIONIST', 'DIETITIAN', 'DERMATOLOGIST', 'SPORTS_MEDICINE', 'PHYSIOTHERAPIST', 'MIDWIFE', 'PELVIC_HEALTH', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "HealthBookingMode" AS ENUM ('TELEHEALTH', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "HealthBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "HabitDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "WellnessMetric" AS ENUM ('SLEEP_HOURS', 'ACTIVITY_SESSIONS', 'ACTIVITY_MINUTES', 'CHECKIN_DAYS', 'HYDRATION_GLASSES', 'MEDITATION_DAYS', 'STEPS');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAY', 'WEEK');

-- CreateEnum
CREATE TYPE "WellnessGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ACHIEVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "HealthEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "HealthEntryKind" NOT NULL,
    "day" DATE NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackers" JSONB NOT NULL,
    "cycleLengthHint" INTEGER,
    "periodLengthHint" INTEGER,
    "hiddenWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anonymousByDefault" BOOLEAN NOT NULL DEFAULT false,
    "checkInReminderHour" INTEGER,
    "shareWithPractitioners" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "times" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "repeatsLeft" INTEGER,
    "nextRefillDue" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "label" TEXT,
    "bookingId" TEXT,
    "days" INTEGER NOT NULL DEFAULT 90,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentalLoadEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "category" "MentalLoadCategory" NOT NULL,
    "task" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "carriedBy" "MentalLoadCarrier" NOT NULL DEFAULT 'ME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentalLoadEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessForum" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "guidelines" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessForum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessPost" (
    "id" TEXT NOT NULL,
    "forumId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentWarning" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenReason" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "crisisFlagged" BOOLEAN NOT NULL DEFAULT false,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "supportCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessReply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isFromModerator" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessSupport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessCircle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "facilitatorId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 6,
    "weeks" INTEGER NOT NULL DEFAULT 8,
    "startsOn" DATE NOT NULL,
    "meetingDay" INTEGER NOT NULL,
    "meetingTime" TEXT NOT NULL,
    "format" "CircleFormat" NOT NULL DEFAULT 'VIDEO',
    "meetingLink" TEXT,
    "location" TEXT,
    "status" "CircleStatus" NOT NULL DEFAULT 'OPEN',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessCircle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessCircleMember" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CircleRole" NOT NULL DEFAULT 'MEMBER',
    "continueRequested" BOOLEAN NOT NULL DEFAULT false,
    "leftAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessCircleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessCircleCheckIn" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "mood" INTEGER NOT NULL,
    "wins" TEXT NOT NULL,
    "blockers" TEXT NOT NULL,
    "nextStep" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessCircleCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthPractitioner" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PractitionerKind" NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "qualifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY['English']::TEXT[],
    "suburb" TEXT,
    "city" TEXT,
    "state" TEXT,
    "telehealth" BOOLEAN NOT NULL DEFAULT true,
    "inPerson" BOOLEAN NOT NULL DEFAULT false,
    "bulkBilling" BOOLEAN NOT NULL DEFAULT false,
    "medicareRebate" BOOLEAN NOT NULL DEFAULT false,
    "privateHealth" BOOLEAN NOT NULL DEFAULT false,
    "feeFrom" DECIMAL(65,30),
    "feeNote" TEXT,
    "ahpraNumber" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "bookingUrl" TEXT,
    "availability" JSONB,
    "slotMinutes" INTEGER NOT NULL DEFAULT 50,
    "acceptsBookings" BOOLEAN NOT NULL DEFAULT true,
    "ownerUserId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ratingAvg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthPractitioner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthBooking" (
    "id" TEXT NOT NULL,
    "practitionerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 50,
    "mode" "HealthBookingMode" NOT NULL DEFAULT 'TELEHEALTH',
    "reason" TEXT,
    "status" "HealthBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "practitionerNote" TEXT,
    "meetingLink" TEXT,
    "shareId" TEXT,
    "followUpOfId" TEXT,
    "followUpCheckSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthReview" (
    "id" TEXT NOT NULL,
    "practitionerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateKey" TEXT,
    "difficulty" "HabitDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "targetPerWeek" INTEGER NOT NULL DEFAULT 7,
    "cue" TEXT,
    "reminderTime" TEXT,
    "evidenceNote" TEXT,
    "evidenceUrl" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessChallenge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "habitTemplateKey" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessChallengeMember" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessChallengeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "WellnessMetric" NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "period" "GoalPeriod" NOT NULL DEFAULT 'WEEK',
    "label" TEXT,
    "startedOn" DATE NOT NULL,
    "reviewEveryWeeks" INTEGER NOT NULL DEFAULT 4,
    "nextReviewOn" DATE NOT NULL,
    "status" "WellnessGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "weeksMet" INTEGER NOT NULL DEFAULT 0,
    "bestStreakWeeks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthEntry_userId_kind_day_idx" ON "HealthEntry"("userId", "kind", "day");

-- CreateIndex
CREATE INDEX "HealthEntry_userId_day_idx" ON "HealthEntry"("userId", "day");

-- CreateIndex
CREATE INDEX "HealthEntry_refId_idx" ON "HealthEntry"("refId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthSettings_userId_key" ON "HealthSettings"("userId");

-- CreateIndex
CREATE INDEX "Medication_userId_isActive_idx" ON "Medication"("userId", "isActive");

-- CreateIndex
CREATE INDEX "HealthNote_userId_idx" ON "HealthNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthShare_token_key" ON "HealthShare"("token");

-- CreateIndex
CREATE INDEX "HealthShare_userId_idx" ON "HealthShare"("userId");

-- CreateIndex
CREATE INDEX "MentalLoadEntry_userId_day_idx" ON "MentalLoadEntry"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessForum_slug_key" ON "WellnessForum"("slug");

-- CreateIndex
CREATE INDEX "WellnessPost_forumId_isHidden_createdAt_idx" ON "WellnessPost"("forumId", "isHidden", "createdAt");

-- CreateIndex
CREATE INDEX "WellnessPost_authorId_idx" ON "WellnessPost"("authorId");

-- CreateIndex
CREATE INDEX "WellnessReply_postId_createdAt_idx" ON "WellnessReply"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "WellnessReply_authorId_idx" ON "WellnessReply"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessSupport_postId_userId_key" ON "WellnessSupport"("postId", "userId");

-- CreateIndex
CREATE INDEX "WellnessCircle_status_startsOn_idx" ON "WellnessCircle"("status", "startsOn");

-- CreateIndex
CREATE INDEX "WellnessCircle_topic_idx" ON "WellnessCircle"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessCircleMember_circleId_userId_key" ON "WellnessCircleMember"("circleId", "userId");

-- CreateIndex
CREATE INDEX "WellnessCircleMember_userId_idx" ON "WellnessCircleMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessCircleCheckIn_circleId_userId_week_key" ON "WellnessCircleCheckIn"("circleId", "userId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "HealthPractitioner_slug_key" ON "HealthPractitioner"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HealthPractitioner_ownerUserId_key" ON "HealthPractitioner"("ownerUserId");

-- CreateIndex
CREATE INDEX "HealthPractitioner_kind_state_idx" ON "HealthPractitioner"("kind", "state");

-- CreateIndex
CREATE INDEX "HealthPractitioner_isActive_isVerified_idx" ON "HealthPractitioner"("isActive", "isVerified");

-- CreateIndex
CREATE INDEX "HealthBooking_practitionerId_scheduledAt_idx" ON "HealthBooking"("practitionerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "HealthBooking_userId_scheduledAt_idx" ON "HealthBooking"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "HealthBooking_status_idx" ON "HealthBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HealthReview_bookingId_key" ON "HealthReview"("bookingId");

-- CreateIndex
CREATE INDEX "HealthReview_practitionerId_idx" ON "HealthReview"("practitionerId");

-- CreateIndex
CREATE INDEX "Habit_userId_isArchived_idx" ON "Habit"("userId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_habitId_day_key" ON "HabitLog"("habitId", "day");

-- CreateIndex
CREATE INDEX "WellnessChallenge_startsOn_endsOn_idx" ON "WellnessChallenge"("startsOn", "endsOn");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessChallengeMember_challengeId_userId_key" ON "WellnessChallengeMember"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "WellnessGoal_userId_status_idx" ON "WellnessGoal"("userId", "status");

-- AddForeignKey
ALTER TABLE "HealthEntry" ADD CONSTRAINT "HealthEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSettings" ADD CONSTRAINT "HealthSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthNote" ADD CONSTRAINT "HealthNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthShare" ADD CONSTRAINT "HealthShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalLoadEntry" ADD CONSTRAINT "MentalLoadEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessPost" ADD CONSTRAINT "WellnessPost_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "WellnessForum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessPost" ADD CONSTRAINT "WellnessPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessReply" ADD CONSTRAINT "WellnessReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "WellnessPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessReply" ADD CONSTRAINT "WellnessReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessSupport" ADD CONSTRAINT "WellnessSupport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "WellnessPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessSupport" ADD CONSTRAINT "WellnessSupport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessCircle" ADD CONSTRAINT "WellnessCircle_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessCircleMember" ADD CONSTRAINT "WellnessCircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "WellnessCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessCircleMember" ADD CONSTRAINT "WellnessCircleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessCircleCheckIn" ADD CONSTRAINT "WellnessCircleCheckIn_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "WellnessCircle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessCircleCheckIn" ADD CONSTRAINT "WellnessCircleCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthPractitioner" ADD CONSTRAINT "HealthPractitioner_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthBooking" ADD CONSTRAINT "HealthBooking_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "HealthPractitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthBooking" ADD CONSTRAINT "HealthBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthBooking" ADD CONSTRAINT "HealthBooking_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "HealthBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthReview" ADD CONSTRAINT "HealthReview_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "HealthPractitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthReview" ADD CONSTRAINT "HealthReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthReview" ADD CONSTRAINT "HealthReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "HealthBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessChallenge" ADD CONSTRAINT "WellnessChallenge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessChallengeMember" ADD CONSTRAINT "WellnessChallengeMember_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WellnessChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessChallengeMember" ADD CONSTRAINT "WellnessChallengeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessGoal" ADD CONSTRAINT "WellnessGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
