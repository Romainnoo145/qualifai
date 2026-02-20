-- AlterTable
ALTER TABLE "ProofMatch" ADD COLUMN     "useCaseId" TEXT;

-- CreateTable
CREATE TABLE "UseCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "outcomes" TEXT[],
    "tags" TEXT[],
    "caseStudyRefs" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isShipped" BOOLEAN NOT NULL DEFAULT true,
    "sourceRef" TEXT,
    "externalUrl" TEXT,

    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UseCase_isActive_isShipped_idx" ON "UseCase"("isActive", "isShipped");

-- CreateIndex
CREATE INDEX "UseCase_category_idx" ON "UseCase"("category");

-- CreateIndex
CREATE INDEX "ProofMatch_useCaseId_idx" ON "ProofMatch"("useCaseId");

-- AddForeignKey
ALTER TABLE "ProofMatch" ADD CONSTRAINT "ProofMatch_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
