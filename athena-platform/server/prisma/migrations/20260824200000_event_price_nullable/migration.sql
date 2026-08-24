-- Let an event record "price not published" rather than being forced to claim 0.
--
-- The events page renders `price ? "$"+price : "Free"`, so an unverified price
-- stored as 0 asserted that a paid conference was free. Nullable price makes
-- the unknown case representable; the default of 0 is kept so existing
-- callers that omit the field behave exactly as before.
--
-- Hand-written, additive, and non-destructive: no existing value changes.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md.

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "price" DROP NOT NULL;
