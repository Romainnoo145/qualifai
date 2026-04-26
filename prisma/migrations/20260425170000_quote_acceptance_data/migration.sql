-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "signatureData" TEXT,
                    ADD COLUMN     "acceptedAt" TIMESTAMPTZ;
