-- CreateEnum
CREATE TYPE "WomanVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BusinessStatus" ADD VALUE 'DETAILS_COMPLETE';
ALTER TYPE "BusinessStatus" ADD VALUE 'PEOPLE_ADDED';
ALTER TYPE "BusinessStatus" ADD VALUE 'ADDRESS_VERIFIED';
ALTER TYPE "BusinessStatus" ADD VALUE 'DOCUMENTS_UPLOADED';
ALTER TYPE "BusinessStatus" ADD VALUE 'PAYMENT_PENDING';
ALTER TYPE "BusinessStatus" ADD VALUE 'PAYMENT_COMPLETE';
ALTER TYPE "BusinessStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "BusinessStatus" ADD VALUE 'ADDITIONAL_INFO_REQUIRED';
ALTER TYPE "BusinessStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "BusinessRegistration" ADD COLUMN     "stateHistory" JSONB;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "messageCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "lastReadMessageId" TEXT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "allowMemberInvites" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxMembers" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "requireApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GroupJoinRequest" ADD COLUMN     "invitedById" TEXT;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "bannedReason" TEXT,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMuted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mutedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "referenceStatus" TEXT,
ADD COLUMN     "referencesReceived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referencesTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "partitionKey" TEXT,
ADD COLUMN     "replyToId" TEXT,
ADD COLUMN     "type" TEXT,
ALTER COLUMN "receiverId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "amount" DECIMAL(10,2),
ADD COLUMN     "interval" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inviteCodeId" TEXT,
ADD COLUMN     "safetyScore" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "safetyScoreUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "stripeConnectAccountId" TEXT,
ADD COLUMN     "stripeConnectStatus" TEXT,
ADD COLUMN     "womanSelfAttested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "womanVerificationStatus" "WomanVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "womanVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowPayment" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeTransferId" TEXT,
    "paymentIntentId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "sessionType" TEXT,
    "releasedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "reason" TEXT,
    "reporterId" TEXT,
    "contentId" TEXT,
    "contentType" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "flaggedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "paymentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "type" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceRequest" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "refereeEmail" TEXT NOT NULL,
    "refereeName" TEXT NOT NULL,
    "refereeTitle" TEXT,
    "refereeCompany" TEXT,
    "relationship" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "responses" JSONB,
    "overallRating" INTEGER,
    "feedback" TEXT,
    "customQuestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_isActive_idx" ON "InviteCode"("isActive");

-- CreateIndex
CREATE INDEX "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "PushToken_token_idx" ON "PushToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowPayment_stripePaymentIntentId_key" ON "EscrowPayment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowPayment_paymentIntentId_key" ON "EscrowPayment"("paymentIntentId");

-- CreateIndex
CREATE INDEX "EscrowPayment_buyerId_idx" ON "EscrowPayment"("buyerId");

-- CreateIndex
CREATE INDEX "EscrowPayment_sellerId_idx" ON "EscrowPayment"("sellerId");

-- CreateIndex
CREATE INDEX "EscrowPayment_status_idx" ON "EscrowPayment"("status");

-- CreateIndex
CREATE INDEX "UsageLog_userId_idx" ON "UsageLog"("userId");

-- CreateIndex
CREATE INDEX "UsageLog_feature_idx" ON "UsageLog"("feature");

-- CreateIndex
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "SafetyIncident_userId_idx" ON "SafetyIncident"("userId");

-- CreateIndex
CREATE INDEX "SafetyIncident_type_idx" ON "SafetyIncident"("type");

-- CreateIndex
CREATE INDEX "SafetyIncident_severity_idx" ON "SafetyIncident"("severity");

-- CreateIndex
CREATE INDEX "SafetyIncident_verified_idx" ON "SafetyIncident"("verified");

-- CreateIndex
CREATE INDEX "AdminFlag_userId_idx" ON "AdminFlag"("userId");

-- CreateIndex
CREATE INDEX "AdminFlag_type_idx" ON "AdminFlag"("type");

-- CreateIndex
CREATE INDEX "AdminFlag_isActive_idx" ON "AdminFlag"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_stripePaymentIntentId_idx" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceRequest_token_key" ON "ReferenceRequest"("token");

-- CreateIndex
CREATE INDEX "ReferenceRequest_candidateId_idx" ON "ReferenceRequest"("candidateId");

-- CreateIndex
CREATE INDEX "ReferenceRequest_applicationId_idx" ON "ReferenceRequest"("applicationId");

-- CreateIndex
CREATE INDEX "ReferenceRequest_status_idx" ON "ReferenceRequest"("status");

-- CreateIndex
CREATE INDEX "ReferenceRequest_token_idx" ON "ReferenceRequest"("token");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "Message_isArchived_idx" ON "Message"("isArchived");

-- CreateIndex
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

-- CreateIndex
CREATE INDEX "Message_partitionKey_idx" ON "Message"("partitionKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowPayment" ADD CONSTRAINT "EscrowPayment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowPayment" ADD CONSTRAINT "EscrowPayment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceRequest" ADD CONSTRAINT "ReferenceRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceRequest" ADD CONSTRAINT "ReferenceRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
