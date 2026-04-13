/**
 * TEST-04 — Integration tests for scripts/import-klarifai-yaml.ts
 *
 * Coverage:
 *   - OFF001/OFF002/OFF003 totals computed correctly from real klarifai-core fixtures
 *   - OFF003 negative-tarief Pakketkorting line is preserved end-to-end
 *   - runImport({apply: false}) performs ZERO prisma writes (critical regression test)
 *   - runImport({apply: true}) creates 1 Prospect + 3 Quotes with correct nummers
 *   - Running runImport twice in apply mode is idempotent (no duplicate creates)
 *
 * Strategy: mock @/lib/prisma with an in-memory store so that a dry run can be
 * distinguished from an apply run without touching Postgres. The `vi.mock`
 * call is hoisted above imports of the code under test (Pitfall 7).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';

// ---------------------------------------------------------------------------
// vi.mock BEFORE imports of the code under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => {
  const fakeProject = {
    id: 'proj-test',
    slug: 'klarifai',
    name: 'Klarifai Test',
  };

  const state = {
    prospects: new Map<string, Record<string, unknown>>(),
    quotes: new Map<string, Record<string, unknown>>(),
  };

  return {
    prisma: {
      project: {
        findUnique: vi.fn().mockImplementation(async () => fakeProject),
      },
      prospect: {
        findUnique: vi
          .fn()
          .mockImplementation(
            async ({ where }: { where: { readableSlug?: string } }) =>
              state.prospects.get(where.readableSlug ?? '') ?? null,
          ),
        create: vi
          .fn()
          .mockImplementation(
            async ({ data }: { data: Record<string, unknown> }) => {
              const readableSlug = data.readableSlug as string;
              const row = { id: `prospect-${readableSlug}`, ...data };
              state.prospects.set(readableSlug, row);
              return row;
            },
          ),
        update: vi
          .fn()
          .mockImplementation(
            async ({
              where,
              data,
            }: {
              where: { id: string };
              data: Record<string, unknown>;
            }) => {
              const current = Array.from(state.prospects.values()).find(
                (p) => (p as { id: string }).id === where.id,
              );
              if (current) {
                Object.assign(current, data);
              }
              return current;
            },
          ),
      },
      quote: {
        findUnique: vi
          .fn()
          .mockImplementation(
            async ({ where }: { where: { nummer?: string } }) =>
              state.quotes.get(where.nummer ?? '') ?? null,
          ),
        create: vi
          .fn()
          .mockImplementation(
            async ({ data }: { data: Record<string, unknown> }) => {
              const nummer = data.nummer as string;
              const row = { id: `quote-${nummer}`, ...data };
              state.quotes.set(nummer, row);
              return row;
            },
          ),
      },
      __state: state,
    },
  };
});

// ---------------------------------------------------------------------------
// Now import the code under test (after vi.mock above is registered)
// ---------------------------------------------------------------------------

import {
  runImport,
  QuoteYamlSchema,
  computeNetto,
  computeBruto,
} from './import-klarifai-yaml';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Fixture resolution — the real klarifai-core repo lives two directories up
// from the qualifai project root on the standard dev layout:
//   ~/Documents/klarifai/klarifai-core
//   ~/Documents/klarifai/projects/qualifai   <-- process.cwd() under vitest
// Try a couple of sensible candidates so the test works regardless of
// whether the repos are siblings under `klarifai/` or under `klarifai/projects/`.
// ---------------------------------------------------------------------------

import { existsSync } from 'node:fs';

const CANDIDATE_KLARIFAI_CORE_PATHS = [
  resolve(process.cwd(), '../../klarifai-core/data'),
  resolve(process.cwd(), '../klarifai-core/data'),
];

const KLARIFAI_CORE_DATA =
  CANDIDATE_KLARIFAI_CORE_PATHS.find((p) => existsSync(p)) ??
  CANDIDATE_KLARIFAI_CORE_PATHS[0]!;

function parseYamlDoc(source: string): unknown {
  // Matches parseYaml in import-klarifai-yaml.ts: klarifai-core files are
  // framed with `---` top AND bottom, so parseAllDocuments returns one real
  // doc followed by an empty trailing doc. Return the first non-empty one.
  const docs = parseAllDocuments(source);
  for (const doc of docs) {
    const value = doc.toJS();
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function loadQuoteYaml(file: string) {
  const raw = parseYamlDoc(
    readFileSync(resolve(KLARIFAI_CORE_DATA, 'quotes/2026', file), 'utf8'),
  );
  return QuoteYamlSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// TEST-04 Part 1: totals computation from real YAML fixtures
// ---------------------------------------------------------------------------

describe('YAML quote totals (TEST-04)', () => {
  it('OFF001: netto 6460 / bruto 7816.60', () => {
    const q = loadQuoteYaml('2026-OFF001.yaml');
    const netto = computeNetto(q.regels);
    const bruto = computeBruto(netto, q.btw_percentage);
    expect(netto).toBe(6460);
    expect(bruto).toBeCloseTo(7816.6, 2);
  });

  it('OFF002: netto 9500 / bruto 11495.00', () => {
    const q = loadQuoteYaml('2026-OFF002.yaml');
    const netto = computeNetto(q.regels);
    const bruto = computeBruto(netto, q.btw_percentage);
    expect(netto).toBe(9500);
    expect(bruto).toBeCloseTo(11495.0, 2);
  });

  it('OFF003: netto 10980 / bruto 13285.80 and accepts negative tarief Pakketkorting line', () => {
    const q = loadQuoteYaml('2026-OFF003.yaml');
    // Regression guard — OFF003 must retain the -800 Pakketkorting row
    expect(q.regels.some((r) => r.tarief === -800)).toBe(true);
    const netto = computeNetto(q.regels);
    const bruto = computeBruto(netto, q.btw_percentage);
    expect(netto).toBe(10980);
    expect(bruto).toBeCloseTo(13285.8, 2);
  });
});

// ---------------------------------------------------------------------------
// TEST-04 Part 2: runImport side effects (dry-run vs apply vs idempotency)
// ---------------------------------------------------------------------------

describe('runImport side effects (TEST-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset in-memory store between tests
    (
      prisma as unknown as {
        __state: {
          prospects: Map<string, unknown>;
          quotes: Map<string, unknown>;
        };
      }
    ).__state.prospects.clear();
    (
      prisma as unknown as {
        __state: {
          prospects: Map<string, unknown>;
          quotes: Map<string, unknown>;
        };
      }
    ).__state.quotes.clear();
  });

  it('dry run: zero writes (no prospect.create, no quote.create)', async () => {
    await runImport({ apply: false, sourceDir: KLARIFAI_CORE_DATA });
    expect(prisma.prospect.create).not.toHaveBeenCalled();
    expect(prisma.prospect.update).not.toHaveBeenCalled();
    expect(prisma.quote.create).not.toHaveBeenCalled();
  });

  it('apply run: creates 1 Marfa prospect and 3 OFF quotes', async () => {
    await runImport({ apply: true, sourceDir: KLARIFAI_CORE_DATA });

    expect(prisma.prospect.create).toHaveBeenCalledTimes(1);
    expect(prisma.quote.create).toHaveBeenCalledTimes(3);

    const createdNummers = (
      prisma.quote.create as ReturnType<typeof vi.fn>
    ).mock.calls
      .map((call) => (call[0] as { data: { nummer: string } }).data.nummer)
      .sort();

    expect(createdNummers).toEqual([
      '2026-OFF001',
      '2026-OFF002',
      '2026-OFF003',
    ]);
  });

  it('apply run preserves OFF003 negative tarief (regression) in create payload', async () => {
    await runImport({ apply: true, sourceDir: KLARIFAI_CORE_DATA });

    const off003Call = (
      prisma.quote.create as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      (call) =>
        (call[0] as { data: { nummer: string } }).data.nummer === '2026-OFF003',
    );
    expect(off003Call).toBeDefined();

    const payload = off003Call![0] as {
      data: {
        lines: { create: Array<{ tarief: number; fase: string }> };
      };
    };
    const linesToCreate = payload.data.lines.create;
    expect(linesToCreate.some((line) => line.tarief === -800)).toBe(true);
  });

  it('apply run twice: idempotent — second run creates nothing new', async () => {
    await runImport({ apply: true, sourceDir: KLARIFAI_CORE_DATA });
    expect(prisma.quote.create).toHaveBeenCalledTimes(3);
    expect(prisma.prospect.create).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    await runImport({ apply: true, sourceDir: KLARIFAI_CORE_DATA });

    // Prospect already in state — second run matches by readableSlug and updates (not creates)
    expect(prisma.prospect.create).not.toHaveBeenCalled();
    // Quote already in state — second run matches by nummer and skips (not creates)
    expect(prisma.quote.create).not.toHaveBeenCalled();
  });
});
