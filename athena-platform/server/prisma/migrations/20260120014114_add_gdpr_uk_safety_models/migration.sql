-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DATA_ACCESS';

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityEscalation" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "escalatedAt" TIMESTAMP(3) NOT NULL,
    "reportedTo" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorityEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransparencyReport" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalReports" INTEGER NOT NULL DEFAULT 0,
    "reportsByCategory" JSONB NOT NULL,
    "actionsTotal" INTEGER NOT NULL DEFAULT 0,
    "actionsByType" JSONB NOT NULL,
    "avgResponseHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "under24Hours" INTEGER NOT NULL DEFAULT 0,
    "under72Hours" INTEGER NOT NULL DEFAULT 0,
    "over72Hours" INTEGER NOT NULL DEFAULT 0,
    "totalAppeals" INTEGER NOT NULL DEFAULT 0,
    "appealsUpheld" INTEGER NOT NULL DEFAULT 0,
    "appealsOverturned" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransparencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSafetySettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allowMessagesFrom" TEXT NOT NULL DEFAULT 'connections',
    "filterOffensiveContent" BOOLEAN NOT NULL DEFAULT true,
    "hideReadReceipts" BOOLEAN NOT NULL DEFAULT false,
    "profileVisibility" TEXT NOT NULL DEFAULT 'public',
    "hideOnlineStatus" BOOLEAN NOT NULL DEFAULT false,
    "hideLastSeen" BOOLEAN NOT NULL DEFAULT false,
    "blockedUsers" TEXT[],
    "blockedKeywords" TEXT[],
    "enableSafetyAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSafetySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationLog_ticketId_idx" ON "ModerationLog"("ticketId");

-- CreateIndex
CREATE INDEX "ModerationLog_moderatorId_idx" ON "ModerationLog"("moderatorId");

-- CreateIndex
CREATE INDEX "ModerationLog_action_idx" ON "ModerationLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorityEscalation_ticketId_key" ON "AuthorityEscalation"("ticketId");

-- CreateIndex
CREATE INDEX "AuthorityEscalation_reason_idx" ON "AuthorityEscalation"("reason");

-- CreateIndex
CREATE INDEX "AuthorityEscalation_reportedTo_idx" ON "AuthorityEscalation"("reportedTo");

-- CreateIndex
CREATE UNIQUE INDEX "TransparencyReport_period_key" ON "TransparencyReport"("period");

-- CreateIndex
CREATE UNIQUE INDEX "UserSafetySettings_userId_key" ON "UserSafetySettings"("userId");

-- AddForeignKey
ALTER TABLE "UserSafetySettings" ADD CONSTRAINT "UserSafetySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
