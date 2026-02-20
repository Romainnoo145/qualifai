-- AlterTable
ALTER TABLE "OutreachStep" ADD COLUMN     "nextStepReadyAt" TIMESTAMP(3),
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "triggeredBy" TEXT;

-- CreateIndex
CREATE INDEX "OutreachStep_nextStepReadyAt_idx" ON "OutreachStep"("nextStepReadyAt");
