-- CreateEnum
CREATE TYPE "HousingListingType" AS ENUM ('RENTAL', 'SHARE', 'EMERGENCY', 'TRANSITIONAL');

-- CreateEnum
CREATE TYPE "HousingListingStatus" AS ENUM ('ACTIVE', 'PENDING', 'LEASED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "HousingInquiryStatus" AS ENUM ('PENDING', 'CONTACTED', 'VIEWING_SCHEDULED', 'APPLICATION_SUBMITTED', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SavingsGoalType" AS ENUM ('EMERGENCY_FUND', 'HOME_DEPOSIT', 'EDUCATION', 'BUSINESS', 'TRAVEL', 'OTHER');

-- CreateEnum
CREATE TYPE "SavingsGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('INCOME_PROTECTION', 'LIFE', 'TPD', 'TRAUMA', 'HEALTH');

-- CreateEnum
CREATE TYPE "InsuranceApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'ACTIVE', 'LAPSED');

-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('FIRST_NATIONS', 'REFUGEE_IMMIGRANT', 'DV_SURVIVOR', 'DISABILITY', 'LGBTQIA', 'SINGLE_PARENT', 'RURAL_REGIONAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "SupportProgramStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImpactMetricType" AS ENUM ('EMPLOYMENT_GAINED', 'INCOME_INCREASED', 'HOUSING_SECURED', 'QUALIFICATION_OBTAINED', 'BUSINESS_STARTED', 'SAFETY_ACHIEVED', 'SKILL_CERTIFIED', 'MENTORSHIP_COMPLETED', 'FINANCIAL_INDEPENDENCE');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('NATIVE', 'FLUENT', 'ADVANCED', 'INTERMEDIATE', 'BEGINNER', 'NONE');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING_REVIEW', 'RECOGNIZED', 'PARTIALLY_RECOGNIZED', 'BRIDGING_REQUIRED', 'NOT_RECOGNIZED');

-- CreateEnum
CREATE TYPE "VideoCategory" AS ENUM ('CAREER_TRANSFORMATION', 'SKILL_SHOWCASE', 'DAY_IN_THE_LIFE', 'MENTORSHIP_MOMENT', 'SUCCESS_CELEBRATION', 'FINANCIAL_LITERACY', 'ENTREPRENEURSHIP', 'LEADERSHIP', 'TECH', 'WELLNESS', 'EDUCATION', 'GENERAL');

-- CreateTable
CREATE TABLE "HousingListing" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "HousingListingType" NOT NULL,
    "address" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Australia',
    "rentWeekly" DECIMAL(65,30),
    "bondAmount" DECIMAL(65,30),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "parking" INTEGER,
    "features" TEXT[],
    "safetyVerified" BOOLEAN NOT NULL DEFAULT false,
    "dvSafe" BOOLEAN NOT NULL DEFAULT false,
    "petFriendly" BOOLEAN NOT NULL DEFAULT false,
    "accessibleUnit" BOOLEAN NOT NULL DEFAULT false,
    "availableFrom" TIMESTAMP(3),
    "minLeaseTerm" INTEGER,
    "flexibleLease" BOOLEAN NOT NULL DEFAULT false,
    "images" JSONB,
    "status" "HousingListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousingListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousingInquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "HousingInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "viewingDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousingInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SavingsGoalType" NOT NULL,
    "targetAmount" DECIMAL(65,30) NOT NULL,
    "currentAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "targetDate" TIMESTAMP(3),
    "monthlyTarget" DECIMAL(65,30),
    "autoSaveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoSaveAmount" DECIMAL(65,30),
    "status" "SavingsGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsContribution" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceProduct" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InsuranceType" NOT NULL,
    "description" TEXT,
    "coverageAmount" DECIMAL(65,30),
    "premiumMonthly" DECIMAL(65,30),
    "premiumAnnual" DECIMAL(65,30),
    "waitingPeriod" INTEGER,
    "benefitPeriod" INTEGER,
    "features" TEXT[],
    "exclusions" TEXT[],
    "commissionPct" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceApplication" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InsuranceApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicationData" JSONB,
    "premiumQuoted" DECIMAL(65,30),
    "coverageAmount" DECIMAL(65,30),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "policyNumber" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperannuationAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fundName" TEXT NOT NULL,
    "memberNumber" TEXT,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "employerContr" DECIMAL(65,30),
    "personalContr" DECIMAL(65,30),
    "investmentOpt" TEXT,
    "insuranceInc" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperannuationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialHealthScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "emergencyFundScore" INTEGER,
    "debtScore" INTEGER,
    "savingsRateScore" INTEGER,
    "insuranceScore" INTEGER,
    "superScore" INTEGER,
    "recommendations" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialHealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySupportProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "communityType" "CommunityType" NOT NULL,
    "description" TEXT NOT NULL,
    "eligibilityDesc" TEXT,
    "objectives" TEXT[],
    "partnerOrgs" TEXT[],
    "fundingSource" TEXT,
    "maxParticipants" INTEGER,
    "currentParticipants" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "region" "Region" NOT NULL DEFAULT 'ANZ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunitySupportProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramEnrollment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SupportProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "caseManagerId" TEXT,
    "notes" TEXT,
    "goalsSet" JSONB,
    "progressData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramMilestone" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "requiredForCompletion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "evidence" TEXT,
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndigenousCommunityPage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "region" TEXT,
    "nation" TEXT,
    "isWomenOnly" BOOLEAN NOT NULL DEFAULT true,
    "coverImage" TEXT,
    "membersCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "moderatorIds" TEXT[],
    "culturalProtocols" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndigenousCommunityPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndigenousCommunityMember" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndigenousCommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndigenousResource" (
    "id" TEXT NOT NULL,
    "communityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "partnerOrg" TEXT,
    "isNational" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndigenousResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryLanguage" TEXT NOT NULL,
    "primaryProficiency" "LanguageProficiency" NOT NULL DEFAULT 'NATIVE',
    "englishProficiency" "LanguageProficiency" NOT NULL DEFAULT 'INTERMEDIATE',
    "otherLanguages" JSONB,
    "needsInterpreter" BOOLEAN NOT NULL DEFAULT false,
    "preferredInterpreterLang" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanguageProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternationalCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalCountry" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL,
    "credentialName" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "yearObtained" INTEGER,
    "fieldOfStudy" TEXT,
    "documentUrl" TEXT,
    "status" "CredentialStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "australianEquiv" TEXT,
    "bridgingRequired" TEXT,
    "assessmentBody" TEXT,
    "assessmentDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternationalCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgingProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "description" TEXT,
    "duration" TEXT,
    "cost" DECIMAL(65,30),
    "fundingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "requirements" TEXT[],
    "outcomes" TEXT[],
    "region" "Region" NOT NULL DEFAULT 'ANZ',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgingEnrollment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT,
    "status" "SupportProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emergencyContacts" JSONB,
    "safeLocations" JSONB,
    "warningTriggers" JSONB,
    "exitStrategies" JSONB,
    "importantDocs" JSONB,
    "financialPlan" JSONB,
    "legalContacts" JSONB,
    "lastReviewedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DVSupportService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "description" TEXT,
    "available24x7" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT,
    "isNational" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DVSupportService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessibilityProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasVisionImpairment" BOOLEAN NOT NULL DEFAULT false,
    "hasHearingImpairment" BOOLEAN NOT NULL DEFAULT false,
    "hasMobilityImpairment" BOOLEAN NOT NULL DEFAULT false,
    "hasCognitiveDisability" BOOLEAN NOT NULL DEFAULT false,
    "usesScreenReader" BOOLEAN NOT NULL DEFAULT false,
    "usesVoiceControl" BOOLEAN NOT NULL DEFAULT false,
    "preferredFontSize" TEXT,
    "highContrastMode" BOOLEAN NOT NULL DEFAULT false,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "captionsRequired" BOOLEAN NOT NULL DEFAULT false,
    "otherNeeds" TEXT,
    "workAccommodations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessibilityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisabilityFriendlyEmployer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accessibilityRating" INTEGER,
    "accommodationsOffered" TEXT[],
    "hasWheelchairAccess" BOOLEAN NOT NULL DEFAULT false,
    "hasFlexibleWork" BOOLEAN NOT NULL DEFAULT false,
    "hasRemoteOptions" BOOLEAN NOT NULL DEFAULT false,
    "hasMentalHealthSupport" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "badgeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisabilityFriendlyEmployer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricType" "ImpactMetricType" NOT NULL,
    "value" DECIMAL(65,30),
    "description" TEXT,
    "evidenceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "communityType" "CommunityType",
    "programId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactReport" (
    "id" TEXT NOT NULL,
    "reportPeriod" TEXT NOT NULL,
    "communityType" "CommunityType",
    "region" "Region" NOT NULL DEFAULT 'ANZ',
    "totalUsersSupported" INTEGER NOT NULL DEFAULT 0,
    "employmentGained" INTEGER NOT NULL DEFAULT 0,
    "avgIncomeIncrease" DECIMAL(65,30),
    "housingSecured" INTEGER NOT NULL DEFAULT 0,
    "qualificationsObtained" INTEGER NOT NULL DEFAULT 0,
    "businessesStarted" INTEGER NOT NULL DEFAULT 0,
    "safetyAchieved" INTEGER NOT NULL DEFAULT 0,
    "totalEconomicImpact" DECIMAL(65,30),
    "narrativeSummary" TEXT,
    "dataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "focusAreas" "CommunityType"[],
    "website" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "partnerSince" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "region" "Region" NOT NULL DEFAULT 'ANZ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerPrediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "predictedRoles" JSONB NOT NULL,
    "prioritySkills" JSONB NOT NULL,
    "mentorRecommendations" JSONB,
    "opportunitiesToTrack" JSONB,
    "riskFactors" JSONB,
    "modelVersion" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "skillsMatch" INTEGER NOT NULL,
    "salaryFit" INTEGER,
    "growthPotential" INTEGER,
    "cultureFit" INTEGER,
    "matchReasons" JSONB NOT NULL,
    "isViewed" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" TIMESTAMP(3),
    "isInterested" BOOLEAN,
    "interactionAt" TIMESTAMP(3),
    "feedback" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "OpportunityMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryDataPoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "normalizedTitle" TEXT,
    "company" TEXT,
    "companySize" TEXT,
    "industry" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Australia',
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "baseSalary" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "bonus" DECIMAL(65,30),
    "equity" DECIMAL(65,30),
    "totalComp" DECIMAL(65,30),
    "yearsExperience" INTEGER,
    "yearsInRole" INTEGER,
    "educationLevel" TEXT,
    "gender" TEXT,
    "ageRange" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryDataPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetLocation" TEXT,
    "targetCompany" TEXT,
    "marketMedian" DECIMAL(65,30) NOT NULL,
    "userPercentile" INTEGER,
    "genderGapAmount" DECIMAL(65,30),
    "genderGapPercent" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL,
    "salaryBands" JSONB NOT NULL,
    "byExperience" JSONB,
    "byEducation" JSONB,
    "byCompanySize" JSONB,
    "negotiationTips" JSONB,
    "comparableOffers" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorMatchScore" (
    "id" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "careerPathSimilarity" INTEGER NOT NULL,
    "skillGapCoverage" INTEGER NOT NULL,
    "industryKnowledge" INTEGER NOT NULL,
    "styleCompatibility" INTEGER NOT NULL,
    "timezoneOverlap" INTEGER NOT NULL,
    "availabilityMatch" INTEGER NOT NULL,
    "successLikelihood" INTEGER NOT NULL,
    "matchReasons" JSONB NOT NULL,
    "recommendedFormat" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorMatchScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrustScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityScore" INTEGER NOT NULL DEFAULT 0,
    "accountAge" INTEGER NOT NULL DEFAULT 0,
    "accountAgeScore" INTEGER NOT NULL DEFAULT 0,
    "communityFeedback" INTEGER NOT NULL DEFAULT 50,
    "engagementScore" INTEGER NOT NULL DEFAULT 50,
    "professionalScore" INTEGER NOT NULL DEFAULT 0,
    "badges" TEXT[],
    "warningsCount" INTEGER NOT NULL DEFAULT 0,
    "suspensionsCount" INTEGER NOT NULL DEFAULT 0,
    "lastIncidentAt" TIMESTAMP(3),
    "reportsAgainst" INTEGER NOT NULL DEFAULT 0,
    "reportsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "reportAccuracy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "action" TEXT,
    "actionTakenAt" TIMESTAMP(3),
    "aiConfidence" DOUBLE PRECISION,
    "aiCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "followerGrowth" JSONB,
    "totalVideos" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "avgViews" DOUBLE PRECISION,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "avgEngagementRate" DOUBLE PRECISION,
    "audienceGender" JSONB,
    "audienceAge" JSONB,
    "audienceLocation" JSONB,
    "peakActiveHours" JSONB,
    "totalEarnings" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "monthlyEarnings" JSONB,
    "revenueBySource" JSONB,
    "creatorTier" TEXT NOT NULL DEFAULT 'BRONZE',
    "isMonetized" BOOLEAN NOT NULL DEFAULT false,
    "monetizedAt" TIMESTAMP(3),
    "projectedIncome" JSONB,
    "topRevenueStreams" JSONB,
    "monetizationRoadmap" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeedPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "followedCategories" "VideoCategory"[],
    "followedHashtags" TEXT[],
    "blockedHashtags" TEXT[],
    "blockedCreators" TEXT[],
    "likedCategories" JSONB,
    "watchHistory" JSONB,
    "searchHistory" TEXT[],
    "inNetworkRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "outNetworkRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "trendingRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "preferredDuration" TEXT,
    "autoplayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeedPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referrerReward" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "refereeReward" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "rewardType" TEXT NOT NULL DEFAULT 'CREDIT',
    "maxUses" INTEGER,
    "usesRemaining" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "successfulConversions" INTEGER NOT NULL DEFAULT 0,
    "totalRewardsEarned" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "campaign" TEXT,
    "referrerRewarded" BOOLEAN NOT NULL DEFAULT false,
    "refereeRewarded" BOOLEAN NOT NULL DEFAULT false,
    "referrerRewardAmount" DECIMAL(65,30),
    "refereeRewardAmount" DECIMAL(65,30),
    "rewardedAt" TIMESTAMP(3),
    "signedUpAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "conversionValue" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "campaignType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "targetPersonas" TEXT[],
    "targetRegions" TEXT[],
    "targetAgeRange" TEXT,
    "budget" DECIMAL(65,30),
    "spent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "goalType" TEXT,
    "goalTarget" INTEGER,
    "goalAchieved" INTEGER NOT NULL DEFAULT 0,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "trackingPixels" JSONB,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cpa" DECIMAL(65,30),
    "cpc" DECIMAL(65,30),
    "conversionRate" DOUBLE PRECISION,
    "roi" DOUBLE PRECISION,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAcquisition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acquisitionSource" TEXT NOT NULL,
    "acquisitionChannel" TEXT,
    "campaignId" TEXT,
    "referralCodeId" TEXT,
    "partnerId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "landingPage" TEXT,
    "firstPageViewed" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "signupAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "firstPurchaseAt" TIMESTAMP(3),
    "firstPurchaseValue" DECIMAL(65,30),
    "totalSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "ltv" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAcquisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerType" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "agreementType" TEXT,
    "contractValue" DECIMAL(65,30),
    "revenueShare" DOUBLE PRECISION,
    "paymentTerms" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "integrationLevel" TEXT,
    "apiAccess" BOOLEAN NOT NULL DEFAULT false,
    "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "usersReferred" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "documents" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "persona" TEXT,
    "industry" TEXT,
    "jobTitle" TEXT,
    "source" TEXT,
    "referredBy" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "position" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "vipReason" TEXT,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "emailsOpened" INTEGER NOT NULL DEFAULT 0,
    "referralsMade" INTEGER NOT NULL DEFAULT 0,
    "invitedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaTester" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "npsScore" INTEGER,
    "feedbackCount" INTEGER NOT NULL DEFAULT 0,
    "bugsReported" INTEGER NOT NULL DEFAULT 0,
    "featuresRequested" INTEGER NOT NULL DEFAULT 0,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "featuresUsed" TEXT[],
    "rewardTier" TEXT,
    "creditsEarned" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "premiumMonths" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaTester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "isVirtual" BOOLEAN NOT NULL DEFAULT true,
    "virtualLink" TEXT,
    "physicalAddress" TEXT,
    "city" TEXT,
    "country" TEXT,
    "maxAttendees" INTEGER,
    "registeredCount" INTEGER NOT NULL DEFAULT 0,
    "attendedCount" INTEGER NOT NULL DEFAULT 0,
    "registrationUrl" TEXT,
    "registrationDeadline" TIMESTAMP(3),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "speakers" JSONB,
    "agenda" JSONB,
    "resources" JSONB,
    "campaignId" TEXT,
    "targetPersonas" TEXT[],
    "recordingUrl" TEXT,
    "slidesDeckUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingEventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "checkedInAt" TIMESTAMP(3),
    "attendanceDuration" INTEGER,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "pollsAnswered" INTEGER NOT NULL DEFAULT 0,
    "resourcesDownloaded" INTEGER NOT NULL DEFAULT 0,
    "followUpSent" BOOLEAN NOT NULL DEFAULT false,
    "followUpOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingEventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "templateId" TEXT,
    "htmlContent" TEXT,
    "plainContent" TEXT,
    "audienceType" TEXT NOT NULL,
    "segmentCriteria" JSONB,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,
    "complained" INTEGER NOT NULL DEFAULT 0,
    "deliveryRate" DOUBLE PRECISION,
    "openRate" DOUBLE PRECISION,
    "clickRate" DOUBLE PRECISION,
    "unsubscribeRate" DOUBLE PRECISION,
    "isAbTest" BOOLEAN NOT NULL DEFAULT false,
    "variantA" JSONB,
    "variantB" JSONB,
    "winningVariant" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HousingListing_type_idx" ON "HousingListing"("type");

-- CreateIndex
CREATE INDEX "HousingListing_status_idx" ON "HousingListing"("status");

-- CreateIndex
CREATE INDEX "HousingListing_dvSafe_idx" ON "HousingListing"("dvSafe");

-- CreateIndex
CREATE INDEX "HousingListing_city_idx" ON "HousingListing"("city");

-- CreateIndex
CREATE INDEX "HousingInquiry_userId_idx" ON "HousingInquiry"("userId");

-- CreateIndex
CREATE INDEX "HousingInquiry_status_idx" ON "HousingInquiry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HousingInquiry_listingId_userId_key" ON "HousingInquiry"("listingId", "userId");

-- CreateIndex
CREATE INDEX "SavingsGoal_userId_idx" ON "SavingsGoal"("userId");

-- CreateIndex
CREATE INDEX "SavingsGoal_type_idx" ON "SavingsGoal"("type");

-- CreateIndex
CREATE INDEX "SavingsGoal_status_idx" ON "SavingsGoal"("status");

-- CreateIndex
CREATE INDEX "SavingsContribution_goalId_idx" ON "SavingsContribution"("goalId");

-- CreateIndex
CREATE INDEX "InsuranceProduct_type_idx" ON "InsuranceProduct"("type");

-- CreateIndex
CREATE INDEX "InsuranceProduct_isActive_idx" ON "InsuranceProduct"("isActive");

-- CreateIndex
CREATE INDEX "InsuranceApplication_userId_idx" ON "InsuranceApplication"("userId");

-- CreateIndex
CREATE INDEX "InsuranceApplication_status_idx" ON "InsuranceApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceApplication_productId_userId_key" ON "InsuranceApplication"("productId", "userId");

-- CreateIndex
CREATE INDEX "SuperannuationAccount_userId_idx" ON "SuperannuationAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialHealthScore_userId_key" ON "FinancialHealthScore"("userId");

-- CreateIndex
CREATE INDEX "FinancialHealthScore_overallScore_idx" ON "FinancialHealthScore"("overallScore");

-- CreateIndex
CREATE INDEX "CommunitySupportProgram_communityType_idx" ON "CommunitySupportProgram"("communityType");

-- CreateIndex
CREATE INDEX "CommunitySupportProgram_isActive_idx" ON "CommunitySupportProgram"("isActive");

-- CreateIndex
CREATE INDEX "CommunitySupportProgram_region_idx" ON "CommunitySupportProgram"("region");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_userId_idx" ON "ProgramEnrollment"("userId");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_status_idx" ON "ProgramEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramEnrollment_programId_userId_key" ON "ProgramEnrollment"("programId", "userId");

-- CreateIndex
CREATE INDEX "ProgramMilestone_programId_idx" ON "ProgramMilestone"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneProgress_enrollmentId_milestoneId_key" ON "MilestoneProgress"("enrollmentId", "milestoneId");

-- CreateIndex
CREATE INDEX "IndigenousCommunityPage_isWomenOnly_idx" ON "IndigenousCommunityPage"("isWomenOnly");

-- CreateIndex
CREATE INDEX "IndigenousCommunityPage_isVerified_idx" ON "IndigenousCommunityPage"("isVerified");

-- CreateIndex
CREATE INDEX "IndigenousCommunityMember_userId_idx" ON "IndigenousCommunityMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IndigenousCommunityMember_communityId_userId_key" ON "IndigenousCommunityMember"("communityId", "userId");

-- CreateIndex
CREATE INDEX "IndigenousResource_type_idx" ON "IndigenousResource"("type");

-- CreateIndex
CREATE INDEX "IndigenousResource_isNational_idx" ON "IndigenousResource"("isNational");

-- CreateIndex
CREATE UNIQUE INDEX "LanguageProfile_userId_key" ON "LanguageProfile"("userId");

-- CreateIndex
CREATE INDEX "InternationalCredential_userId_idx" ON "InternationalCredential"("userId");

-- CreateIndex
CREATE INDEX "InternationalCredential_status_idx" ON "InternationalCredential"("status");

-- CreateIndex
CREATE INDEX "InternationalCredential_originalCountry_idx" ON "InternationalCredential"("originalCountry");

-- CreateIndex
CREATE INDEX "BridgingProgram_profession_idx" ON "BridgingProgram"("profession");

-- CreateIndex
CREATE INDEX "BridgingProgram_isActive_idx" ON "BridgingProgram"("isActive");

-- CreateIndex
CREATE INDEX "BridgingEnrollment_userId_idx" ON "BridgingEnrollment"("userId");

-- CreateIndex
CREATE INDEX "BridgingEnrollment_status_idx" ON "BridgingEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BridgingEnrollment_programId_userId_key" ON "BridgingEnrollment"("programId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyPlan_userId_key" ON "SafetyPlan"("userId");

-- CreateIndex
CREATE INDEX "DVSupportService_type_idx" ON "DVSupportService"("type");

-- CreateIndex
CREATE INDEX "DVSupportService_state_idx" ON "DVSupportService"("state");

-- CreateIndex
CREATE INDEX "DVSupportService_isNational_idx" ON "DVSupportService"("isNational");

-- CreateIndex
CREATE UNIQUE INDEX "AccessibilityProfile_userId_key" ON "AccessibilityProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DisabilityFriendlyEmployer_organizationId_key" ON "DisabilityFriendlyEmployer"("organizationId");

-- CreateIndex
CREATE INDEX "ImpactMetric_userId_idx" ON "ImpactMetric"("userId");

-- CreateIndex
CREATE INDEX "ImpactMetric_metricType_idx" ON "ImpactMetric"("metricType");

-- CreateIndex
CREATE INDEX "ImpactMetric_communityType_idx" ON "ImpactMetric"("communityType");

-- CreateIndex
CREATE INDEX "ImpactReport_communityType_idx" ON "ImpactReport"("communityType");

-- CreateIndex
CREATE INDEX "ImpactReport_region_idx" ON "ImpactReport"("region");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactReport_reportPeriod_communityType_region_key" ON "ImpactReport"("reportPeriod", "communityType", "region");

-- CreateIndex
CREATE INDEX "ImpactPartner_isActive_idx" ON "ImpactPartner"("isActive");

-- CreateIndex
CREATE INDEX "CareerPrediction_userId_idx" ON "CareerPrediction"("userId");

-- CreateIndex
CREATE INDEX "CareerPrediction_generatedAt_idx" ON "CareerPrediction"("generatedAt");

-- CreateIndex
CREATE INDEX "OpportunityMatch_userId_isViewed_idx" ON "OpportunityMatch"("userId", "isViewed");

-- CreateIndex
CREATE INDEX "OpportunityMatch_opportunityType_idx" ON "OpportunityMatch"("opportunityType");

-- CreateIndex
CREATE INDEX "OpportunityMatch_matchScore_idx" ON "OpportunityMatch"("matchScore");

-- CreateIndex
CREATE INDEX "SalaryDataPoint_normalizedTitle_idx" ON "SalaryDataPoint"("normalizedTitle");

-- CreateIndex
CREATE INDEX "SalaryDataPoint_city_state_idx" ON "SalaryDataPoint"("city", "state");

-- CreateIndex
CREATE INDEX "SalaryDataPoint_gender_idx" ON "SalaryDataPoint"("gender");

-- CreateIndex
CREATE INDEX "SalaryDataPoint_submittedAt_idx" ON "SalaryDataPoint"("submittedAt");

-- CreateIndex
CREATE INDEX "SalaryAnalysis_userId_idx" ON "SalaryAnalysis"("userId");

-- CreateIndex
CREATE INDEX "SalaryAnalysis_targetRole_idx" ON "SalaryAnalysis"("targetRole");

-- CreateIndex
CREATE INDEX "MentorMatchScore_menteeId_overallScore_idx" ON "MentorMatchScore"("menteeId", "overallScore");

-- CreateIndex
CREATE INDEX "MentorMatchScore_mentorId_idx" ON "MentorMatchScore"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorMatchScore_menteeId_mentorId_key" ON "MentorMatchScore"("menteeId", "mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTrustScore_userId_key" ON "UserTrustScore"("userId");

-- CreateIndex
CREATE INDEX "UserTrustScore_trustScore_idx" ON "UserTrustScore"("trustScore");

-- CreateIndex
CREATE INDEX "ContentReport_reportedUserId_idx" ON "ContentReport"("reportedUserId");

-- CreateIndex
CREATE INDEX "ContentReport_status_idx" ON "ContentReport"("status");

-- CreateIndex
CREATE INDEX "ContentReport_contentType_contentId_idx" ON "ContentReport"("contentType", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorAnalytics_userId_key" ON "CreatorAnalytics"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFeedPreferences_userId_key" ON "UserFeedPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_userId_idx" ON "ReferralCode"("userId");

-- CreateIndex
CREATE INDEX "MarketingReferral_referralCodeId_idx" ON "MarketingReferral"("referralCodeId");

-- CreateIndex
CREATE INDEX "MarketingReferral_status_idx" ON "MarketingReferral"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingReferral_referrerId_refereeId_key" ON "MarketingReferral"("referrerId", "refereeId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");

-- CreateIndex
CREATE INDEX "MarketingCampaign_campaignType_idx" ON "MarketingCampaign"("campaignType");

-- CreateIndex
CREATE INDEX "MarketingCampaign_startDate_endDate_idx" ON "MarketingCampaign"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserAcquisition_userId_key" ON "UserAcquisition"("userId");

-- CreateIndex
CREATE INDEX "UserAcquisition_acquisitionSource_idx" ON "UserAcquisition"("acquisitionSource");

-- CreateIndex
CREATE INDEX "UserAcquisition_campaignId_idx" ON "UserAcquisition"("campaignId");

-- CreateIndex
CREATE INDEX "UserAcquisition_signupAt_idx" ON "UserAcquisition"("signupAt");

-- CreateIndex
CREATE INDEX "Partnership_partnerType_idx" ON "Partnership"("partnerType");

-- CreateIndex
CREATE INDEX "Partnership_status_idx" ON "Partnership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_email_key" ON "Waitlist"("email");

-- CreateIndex
CREATE INDEX "Waitlist_email_idx" ON "Waitlist"("email");

-- CreateIndex
CREATE INDEX "Waitlist_position_idx" ON "Waitlist"("position");

-- CreateIndex
CREATE INDEX "Waitlist_status_idx" ON "Waitlist"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BetaTester_userId_key" ON "BetaTester"("userId");

-- CreateIndex
CREATE INDEX "BetaTester_cohort_idx" ON "BetaTester"("cohort");

-- CreateIndex
CREATE INDEX "BetaTester_status_idx" ON "BetaTester"("status");

-- CreateIndex
CREATE INDEX "MarketingEvent_startTime_idx" ON "MarketingEvent"("startTime");

-- CreateIndex
CREATE INDEX "MarketingEvent_eventType_idx" ON "MarketingEvent"("eventType");

-- CreateIndex
CREATE INDEX "MarketingEvent_status_idx" ON "MarketingEvent"("status");

-- CreateIndex
CREATE INDEX "MarketingEventRegistration_eventId_idx" ON "MarketingEventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "MarketingEventRegistration_userId_idx" ON "MarketingEventRegistration"("userId");

-- CreateIndex
CREATE INDEX "MarketingEventRegistration_status_idx" ON "MarketingEventRegistration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingEventRegistration_eventId_email_key" ON "MarketingEventRegistration"("eventId", "email");

-- CreateIndex
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");

-- CreateIndex
CREATE INDEX "EmailCampaign_scheduledAt_idx" ON "EmailCampaign"("scheduledAt");

-- AddForeignKey
ALTER TABLE "HousingInquiry" ADD CONSTRAINT "HousingInquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HousingListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousingInquiry" ADD CONSTRAINT "HousingInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsContribution" ADD CONSTRAINT "SavingsContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceApplication" ADD CONSTRAINT "InsuranceApplication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InsuranceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceApplication" ADD CONSTRAINT "InsuranceApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperannuationAccount" ADD CONSTRAINT "SuperannuationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialHealthScore" ADD CONSTRAINT "FinancialHealthScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "CommunitySupportProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMilestone" ADD CONSTRAINT "ProgramMilestone_programId_fkey" FOREIGN KEY ("programId") REFERENCES "CommunitySupportProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneProgress" ADD CONSTRAINT "MilestoneProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneProgress" ADD CONSTRAINT "MilestoneProgress_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProgramMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndigenousCommunityMember" ADD CONSTRAINT "IndigenousCommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "IndigenousCommunityPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndigenousCommunityMember" ADD CONSTRAINT "IndigenousCommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndigenousResource" ADD CONSTRAINT "IndigenousResource_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "IndigenousCommunityPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageProfile" ADD CONSTRAINT "LanguageProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternationalCredential" ADD CONSTRAINT "InternationalCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgingEnrollment" ADD CONSTRAINT "BridgingEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "BridgingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgingEnrollment" ADD CONSTRAINT "BridgingEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyPlan" ADD CONSTRAINT "SafetyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessibilityProfile" ADD CONSTRAINT "AccessibilityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisabilityFriendlyEmployer" ADD CONSTRAINT "DisabilityFriendlyEmployer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactMetric" ADD CONSTRAINT "ImpactMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerPrediction" ADD CONSTRAINT "CareerPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityMatch" ADD CONSTRAINT "OpportunityMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryDataPoint" ADD CONSTRAINT "SalaryDataPoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAnalysis" ADD CONSTRAINT "SalaryAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorMatchScore" ADD CONSTRAINT "MentorMatchScore_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorMatchScore" ADD CONSTRAINT "MentorMatchScore_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrustScore" ADD CONSTRAINT "UserTrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorAnalytics" ADD CONSTRAINT "CreatorAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedPreferences" ADD CONSTRAINT "UserFeedPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingReferral" ADD CONSTRAINT "MarketingReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingReferral" ADD CONSTRAINT "MarketingReferral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingReferral" ADD CONSTRAINT "MarketingReferral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcquisition" ADD CONSTRAINT "UserAcquisition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetaTester" ADD CONSTRAINT "BetaTester_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEventRegistration" ADD CONSTRAINT "MarketingEventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MarketingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEventRegistration" ADD CONSTRAINT "MarketingEventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
