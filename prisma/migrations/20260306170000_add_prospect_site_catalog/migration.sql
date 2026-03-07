-- Phase 39: Prospect site catalog for sitemap discovery coverage and selected URL transparency

CREATE TYPE "SiteCatalogStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "ProspectSiteCatalogRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "SiteCatalogStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "discoveredTotal" INTEGER NOT NULL DEFAULT 0,
    "selectedTotal" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "ProspectSiteCatalogRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectSiteUrl" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "lastmod" TIMESTAMP(3),
    "topSegment" TEXT NOT NULL,
    "pathDepth" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "selectedRank" INTEGER,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "catalogRunId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "ProspectSiteUrl_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectSiteCatalogRun_prospectId_createdAt_idx" ON "ProspectSiteCatalogRun"("prospectId", "createdAt");
CREATE INDEX "ProspectSiteCatalogRun_status_createdAt_idx" ON "ProspectSiteCatalogRun"("status", "createdAt");

CREATE UNIQUE INDEX "ProspectSiteUrl_prospectId_normalizedUrl_key" ON "ProspectSiteUrl"("prospectId", "normalizedUrl");
CREATE INDEX "ProspectSiteUrl_catalogRunId_selectedRank_idx" ON "ProspectSiteUrl"("catalogRunId", "selectedRank");
CREATE INDEX "ProspectSiteUrl_prospectId_isSelected_idx" ON "ProspectSiteUrl"("prospectId", "isSelected");

ALTER TABLE "ProspectSiteCatalogRun" ADD CONSTRAINT "ProspectSiteCatalogRun_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProspectSiteUrl" ADD CONSTRAINT "ProspectSiteUrl_catalogRunId_fkey"
  FOREIGN KEY ("catalogRunId") REFERENCES "ProspectSiteCatalogRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProspectSiteUrl" ADD CONSTRAINT "ProspectSiteUrl_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
