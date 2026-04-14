-- Phase 61.1 POLISH-03 + SC #2: Track master-analyzer failures + model used on Prospect row
ALTER TABLE "Prospect" ADD COLUMN "lastAnalysisError" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "lastAnalysisAttemptedAt" TIMESTAMP(3);
ALTER TABLE "Prospect" ADD COLUMN "lastAnalysisModelUsed" TEXT;
