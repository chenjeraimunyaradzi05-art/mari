-- CreateEnum
CREATE TYPE "AccountingAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "TaxRateType" AS ENUM ('GST', 'VAT', 'SALES_TAX', 'WITHHOLDING');

-- CreateEnum
CREATE TYPE "TaxReturnStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN');

-- CreateEnum
CREATE TYPE "InventoryValuationMethod" AS ENUM ('FIFO', 'LIFO', 'AVERAGE');

-- CreateEnum
CREATE TYPE "MoneyTransactionType" AS ENUM ('PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MoneyTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "AccountingAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "AccountingAccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "type" "TaxRateType" NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "region" "Region",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReturn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "TaxReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "totalSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "filedAt" TIMESTAMP(3),
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "valuationMethod" "InventoryValuationMethod" NOT NULL DEFAULT 'FIFO',
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT,
    "createdByUserId" TEXT,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "reference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "type" "MoneyTransactionType" NOT NULL,
    "status" "MoneyTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AccountingAccount_organizationId_idx" ON "AccountingAccount"("organizationId");
CREATE INDEX "AccountingAccount_userId_idx" ON "AccountingAccount"("userId");
CREATE INDEX "AccountingAccount_type_idx" ON "AccountingAccount"("type");
CREATE INDEX "AccountingAccount_currency_idx" ON "AccountingAccount"("currency");
CREATE INDEX "AccountingAccount_isActive_idx" ON "AccountingAccount"("isActive");
CREATE UNIQUE INDEX "AccountingAccount_organizationId_code_key" ON "AccountingAccount"("organizationId", "code");

CREATE INDEX "JournalEntry_organizationId_idx" ON "JournalEntry"("organizationId");
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");
CREATE INDEX "JournalEntry_status_idx" ON "JournalEntry"("status");
CREATE INDEX "JournalEntry_status_entryDate_idx" ON "JournalEntry"("status", "entryDate");
CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

CREATE INDEX "TaxRate_organizationId_idx" ON "TaxRate"("organizationId");
CREATE INDEX "TaxRate_region_idx" ON "TaxRate"("region");
CREATE INDEX "TaxRate_type_idx" ON "TaxRate"("type");
CREATE INDEX "TaxRate_isActive_idx" ON "TaxRate"("isActive");
CREATE INDEX "TaxRate_organizationId_type_idx" ON "TaxRate"("organizationId", "type");

CREATE INDEX "TaxReturn_organizationId_idx" ON "TaxReturn"("organizationId");
CREATE INDEX "TaxReturn_userId_idx" ON "TaxReturn"("userId");
CREATE INDEX "TaxReturn_status_idx" ON "TaxReturn"("status");
CREATE INDEX "TaxReturn_periodStart_periodEnd_idx" ON "TaxReturn"("periodStart", "periodEnd");
CREATE INDEX "TaxReturn_organizationId_status_idx" ON "TaxReturn"("organizationId", "status");

CREATE INDEX "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId");
CREATE INDEX "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");
CREATE INDEX "InventoryItem_organizationId_sku_idx" ON "InventoryItem"("organizationId", "sku");
CREATE UNIQUE INDEX "InventoryItem_organizationId_sku_key" ON "InventoryItem"("organizationId", "sku");

CREATE INDEX "InventoryLocation_organizationId_idx" ON "InventoryLocation"("organizationId");
CREATE INDEX "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");
CREATE INDEX "InventoryLocation_organizationId_code_idx" ON "InventoryLocation"("organizationId", "code");
CREATE UNIQUE INDEX "InventoryLocation_organizationId_code_key" ON "InventoryLocation"("organizationId", "code");

CREATE INDEX "InventoryTransaction_itemId_idx" ON "InventoryTransaction"("itemId");
CREATE INDEX "InventoryTransaction_locationId_idx" ON "InventoryTransaction"("locationId");
CREATE INDEX "InventoryTransaction_type_idx" ON "InventoryTransaction"("type");
CREATE INDEX "InventoryTransaction_occurredAt_idx" ON "InventoryTransaction"("occurredAt");
CREATE INDEX "InventoryTransaction_itemId_occurredAt_idx" ON "InventoryTransaction"("itemId", "occurredAt");

CREATE INDEX "MoneyTransaction_organizationId_idx" ON "MoneyTransaction"("organizationId");
CREATE INDEX "MoneyTransaction_userId_idx" ON "MoneyTransaction"("userId");
CREATE INDEX "MoneyTransaction_status_idx" ON "MoneyTransaction"("status");
CREATE INDEX "MoneyTransaction_type_idx" ON "MoneyTransaction"("type");
CREATE INDEX "MoneyTransaction_currency_idx" ON "MoneyTransaction"("currency");

-- Foreign Keys
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingAccount" ADD CONSTRAINT "AccountingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AccountingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
