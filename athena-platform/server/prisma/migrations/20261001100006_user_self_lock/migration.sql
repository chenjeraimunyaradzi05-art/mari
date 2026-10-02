-- The schema half of the member's own account lock, whose code lands alongside
-- this migration. One nullable column and two audit verbs, nothing else:
-- nothing is dropped, renamed or retyped, because the production database is
-- shared with an application this repository does not model, and a nullable
-- column with no default is safe against live rows.

-- ---------------------------------------------------------------------------
-- 1. The lock itself.
--
-- Set when a member freezes her own account because she suspects someone else
-- has it, from her security settings or from the "this was not me" link in a
-- new-device sign-in email. While it is set every sign-in route and every live
-- session is refused; the link mailed to her address clears it. It is not a
-- moderation state, so it has a column of its own instead of borrowing
-- isSuspended (which carries the appeal wording and is staff's to lift).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 2. Audit actions that say what happened.
--
-- IF NOT EXISTS so a re-run is harmless.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_LOCKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_UNLOCKED';
