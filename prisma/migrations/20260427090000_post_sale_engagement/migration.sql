CREATE TYPE "EngagementStatus" AS ENUM ('ACTIVE', 'DELIVERED', 'ARCHIVED');

CREATE TABLE "Engagement" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "quoteId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "kickoffBookedAt" TIMESTAMP(3),
  "kickoffReminderCount" INTEGER NOT NULL DEFAULT 0,
  "kickoffReminderLastAt" TIMESTAMP(3),
  "status" "EngagementStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Engagement_quoteId_key" UNIQUE ("quoteId"),
  CONSTRAINT "Engagement_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Engagement_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Engagement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Engagement_prospectId_idx" ON "Engagement"("prospectId");
CREATE INDEX "Engagement_projectId_idx" ON "Engagement"("projectId");

CREATE TABLE "EngagementMilestone" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "ordering" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "EngagementMilestone_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EngagementMilestone_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EngagementMilestone_engagementId_idx" ON "EngagementMilestone"("engagementId");
CREATE INDEX "EngagementMilestone_engagementId_ordering_idx" ON "EngagementMilestone"("engagementId", "ordering");
