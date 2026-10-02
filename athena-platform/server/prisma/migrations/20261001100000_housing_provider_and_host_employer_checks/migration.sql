-- The schema halves of two safety checks whose code lands alongside this
-- migration. Everything here is additive: two new tables, one new enum and one
-- nullable column. Nothing is dropped, renamed or retyped, because the
-- production database is shared with an application this repository does not
-- model.

-- ---------------------------------------------------------------------------
-- 1. Housing: who ATHENA has checked as a provider.
--
-- A listing was badged "Checked by ATHENA staff" on the strength of a look at
-- the listing alone. The badge is also a promise about the person offering the
-- place, so DV-safe, emergency and transitional listings can now be badged only
-- while their lister holds an approved, unexpired row here. EXPIRED is written
-- by the hourly sweep when expiresAt passes.

CREATE TYPE "HousingProviderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS "HousingProviderVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "abn" TEXT,
    "statement" TEXT,
    "status" "HousingProviderStatus" NOT NULL DEFAULT 'PENDING',
    "basis" TEXT,
    "evidence" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousingProviderVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HousingProviderVerification_userId_key" ON "HousingProviderVerification"("userId");

CREATE INDEX IF NOT EXISTS "HousingProviderVerification_status_submittedAt_idx" ON "HousingProviderVerification"("status", "submittedAt");

CREATE INDEX IF NOT EXISTS "HousingProviderVerification_status_expiresAt_idx" ON "HousingProviderVerification"("status", "expiresAt");

ALTER TABLE "HousingProviderVerification" ADD CONSTRAINT "HousingProviderVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Apprenticeships: a host employer's safety attestation.
--
-- Nothing in the placement path read whether the employer hosting an apprentice
-- had been looked at. An organisation may now place apprentices only while it
-- is verified and holds an approved, unexpired attestation here. Organisation-
-- level facts only: no individual's police or background check is collected.
-- Organization.abn is the ABN the organisation attested to.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "abn" TEXT;

CREATE TABLE IF NOT EXISTS "HostEmployerSafetyAttestation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "answers" JSONB NOT NULL,
    "safetyContactName" TEXT NOT NULL,
    "safetyContactEmail" TEXT,
    "safetyContactPhone" TEXT,
    "abn" TEXT,
    "abnCheck" JSONB,
    "attestedById" TEXT,
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "HostEmployerSafetyAttestation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HostEmployerSafetyAttestation_organizationId_status_idx" ON "HostEmployerSafetyAttestation"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "HostEmployerSafetyAttestation_status_attestedAt_idx" ON "HostEmployerSafetyAttestation"("status", "attestedAt");

ALTER TABLE "HostEmployerSafetyAttestation" ADD CONSTRAINT "HostEmployerSafetyAttestation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
