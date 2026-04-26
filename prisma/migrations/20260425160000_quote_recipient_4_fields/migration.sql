-- AlterTable: replace single recipientAddress text field with 4 structured fields
ALTER TABLE "Quote" DROP COLUMN IF EXISTS "recipientAddress";
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "recipientCompany" VARCHAR(120);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "recipientContact" VARCHAR(120);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "recipientStreet"  VARCHAR(120);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "recipientCity"    VARCHAR(120);
