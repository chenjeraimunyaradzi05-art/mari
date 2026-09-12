-- A share link can leave the member's name off the summary. The blueprint
-- asks for an anonymous option on everything but a consultation, and a
-- link handed to a practitioner she has not met yet is exactly that case.

-- AlterTable
ALTER TABLE "HealthShare" ADD COLUMN "anonymous" BOOLEAN NOT NULL DEFAULT false;
