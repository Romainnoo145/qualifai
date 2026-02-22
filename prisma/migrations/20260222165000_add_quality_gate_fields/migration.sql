-- Phase 18: Research Quality Gate — schema foundation
-- Add PENDING and DECLINED to HypothesisStatus enum
-- Add quality review fields to ResearchRun

ALTER TYPE "HypothesisStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "HypothesisStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

ALTER TABLE "ResearchRun" ADD COLUMN IF NOT EXISTS "qualityApproved" BOOLEAN;
ALTER TABLE "ResearchRun" ADD COLUMN IF NOT EXISTS "qualityReviewedAt" TIMESTAMP(3);
ALTER TABLE "ResearchRun" ADD COLUMN IF NOT EXISTS "qualityNotes" TEXT;
