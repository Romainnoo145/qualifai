-- v4 Phase 36 foundation: project + SPV scoping with legacy backfill

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('KLARIFAI', 'ATLANTIS');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectType" "ProjectType" NOT NULL,
    "brandName" TEXT,
    "bookingUrl" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SPV" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "metricsTemplate" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SPV_pkey" PRIMARY KEY ("id")
);

-- Seed baseline projects for backfill and first-use scope
INSERT INTO "Project" ("id", "updatedAt", "slug", "name", "projectType", "brandName", "bookingUrl", "metadata")
VALUES
    ('project_klarifai', NOW(), 'klarifai', 'Klarifai', 'KLARIFAI', 'Klarifai', NULL, NULL),
    ('project_europes_gate', NOW(), 'europes-gate', 'Atlantis', 'ATLANTIS', 'Atlantis', NULL, '{"partnerLabel":"Europe''s Gate"}'::jsonb);

-- AlterTable (nullable first, then backfill, then required)
ALTER TABLE "Campaign" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "projectId" TEXT,
ADD COLUMN "spvId" TEXT;
ALTER TABLE "UseCase" ADD COLUMN "projectId" TEXT;

-- Backfill all existing legacy records into Klarifai scope
UPDATE "Campaign" SET "projectId" = 'project_klarifai' WHERE "projectId" IS NULL;
UPDATE "Prospect" SET "projectId" = 'project_klarifai' WHERE "projectId" IS NULL;
UPDATE "UseCase" SET "projectId" = 'project_klarifai' WHERE "projectId" IS NULL;

-- Enforce required project ownership
ALTER TABLE "Campaign" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "Prospect" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "UseCase" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "projectId" SET DEFAULT 'project_klarifai';
ALTER TABLE "Prospect" ALTER COLUMN "projectId" SET DEFAULT 'project_klarifai';
ALTER TABLE "UseCase" ALTER COLUMN "projectId" SET DEFAULT 'project_klarifai';

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE INDEX "Project_projectType_idx" ON "Project"("projectType");
CREATE UNIQUE INDEX "SPV_slug_key" ON "SPV"("slug");
CREATE UNIQUE INDEX "SPV_code_key" ON "SPV"("code");
CREATE INDEX "SPV_projectId_isActive_idx" ON "SPV"("projectId", "isActive");
CREATE INDEX "Campaign_projectId_updatedAt_idx" ON "Campaign"("projectId", "updatedAt");
CREATE INDEX "Prospect_projectId_createdAt_idx" ON "Prospect"("projectId", "createdAt");
CREATE INDEX "Prospect_spvId_idx" ON "Prospect"("spvId");
CREATE INDEX "UseCase_projectId_updatedAt_idx" ON "UseCase"("projectId", "updatedAt");
CREATE INDEX "UseCase_projectId_sourceRef_idx" ON "UseCase"("projectId", "sourceRef");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_spvId_fkey" FOREIGN KEY ("spvId") REFERENCES "SPV"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UseCase" ADD CONSTRAINT "UseCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SPV" ADD CONSTRAINT "SPV_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
