/**
 * IMPORT-01..04 — One-shot migration script for klarifai-core YAML data.
 *
 * Imports:
 *   1. klarifai-core/data/clients/*.yaml  -> Qualifai Prospect (idempotent on readableSlug)
 *   2. klarifai-core/data/quotes/{year}/*.yaml -> Qualifai Quote + QuoteLine (idempotent on nummer)
 *
 * Usage:
 *   tsx scripts/import-klarifai-yaml.ts                 # DRY (default) — logs intended writes
 *   tsx scripts/import-klarifai-yaml.ts --apply         # performs real DB writes
 *   tsx scripts/import-klarifai-yaml.ts --source <dir>  # override default source dir
 *
 * The script MUST be run with the singleton Prisma client (lib/prisma.ts).
 * Do NOT instantiate a fresh PrismaClient directly — Prisma 7 adapter quirk.
 *
 * Contact import is deferred to Phase 61 admin UI (research recommendation #6).
 */
import 'dotenv/config';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';

/**
 * The klarifai-core YAML files are framed with `---` at the top AND bottom,
 * which the `yaml` parser treats as a multi-document stream with a trailing
 * empty document. Use `parseAllDocuments` and return the first non-empty
 * document's JS value — that is the only real payload in every fixture.
 */
function parseYaml(source: string): unknown {
  const docs = parseAllDocuments(source);
  for (const doc of docs) {
    const value = doc.toJS();
    if (value !== null && value !== undefined) return value;
  }
  return null;
}
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Path resolution — works under both CJS (tsx) and ESM (vitest)
// ---------------------------------------------------------------------------

// Resolve this file's directory in an ESM-safe way so the script runs
// identically under `tsx` (CJS) and under Vitest (ESM/Vite transform).
const HERE =
  typeof __dirname !== 'undefined'
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

// Default search order for klarifai-core/data — accommodates two common
// layouts: (a) siblings under one parent, or (b) qualifai nested one level
// deeper (projects/qualifai, with klarifai-core one level up).
//   /parent/qualifai + /parent/klarifai-core
//   /parent/projects/qualifai + /parent/klarifai-core
const DEFAULT_SOURCE_CANDIDATES = [
  resolve(HERE, '../../klarifai-core/data'),
  resolve(HERE, '../../../klarifai-core/data'),
];

export const DEFAULT_SOURCE_DIR: string =
  DEFAULT_SOURCE_CANDIDATES.find((p) => existsSync(p)) ??
  DEFAULT_SOURCE_CANDIDATES[0]!;

// ---------------------------------------------------------------------------
// YAML schemas — match real klarifai-core fixture shapes
// ---------------------------------------------------------------------------

export const ClientYamlSchema = z.object({
  naam: z.string(),
  slug: z.string(), // human slug like "marfa" — maps to Prospect.readableSlug
  contactpersoon: z.string().optional(),
  email: z.string().email().optional(),
  adres: z
    .object({
      straat: z.string().optional(),
      postcode: z.string().optional(),
      stad: z.string().optional(),
    })
    .optional(),
  standaard_tarief: z.number().optional(),
  betaaltermijn_dagen: z.number().optional(),
});
export type ClientYaml = z.infer<typeof ClientYamlSchema>;

// Line item schema — tarief is SIGNED int (negative allowed for OFF003
// Pakketkorting line carrying -800). Do NOT constrain tarief to >= 0 — Pitfall 5.
export const QuoteLineYamlSchema = z.object({
  fase: z.string(),
  omschrijving: z.string(),
  oplevering: z.string(),
  uren: z.number().int().nonnegative(),
  tarief: z.number().int(), // SIGNED — negative allowed for discount lines
});
export type QuoteLineYaml = z.infer<typeof QuoteLineYamlSchema>;

export const QuoteYamlSchema = z.object({
  nummer: z.string(),
  datum: z.string(), // ISO date
  geldig_tot: z.string(),
  klant: z.string(), // matches ClientYaml.slug -> Prospect.readableSlug
  status: z.string().default('concept'),
  onderwerp: z.string(),
  tagline: z.string().optional().default(''),
  introductie: z.string().optional().default(''),
  uitdaging: z.string().optional().default(''),
  aanpak: z.string().optional().default(''),
  regels: z.array(QuoteLineYamlSchema),
  btw_percentage: z.number(),
  scope: z.string().optional().default(''),
  buiten_scope: z.string().optional().default(''),
});
export type QuoteYaml = z.infer<typeof QuoteYamlSchema>;

