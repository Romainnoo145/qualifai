-- Phase 43: AI Master Analysis — ProspectAnalysis model

CREATE TABLE IF NOT EXISTS "ProspectAnalysis" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" TEXT NOT NULL DEFAULT 'analysis-v1',
  "content" JSONB NOT NULL,
  "modelUsed" TEXT,
  "inputSnapshot" JSONB,
  "researchRunId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  CONSTRAINT "ProspectAnalysis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProspectAnalysis_researchRunId_key" UNIQUE ("researchRunId"),
  CONSTRAINT "ProspectAnalysis_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProspectAnalysis_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProspectAnalysis_prospectId_idx" ON "ProspectAnalysis"("prospectId");
CREATE INDEX IF NOT EXISTS "ProspectAnalysis_researchRunId_idx" ON "ProspectAnalysis"("researchRunId");
