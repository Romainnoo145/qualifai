-- Phase 60-02: Quote Schema Foundation
-- Adds Quote + QuoteLine models, QuoteStatus + SnapshotStatus enums,
-- and extends ProspectStatus with QUOTE_SENT.
--
-- Locked decisions (klarifai-core/docs/strategy/decisions.md):
--   Q5  — SnapshotStatus enum: PENDING | RENDERING | READY | FAILED
--   Q9  — Quote.replacesId self-FK added now (avoids second migration in Phase 61)
--   Q12 — Snapshot fields: snapshotAt + templateVersion (no counter)
--   Q13 — QuoteStatus has 7 values; ProspectStatus gets one new value QUOTE_SENT

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PENDING', 'RENDERING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "ProspectStatus" ADD VALUE 'QUOTE_SENT' BEFORE 'CONVERTED';

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nummer" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "geldigTot" TIMESTAMP(3) NOT NULL,
    "onderwerp" TEXT NOT NULL,
    "tagline" TEXT,
    "introductie" TEXT,
    "uitdaging" TEXT,
    "aanpak" TEXT,
    "btwPercentage" INTEGER NOT NULL,
    "scope" TEXT,
    "buitenScope" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshotAt" TIMESTAMP(3),
    "templateVersion" TEXT,
    "snapshotHtml" TEXT,
    "snapshotData" JSONB,
    "snapshotPdfUrl" TEXT,
    "snapshotStatus" "SnapshotStatus",
    "replacesId" TEXT,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fase" TEXT NOT NULL,
    "omschrijving" TEXT,
    "oplevering" TEXT,
    "uren" INTEGER NOT NULL,
    "tarief" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "quoteId" TEXT NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_nummer_key" ON "Quote"("nummer");

-- CreateIndex
CREATE INDEX "Quote_prospectId_idx" ON "Quote"("prospectId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_nummer_idx" ON "Quote"("nummer");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
