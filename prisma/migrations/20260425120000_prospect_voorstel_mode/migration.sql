-- CreateEnum
CREATE TYPE "VoorstelMode" AS ENUM ('STANDARD', 'BESPOKE');

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "voorstelMode" "VoorstelMode" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "bespokeUrl" VARCHAR(500);
