-- Phase 30: Pain Confirmation Gate + Override Audit
-- Create GateOverrideAudit table for permanent, queryable audit trail of gate bypasses

CREATE TABLE "GateOverrideAudit" (
  "id"            TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gateType"      TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "actor"         TEXT NOT NULL DEFAULT 'admin',
  "gateSnapshot"  JSONB NOT NULL,
  "researchRunId" TEXT NOT NULL,
  "prospectId"    TEXT NOT NULL,

  CONSTRAINT "GateOverrideAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GateOverrideAudit_researchRunId_idx" ON "GateOverrideAudit"("researchRunId");
CREATE INDEX "GateOverrideAudit_prospectId_idx"    ON "GateOverrideAudit"("prospectId");
CREATE INDEX "GateOverrideAudit_createdAt_idx"     ON "GateOverrideAudit"("createdAt");

ALTER TABLE "GateOverrideAudit"
  ADD CONSTRAINT "GateOverrideAudit_researchRunId_fkey"
  FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GateOverrideAudit"
  ADD CONSTRAINT "GateOverrideAudit_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
