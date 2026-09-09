-- The four strategy plans a member saves (housing, business, tax, investment),
-- and what she owns and owes for the net worth view.

-- CreateEnum
CREATE TYPE "StrategyArea" AS ENUM ('HOUSING', 'BUSINESS', 'TAX', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "HoldingKind" AS ENUM ('ASSET', 'LIABILITY');

-- CreateEnum
CREATE TYPE "WealthCategory" AS ENUM ('CASH', 'BONDS', 'AU_SHARES', 'INTL_SHARES', 'PROPERTY', 'SUPER', 'CRYPTO', 'BUSINESS', 'OTHER_ASSET', 'MORTGAGE', 'HECS', 'CREDIT_CARD', 'PERSONAL_LOAN', 'OTHER_LIABILITY');

-- CreateTable
CREATE TABLE "StrategyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "StrategyArea" NOT NULL,
    "title" TEXT,
    "inputs" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "HoldingKind" NOT NULL,
    "category" "WealthCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "costBase" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StrategyPlan_userId_idx" ON "StrategyPlan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyPlan_userId_area_key" ON "StrategyPlan"("userId", "area");

-- CreateIndex
CREATE INDEX "PortfolioHolding_userId_idx" ON "PortfolioHolding"("userId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_userId_kind_idx" ON "PortfolioHolding"("userId", "kind");

-- AddForeignKey
ALTER TABLE "StrategyPlan" ADD CONSTRAINT "StrategyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
