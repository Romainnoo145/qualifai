-- Fase B: active proposal flag per prospect
ALTER TABLE "Quote" ADD COLUMN "isActiveProposal" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Quote_prospectId_isActiveProposal_idx" ON "Quote" ("prospectId", "isActiveProposal");
