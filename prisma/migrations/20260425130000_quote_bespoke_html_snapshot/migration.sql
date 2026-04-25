-- AddColumn
-- Bespoke voorstel HTML frozen at SENT for BESPOKE prospects (immune to bespokeUrl drift post-akkoord)
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "bespokeHtmlSnapshot" TEXT;
