-- Add content hash for deduplication
ALTER TABLE "EvidenceItem" ADD COLUMN "content_hash" TEXT;

-- Unique constraint: same content allowed across sourceTypes, not within
CREATE UNIQUE INDEX "EvidenceItem_prospectId_sourceType_contentHash_key"
  ON "EvidenceItem"("prospectId", "sourceType", "content_hash")
  WHERE "content_hash" IS NOT NULL;
