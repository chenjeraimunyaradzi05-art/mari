-- Marketplace orders are paid: each order points at the escrow hold that
-- backs it. Orders placed before this have none.
ALTER TABLE "ServiceOrder" ADD COLUMN "escrowPaymentId" TEXT;

CREATE UNIQUE INDEX "ServiceOrder_escrowPaymentId_key" ON "ServiceOrder"("escrowPaymentId");

ALTER TABLE "ServiceOrder"
  ADD CONSTRAINT "ServiceOrder_escrowPaymentId_fkey"
  FOREIGN KEY ("escrowPaymentId") REFERENCES "EscrowPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
