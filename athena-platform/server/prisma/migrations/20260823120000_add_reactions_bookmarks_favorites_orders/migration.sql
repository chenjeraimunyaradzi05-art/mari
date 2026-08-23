-- Adds the backing store for UI that previously called routes with nothing behind them:
--   * channel message reactions (MessageReaction is bound to Message, the DM model)
--   * apprenticeship "featured" and bookmarks
--   * skill service favourites
--   * skill service package orders (distinct from ServiceBooking, which buys time)
--
-- Written by hand rather than generated from the live datasource: that database
-- carries 56 tables this schema does not model, and a generated diff would drop them.

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DELIVERED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ChannelMessage" ADD COLUMN "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Apprenticeship" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SkillService" ADD COLUMN "packages" JSONB;

-- CreateTable
CREATE TABLE "ChannelMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprenticeshipBookmark" (
    "id" TEXT NOT NULL,
    "apprenticeshipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprenticeshipBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceFavorite" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "packageIndex" INTEGER NOT NULL,
    "packageName" TEXT,
    "requirements" TEXT,
    "attachments" TEXT[],
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "providerPayout" INTEGER NOT NULL,
    "deliveryDays" INTEGER,
    "dueAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Apprenticeship_isFeatured_idx" ON "Apprenticeship"("isFeatured");

-- CreateIndex
CREATE INDEX "ChannelMessageReaction_messageId_idx" ON "ChannelMessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "ChannelMessageReaction_userId_idx" ON "ChannelMessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMessageReaction_messageId_userId_emoji_key" ON "ChannelMessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "ApprenticeshipBookmark_userId_idx" ON "ApprenticeshipBookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprenticeshipBookmark_apprenticeshipId_userId_key" ON "ApprenticeshipBookmark"("apprenticeshipId", "userId");

-- CreateIndex
CREATE INDEX "ServiceFavorite_userId_idx" ON "ServiceFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceFavorite_serviceId_userId_key" ON "ServiceFavorite"("serviceId", "userId");

-- CreateIndex
CREATE INDEX "ServiceOrder_serviceId_idx" ON "ServiceOrder"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceOrder_clientId_idx" ON "ServiceOrder"("clientId");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_idx" ON "ServiceOrder"("status");

-- AddForeignKey
ALTER TABLE "ChannelMessageReaction" ADD CONSTRAINT "ChannelMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChannelMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessageReaction" ADD CONSTRAINT "ChannelMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeshipBookmark" ADD CONSTRAINT "ApprenticeshipBookmark_apprenticeshipId_fkey" FOREIGN KEY ("apprenticeshipId") REFERENCES "Apprenticeship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprenticeshipBookmark" ADD CONSTRAINT "ApprenticeshipBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceFavorite" ADD CONSTRAINT "ServiceFavorite_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SkillService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceFavorite" ADD CONSTRAINT "ServiceFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SkillService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
