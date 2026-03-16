-- Add prospectId denormalization to OutreachLog for direct prospect-to-draft queries
ALTER TABLE "OutreachLog" ADD COLUMN "prospectId" TEXT;
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OutreachLog_prospectId_idx" ON "OutreachLog"("prospectId");
