-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "readableSlug" VARCHAR(80);

-- AlterTable
ALTER TABLE "WizardSession" ADD COLUMN "quoteRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WizardSession" ADD COLUMN "quoteRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_readableSlug_key" ON "Prospect"("readableSlug");

-- CreateIndex
CREATE INDEX "Prospect_readableSlug_idx" ON "Prospect"("readableSlug");
