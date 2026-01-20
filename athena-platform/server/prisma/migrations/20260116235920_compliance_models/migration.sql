-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('MARKETING_EMAIL', 'MARKETING_SMS', 'MARKETING_PUSH', 'DATA_PROCESSING', 'ANALYTICS', 'PERSONALIZATION', 'THIRD_PARTY_SHARING', 'COOKIE_ESSENTIAL', 'COOKIE_ANALYTICS', 'COOKIE_MARKETING', 'COOKIE_FUNCTIONAL');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'DENIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DSARType" AS ENUM ('EXPORT', 'DELETION', 'RECTIFICATION', 'RESTRICTION', 'PORTABILITY');

-- CreateEnum
CREATE TYPE "DSARStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataCategory" AS ENUM ('PII', 'SENSITIVE', 'FINANCIAL', 'UGC', 'BIOMETRIC', 'BEHAVIORAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "LegalBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTERESTS', 'PUBLIC_TASK', 'LEGITIMATE_INTERESTS');

-- CreateEnum
CREATE TYPE "BreachSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BreachStatus" AS ENUM ('DETECTED', 'INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "version" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "region" TEXT,
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSARRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DSARType" NOT NULL,
    "status" "DSARStatus" NOT NULL DEFAULT 'PENDING',
    "requestDetails" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT,
    "processingNotes" TEXT,
    "exportUrl" TEXT,
    "exportExpiresAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "auditLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DSARRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingActivity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "dataSubjectCategories" TEXT[],
    "dataCategories" "DataCategory"[],
    "dataElements" TEXT[],
    "legalBasis" "LegalBasis" NOT NULL,
    "legalBasisDetails" TEXT,
    "purposes" TEXT[],
    "recipients" TEXT[],
    "thirdCountryTransfers" TEXT[],
    "transferSafeguards" TEXT,
    "retentionPeriod" TEXT NOT NULL,
    "retentionJustification" TEXT,
    "securityMeasures" TEXT[],
    "dpiaRequired" BOOLEAN NOT NULL DEFAULT false,
    "dpiaId" TEXT,
    "subprocessors" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DPIA" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "featureOrSystem" TEXT NOT NULL,
    "dataCategories" "DataCategory"[],
    "processingOperations" TEXT[],
    "necessity" TEXT NOT NULL,
    "proportionality" TEXT NOT NULL,
    "risks" JSONB NOT NULL,
    "mitigations" JSONB NOT NULL,
    "residualRiskLevel" TEXT NOT NULL,
    "residualRiskAccepted" BOOLEAN NOT NULL DEFAULT false,
    "dpoConsulted" BOOLEAN NOT NULL DEFAULT false,
    "dpoComments" TEXT,
    "regulatorConsulted" BOOLEAN NOT NULL DEFAULT false,
    "regulatorResponse" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DPIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataBreach" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "detectedBy" TEXT NOT NULL,
    "severity" "BreachSeverity" NOT NULL,
    "status" "BreachStatus" NOT NULL DEFAULT 'DETECTED',
    "dataCategories" "DataCategory"[],
    "affectedRecords" INTEGER,
    "affectedUsers" INTEGER,
    "riskToIndividuals" TEXT NOT NULL,
    "likelyConsequences" TEXT,
    "occurredAt" TIMESTAMP(3),
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "regulatorNotifiedAt" TIMESTAMP(3),
    "regulatorReference" TEXT,
    "usersNotifiedAt" TIMESTAMP(3),
    "notificationMethod" TEXT,
    "containmentActions" TEXT[],
    "remediationActions" TEXT[],
    "preventionMeasures" TEXT[],
    "rootCause" TEXT,
    "lessonsLearned" TEXT,
    "handledBy" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataBreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subprocessor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "country" TEXT NOT NULL,
    "isEUAdequate" BOOLEAN NOT NULL DEFAULT false,
    "transferMechanism" TEXT,
    "services" TEXT[],
    "dataCategories" "DataCategory"[],
    "dpaSignedAt" TIMESTAMP(3),
    "dpaExpiresAt" TIMESTAMP(3),
    "sccVersion" TEXT,
    "lastAuditDate" TIMESTAMP(3),
    "nextAuditDate" TIMESTAMP(3),
    "securityCertifications" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subprocessor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dataCategory" "DataCategory" NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "retentionReason" TEXT NOT NULL,
    "legalBasis" "LegalBasis" NOT NULL,
    "softDeleteFirst" BOOLEAN NOT NULL DEFAULT true,
    "hardDeleteAfterDays" INTEGER,
    "anonymizeInstead" BOOLEAN NOT NULL DEFAULT false,
    "canBeLegalHeld" BOOLEAN NOT NULL DEFAULT true,
    "automatedPurge" BOOLEAN NOT NULL DEFAULT true,
    "purgeJobName" TEXT,
    "lastPurgeAt" TIMESTAMP(3),
    "nextPurgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalHold" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "caseReference" TEXT,
    "affectedUserIds" TEXT[],
    "affectedDataTypes" TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorizedBy" TEXT NOT NULL,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "adminId" TEXT,
    "systemProcess" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "region" TEXT,
    "legalBasis" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 2555,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookieConsent" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "essential" BOOLEAN NOT NULL DEFAULT true,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "functional" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "region" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CookieConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE INDEX "ConsentRecord_consentType_idx" ON "ConsentRecord"("consentType");

-- CreateIndex
CREATE INDEX "ConsentRecord_status_idx" ON "ConsentRecord"("status");

-- CreateIndex
CREATE INDEX "ConsentRecord_region_idx" ON "ConsentRecord"("region");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_consentType_key" ON "ConsentRecord"("userId", "consentType");

-- CreateIndex
CREATE INDEX "DSARRequest_userId_idx" ON "DSARRequest"("userId");

-- CreateIndex
CREATE INDEX "DSARRequest_status_idx" ON "DSARRequest"("status");

-- CreateIndex
CREATE INDEX "DSARRequest_type_idx" ON "DSARRequest"("type");

-- CreateIndex
CREATE INDEX "DSARRequest_dueDate_idx" ON "DSARRequest"("dueDate");

-- CreateIndex
CREATE INDEX "ProcessingActivity_department_idx" ON "ProcessingActivity"("department");

-- CreateIndex
CREATE INDEX "ProcessingActivity_isActive_idx" ON "ProcessingActivity"("isActive");

-- CreateIndex
CREATE INDEX "DPIA_status_idx" ON "DPIA"("status");

-- CreateIndex
CREATE INDEX "DPIA_featureOrSystem_idx" ON "DPIA"("featureOrSystem");

-- CreateIndex
CREATE INDEX "DataBreach_severity_idx" ON "DataBreach"("severity");

-- CreateIndex
CREATE INDEX "DataBreach_status_idx" ON "DataBreach"("status");

-- CreateIndex
CREATE INDEX "DataBreach_detectedAt_idx" ON "DataBreach"("detectedAt");

-- CreateIndex
CREATE INDEX "Subprocessor_isActive_idx" ON "Subprocessor"("isActive");

-- CreateIndex
CREATE INDEX "Subprocessor_country_idx" ON "Subprocessor"("country");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_dataType_key" ON "RetentionPolicy"("dataType");

-- CreateIndex
CREATE INDEX "RetentionPolicy_dataCategory_idx" ON "RetentionPolicy"("dataCategory");

-- CreateIndex
CREATE INDEX "LegalHold_isActive_idx" ON "LegalHold"("isActive");

-- CreateIndex
CREATE INDEX "PrivacyAuditLog_userId_idx" ON "PrivacyAuditLog"("userId");

-- CreateIndex
CREATE INDEX "PrivacyAuditLog_adminId_idx" ON "PrivacyAuditLog"("adminId");

-- CreateIndex
CREATE INDEX "PrivacyAuditLog_action_idx" ON "PrivacyAuditLog"("action");

-- CreateIndex
CREATE INDEX "PrivacyAuditLog_resourceType_idx" ON "PrivacyAuditLog"("resourceType");

-- CreateIndex
CREATE INDEX "PrivacyAuditLog_createdAt_idx" ON "PrivacyAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CookieConsent_visitorId_key" ON "CookieConsent"("visitorId");

-- CreateIndex
CREATE INDEX "CookieConsent_visitorId_idx" ON "CookieConsent"("visitorId");

-- CreateIndex
CREATE INDEX "CookieConsent_userId_idx" ON "CookieConsent"("userId");

-- CreateIndex
CREATE INDEX "CookieConsent_region_idx" ON "CookieConsent"("region");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSARRequest" ADD CONSTRAINT "DSARRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
