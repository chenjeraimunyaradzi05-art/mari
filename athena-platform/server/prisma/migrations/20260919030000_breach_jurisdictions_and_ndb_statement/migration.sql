-- A breach can be handled under more than one regime, and for a Queensland
-- company the default is the Notifiable Data Breaches scheme rather than the
-- GDPR 72-hour clock. "jurisdictions" replaces the single "jurisdiction"
-- column. The old column is not dropped: it keeps being written with the first
-- entry for one release, and readers fall back to it when the list is empty,
-- so nothing recorded before the list existed is silently reclassified.
--
-- The four parts of an OAIC eligible data breach statement (Privacy Act 1988
-- s 26WK) are recorded on the row so the entity can later show what the
-- Commissioner and the people affected were told, rather than pointing at an
-- outbound email.

ALTER TABLE "DataBreach" ADD COLUMN "jurisdictions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DataBreach" ADD COLUMN "statementEntityContact" TEXT;
ALTER TABLE "DataBreach" ADD COLUMN "statementDescription" TEXT;
ALTER TABLE "DataBreach" ADD COLUMN "statementInformationKinds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DataBreach" ADD COLUMN "statementRecommendedSteps" TEXT;
ALTER TABLE "DataBreach" ADD COLUMN "statementLodgedAt" TIMESTAMP(3);
