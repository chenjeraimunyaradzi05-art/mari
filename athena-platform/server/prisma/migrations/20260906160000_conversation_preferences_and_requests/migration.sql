-- Each person's own view of a thread (pinned, muted, archived), and message
-- requests: a thread opened by someone the recipient does not follow waits for
-- them to accept it. Declining keeps the row so the opener cannot ask again.
ALTER TABLE "ConversationParticipant"
  ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isMuted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Conversation"
  ADD COLUMN "requestedById" TEXT,
  ADD COLUMN "requestAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "requestDeclinedAt" TIMESTAMP(3);
