-- The candidate-facing application flow ended at OFFERED, so the "Accept Offer"
-- button on /dashboard/applications had no state to move to and did nothing.
--
-- Hand-written rather than generated from the live datasource: that database
-- carries tables this schema does not model, so a generated diff drops them.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md. Additive only.

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
