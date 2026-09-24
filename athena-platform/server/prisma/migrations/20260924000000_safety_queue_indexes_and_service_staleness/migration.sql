-- The indexes the safety queue needs, and the two columns a referral directory
-- needs in order to be honest about itself.
--
-- 1. AdminFlag now has a reader.
--
-- HIGH-severity SAFETY_CONCERN rows — raised when a member writes about suicide
-- or self-harm, and when a safety score falls below 25 — were written and never
-- read by anything. They now feed a staff queue, which asks two questions the
-- model was not indexed for: which flags are still open (resolvedAt IS NULL),
-- and which of those are urgent (severity IN ('CRITICAL','HIGH')). Both were
-- sequential scans, and both would have got slower exactly as the platform grew
-- and the table filled. This is a page a moderator is meant to be able to open
-- quickly when something has gone wrong for somebody.

CREATE INDEX "AdminFlag_resolvedAt_idx" ON "AdminFlag"("resolvedAt");
CREATE INDEX "AdminFlag_severity_resolvedAt_idx" ON "AdminFlag"("severity", "resolvedAt");

-- 2. A DV service can be retired, and says when it was last checked.
--
-- Until now the only way to remove a domestic-violence support service from the
-- directory was to delete the row, which loses the record that ATHENA ever
-- listed it — and "we used to list them" is a materially different fact from
-- "we never did" on a page like this one. isActive retires an entry while
-- keeping it.
--
-- lastCheckedAt records when a person last confirmed the entry against the
-- service itself. Nothing tracked staleness, so an entry verified three years
-- ago was indistinguishable from one verified this morning. A crisis number
-- that has changed is worse than no number, because she will ring it at the
-- moment she needs it to work.
--
-- Both are additive and safe for the existing rows: everything already listed
-- is treated as active, and a null lastCheckedAt is the honest answer for an
-- entry nobody has yet confirmed.

ALTER TABLE "DVSupportService" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DVSupportService" ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
ALTER TABLE "DVSupportService" ADD COLUMN "updatedAt" TIMESTAMP(3);
CREATE INDEX "DVSupportService_isActive_idx" ON "DVSupportService"("isActive");

-- 3. The creator tier default names a tier that exists.
--
-- CreatorAnalytics.creatorTier defaulted to 'BRONZE', one of four metal names
-- that appear nowhere else in this codebase: no threshold was ever defined for
-- them and nothing ever moved a row off BRONZE. The ladder that actually decides
-- a creator's revenue share is CREATOR_TIERS — Emerging, Rising, Established,
-- Partner — so every row carried a tier name the payout code had never heard of.
--
-- Existing rows are migrated by name rather than by position, and only where
-- they still hold an untouched metal default; anything already written by the
-- refresh is left alone.

ALTER TABLE "CreatorAnalytics" ALTER COLUMN "creatorTier" SET DEFAULT 'Emerging';

UPDATE "CreatorAnalytics" SET "creatorTier" = 'Emerging'    WHERE "creatorTier" = 'BRONZE';
UPDATE "CreatorAnalytics" SET "creatorTier" = 'Rising'      WHERE "creatorTier" = 'SILVER';
UPDATE "CreatorAnalytics" SET "creatorTier" = 'Established' WHERE "creatorTier" = 'GOLD';
UPDATE "CreatorAnalytics" SET "creatorTier" = 'Partner'     WHERE "creatorTier" = 'PLATINUM';
