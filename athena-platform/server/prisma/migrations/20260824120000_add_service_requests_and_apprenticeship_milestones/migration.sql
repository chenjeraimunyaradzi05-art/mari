-- Two features that had client API helpers but no storage behind them:
--
--   1. Marketplace custom requests. The reverse of a SkillService listing: a
--      buyer posts a brief and providers pitch for it.
--   2. Apprenticeship milestones. Units of competency an apprentice submits
--      evidence against, which is what "progress" and "certificate" are
--      derived from.
--
-- Hand-written rather than generated from the live datasource: that database
-- carries tables this schema does not model, so a generated diff drops them.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md. Additive only.

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'AWARDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ServiceProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MilestoneSubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "budgetMin" INTEGER NOT NULL,
    "budgetMax" INTEGER NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "attachments" TEXT[],
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_clientId_idx" ON "ServiceRequest"("clientId");

-- CreateIndex
CREATE INDEX "ServiceRequest_category_idx" ON "ServiceRequest"("category");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ServiceProposal" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "status" "ServiceProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceProposal_requestId_idx" ON "ServiceProposal"("requestId");

-- CreateIndex
CREATE INDEX "ServiceProposal_providerId_idx" ON "ServiceProposal"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProposal_requestId_providerId_key" ON "ServiceProposal"("requestId", "providerId");

-- AddForeignKey
ALTER TABLE "ServiceProposal" ADD CONSTRAINT "ServiceProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProposal" ADD CONSTRAINT "ServiceProposal_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ApprenticeshipMilestone" (
    "id" TEXT NOT NULL,
    "apprenticeshipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "competencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprenticeshipMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprenticeshipMilestone_apprenticeshipId_idx" ON "ApprenticeshipMilestone"("apprenticeshipId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprenticeshipMilestone_apprenticeshipId_orderIndex_key" ON "ApprenticeshipMilestone"("apprenticeshipId", "orderIndex");

-- AddForeignKey
ALTER TABLE "ApprenticeshipMilestone" ADD CONSTRAINT "ApprenticeshipMilestone_apprenticeshipId_fkey" FOREIGN KEY ("apprenticeshipId") REFERENCES "Apprenticeship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ApprenticeshipMilestoneSubmission" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "notes" TEXT,
    "attachments" TEXT[],
    "status" "MilestoneSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprenticeshipMilestoneSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprenticeshipMilestoneSubmission_applicationId_idx" ON "ApprenticeshipMilestoneSubmission"("applicationId");

-- CreateIndex
CREATE INDEX "ApprenticeshipMilestoneSubmission_status_idx" ON "ApprenticeshipMilestoneSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprenticeshipMilestoneSubmission_milestoneId_applicationId_key" ON "ApprenticeshipMilestoneSubmission"("milestoneId", "applicationId");

-- AddForeignKey
ALTER TABLE "ApprenticeshipMilestoneSubmission" ADD CONSTRAINT "ApprenticeshipMilestoneSubmission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ApprenticeshipMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeshipMilestoneSubmission" ADD CONSTRAINT "ApprenticeshipMilestoneSubmission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ApprenticeshipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeshipMilestoneSubmission" ADD CONSTRAINT "ApprenticeshipMilestoneSubmission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
