-- The schema halves of two money fixes whose code lands alongside this
-- migration. Everything here is additive: one new table and nullable or
-- defaulted columns. Nothing is dropped, renamed or retyped, because the
-- production database is shared with an application this repository does not
-- model.

-- ---------------------------------------------------------------------------
-- 1. Disputes, refunds and what they do to a member's balance.
--
-- A card dispute was a log line and one email, and a refund of any size marked
-- the whole sale refunded. PaymentDispute is one row per Stripe dispute, moved
-- only by the charge.dispute.* events. The refunded amounts are cumulative, as
-- Stripe reports them, so a sale refunded in part stays a sale. An invoice
-- records what was credited against it. GiftBalancePurchase records how many of
-- its points have been taken back, so a refund delivered twice takes them back
-- once. payoutHold is the freeze on withdrawals while a payment connected to a
-- creator's earnings is being looked at.

ALTER TABLE "EscrowPayment" ADD COLUMN IF NOT EXISTS "refundedAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "creditedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "creditedAt" TIMESTAMP(3);

ALTER TABLE "GiftBalancePurchase" ADD COLUMN IF NOT EXISTS "reversedPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CreatorProfile" ADD COLUMN IF NOT EXISTS "payoutHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreatorProfile" ADD COLUMN IF NOT EXISTS "payoutHoldReason" TEXT;
ALTER TABLE "CreatorProfile" ADD COLUMN IF NOT EXISTS "payoutHeldAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PaymentDispute" (
    "id" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "chargeId" TEXT,
    "paymentIntentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'OPEN',
    "evidenceDueBy" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "fundsWithdrawn" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT,
    "userId" TEXT,
    "paymentId" TEXT,
    "escrowPaymentId" TEXT,
    "effectsAppliedAt" TIMESTAMP(3),
    "effects" JSONB,
    "heldCreatorProfileIds" TEXT[],
    "holdsReleasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentDispute_stripeDisputeId_key" ON "PaymentDispute"("stripeDisputeId");

CREATE INDEX IF NOT EXISTS "PaymentDispute_outcome_openedAt_idx" ON "PaymentDispute"("outcome", "openedAt");

CREATE INDEX IF NOT EXISTS "PaymentDispute_paymentIntentId_idx" ON "PaymentDispute"("paymentIntentId");

CREATE INDEX IF NOT EXISTS "PaymentDispute_userId_idx" ON "PaymentDispute"("userId");

-- ---------------------------------------------------------------------------
-- 2. Hourly bookings and accepted proposals are paid through escrow.
--
-- A booking recorded a total and a payout that no money ever backed, and an
-- accepted proposal recorded nothing. Each now points at the escrow hold that
-- backs it, the same way a package order does. Bookings and proposals made
-- before this have none.

ALTER TABLE "ServiceBooking" ADD COLUMN IF NOT EXISTS "escrowPaymentId" TEXT;

-- When the buyer said the session was not given, and what she said. The money
-- stays held while ATHENA's team decides; this is what they read to decide it.
ALTER TABLE "ServiceBooking" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);
ALTER TABLE "ServiceBooking" ADD COLUMN IF NOT EXISTS "disputeReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceBooking_escrowPaymentId_key" ON "ServiceBooking"("escrowPaymentId");

ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_escrowPaymentId_fkey" FOREIGN KEY ("escrowPaymentId") REFERENCES "EscrowPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceProposal" ADD COLUMN IF NOT EXISTS "escrowPaymentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceProposal_escrowPaymentId_key" ON "ServiceProposal"("escrowPaymentId");

ALTER TABLE "ServiceProposal" ADD CONSTRAINT "ServiceProposal_escrowPaymentId_fkey" FOREIGN KEY ("escrowPaymentId") REFERENCES "EscrowPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
