-- What each side said at an order transition.
--
-- The deliver, revision and cancel routes already validated a message/reason
-- and then discarded it, because ServiceOrder had nowhere to put it. In a paid
-- flow those three fields are the record a dispute is decided on, so they are
-- stored rather than dropped.
--
-- Hand-written rather than generated from the live datasource: that database
-- carries tables this schema does not model, so a generated diff drops them.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md. Additive only.

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN "deliveryMessage" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN "revisionReason" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN "cancellationReason" TEXT;