// ---------------------------------------------------------------------------
// Totals helpers — exported so the test file can re-use them
// ---------------------------------------------------------------------------

export function computeNetto(regels: QuoteYaml['regels']): number {
  return regels.reduce((sum, r) => sum + r.uren * r.tarief, 0);
}

export function computeBruto(netto: number, btwPercentage: number): number {
  return Math.round(netto * (1 + btwPercentage / 100) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Run options + result types
// ---------------------------------------------------------------------------

export interface RunImportOptions {
  apply: boolean;
  source?: string;
  sourceDir?: string; // accepted alias used in tests
  projectSlug?: string;
}

interface UpsertResult {
  action: 'created' | 'updated' | 'skipped' | 'warned';
  id?: string;
}

// ---------------------------------------------------------------------------
// Logging helper — takes `apply` as an explicit parameter
// ---------------------------------------------------------------------------

function log(
  apply: boolean,
  action: 'create' | 'update' | 'skip' | 'warn' | 'info',
  kind: string,
  label: string,
  detail = '',
): void {
  const tag = apply ? '[APPLY]' : '[DRY]  ';
  console.log(
    `${tag} ${action.toUpperCase().padEnd(6)} ${kind.padEnd(10)} ${label}${detail ? ' ' + detail : ''}`,
  );
}

// ---------------------------------------------------------------------------
// Entry point — exported so tests can call it directly
// ---------------------------------------------------------------------------

export async function runImport(opts: RunImportOptions): Promise<void> {
  const apply = opts.apply;
  const sourceDir = resolve(
    opts.source ?? opts.sourceDir ?? DEFAULT_SOURCE_DIR,
  );
  const projectSlug =
    opts.projectSlug ?? process.env.IMPORT_PROJECT_SLUG ?? 'klarifai';

  console.log('---');
  console.log(
    `[import-klarifai-yaml] mode=${apply ? 'APPLY' : 'DRY'} source=${sourceDir}`,
  );
  console.log(`[import-klarifai-yaml] project=${projectSlug}`);
  console.log('---');

  if (!existsSync(sourceDir)) {
    throw new Error(
      `Source directory does not exist: ${sourceDir}. Pass --source <path> to override.`,
    );
  }

  // Resolve the active Project (multi-tenant scope target)
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
  });
  if (!project) {
    throw new Error(
      `Project not found in DB: slug=${projectSlug}. Seed it first.`,
    );
  }
  log(apply, 'info', 'project', project.slug, `id=${project.id}`);

  // Track client slugs we have seen this run so that --dry mode can still
  // resolve quote.klant -> prospect without having created a real DB row.
  const pendingClientSlugs = new Set<string>();

  // -------------------------------------------------------------------------
  // 1. Clients -> Prospects
  // -------------------------------------------------------------------------
  const clientsDir = join(sourceDir, 'clients');
  let clientsProcessed = 0;
  if (!existsSync(clientsDir)) {
    log(apply, 'warn', 'clients', '(dir missing)', clientsDir);
  } else {
    const clientFiles = readdirSync(clientsDir).filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
    );
    for (const file of clientFiles) {
      const raw = parseYaml(readFileSync(join(clientsDir, file), 'utf8'));
      const parsed = ClientYamlSchema.safeParse(raw);
      if (!parsed.success) {
        log(
          apply,
          'warn',
          'client',
          file,
          `parse error: ${parsed.error.issues.map((i) => i.path.join('.')).join(',')}`,
        );
        continue;
      }
      await upsertClient(parsed.data, project.id, file, apply);
      pendingClientSlugs.add(parsed.data.slug);
      clientsProcessed += 1;

      // Research rec #6 — contact import deferred to Phase 61 admin UI.
      log(
        apply,
        'warn',
        'contact',
        file,
        'Contact import deferred to Phase 61 admin UI (research rec #6)',
      );
    }
  }

  // -------------------------------------------------------------------------
  // 2. Quotes -> Quote + QuoteLine
  // -------------------------------------------------------------------------
  const quotesRoot = join(sourceDir, 'quotes');
  const totalsByNummer: Record<string, { netto: number; bruto: number }> = {};
  let quotesProcessed = 0;

  if (!existsSync(quotesRoot)) {
    log(apply, 'warn', 'quotes', '(dir missing)', quotesRoot);
  } else {
    const yearDirs = readdirSync(quotesRoot).filter((d) => /^\d{4}$/.test(d));
    for (const year of yearDirs) {
      const yearDir = join(quotesRoot, year);
      const quoteFiles = readdirSync(yearDir).filter(
        (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
      );
      for (const file of quoteFiles) {
        const raw = parseYaml(readFileSync(join(yearDir, file), 'utf8'));
        const parsed = QuoteYamlSchema.safeParse(raw);
        if (!parsed.success) {
          log(
            apply,
            'warn',
            'quote',
            file,
            `parse error: ${parsed.error.issues.map((i) => i.path.join('.')).join(',')}`,
          );
          continue;
        }
        const q = parsed.data;
        const netto = computeNetto(q.regels);
        const bruto = computeBruto(netto, q.btw_percentage);
        totalsByNummer[q.nummer] = { netto, bruto };
        await upsertQuote(q, project.id, file, apply, pendingClientSlugs);
        quotesProcessed += 1;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary + totals comparison against known-good klarifai-core values
  // -------------------------------------------------------------------------
  const EXPECTED_TOTALS: Record<string, number> = {
    '2026-OFF001': 7816.6,
    '2026-OFF002': 11495.0,
    '2026-OFF003': 13285.8,
  };

  console.log('---');
  console.log(
    `[import-klarifai-yaml] summary: ${clientsProcessed} client(s), ${quotesProcessed} quote(s) processed`,
  );
  let mismatches = 0;
  for (const [nummer, expected] of Object.entries(EXPECTED_TOTALS)) {
    const actual = totalsByNummer[nummer];
    if (!actual) {
      console.log(
        `[import-klarifai-yaml] totals: ${nummer} NOT FOUND in source dir`,
      );
      mismatches += 1;
      continue;
    }
    const match = Math.abs(actual.bruto - expected) < 0.005;
    console.log(
      `[import-klarifai-yaml] totals: ${nummer} bruto=${actual.bruto.toFixed(2)} expected=${expected.toFixed(2)} ${match ? 'OK' : 'MISMATCH'}`,
    );
    if (!match) mismatches += 1;
  }

  console.log('---');
  if (!apply) {
    console.log(
      '[import-klarifai-yaml] DRY RUN COMPLETE — no writes performed. Use --apply to commit.',
    );
  } else if (mismatches > 0) {
    console.log(
      `[import-klarifai-yaml] APPLY COMPLETE with ${mismatches} total mismatch(es).`,
    );
    throw new Error(
      `Totals mismatch against klarifai-core expected values (${mismatches} mismatch(es)).`,
    );
  } else {
    console.log('[import-klarifai-yaml] APPLY COMPLETE. All totals match.');
  }
  console.log('---');
}

// ---------------------------------------------------------------------------
// upsertClient — idempotent on Prospect.readableSlug (research rec #2)
// ---------------------------------------------------------------------------

async function upsertClient(
  client: ClientYaml,
  projectId: string,
  file: string,
  apply: boolean,
): Promise<UpsertResult> {
  void file;
  const existing = await prisma.prospect.findUnique({
    where: { readableSlug: client.slug },
  });

  if (existing) {
    log(
      apply,
      'update',
      'prospect',
      client.slug,
      `id=${existing.id} (matched by readableSlug)`,
    );
    if (apply) {
      await prisma.prospect.update({
        where: { id: existing.id },
        data: {
          companyName: client.naam,
          city: client.adres?.stad ?? existing.city ?? undefined,
        },
      });
    }
    return { action: 'updated', id: existing.id };
  }

  // Create new — domain is NOT NULL on Prospect, use a placeholder if none
  const placeholderDomain = `${client.slug}.placeholder.invalid`;
  log(apply, 'create', 'prospect', client.slug, `domain=${placeholderDomain}`);
  if (apply) {
    const created = await prisma.prospect.create({
      data: {
        readableSlug: client.slug,
        slug: generateShortCuid(),
        companyName: client.naam,
        domain: placeholderDomain,
        city: client.adres?.stad,
        projectId,
        // status defaults to DRAFT
      },
    });
    return { action: 'created', id: created.id };
  }
  return { action: 'created' };
}

// ---------------------------------------------------------------------------
// upsertQuote — idempotent on Quote.nummer (research rec #3)
// ---------------------------------------------------------------------------

async function upsertQuote(
  quote: QuoteYaml,
  projectId: string,
  file: string,
  apply: boolean,
  pendingClientSlugs: Set<string> = new Set(),
): Promise<UpsertResult> {
  void file;
  void projectId;
  const netto = computeNetto(quote.regels);
  const bruto = computeBruto(netto, quote.btw_percentage);
  const totalLabel = `netto=${netto} bruto=${bruto.toFixed(2)}`;

  const existing = await prisma.quote.findUnique({
    where: { nummer: quote.nummer },
  });

  const prospect = await prisma.prospect.findUnique({
    where: { readableSlug: quote.klant },
  });
  // In --dry mode the prospect row was NOT actually created, so fall back to
  // the in-memory set of client slugs we have already seen this run.
  if (!prospect && !pendingClientSlugs.has(quote.klant)) {
    log(
      apply,
      'warn',
      'quote',
      quote.nummer,
      `no prospect found for klant=${quote.klant} — skipping`,
    );
    return { action: 'warned' };
  }

  if (existing) {
    // Q9 immutability: never overwrite non-DRAFT quotes. Skip with a warning.
    if (existing.status !== 'DRAFT') {
      log(
        apply,
        'skip',
        'quote',
        quote.nummer,
        `${totalLabel} (status=${existing.status}, immutable — skipping)`,
      );
      return { action: 'skipped', id: existing.id };
    }
    log(
      apply,
      'skip',
      'quote',
      quote.nummer,
      `${totalLabel} (already in DB, idempotent skip)`,
    );
    return { action: 'skipped', id: existing.id };
  }

  log(apply, 'create', 'quote', quote.nummer, totalLabel);
  if (apply) {
    if (!prospect) {
      // Safety: in --apply mode the Prospect MUST already exist in the DB.
      // The pendingClientSlugs fallback is a --dry-only affordance.
      throw new Error(
        `upsertQuote: no Prospect row found for klant=${quote.klant} in --apply mode`,
      );
    }
    const created = await prisma.quote.create({
      data: {
        nummer: quote.nummer,
        datum: new Date(quote.datum),
        geldigTot: new Date(quote.geldig_tot),
        onderwerp: quote.onderwerp,
        tagline: quote.tagline,
        introductie: quote.introductie,
        uitdaging: quote.uitdaging,
        aanpak: quote.aanpak,
        btwPercentage: quote.btw_percentage,
        scope: quote.scope,
        buitenScope: quote.buiten_scope,
        prospect: { connect: { id: prospect.id } },
        // status defaults to DRAFT
        lines: {
          create: quote.regels.map((r, idx) => ({
            fase: r.fase,
            omschrijving: r.omschrijving,
            oplevering: r.oplevering,
            uren: r.uren,
            tarief: r.tarief,
            position: idx,
          })),
        },
      },
      include: { lines: true },
    });
    return { action: 'created', id: created.id };
  }
  return { action: 'created' };
}

// ---------------------------------------------------------------------------
// Small CUID-ish generator (12 char) — Prospect.slug is @db.VarChar(12)
// ---------------------------------------------------------------------------
function generateShortCuid(): string {
  // 12 chars of url-safe lowercase alphanumerics. Collision odds are
  // vanishingly small for the import script's single-run population.
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI entry — only runs when invoked directly via `tsx scripts/import-...ts`
// ---------------------------------------------------------------------------

const isCliEntry =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  (require as NodeRequire).main === module;

if (isCliEntry) {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const sourceFlagIdx = argv.indexOf('--source');
  const source =
    sourceFlagIdx > -1 && argv[sourceFlagIdx + 1]
      ? argv[sourceFlagIdx + 1]
      : undefined;

  runImport({ apply, source })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[import-klarifai-yaml] FAILED');
      console.error(err);
      process.exit(1);
    });
}
