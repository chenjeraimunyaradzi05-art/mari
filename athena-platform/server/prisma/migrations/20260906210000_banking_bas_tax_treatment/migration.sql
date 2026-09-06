-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('GST', 'GST_FREE', 'EXPORT', 'INPUT_TAXED', 'BAS_EXCLUDED', 'CAPITAL', 'GST_COLLECTED', 'GST_PAID');

-- CreateEnum
CREATE TYPE "BankProvider" AS ENUM ('BASIQ', 'CSV');

-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('UNREVIEWED', 'CATEGORISED', 'POSTED', 'IGNORED');

-- AlterTable
ALTER TABLE "AccountingAccount" ADD COLUMN     "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'GST';

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" "BankProvider" NOT NULL,
    "institution" TEXT NOT NULL,
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "providerUserId" TEXT,
    "providerConnectionId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "bsb" TEXT,
    "type" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "availableCents" INTEGER,
    "ledgerAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "ledgerAccountId" TEXT,
    "journalEntryId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankConnection_userId_idx" ON "BankConnection"("userId");

-- CreateIndex
CREATE INDEX "BankAccount_ledgerAccountId_idx" ON "BankAccount"("ledgerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_connectionId_providerAccountId_key" ON "BankAccount"("connectionId", "providerAccountId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_postedAt_idx" ON "BankTransaction"("bankAccountId", "postedAt");

-- CreateIndex
CREATE INDEX "BankTransaction_status_idx" ON "BankTransaction"("status");

-- CreateIndex
CREATE INDEX "BankTransaction_ledgerAccountId_idx" ON "BankTransaction"("ledgerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_bankAccountId_fingerprint_key" ON "BankTransaction"("bankAccountId", "fingerprint");

-- AddForeignKey
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "AccountingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

