-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('DRAFT', 'ENRICHED', 'GENERATING', 'READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slug" VARCHAR(12) NOT NULL,
    "companyName" TEXT,
    "domain" TEXT NOT NULL,
    "industry" TEXT,
    "subIndustry" TEXT,
    "employeeRange" TEXT,
    "revenueRange" TEXT,
    "technologies" TEXT[],
    "specialties" TEXT[],
    "country" TEXT,
    "city" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "lushaRawData" JSONB,
    "heroContent" JSONB,
    "dataOpportunities" JSONB,
    "automationAgents" JSONB,
    "successStories" JSONB,
    "aiRoadmap" JSONB,
    "status" "ProspectStatus" NOT NULL DEFAULT 'DRAFT',
    "internalNotes" TEXT,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WizardSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prospectId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "maxStepReached" INTEGER NOT NULL DEFAULT 0,
    "stepTimes" JSONB,
    "pdfDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "pdfDownloadedAt" TIMESTAMP(3),
    "callBooked" BOOLEAN NOT NULL DEFAULT false,
    "callBookedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "WizardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "industry" TEXT NOT NULL,
    "subIndustry" TEXT,
    "displayName" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "colorAccent" TEXT NOT NULL,
    "dataOpportunityPrompts" JSONB NOT NULL,
    "automationPrompts" JSONB NOT NULL,
    "successStoryTemplates" JSONB NOT NULL,
    "roadmapTemplates" JSONB NOT NULL,

    CONSTRAINT "IndustryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prospectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_slug_key" ON "Prospect"("slug");

-- CreateIndex
CREATE INDEX "Prospect_domain_idx" ON "Prospect"("domain");

-- CreateIndex
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX "WizardSession_prospectId_idx" ON "WizardSession"("prospectId");

-- CreateIndex
CREATE INDEX "IndustryTemplate_industry_idx" ON "IndustryTemplate"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryTemplate_industry_subIndustry_key" ON "IndustryTemplate"("industry", "subIndustry");

-- CreateIndex
CREATE INDEX "NotificationLog_prospectId_idx" ON "NotificationLog"("prospectId");

-- CreateIndex
CREATE INDEX "NotificationLog_type_idx" ON "NotificationLog"("type");

-- AddForeignKey
ALTER TABLE "WizardSession" ADD CONSTRAINT "WizardSession_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
