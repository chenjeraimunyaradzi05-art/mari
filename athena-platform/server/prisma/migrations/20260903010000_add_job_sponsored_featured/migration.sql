-- Paid placement and editorial feature flags on Job.
--
-- The admin console has always written both of these — admin.routes.ts sets
-- isSponsored / isFeatured on a job, and the job list filters on isFeatured —
-- but neither column existed, so every "Make Sponsored" or "Feature" action
-- raised a Prisma error and the filter could never match. The UI was wired to
-- fields the database had never heard of.
--
-- They are two separate flags on purpose. isSponsored means an employer paid
-- for the position and it has to be labelled as advertising wherever it
-- appears; isFeatured is an editorial choice with no money behind it. Merging
-- them would make it impossible to tell a paid slot from a recommendation.
--
-- Hand-written, additive and non-destructive: no existing value changes and
-- every existing row takes the default of false, which is the correct answer
-- for a job nobody has paid to promote.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md.

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "isSponsored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
-- The admin job list filters on isFeatured, and the homepage would too.
CREATE INDEX "Job_isFeatured_idx" ON "Job"("isFeatured");
