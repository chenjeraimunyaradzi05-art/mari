-- The schema halves of two money fixes whose code lands alongside this
-- migration. Everything here is additive: two new enum values and nullable
-- columns. Nothing is dropped, renamed or retyped, because the production
-- database is shared with an application this repository does not model.

-- ---------------------------------------------------------------------------
-- 1. Disputes on a mentoring session and on a marketplace order.
--
-- Only car purchases and hourly bookings had somewhere to say "this was not
-- delivered". A mentor closing a session took the mentee's card at once, with no
-- way to object first, and a buyer who thought an order's delivery was wrong
-- could only send it back for a revision or let the hold lapse. Each now has a
-- DISPUTED state. The money stays held while ATHENA's team decides: the buyer
-- says what went wrong, the provider may answer once, and a member of staff
-- releases the payment or gives it back.

ALTER TYPE "MentorSessionStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';

ALTER TYPE "ServiceOrderStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';

-- When the mentor said the session was given, and when the mentee's card is
-- charged for it. A session the mentor closes is charged after a short window in
-- which the mentee can say it did not happen; paymentReleaseAt is the end of it.
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "paymentReleaseAt" TIMESTAMP(3);

ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "disputeResponse" TEXT;
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "disputeRespondedAt" TIMESTAMP(3);
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "disputeResolution" TEXT;
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "disputeResolvedAt" TIMESTAMP(3);
ALTER TABLE "MentorSession" ADD COLUMN IF NOT EXISTS "disputeResolvedById" TEXT;

CREATE INDEX IF NOT EXISTS "MentorSession_paymentReleaseAt_idx" ON "MentorSession"("paymentReleaseAt");

ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "disputeResponse" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "disputeRespondedAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "disputeResolution" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "disputeResolvedAt" TIMESTAMP(3);
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "disputeResolvedById" TEXT;

-- ---------------------------------------------------------------------------
-- 2. The Creator Terms Addendum a creator accepted.
--
-- Terms 5.1 lists accepting the addendum among the conditions for being paid,
-- and nothing recorded it. The version and the time are kept so that a later
-- version can be asked for again. Creators who enabled creator mode before this
-- have neither, and are asked at their next withdrawal.

ALTER TABLE "CreatorProfile" ADD COLUMN IF NOT EXISTS "creatorTermsVersion" TEXT;
ALTER TABLE "CreatorProfile" ADD COLUMN IF NOT EXISTS "creatorTermsAcceptedAt" TIMESTAMP(3);
