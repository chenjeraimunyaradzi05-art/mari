-- CreateEnum
CREATE TYPE "AcceleratorCohortStatus" AS ENUM ('UPCOMING', 'ENROLLING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AcceleratorEnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'DROPPED', 'GRADUATED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "GrantProviderType" AS ENUM ('FEDERAL', 'STATE', 'PRIVATE_FOUNDATION', 'CORPORATE', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "GrantApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'AWARDED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InvestorType" AS ENUM ('ANGEL', 'VC', 'CORPORATE_VC', 'FAMILY_OFFICE', 'ACCELERATOR', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "IntroductionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'INTRODUCED', 'MEETING_SCHEDULED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('ACCOUNTING_TAX', 'LEGAL', 'DESIGN_MARKETING', 'TECH_DEVELOPMENT', 'HR_COMPLIANCE', 'BUSINESS_COACHING', 'PHOTOGRAPHY_VIDEO', 'COPYWRITING', 'VIRTUAL_ASSISTANT', 'OTHER');

-- CreateEnum
CREATE TYPE "RfpStatus" AS ENUM ('OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfpResponseStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'SELECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "AcceleratorCohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "maxParticipants" INTEGER NOT NULL DEFAULT 30,
    "priceAud" DECIMAL(65,30) NOT NULL DEFAULT 2500,
    "status" "AcceleratorCohortStatus" NOT NULL DEFAULT 'UPCOMING',
    "curriculum" JSONB,
    "mentorIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcceleratorCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceleratorEnrollment" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AcceleratorEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "completedWeeks" INTEGER NOT NULL DEFAULT 0,
    "deliverables" JSONB,
    "mentorNotes" JSONB,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AcceleratorEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceleratorSession" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 120,
    "meetingUrl" TEXT,
    "recordingUrl" TEXT,
    "materials" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceleratorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerType" "GrantProviderType" NOT NULL,
    "minFunding" DECIMAL(65,30),
    "maxFunding" DECIMAL(65,30),
    "industries" TEXT[],
    "stages" TEXT[],
    "regions" TEXT[],
    "requirements" JSONB,
    "applicationUrl" TEXT,
    "deadline" TIMESTAMP(3),
    "isRolling" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantApplication" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GrantApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "matchScore" INTEGER,
    "applicationData" JSONB,
    "submittedAt" TIMESTAMP(3),
    "resultAt" TIMESTAMP(3),
    "amountAwarded" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InvestorType" NOT NULL,
    "description" TEXT,
    "minCheckSize" DECIMAL(65,30),
    "maxCheckSize" DECIMAL(65,30),
    "stages" TEXT[],
    "industries" TEXT[],
    "regions" TEXT[],
    "thesis" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "portfolioCompanies" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorIntroduction" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "IntroductionStatus" NOT NULL DEFAULT 'REQUESTED',
    "message" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "introducedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "InvestorIntroduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "description" TEXT,
    "services" TEXT[],
    "priceRange" TEXT,
    "discountPct" INTEGER,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPartner" BOOLEAN NOT NULL DEFAULT false,
    "avgRating" DECIMAL(65,30) DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorReview" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "projectType" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "budget" TEXT,
    "deadline" TIMESTAMP(3),
    "requirements" JSONB,
    "status" "RfpStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpResponse" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "priceQuote" DECIMAL(65,30),
    "timeline" TEXT,
    "attachments" JSONB,
    "status" "RfpResponseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcceleratorCohort_status_idx" ON "AcceleratorCohort"("status");

-- CreateIndex
CREATE INDEX "AcceleratorCohort_startDate_idx" ON "AcceleratorCohort"("startDate");

-- CreateIndex
CREATE INDEX "AcceleratorEnrollment_userId_idx" ON "AcceleratorEnrollment"("userId");

-- CreateIndex
CREATE INDEX "AcceleratorEnrollment_status_idx" ON "AcceleratorEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AcceleratorEnrollment_cohortId_userId_key" ON "AcceleratorEnrollment"("cohortId", "userId");

-- CreateIndex
CREATE INDEX "AcceleratorSession_cohortId_idx" ON "AcceleratorSession"("cohortId");

-- CreateIndex
CREATE INDEX "AcceleratorSession_weekNumber_idx" ON "AcceleratorSession"("weekNumber");

-- CreateIndex
CREATE INDEX "Grant_providerType_idx" ON "Grant"("providerType");

-- CreateIndex
CREATE INDEX "Grant_isActive_idx" ON "Grant"("isActive");

-- CreateIndex
CREATE INDEX "Grant_deadline_idx" ON "Grant"("deadline");

-- CreateIndex
CREATE INDEX "GrantApplication_userId_idx" ON "GrantApplication"("userId");

-- CreateIndex
CREATE INDEX "GrantApplication_status_idx" ON "GrantApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GrantApplication_grantId_userId_key" ON "GrantApplication"("grantId", "userId");

-- CreateIndex
CREATE INDEX "Investor_type_idx" ON "Investor"("type");

-- CreateIndex
CREATE INDEX "Investor_isActive_idx" ON "Investor"("isActive");

-- CreateIndex
CREATE INDEX "InvestorIntroduction_userId_idx" ON "InvestorIntroduction"("userId");

-- CreateIndex
CREATE INDEX "InvestorIntroduction_status_idx" ON "InvestorIntroduction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorIntroduction_investorId_userId_key" ON "InvestorIntroduction"("investorId", "userId");

-- CreateIndex
CREATE INDEX "Vendor_category_idx" ON "Vendor"("category");

-- CreateIndex
CREATE INDEX "Vendor_isPartner_idx" ON "Vendor"("isPartner");

-- CreateIndex
CREATE INDEX "Vendor_avgRating_idx" ON "Vendor"("avgRating");

-- CreateIndex
CREATE INDEX "VendorReview_vendorId_idx" ON "VendorReview"("vendorId");

-- CreateIndex
CREATE INDEX "VendorReview_rating_idx" ON "VendorReview"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "VendorReview_vendorId_userId_key" ON "VendorReview"("vendorId", "userId");

-- CreateIndex
CREATE INDEX "Rfp_userId_idx" ON "Rfp"("userId");

-- CreateIndex
CREATE INDEX "Rfp_status_idx" ON "Rfp"("status");

-- CreateIndex
CREATE INDEX "Rfp_category_idx" ON "Rfp"("category");

-- CreateIndex
CREATE INDEX "RfpResponse_rfpId_idx" ON "RfpResponse"("rfpId");

-- CreateIndex
CREATE INDEX "RfpResponse_vendorId_idx" ON "RfpResponse"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "RfpResponse_rfpId_vendorId_key" ON "RfpResponse"("rfpId", "vendorId");

-- AddForeignKey
ALTER TABLE "AcceleratorEnrollment" ADD CONSTRAINT "AcceleratorEnrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "AcceleratorCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceleratorEnrollment" ADD CONSTRAINT "AcceleratorEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceleratorSession" ADD CONSTRAINT "AcceleratorSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "AcceleratorCohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantApplication" ADD CONSTRAINT "GrantApplication_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantApplication" ADD CONSTRAINT "GrantApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorIntroduction" ADD CONSTRAINT "InvestorIntroduction_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorIntroduction" ADD CONSTRAINT "InvestorIntroduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpResponse" ADD CONSTRAINT "RfpResponse_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpResponse" ADD CONSTRAINT "RfpResponse_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
