-- Australia's Notifiable Data Breaches scheme, alongside the existing GDPR
-- fields rather than replacing them: an entity may hold data subject to both.
--
-- The NDB scheme gives 30 days to complete a reasonable assessment of a
-- suspected eligible data breach, sets the threshold at serious harm being
-- likely, and removes the obligation entirely where remedial action prevents
-- that harm. None of that maps onto the 72-hour Article 33 clock.

ALTER TABLE "DataBreach" ADD COLUMN "jurisdiction" TEXT;
ALTER TABLE "DataBreach" ADD COLUMN "assessmentDueAt" TIMESTAMP(3);
ALTER TABLE "DataBreach" ADD COLUMN "assessmentComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DataBreach" ADD COLUMN "seriousHarmLikely" BOOLEAN;
ALTER TABLE "DataBreach" ADD COLUMN "remediedBeforeHarm" BOOLEAN NOT NULL DEFAULT false;
