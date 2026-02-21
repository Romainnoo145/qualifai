-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('NONE', 'QUEUED', 'EMAIL_SENT', 'OPENED', 'REPLIED', 'CONVERTED', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('JOB_CHANGE', 'PROMOTION', 'NEW_JOB_LISTING', 'HEADCOUNT_GROWTH', 'FUNDING_EVENT', 'TECHNOLOGY_ADOPTION', 'INTENT_TOPIC');

-- CreateEnum
CREATE TYPE "OutreachType" AS ENUM ('INTRO_EMAIL', 'WIZARD_LINK', 'PDF_REPORT', 'FOLLOW_UP', 'SIGNAL_TRIGGERED');

-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('WEBSITE', 'DOCS', 'CAREERS', 'HELP_CENTER', 'JOB_BOARD', 'REVIEWS', 'MANUAL_URL');

-- CreateEnum
CREATE TYPE "HypothesisStatus" AS ENUM ('DRAFT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('DRAFTED', 'QUEUED', 'SENT', 'OPENED', 'REPLIED', 'BOOKED', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('WORKFLOW_LOSS_MAP', 'PDF_BRIEF', 'DEMO_SCRIPT', 'EMAIL_COPY', 'CALL_PREP_PLAN');

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "employeeCount" INTEGER,
ADD COLUMN     "foundedYear" INTEGER,
ADD COLUMN     "fundingInfo" JSONB,
ADD COLUMN     "intentTopics" JSONB,
ADD COLUMN     "lastEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "lushaCompanyId" TEXT,
ADD COLUMN     "naicsCode" TEXT,
ADD COLUMN     "revenueEstimate" TEXT,
ADD COLUMN     "sicCode" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "seniority" TEXT,
    "department" TEXT,
    "emails" JSONB,
    "phones" JSONB,
    "primaryEmail" TEXT,
    "primaryPhone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "lushaPersonId" TEXT,
    "linkedinUrl" TEXT,
    "socialProfiles" JSONB,
    "lushaRawData" JSONB,
    "outreachStatus" "OutreachStatus" NOT NULL DEFAULT 'NONE',
    "lastContactedAt" TIMESTAMP(3),
    "outreachNotes" TEXT,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalType" "SignalType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "prospectId" TEXT,
    "contactId" TEXT,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT NOT NULL,
    "type" "OutreachType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "OutreachLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditUsage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpoint" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 1,
    "prospectId" TEXT,
    "contactId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "CreditUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nicheKey" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "tone" TEXT,
    "strictGate" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignProspect" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "CampaignProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ResearchStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "workerId" TEXT,
    "inputSnapshot" JSONB,
    "summary" JSONB,
    "prospectId" TEXT NOT NULL,
    "campaignId" TEXT,

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT NOT NULL,
    "workflowTag" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "researchRunId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowHypothesis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "assumptions" JSONB,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "evidenceRefs" JSONB,
    "validationQuestions" JSONB,
    "hoursSavedWeekLow" INTEGER,
    "hoursSavedWeekMid" INTEGER,
    "hoursSavedWeekHigh" INTEGER,
    "handoffSpeedGainPct" DOUBLE PRECISION,
    "errorReductionPct" DOUBLE PRECISION,
    "revenueLeakageRecoveredLow" DOUBLE PRECISION,
    "revenueLeakageRecoveredMid" DOUBLE PRECISION,
    "revenueLeakageRecoveredHigh" DOUBLE PRECISION,
    "status" "HypothesisStatus" NOT NULL DEFAULT 'DRAFT',
    "researchRunId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "WorkflowHypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationOpportunity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assumptions" JSONB,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "evidenceRefs" JSONB,
    "hoursSavedWeekLow" INTEGER,
    "hoursSavedWeekMid" INTEGER,
    "hoursSavedWeekHigh" INTEGER,
    "handoffSpeedGainPct" DOUBLE PRECISION,
    "errorReductionPct" DOUBLE PRECISION,
    "revenueLeakageRecoveredLow" DOUBLE PRECISION,
    "revenueLeakageRecoveredMid" DOUBLE PRECISION,
    "revenueLeakageRecoveredHigh" DOUBLE PRECISION,
    "status" "HypothesisStatus" NOT NULL DEFAULT 'DRAFT',
    "researchRunId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "AutomationOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofMatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL,
    "proofId" TEXT,
    "proofTitle" TEXT NOT NULL,
    "proofSummary" TEXT,
    "proofUrl" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "isRealShipped" BOOLEAN NOT NULL DEFAULT true,
    "isCustomPlan" BOOLEAN NOT NULL DEFAULT false,
    "prospectId" TEXT NOT NULL,
    "workflowHypothesisId" TEXT,
    "automationOpportunityId" TEXT,
    "evidenceItemId" TEXT,

    CONSTRAINT "ProofMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowLossMap" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'WORKFLOW_LOSS_MAP',
    "version" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "title" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "html" TEXT,
    "pdfUrl" TEXT,
    "metrics" JSONB,
    "emailSubject" TEXT,
    "emailBodyText" TEXT,
    "emailBodyHtml" TEXT,
    "demoScript" TEXT,
    "ctaStep1" TEXT NOT NULL,
    "ctaStep2" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "researchRunId" TEXT NOT NULL,
    "campaignId" TEXT,

    CONSTRAINT "WorkflowLossMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSequence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFTED',
    "isEvidenceBacked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "prospectId" TEXT NOT NULL,
    "contactId" TEXT,
    "campaignId" TEXT,
    "researchRunId" TEXT,
    "workflowLossMapId" TEXT,

    CONSTRAINT "OutreachSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachStep" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "plannedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFTED',
    "metadata" JSONB,
    "sequenceId" TEXT NOT NULL,
    "outreachLogId" TEXT,

    CONSTRAINT "OutreachStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallPrepPlan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'CALL_PREP_PLAN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "summary" TEXT NOT NULL,
    "plan30" JSONB NOT NULL,
    "plan60" JSONB NOT NULL,
    "plan90" JSONB NOT NULL,
    "stakeholderMap" JSONB,
    "discoveryQuestions" JSONB,
    "riskList" JSONB,
    "demoFlow" JSONB,
    "prospectId" TEXT NOT NULL,
    "campaignId" TEXT,
    "researchRunId" TEXT NOT NULL,
    "workflowLossMapId" TEXT,

    CONSTRAINT "CallPrepPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_lushaPersonId_key" ON "Contact"("lushaPersonId");

-- CreateIndex
CREATE INDEX "Contact_prospectId_idx" ON "Contact"("prospectId");

-- CreateIndex
CREATE INDEX "Contact_outreachStatus_idx" ON "Contact"("outreachStatus");

-- CreateIndex
CREATE INDEX "Contact_seniority_idx" ON "Contact"("seniority");

-- CreateIndex
CREATE INDEX "Signal_signalType_idx" ON "Signal"("signalType");

-- CreateIndex
CREATE INDEX "Signal_isProcessed_idx" ON "Signal"("isProcessed");

-- CreateIndex
CREATE INDEX "Signal_prospectId_idx" ON "Signal"("prospectId");

-- CreateIndex
CREATE INDEX "Signal_contactId_idx" ON "Signal"("contactId");

-- CreateIndex
CREATE INDEX "OutreachLog_contactId_idx" ON "OutreachLog"("contactId");

-- CreateIndex
CREATE INDEX "OutreachLog_type_idx" ON "OutreachLog"("type");

-- CreateIndex
CREATE INDEX "OutreachLog_status_idx" ON "OutreachLog"("status");

-- CreateIndex
CREATE INDEX "CreditUsage_endpoint_idx" ON "CreditUsage"("endpoint");

-- CreateIndex
CREATE INDEX "CreditUsage_createdAt_idx" ON "CreditUsage"("createdAt");

-- CreateIndex
CREATE INDEX "SavedSearch_type_idx" ON "SavedSearch"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "Campaign"("isActive");

-- CreateIndex
CREATE INDEX "CampaignProspect_campaignId_idx" ON "CampaignProspect"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignProspect_prospectId_idx" ON "CampaignProspect"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignProspect_campaignId_prospectId_key" ON "CampaignProspect"("campaignId", "prospectId");

-- CreateIndex
CREATE INDEX "ResearchRun_prospectId_idx" ON "ResearchRun"("prospectId");

-- CreateIndex
CREATE INDEX "ResearchRun_campaignId_idx" ON "ResearchRun"("campaignId");

-- CreateIndex
CREATE INDEX "ResearchRun_status_createdAt_idx" ON "ResearchRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceItem_researchRunId_idx" ON "EvidenceItem"("researchRunId");

-- CreateIndex
CREATE INDEX "EvidenceItem_prospectId_createdAt_idx" ON "EvidenceItem"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceItem_workflowTag_idx" ON "EvidenceItem"("workflowTag");

-- CreateIndex
CREATE INDEX "WorkflowHypothesis_researchRunId_idx" ON "WorkflowHypothesis"("researchRunId");

-- CreateIndex
CREATE INDEX "WorkflowHypothesis_prospectId_status_idx" ON "WorkflowHypothesis"("prospectId", "status");

-- CreateIndex
CREATE INDEX "AutomationOpportunity_researchRunId_idx" ON "AutomationOpportunity"("researchRunId");

-- CreateIndex
CREATE INDEX "AutomationOpportunity_prospectId_status_idx" ON "AutomationOpportunity"("prospectId", "status");

-- CreateIndex
CREATE INDEX "ProofMatch_prospectId_idx" ON "ProofMatch"("prospectId");

-- CreateIndex
CREATE INDEX "ProofMatch_workflowHypothesisId_idx" ON "ProofMatch"("workflowHypothesisId");

-- CreateIndex
CREATE INDEX "ProofMatch_automationOpportunityId_idx" ON "ProofMatch"("automationOpportunityId");

-- CreateIndex
CREATE INDEX "ProofMatch_evidenceItemId_idx" ON "ProofMatch"("evidenceItemId");

-- CreateIndex
CREATE INDEX "WorkflowLossMap_prospectId_createdAt_idx" ON "WorkflowLossMap"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowLossMap_researchRunId_idx" ON "WorkflowLossMap"("researchRunId");

-- CreateIndex
CREATE INDEX "OutreachSequence_prospectId_status_idx" ON "OutreachSequence"("prospectId", "status");

-- CreateIndex
CREATE INDEX "OutreachSequence_contactId_idx" ON "OutreachSequence"("contactId");

-- CreateIndex
CREATE INDEX "OutreachSequence_campaignId_idx" ON "OutreachSequence"("campaignId");

-- CreateIndex
CREATE INDEX "OutreachStep_outreachLogId_idx" ON "OutreachStep"("outreachLogId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachStep_sequenceId_stepOrder_key" ON "OutreachStep"("sequenceId", "stepOrder");

-- CreateIndex
CREATE INDEX "CallPrepPlan_prospectId_createdAt_idx" ON "CallPrepPlan"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "CallPrepPlan_researchRunId_idx" ON "CallPrepPlan"("researchRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_lushaCompanyId_key" ON "Prospect"("lushaCompanyId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignProspect" ADD CONSTRAINT "CampaignProspect_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignProspect" ADD CONSTRAINT "CampaignProspect_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowHypothesis" ADD CONSTRAINT "WorkflowHypothesis_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowHypothesis" ADD CONSTRAINT "WorkflowHypothesis_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationOpportunity" ADD CONSTRAINT "AutomationOpportunity_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationOpportunity" ADD CONSTRAINT "AutomationOpportunity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofMatch" ADD CONSTRAINT "ProofMatch_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofMatch" ADD CONSTRAINT "ProofMatch_workflowHypothesisId_fkey" FOREIGN KEY ("workflowHypothesisId") REFERENCES "WorkflowHypothesis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofMatch" ADD CONSTRAINT "ProofMatch_automationOpportunityId_fkey" FOREIGN KEY ("automationOpportunityId") REFERENCES "AutomationOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofMatch" ADD CONSTRAINT "ProofMatch_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowLossMap" ADD CONSTRAINT "WorkflowLossMap_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowLossMap" ADD CONSTRAINT "WorkflowLossMap_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowLossMap" ADD CONSTRAINT "WorkflowLossMap_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSequence" ADD CONSTRAINT "OutreachSequence_workflowLossMapId_fkey" FOREIGN KEY ("workflowLossMapId") REFERENCES "WorkflowLossMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachStep" ADD CONSTRAINT "OutreachStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachStep" ADD CONSTRAINT "OutreachStep_outreachLogId_fkey" FOREIGN KEY ("outreachLogId") REFERENCES "OutreachLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallPrepPlan" ADD CONSTRAINT "CallPrepPlan_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallPrepPlan" ADD CONSTRAINT "CallPrepPlan_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallPrepPlan" ADD CONSTRAINT "CallPrepPlan_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallPrepPlan" ADD CONSTRAINT "CallPrepPlan_workflowLossMapId_fkey" FOREIGN KEY ("workflowLossMapId") REFERENCES "WorkflowLossMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
