-- AddColumn
ALTER TABLE "OutreachLog" ADD COLUMN "quoteId" TEXT;

-- AddForeignKey
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL;

-- AddIndex
CREATE INDEX "OutreachLog_quoteId_idx" ON "OutreachLog"("quoteId");

-- AddEnumValue (OutreachType)
ALTER TYPE "OutreachType" ADD VALUE 'QUOTE_DELIVERY';
