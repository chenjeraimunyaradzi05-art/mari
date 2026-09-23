-- Three unrelated columns land together because each one closes a hole that the
-- 2026-09-23 audit confirmed, and each is additive and nullable, so one
-- migration is safer than three deploys against a shared database.
--
-- 1. Age.
--
-- Nothing anywhere collected a date of birth, so no gate could ask how old an
-- account holder was. A minor could finish registration in under a minute, or
-- in one click through Google, and land in an adult network with a public feed,
-- direct messages and a domestic-violence surface. The column is nullable
-- because it is the one field that cannot be backfilled from anything else on
-- the row; readers treat null as "never asked" and refuse, rather than allow.
-- ageVerifiedAt records when the answer was accepted, so a later change of
-- policy can tell a checked account from an unchecked one.

ALTER TABLE "User" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "ageVerifiedAt" TIMESTAMP(3);

-- 2. Who published an event.
--
-- Members can publish an event that appears to anonymous visitors within one
-- request, and until now nothing recorded which member did it — so a listing
-- could not be attributed, reported, or taken down by its author. Nullable
-- because the admin-curated rows and the seeded rows have no member behind
-- them: null means "curated by ATHENA", a set value means who to hold
-- responsible. ON DELETE SET NULL so removing an account does not remove the
-- event other people have already registered for.

ALTER TABLE "Event" ADD COLUMN "hostUserId" TEXT;
ALTER TABLE "Event" ADD CONSTRAINT "Event_hostUserId_fkey"
  FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Event_hostUserId_idx" ON "Event"("hostUserId");

-- 3. Who owns a stock row.
--
-- Every inventory list endpoint returned every tenant's rows to every signed-in
-- user: SKUs, descriptions, unit cost and sell price, and therefore margins.
-- The models had no owner column at all, so there was nothing to filter on —
-- organizationId is null for a sole trader, which is most of this platform's
-- businesses. Scope is now derived from the caller rather than from the query
-- string: her own rows, plus the rows of organisations she is a member of.
--
-- ON DELETE CASCADE because stock belongs to the person the way a draft does;
-- there is no one to inherit it.

ALTER TABLE "InventoryItem" ADD COLUMN "userId" TEXT;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "InventoryItem_userId_idx" ON "InventoryItem"("userId");

ALTER TABLE "InventoryLocation" ADD COLUMN "userId" TEXT;
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "InventoryLocation_userId_idx" ON "InventoryLocation"("userId");

-- Backfill, so the new scope does not hide a sole trader's existing stock from
-- her the moment it lands.
--
-- Before these columns, a row with no organizationId belonged to nobody in
-- particular and every signed-in account could read it. Scoping fixes the leak
-- but leaves those rows owned by no one, and a row owned by no one is refused —
-- which for the woman who entered it is indistinguishable from the platform
-- losing her data.
--
-- InventoryTransaction.createdByUserId is the only record of who touched a row,
-- so ownership is recovered from the earliest transaction against it. Rows that
-- were never transacted cannot be attributed and stay unowned; they are
-- unreachable rather than exposed, which is the safer of the two failures, and
-- an admin can assign them.

UPDATE "InventoryItem" AS i
SET "userId" = t."createdByUserId"
FROM (
  SELECT DISTINCT ON ("itemId") "itemId", "createdByUserId"
  FROM "InventoryTransaction"
  WHERE "createdByUserId" IS NOT NULL
  ORDER BY "itemId", "createdAt" ASC
) AS t
WHERE i."id" = t."itemId"
  AND i."userId" IS NULL
  AND i."organizationId" IS NULL;

UPDATE "InventoryLocation" AS l
SET "userId" = t."createdByUserId"
FROM (
  SELECT DISTINCT ON ("locationId") "locationId", "createdByUserId"
  FROM "InventoryTransaction"
  WHERE "createdByUserId" IS NOT NULL AND "locationId" IS NOT NULL
  ORDER BY "locationId", "createdAt" ASC
) AS t
WHERE l."id" = t."locationId"
  AND l."userId" IS NULL
  AND l."organizationId" IS NULL;

-- 4. How much of a creator payout has already been given back.
--
-- Stripe reports a transfer's `amount_reversed` cumulatively. The reversal
-- handler restored the event's fraction of the payout each time it fired, so a
-- payout reversed in two parts — "30% reversed", then "100% reversed" — put 130%
-- of it back into her pending balance. Those are gift points bought with real
-- money and redeemable for real money, so the overcredit leaves as a Stripe
-- transfer. Recording what has been restored lets each event credit only the
-- difference, and makes a redelivered event a no-op.
--
-- Defaults to 0, which is correct for every existing row: none of them has been
-- partially reversed, because nothing tracked it.

ALTER TABLE "CreatorPayout" ADD COLUMN "reversedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 5. "Who has blocked me", answered without reading the whole table.
--
-- getBlockedRelationshipIds runs `blockedUsers @> ARRAY[$1]` on every feed
-- load, story ring, search and profile view — blocking is checked more often
-- than almost anything else here. blockedUsers is a text[] with no index, so
-- each of those was a sequential scan, and the cost of blocking working grew
-- with the number of members. GIN is the index type for array containment.

CREATE INDEX "UserSafetySettings_blockedUsers_idx"
  ON "UserSafetySettings" USING GIN ("blockedUsers");
