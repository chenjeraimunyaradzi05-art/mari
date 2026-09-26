-- The schema halves of fixes whose code lands alongside this migration. Each
-- section is additive, or removes only data that no code reads and that was
-- never the member's to keep. Nothing here drops a table or a column: the
-- production database is shared with an application this repository does not
-- model, and a drop is not something to do against a database whose other
-- tenants are unknown.

-- ---------------------------------------------------------------------------
-- 1. Audit actions that say what happened.
--
-- A moderator's decision on a report was recorded as DATA_ACCESS with the real
-- verb in metadata, and nine admin routers recorded staff configuration changes
-- the same way or not at all. "Who banned this account" could only be answered
-- by reading the JSON of every row. IF NOT EXISTS so a re-run is harmless.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MODERATION_DISMISS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MODERATION_WARN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MODERATION_REMOVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MODERATION_SUSPEND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MODERATION_BAN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MODERATION_ESCALATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_CONFIG_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_CONTENT_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIGN_IN_PROVIDER_LINKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SAFETY_REPORT_DECIDED';

-- ---------------------------------------------------------------------------
-- 2. A safe-chat PIN that cannot be guessed forever.
--
-- The PIN is a handful of digits and the person most likely to be guessing it
-- is holding her phone. scrypt slows each guess; nothing limited how many. The
-- chat now locks after repeated wrong PINs and counts the wrong PINs since she
-- last opened it herself, so she can be told that somebody tried.

ALTER TABLE "DvSafeChat" ADD COLUMN "wrongPinAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DvSafeChat" ADD COLUMN "pinLockedUntil" TIMESTAMP(3);
ALTER TABLE "DvSafeChat" ADD COLUMN "wrongPinsSinceOpen" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 3. One push token, one owner.
--
-- With duplicates allowed, a phone that changed hands and was signed into a
-- different account kept its old registration active, so the new holder went on
-- receiving the previous member's notifications — message previews and safety
-- alerts included. On this platform the person who ends up with her old phone
-- may be the person she is hiding from.
--
-- Duplicates are collapsed to the MOST RECENTLY UPDATED row for each token,
-- because that row belongs to whoever holds the device now. Keeping the oldest,
-- as the first draft of this migration proposed, would have preserved exactly
-- the exposure it exists to close. Ties are broken on id so the result is
-- deterministic.

DELETE FROM "PushToken" p
USING (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "token" ORDER BY "updatedAt" DESC, "id" DESC) AS rn
  FROM "PushToken"
) ranked
WHERE p."id" = ranked."id"
  AND ranked.rn > 1;

DROP INDEX IF EXISTS "PushToken_token_idx";
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- ---------------------------------------------------------------------------
-- 4. A review deadline the queue can see.
--
-- The reporting screen promises a person will look within 24 to 48 hours. The
-- deadline and the priority lived inside the evidence JSON, where nothing could
-- sort by them or say which reports were overdue. They are copied out of the
-- JSON for existing rows, but only where the stored value is a well-formed
-- timestamp: a malformed one is left null rather than failing the migration or
-- inventing a deadline nobody set.

ALTER TABLE "ContentReport" ADD COLUMN "reviewDeadline" TIMESTAMP(3);
ALTER TABLE "ContentReport" ADD COLUMN "priority" TEXT;

UPDATE "ContentReport"
SET "reviewDeadline" = ("evidence"->>'reviewDeadline')::timestamp(3)
WHERE "reviewDeadline" IS NULL
  AND jsonb_typeof("evidence"::jsonb) = 'object'
  AND ("evidence"->>'reviewDeadline') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}';

UPDATE "ContentReport"
SET "priority" = upper("evidence"->>'priority')
WHERE "priority" IS NULL
  AND jsonb_typeof("evidence"::jsonb) = 'object'
  AND upper("evidence"->>'priority') IN ('URGENT', 'HIGH', 'NORMAL');

CREATE INDEX "ContentReport_status_reviewDeadline_idx" ON "ContentReport"("status", "reviewDeadline");

-- ---------------------------------------------------------------------------
-- 5. Suspensions and bans that say why, and a ban that holds.
--
-- isSuspended recorded that an account was shut and nothing else, so an appeal
-- had nothing to answer. And banning an account suspended that one row: the
-- person banned for threatening a member could sign up again the same
-- afternoon with the same address. BannedIdentity stores a keyed hash of the
-- address rather than the address itself, so it can be checked at every
-- registration without becoming a plain-text list of everyone ever banned.

ALTER TABLE "User" ADD COLUMN "suspensionReason" TEXT;
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspendedById" TEXT;
ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;
ALTER TABLE "User" ADD COLUMN "bannedById" TEXT;

CREATE TABLE "BannedIdentity" (
  "id"          TEXT         NOT NULL,
  "emailHash"   TEXT         NOT NULL,
  "userId"      TEXT,
  "reportId"    TEXT,
  "createdById" TEXT         NOT NULL,
  "reason"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BannedIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BannedIdentity_emailHash_key" ON "BannedIdentity"("emailHash");
CREATE INDEX "BannedIdentity_userId_idx" ON "BannedIdentity"("userId");

-- ---------------------------------------------------------------------------
-- 6. A certificate that outlives a tidy-up.
--
-- Deleting a course cascaded to every certificate issued for it, and with them
-- the public page an employer uses to check one. Renaming a course rewrote the
-- title on every certificate already issued. The title and issuer are now
-- written at issue time — backfilled here from the course as it stands, which
-- is the best record there is for certificates issued before this — and a
-- course with issued certificates can no longer be deleted out from under them.

ALTER TABLE "CourseCertificate" ADD COLUMN "courseTitle" TEXT;
ALTER TABLE "CourseCertificate" ADD COLUMN "issuerName" TEXT;

UPDATE "CourseCertificate" cc
SET "courseTitle" = c."title",
    "issuerName"  = COALESCE(c."providerName", o."name")
FROM "Course" c
LEFT JOIN "Organization" o ON o."id" = c."organizationId"
WHERE cc."courseId" = c."id"
  AND cc."courseTitle" IS NULL;

ALTER TABLE "CourseCertificate" DROP CONSTRAINT IF EXISTS "CourseCertificate_courseId_fkey";
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. An event that can be called off rather than deleted.
--
-- Deleting was the only way to stop an event, which also deleted every
-- registration and so every record of who needed to be told.

ALTER TABLE "Event" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "cancelledReason" TEXT;

-- ---------------------------------------------------------------------------
-- 8. Search history nobody should have kept.
--
-- UserFeedPreferences.searchHistory held the raw text of a member's last fifty
-- searches, with no reader anywhere on the server and no way for her to clear
-- it. The code no longer writes it and no longer returns it. What was already
-- stored is emptied here: on a platform whose members include women whose
-- searches are exactly what someone else wants to see, a log with no purpose is
-- a liability and not an asset. The column itself stays for now, for the
-- reason given at the top of this file.

UPDATE "UserFeedPreferences" SET "searchHistory" = '{}' WHERE cardinality("searchHistory") > 0;
