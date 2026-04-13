/**
 * FOUND-03 / FOUND-04 — Zod schema + type-safe accessors for Quote.snapshotData.
 *
 * The snapshot is frozen at SENT time inside lib/state-machines/quote.ts
 * (Plan 04) and validated against this schema before being written to Prisma.
 *
 * Both the web proposal page (Phase 62) and the PDF worker (Phase 62) read
 * snapshotData via parseSnapshot/getSnapshotField — never via `as any`.
 *
 * IMPORTANT (Pitfall 5): line item `tarief` allows SIGNED integers because
 * klarifai-core OFF003 has a `Pakketkorting` line with `tarief: -800`.
 * Do NOT add `.nonnegative()` to tarief.
 */
import { z } from 'zod';

export const QuoteSnapshotLineSchema = z.object({
  fase: z.string(),
  omschrijving: z.string(),
  oplevering: z.string(),
  uren: z.number().int().nonnegative(),
  tarief: z.number().int(), // SIGNED — negative allowed for discount lines
});

export const QuoteSnapshotSchema = z.object({
  // metadata
  templateVersion: z.string(),
  capturedAt: z.string(), // ISO datetime string

  // narrative content
  tagline: z.string(),
  introductie: z.string(),
  uitdaging: z.string(),
  aanpak: z.string(),

  // quote header
  nummer: z.string(),
  onderwerp: z.string(),
  datum: z.string(),
  geldigTot: z.string(),

  // line items
  lines: z.array(QuoteSnapshotLineSchema),

  // commercial
  btwPercentage: z.number(),
  scope: z.string(),
  buitenScope: z.string(),

  // computed totals (frozen at snapshot time)
  totals: z.object({
    netto: z.number(),
    btw: z.number(),
    bruto: z.number(),
  }),

  // prospect snapshot (denormalised so it survives prospect edits)
  prospect: z.object({
    slug: z.string(),
    companyName: z.string().nullable(),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
  }),
});

export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;
export type QuoteSnapshotLine = z.infer<typeof QuoteSnapshotLineSchema>;

/**
 * FOUND-04 — Type-safe parser. Returns null on failure or null/undefined input.
 * Use this instead of `as any` casts on Quote.snapshotData.
 */
export function parseSnapshot(raw: unknown): QuoteSnapshot | null {
  if (raw === null || raw === undefined) return null;
  const result = QuoteSnapshotSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * FOUND-04 — Read a single field with a typed default.
 * If the snapshot fails to parse OR the field is undefined, returns `fallback`.
 */
export function getSnapshotField<K extends keyof QuoteSnapshot>(
  raw: unknown,
  key: K,
  fallback: QuoteSnapshot[K],
): QuoteSnapshot[K] {
  const parsed = parseSnapshot(raw);
  return parsed?.[key] ?? fallback;
}
