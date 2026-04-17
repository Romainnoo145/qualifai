-- Offerte lifecycle: meeting notes, AI generation timestamp, view tracking
ALTER TABLE "Quote" ADD COLUMN "meetingNotes" TEXT;
ALTER TABLE "Quote" ADD COLUMN "narrativeGeneratedAt" TIMESTAMPTZ;
ALTER TABLE "Quote" ADD COLUMN "viewedAt" TIMESTAMPTZ;
