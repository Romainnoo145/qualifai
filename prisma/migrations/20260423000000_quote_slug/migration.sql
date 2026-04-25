-- Add human-readable slug to Quote (companyName-nummer, e.g. marfa-2026-off001)
ALTER TABLE "Quote" ADD COLUMN "slug" VARCHAR(100);
CREATE UNIQUE INDEX "Quote_slug_key" ON "Quote"("slug");

-- Backfill existing rows
UPDATE "Quote" q
SET slug = CONCAT(
  LOWER(REGEXP_REPLACE(COALESCE(p."companyName", SPLIT_PART(p.domain, '.', 1)), '[^a-zA-Z0-9]+', '-', 'g')),
  '-',
  LOWER(q.nummer)
)
FROM "Prospect" p
WHERE q."prospectId" = p.id AND q.slug IS NULL;
