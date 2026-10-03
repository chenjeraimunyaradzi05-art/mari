-- The schema half of the email delivery fix, whose code lands alongside this
-- migration. One new table and nothing else: nothing is dropped, renamed or
-- retyped, because the production database is shared with an application this
-- repository does not model.

-- ---------------------------------------------------------------------------
-- Addresses SendGrid says it cannot deliver to.
--
-- Filled by the signed SendGrid Event Webhook (a hard bounce, a drop for a
-- bounced or invalid address, a spam report) and read before every send, so a
-- mistyped address or a closed mailbox is not mailed over and over. One row per
-- address, lower-case; a later event for the same address updates the row, which
-- is also what makes a replayed delivery harmless. No foreign key to User: an
-- address that bounced usually has no account.

CREATE TABLE IF NOT EXISTS "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'sendgrid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailSuppression_email_key" ON "EmailSuppression"("email");

CREATE INDEX IF NOT EXISTS "EmailSuppression_createdAt_idx" ON "EmailSuppression"("createdAt");
