-- "Keep notifications vague" becomes something a member chooses, not something
-- she is put on. The column defaulted to true and the row was created by a
-- read, so every member who opened the quick exit (it sits in the dashboard
-- shell) was silently moved onto "New Update" for every notification on the
-- platform, without ever having been asked. Nothing is dropped, renamed or
-- retyped: this changes the default for rows made from now on, and corrects
-- only the rows that carry nothing but defaults.

-- ---------------------------------------------------------------------------
-- 1. New rows start with the switch off.

ALTER TABLE "DvSafetyProfile" ALTER COLUMN "notificationsSafe" SET DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Rows that only ever came from a read.
--
-- A row a member has used is left exactly as she has it. A row is taken to be
-- one nobody has used only when every other column still holds the value a
-- fresh row gets, it has not been written since it was made, and nothing hangs
-- off it (no safe chat, no panic alert). Anything else could be a woman who
-- set herself up and is better left on the safer side.

UPDATE "DvSafetyProfile" AS p
SET "notificationsSafe" = false
WHERE p."notificationsSafe" = true
  AND p."isSafeMode" = false
  AND p."hideFromSearch" = false
  AND p."allowMessages" = true
  AND p."safeExitEnabled" = false
  AND p."panicButtonEnabled" = false
  AND p."disguisedAppIcon" = false
  AND p."emergencyContacts" = '[]'::jsonb
  AND cardinality(p."blockedUserIds") = 0
  AND p."updatedAt" <= p."createdAt" + INTERVAL '1 second'
  AND NOT EXISTS (SELECT 1 FROM "DvSafeChat" c WHERE c."profileId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "DvPanicAlert" a WHERE a."profileId" = p."id");
