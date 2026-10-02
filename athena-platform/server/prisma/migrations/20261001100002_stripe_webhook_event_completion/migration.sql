-- The schema half of a fix to how Stripe events are claimed. Additive only: four
-- columns and one index on StripeWebhookEvent. Nothing is dropped, renamed or
-- retyped, because the production database is shared with an application this
-- repository does not model.
--
-- A Stripe event used to be recorded the moment it arrived, before its handler
-- ran, and Stripe's retry of an event whose row existed was answered "duplicate".
-- If the process died between the claim and the end of the handler (a deploy, an
-- out-of-memory kill) the work was half done and no retry could ever finish it.
-- The claim now says when it was taken and, separately, when the handler
-- finished: an event with no completion time whose claim has gone stale is
-- picked up again, and every handler is written to be safe to repeat.
--
-- subjectId and eventCreatedAt record which Stripe object an event is about and
-- when Stripe made it, so an older subscription event that arrives after a newer
-- one has been applied is recognised and skipped instead of overwriting it.

ALTER TABLE "StripeWebhookEvent" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StripeWebhookEvent" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "StripeWebhookEvent" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "StripeWebhookEvent" ADD COLUMN IF NOT EXISTS "eventCreatedAt" TIMESTAMP(3);

-- Every row that exists was written by the old code, which recorded an event
-- before handling it and never said when it finished. Those rows are history, so
-- they read as handled: left without a completion time they would all look like
-- events that died half way, and the first retry of any of them would be run
-- again. Safe to run twice: it touches only rows with no completion time, and
-- the columns it fills were added above.
UPDATE "StripeWebhookEvent"
SET "claimedAt" = "processedAt",
    "completedAt" = "processedAt"
WHERE "completedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_subjectId_eventCreatedAt_idx" ON "StripeWebhookEvent"("subjectId", "eventCreatedAt");
