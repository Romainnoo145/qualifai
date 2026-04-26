-- AlterTable
ALTER TABLE "Quote"
  ADD COLUMN "signerName" VARCHAR(120),
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
