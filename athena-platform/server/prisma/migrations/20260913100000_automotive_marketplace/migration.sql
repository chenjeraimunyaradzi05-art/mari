-- Automotive marketplace: the new-car catalogue and reviews, dealerships
-- with test drives and trade-in requests, the garage with service records,
-- the pre-loved listings with inspections and purchases held under buyer
-- protection, the mechanic directory with bookings and verified reviews,
-- and car finance pre-approvals.

-- CreateEnum
CREATE TYPE "CarBodyType" AS ENUM ('HATCH', 'SEDAN', 'WAGON', 'SUV', 'UTE', 'VAN', 'PEOPLE_MOVER', 'COUPE', 'CONVERTIBLE');

-- CreateEnum
CREATE TYPE "CarFuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'PLUG_IN_HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "CarTransmission" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "TestDriveStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradeInStatus" AS ENUM ('OPEN', 'QUOTED', 'ACCEPTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SellerKind" AS ENUM ('PRIVATE', 'DEALER');

-- CreateEnum
CREATE TYPE "ServiceHistoryKind" AS ENUM ('FULL', 'PARTIAL', 'NONE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VehicleListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_OFFER', 'SOLD', 'WITHDRAWN', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ListingWarranty" AS ENUM ('NONE', 'BALANCE_OF_NEW_CAR', 'STATUTORY', 'DEALER', 'EXTENDED');

-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('ATHENA_VETTED', 'INDEPENDENT', 'SELLER_PROVIDED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionOutcome" AS ENUM ('PASS', 'ADVISORIES', 'FAIL');

-- CreateEnum
CREATE TYPE "VehiclePurchaseStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'PAID_HELD', 'HANDED_OVER', 'RELEASED', 'DISPUTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MechanicBookingStatus" AS ENUM ('REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CarFinanceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PRE_APPROVED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "CarModel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "year" INTEGER NOT NULL,
    "bodyType" "CarBodyType" NOT NULL,
    "fuelType" "CarFuelType" NOT NULL,
    "transmission" "CarTransmission" NOT NULL DEFAULT 'AUTOMATIC',
    "seats" INTEGER NOT NULL DEFAULT 5,
    "priceFrom" INTEGER NOT NULL,
    "ancapStars" INTEGER,
    "ancapYear" INTEGER,
    "fuelPer100" DECIMAL(65,30),
    "kwhPer100" DECIMAL(65,30),
    "rangeKm" INTEGER,
    "co2GramsKm" INTEGER,
    "warrantyYears" INTEGER,
    "warrantyKm" INTEGER,
    "serviceIntervalMonths" INTEGER,
    "serviceIntervalKm" INTEGER,
    "servicingCostYear" INTEGER,
    "safetyFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT,
    "asAt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ratingAvg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "reliabilityAvg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarReview" (
    "id" TEXT NOT NULL,
    "carModelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reliability" INTEGER NOT NULL,
    "safetyFeel" INTEGER NOT NULL,
    "runningCosts" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ownedMonths" INTEGER,
    "videoUrl" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dealership" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headline" TEXT NOT NULL,
    "about" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "email" TEXT,
    "womenLed" BOOLEAN NOT NULL DEFAULT false,
    "financeAvailable" BOOLEAN NOT NULL DEFAULT false,
    "financePartners" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hours" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "ratingAvg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDriveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealershipId" TEXT,
    "carModelId" TEXT,
    "listingId" TEXT,
    "preferredAt" TIMESTAMP(3) NOT NULL,
    "alternativeAt" TIMESTAMP(3),
    "note" TEXT,
    "status" "TestDriveStatus" NOT NULL DEFAULT 'REQUESTED',
    "dealerNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestDriveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeInRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "dealershipId" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "variant" TEXT,
    "odometerKm" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "photos" JSONB,
    "notes" TEXT,
    "estimateLow" INTEGER NOT NULL,
    "estimateMid" INTEGER NOT NULL,
    "estimateHigh" INTEGER NOT NULL,
    "status" "TradeInStatus" NOT NULL DEFAULT 'OPEN',
    "quotes" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeInRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "carModelId" TEXT,
    "nickname" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "variant" TEXT,
    "bodyType" "CarBodyType",
    "fuelType" "CarFuelType" NOT NULL DEFAULT 'PETROL',
    "colour" TEXT,
    "rego" TEXT,
    "regoState" TEXT,
    "vin" TEXT,
    "odometerKm" INTEGER,
    "odometerAt" TIMESTAMP(3),
    "kmPerYear" INTEGER,
    "purchasePrice" INTEGER,
    "purchasedAt" DATE,
    "boughtNew" BOOLEAN NOT NULL DEFAULT false,
    "newPrice" INTEGER,
    "warrantyEndsAt" DATE,
    "warrantyEndsKm" INTEGER,
    "regoDueAt" DATE,
    "insuranceRenewsAt" DATE,
    "insurer" TEXT,
    "insurancePremium" INTEGER,
    "nextServiceDueAt" DATE,
    "nextServiceDueKm" INTEGER,
    "serviceIntervalMonths" INTEGER NOT NULL DEFAULT 12,
    "serviceIntervalKm" INTEGER NOT NULL DEFAULT 15000,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReminderKeys" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleServiceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "bookingId" TEXT,
    "mechanicId" TEXT,
    "date" DATE NOT NULL,
    "odometerKm" INTEGER,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "workshop" TEXT,
    "cost" INTEGER,
    "notes" TEXT,
    "partsWarrantyMonths" INTEGER,
    "labourWarrantyMonths" INTEGER,
    "invoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerKind" "SellerKind" NOT NULL DEFAULT 'PRIVATE',
    "dealershipId" TEXT,
    "vehicleId" TEXT,
    "title" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "variant" TEXT,
    "bodyType" "CarBodyType" NOT NULL,
    "fuelType" "CarFuelType" NOT NULL,
    "transmission" "CarTransmission" NOT NULL DEFAULT 'AUTOMATIC',
    "odometerKm" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "priceGuideLow" INTEGER,
    "priceGuideHigh" INTEGER,
    "priceVerdict" TEXT,
    "colour" TEXT,
    "seats" INTEGER,
    "description" TEXT NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photos" JSONB,
    "videoUrl" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "state" TEXT NOT NULL,
    "postcode" TEXT,
    "vin" TEXT,
    "rego" TEXT,
    "regoExpires" DATE,
    "serviceHistory" "ServiceHistoryKind" NOT NULL DEFAULT 'UNKNOWN',
    "accidentHistory" TEXT NOT NULL DEFAULT 'NONE',
    "ownersCount" INTEGER,
    "ppsrChecked" BOOLEAN NOT NULL DEFAULT false,
    "ppsrCertificateUrl" TEXT,
    "roadworthy" BOOLEAN NOT NULL DEFAULT false,
    "warranty" "ListingWarranty" NOT NULL DEFAULT 'NONE',
    "warrantyNote" TEXT,
    "status" "VehicleListingStatus" NOT NULL DEFAULT 'DRAFT',
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "soldAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleListingSave" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleListingSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleInspection" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "purchaseId" TEXT,
    "inspectorId" TEXT,
    "kind" "InspectionKind" NOT NULL DEFAULT 'ATHENA_VETTED',
    "status" "InspectionStatus" NOT NULL DEFAULT 'REQUESTED',
    "fee" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outcome" "InspectionOutcome",
    "summary" TEXT,
    "report" JSONB,
    "reportUrl" TEXT,
    "escrowPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePurchase" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "offerAmount" INTEGER NOT NULL,
    "agreedAmount" INTEGER,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "status" "VehiclePurchaseStatus" NOT NULL DEFAULT 'OFFERED',
    "message" TEXT,
    "sellerMessage" TEXT,
    "escrowPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "handedOverAt" TIMESTAMP(3),
    "inspectionEndsAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputeOpenedAt" TIMESTAMP(3),
    "disputeResolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "transferNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "reviewRating" INTEGER,
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mechanic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "headline" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "womenOwned" BOOLEAN NOT NULL DEFAULT false,
    "womenMechanics" BOOLEAN NOT NULL DEFAULT false,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "makes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evCapable" BOOLEAN NOT NULL DEFAULT false,
    "mobile" BOOLEAN NOT NULL DEFAULT false,
    "loanCar" BOOLEAN NOT NULL DEFAULT false,
    "afterHours" BOOLEAN NOT NULL DEFAULT false,
    "doesInspections" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY['English']::TEXT[],
    "suburb" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "bookingUrl" TEXT,
    "licenceNumber" TEXT,
    "priceList" JSONB,
    "labourRateHour" INTEGER,
    "partsWarrantyMonths" INTEGER,
    "labourWarrantyMonths" INTEGER,
    "warrantyNote" TEXT,
    "availability" JSONB,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "acceptsBookings" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "ratingAvg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "transparencyAvg" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mechanic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicBooking" (
    "id" TEXT NOT NULL,
    "mechanicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "kind" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "dropOff" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,
    "concern" TEXT,
    "odometerKm" INTEGER,
    "status" "MechanicBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "quoteAmount" INTEGER,
    "quoteLines" JSONB,
    "quoteNote" TEXT,
    "quotedAt" TIMESTAMP(3),
    "quoteAcceptedAt" TIMESTAMP(3),
    "partsRequested" JSONB,
    "finalAmount" INTEGER,
    "escrowPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "workshopNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "partsWarrantyMonths" INTEGER,
    "labourWarrantyMonths" INTEGER,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechanicBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicReview" (
    "id" TEXT NOT NULL,
    "mechanicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "transparency" INTEGER NOT NULL,
    "comment" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarFinanceApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "carModelId" TEXT,
    "purpose" TEXT NOT NULL,
    "vehiclePrice" INTEGER NOT NULL,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "tradeIn" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "balloonPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ratePct" DECIMAL(65,30) NOT NULL,
    "repaymentMonthly" INTEGER NOT NULL,
    "incomeAnnual" INTEGER NOT NULL,
    "expensesMonthly" INTEGER NOT NULL,
    "otherDebtsMonthly" INTEGER NOT NULL DEFAULT 0,
    "dependants" INTEGER NOT NULL DEFAULT 0,
    "employment" TEXT NOT NULL,
    "employmentMonths" INTEGER,
    "residency" TEXT,
    "readinessScore" INTEGER NOT NULL,
    "readinessNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CarFinanceStatus" NOT NULL DEFAULT 'DRAFT',
    "lender" TEXT,
    "referenceCode" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "timeline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarFinanceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarModel_slug_key" ON "CarModel"("slug");

-- CreateIndex
CREATE INDEX "CarModel_make_model_idx" ON "CarModel"("make", "model");

-- CreateIndex
CREATE INDEX "CarModel_bodyType_fuelType_idx" ON "CarModel"("bodyType", "fuelType");

-- CreateIndex
CREATE INDEX "CarModel_isActive_idx" ON "CarModel"("isActive");

-- CreateIndex
CREATE INDEX "CarReview_carModelId_isHidden_idx" ON "CarReview"("carModelId", "isHidden");

-- CreateIndex
CREATE UNIQUE INDEX "CarReview_carModelId_userId_key" ON "CarReview"("carModelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Dealership_slug_key" ON "Dealership"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Dealership_ownerUserId_key" ON "Dealership"("ownerUserId");

-- CreateIndex
CREATE INDEX "Dealership_state_isActive_idx" ON "Dealership"("state", "isActive");

-- CreateIndex
CREATE INDEX "TestDriveRequest_userId_idx" ON "TestDriveRequest"("userId");

-- CreateIndex
CREATE INDEX "TestDriveRequest_dealershipId_status_idx" ON "TestDriveRequest"("dealershipId", "status");

-- CreateIndex
CREATE INDEX "TradeInRequest_userId_idx" ON "TradeInRequest"("userId");

-- CreateIndex
CREATE INDEX "TradeInRequest_status_idx" ON "TradeInRequest"("status");

-- CreateIndex
CREATE INDEX "Vehicle_userId_isActive_idx" ON "Vehicle"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleServiceRecord_bookingId_key" ON "VehicleServiceRecord"("bookingId");

-- CreateIndex
CREATE INDEX "VehicleServiceRecord_vehicleId_date_idx" ON "VehicleServiceRecord"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleListing_status_state_idx" ON "VehicleListing"("status", "state");

-- CreateIndex
CREATE INDEX "VehicleListing_make_model_idx" ON "VehicleListing"("make", "model");

-- CreateIndex
CREATE INDEX "VehicleListing_sellerId_idx" ON "VehicleListing"("sellerId");

-- CreateIndex
CREATE INDEX "VehicleListing_price_idx" ON "VehicleListing"("price");

-- CreateIndex
CREATE INDEX "VehicleListingSave_userId_idx" ON "VehicleListingSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleListingSave_listingId_userId_key" ON "VehicleListingSave"("listingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleInspection_escrowPaymentId_key" ON "VehicleInspection"("escrowPaymentId");

-- CreateIndex
CREATE INDEX "VehicleInspection_listingId_idx" ON "VehicleInspection"("listingId");

-- CreateIndex
CREATE INDEX "VehicleInspection_status_idx" ON "VehicleInspection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePurchase_escrowPaymentId_key" ON "VehiclePurchase"("escrowPaymentId");

-- CreateIndex
CREATE INDEX "VehiclePurchase_listingId_idx" ON "VehiclePurchase"("listingId");

-- CreateIndex
CREATE INDEX "VehiclePurchase_buyerId_idx" ON "VehiclePurchase"("buyerId");

-- CreateIndex
CREATE INDEX "VehiclePurchase_sellerId_idx" ON "VehiclePurchase"("sellerId");

-- CreateIndex
CREATE INDEX "VehiclePurchase_status_idx" ON "VehiclePurchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Mechanic_slug_key" ON "Mechanic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Mechanic_ownerUserId_key" ON "Mechanic"("ownerUserId");

-- CreateIndex
CREATE INDEX "Mechanic_state_isActive_idx" ON "Mechanic"("state", "isActive");

-- CreateIndex
CREATE INDEX "Mechanic_isActive_isVerified_idx" ON "Mechanic"("isActive", "isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "MechanicBooking_escrowPaymentId_key" ON "MechanicBooking"("escrowPaymentId");

-- CreateIndex
CREATE INDEX "MechanicBooking_mechanicId_scheduledAt_idx" ON "MechanicBooking"("mechanicId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MechanicBooking_userId_scheduledAt_idx" ON "MechanicBooking"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MechanicBooking_status_idx" ON "MechanicBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MechanicReview_bookingId_key" ON "MechanicReview"("bookingId");

-- CreateIndex
CREATE INDEX "MechanicReview_mechanicId_idx" ON "MechanicReview"("mechanicId");

-- CreateIndex
CREATE UNIQUE INDEX "CarFinanceApplication_referenceCode_key" ON "CarFinanceApplication"("referenceCode");

-- CreateIndex
CREATE INDEX "CarFinanceApplication_userId_idx" ON "CarFinanceApplication"("userId");

-- CreateIndex
CREATE INDEX "CarFinanceApplication_status_idx" ON "CarFinanceApplication"("status");

-- AddForeignKey
ALTER TABLE "CarReview" ADD CONSTRAINT "CarReview_carModelId_fkey" FOREIGN KEY ("carModelId") REFERENCES "CarModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarReview" ADD CONSTRAINT "CarReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealership" ADD CONSTRAINT "Dealership_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDriveRequest" ADD CONSTRAINT "TestDriveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDriveRequest" ADD CONSTRAINT "TestDriveRequest_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDriveRequest" ADD CONSTRAINT "TestDriveRequest_carModelId_fkey" FOREIGN KEY ("carModelId") REFERENCES "CarModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDriveRequest" ADD CONSTRAINT "TestDriveRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeInRequest" ADD CONSTRAINT "TradeInRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeInRequest" ADD CONSTRAINT "TradeInRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeInRequest" ADD CONSTRAINT "TradeInRequest_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_carModelId_fkey" FOREIGN KEY ("carModelId") REFERENCES "CarModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleServiceRecord" ADD CONSTRAINT "VehicleServiceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleServiceRecord" ADD CONSTRAINT "VehicleServiceRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "MechanicBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleServiceRecord" ADD CONSTRAINT "VehicleServiceRecord_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Mechanic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListingSave" ADD CONSTRAINT "VehicleListingSave_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListingSave" ADD CONSTRAINT "VehicleListingSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Mechanic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "VehiclePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_escrowPaymentId_fkey" FOREIGN KEY ("escrowPaymentId") REFERENCES "EscrowPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePurchase" ADD CONSTRAINT "VehiclePurchase_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePurchase" ADD CONSTRAINT "VehiclePurchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePurchase" ADD CONSTRAINT "VehiclePurchase_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePurchase" ADD CONSTRAINT "VehiclePurchase_escrowPaymentId_fkey" FOREIGN KEY ("escrowPaymentId") REFERENCES "EscrowPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mechanic" ADD CONSTRAINT "Mechanic_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicBooking" ADD CONSTRAINT "MechanicBooking_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Mechanic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicBooking" ADD CONSTRAINT "MechanicBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicBooking" ADD CONSTRAINT "MechanicBooking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicBooking" ADD CONSTRAINT "MechanicBooking_escrowPaymentId_fkey" FOREIGN KEY ("escrowPaymentId") REFERENCES "EscrowPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicReview" ADD CONSTRAINT "MechanicReview_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Mechanic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicReview" ADD CONSTRAINT "MechanicReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicReview" ADD CONSTRAINT "MechanicReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "MechanicBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarFinanceApplication" ADD CONSTRAINT "CarFinanceApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "CarReferralKind" AS ENUM ('DEALER_SALE', 'FINANCE', 'INSURANCE', 'WARRANTY', 'PARTS', 'FLEET');

-- CreateEnum
CREATE TYPE "CarReferralStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "CarReferral" (
    "id" TEXT NOT NULL,
    "kind" "CarReferralKind" NOT NULL,
    "status" "CarReferralStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "dealershipId" TEXT,
    "referenceId" TEXT,
    "partner" TEXT,
    "basisAmount" INTEGER NOT NULL,
    "feePercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fee" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarReferral_status_kind_idx" ON "CarReferral"("status", "kind");

-- CreateIndex
CREATE INDEX "CarReferral_dealershipId_idx" ON "CarReferral"("dealershipId");

-- CreateIndex
CREATE INDEX "CarReferral_createdAt_idx" ON "CarReferral"("createdAt");

-- AddForeignKey
ALTER TABLE "CarReferral" ADD CONSTRAINT "CarReferral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarReferral" ADD CONSTRAINT "CarReferral_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
