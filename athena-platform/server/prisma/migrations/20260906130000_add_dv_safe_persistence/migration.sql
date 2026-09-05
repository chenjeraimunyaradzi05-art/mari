-- DV Safe Mode moves out of process memory. Settings, emergency contacts,
-- encrypted safe chats and panic alerts survive a restart and are shared
-- across replicas.

CREATE TABLE "DvSafetyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isSafeMode" BOOLEAN NOT NULL DEFAULT false,
    "hideFromSearch" BOOLEAN NOT NULL DEFAULT false,
    "allowMessages" BOOLEAN NOT NULL DEFAULT true,
    "safeExitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "safeExitUrl" TEXT NOT NULL DEFAULT 'https://www.google.com',
    "panicButtonEnabled" BOOLEAN NOT NULL DEFAULT false,
    "activityLogEnabled" BOOLEAN NOT NULL DEFAULT true,
    "disguisedAppIcon" BOOLEAN NOT NULL DEFAULT false,
    "notificationsSafe" BOOLEAN NOT NULL DEFAULT true,
    "emergencyContacts" JSONB NOT NULL DEFAULT '[]',
    "blockedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DvSafetyProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DvSafetyProfile_userId_key" ON "DvSafetyProfile"("userId");
ALTER TABLE "DvSafetyProfile" ADD CONSTRAINT "DvSafetyProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DvSafeChat" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disguisedName" TEXT NOT NULL DEFAULT 'Shopping List',
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessPinHash" TEXT,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DvSafeChat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DvSafeChat_profileId_idx" ON "DvSafeChat"("profileId");
ALTER TABLE "DvSafeChat" ADD CONSTRAINT "DvSafeChat_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "DvSafetyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DvSafeMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "autoDeleteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DvSafeMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DvSafeMessage_chatId_createdAt_idx" ON "DvSafeMessage"("chatId", "createdAt");
CREATE INDEX "DvSafeMessage_autoDeleteAt_idx" ON "DvSafeMessage"("autoDeleteAt");
ALTER TABLE "DvSafeMessage" ADD CONSTRAINT "DvSafeMessage_chatId_fkey"
  FOREIGN KEY ("chatId") REFERENCES "DvSafeChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DvPanicAlert" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedContacts" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "DvPanicAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DvPanicAlert_profileId_triggeredAt_idx" ON "DvPanicAlert"("profileId", "triggeredAt");
ALTER TABLE "DvPanicAlert" ADD CONSTRAINT "DvPanicAlert_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "DvSafetyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
