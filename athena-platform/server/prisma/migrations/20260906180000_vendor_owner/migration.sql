-- A vendor listing can belong to a member: the one who registered it, or the
-- one who claimed a catalogue entry. Owning a vendor is what lets a member
-- answer RFPs on its behalf.
ALTER TABLE "Vendor" ADD COLUMN "ownerId" TEXT;

CREATE INDEX "Vendor_ownerId_idx" ON "Vendor"("ownerId");

ALTER TABLE "Vendor"
  ADD CONSTRAINT "Vendor_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
