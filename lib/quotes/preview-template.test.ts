/**
 * Phase 61-01 / ADMIN-04 — preview renderer regression.
 *
 * Locks in:
 *   - All 3 Marfa golden totals (€ 7.816,60 / € 11.495,00 / € 13.285,80)
 *   - Token substitution (no stray {{client_name}}/{{project_title}}/{{tagline}})
 *   - Negative tarief line survives
 *   - Empty scope/buitenScope render a "Nog niet ingevuld" placeholder
 *   - Hardcoded OFF003 / "10 mei 2026" references from the klarifai-core
 *     template get replaced by the live quote values
 */
import { describe, it, expect } from 'vitest';
import type { Quote, QuoteLine, Prospect } from '@prisma/client';
import {
  renderQuotePreview,
  type QuoteWithRelations,
} from './preview-template';

// ---------------------------------------------------------------------------
// Fixture builder — mirrors the OFF001/OFF002/OFF003 shape from klarifai-core
// data/quotes/2026/*.yaml. Dates are fixed so the "geldig tot" assertion is
// deterministic.
// ---------------------------------------------------------------------------

interface FixtureInput {
  nummer: string;
  onderwerp: string;
  tagline: string;
  uitdaging?: string;
  aanpak?: string;
  scope?: string;
  buitenScope?: string;
  lines: Array<
    Partial<QuoteLine> & { fase: string; uren: number; tarief: number }
  >;
  companyName?: string | null;
}

function buildFixture(input: FixtureInput): QuoteWithRelations {
  const lines: QuoteLine[] = input.lines.map((l, idx) => ({
    id: `line-${idx}`,
    quoteId: 'fake-q',
    fase: l.fase,
    omschrijving: l.omschrijving ?? '',
    oplevering: l.oplevering ?? '',
    uren: l.uren,
    tarief: l.tarief,
    position: idx,
    createdAt: new Date('2026-04-10'),
    updatedAt: new Date('2026-04-10'),
  }));

  const quote = {
    id: 'fake-q',
    prospectId: 'fake-p',
    replacesId: null,
    status: 'DRAFT',
    nummer: input.nummer,
    datum: new Date('2026-04-10'),
    geldigTot: new Date('2026-05-10'),
    onderwerp: input.onderwerp,
    tagline: input.tagline,
    introductie: null,
    uitdaging: input.uitdaging ?? 'Plancraft loopt vast op zijn eigen succes.',
    aanpak: input.aanpak ?? 'We bouwen in vier heldere fases.',
    btwPercentage: 21,
    scope: input.scope ?? null,
    buitenScope: input.buitenScope ?? null,
    snapshotData: null,
    snapshotAt: null,
    snapshotStatus: null,
    templateVersion: null,
    createdAt: new Date('2026-04-10'),
    updatedAt: new Date('2026-04-10'),
  } as unknown as Quote;

  const prospect: Pick<Prospect, 'slug' | 'companyName'> = {
    slug: 'marfa-12char',
    companyName: input.companyName === undefined ? 'Marfa' : input.companyName,
  };

  return { ...quote, lines, prospect };
}

const OFF001 = buildFixture({
  nummer: '2026-OFF001',
  onderwerp: 'Rebuild Plancraft in Marfa-vorm',
  tagline: 'Een pragmatische rebuild van jullie bestaande tool.',
  scope:
    '- Volledige rebuild van bestaande Plancraft-functionaliteit\n- Migratie naar Marfa-architectuur',
  buitenScope:
    '- Nieuwe features buiten huidige Plancraft-scope\n- Hosting en infrastructuur',
  lines: [
    { fase: 'Discovery & analyse', uren: 8, tarief: 95 },
    { fase: 'Rebuild & development', uren: 48, tarief: 95 },
    { fase: 'Testing & oplevering', uren: 12, tarief: 95 },
  ],
});

const OFF002 = buildFixture({
  nummer: '2026-OFF002',
  onderwerp: 'Custom build Marfa',
  tagline: 'Een volledig nieuw platform, gebouwd op schaalbare architectuur.',
  scope: '- Volledig custom platform',
  buitenScope: '- Hosting en infrastructuur',
  lines: [
    { fase: 'Discovery & architectuur', uren: 16, tarief: 95 },
    { fase: 'Custom app development', uren: 72, tarief: 95 },
    { fase: 'Testing & oplevering', uren: 12, tarief: 95 },
  ],
});

const OFF003 = buildFixture({
  nummer: '2026-OFF003',
  onderwerp: 'Custom build Marfa + website redesign',
  tagline: 'Nieuw platform plus bijpassende website.',
  scope: '- Alles uit OFF002',
  buitenScope: '- Hosting en infrastructuur',
  lines: [
    { fase: 'Discovery & architectuur', uren: 16, tarief: 95 },
    { fase: 'Custom app development', uren: 72, tarief: 95 },
    { fase: 'Website redesign & implementatie', uren: 20, tarief: 95 },
    { fase: 'Testing & oplevering', uren: 16, tarief: 95 },
    { fase: 'Pakketkorting', uren: 1, tarief: -800 },
  ],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderQuotePreview — token substitution', () => {
  it('substitutes {{client_name}}, {{project_title}}, {{tagline}} tokens and removes all literal placeholders', async () => {
    const html = await renderQuotePreview(OFF001);

    // No stray tokens
    expect(html).not.toContain('{{client_name}}');
    expect(html).not.toContain('{{project_title}}');
    expect(html).not.toContain('{{tagline}}');

    // Real values appear
    expect(html).toContain('Marfa');
    expect(html).toContain('Rebuild Plancraft in Marfa-vorm');
    expect(html).toContain(
      'Een pragmatische rebuild van jullie bestaande tool.',
    );
  });

  it('falls back to prospect slug when companyName is null', async () => {
    const anon = buildFixture({
      nummer: OFF001.nummer,
      onderwerp: OFF001.onderwerp,
      tagline: OFF001.tagline ?? '',
      companyName: null,
      lines: OFF001.lines,
    });
    const html = await renderQuotePreview(anon);
    expect(html).toContain('marfa-12char');
  });
});

describe('renderQuotePreview — Marfa golden totals', () => {
  it('OFF001 renders total € 7.816,60', async () => {
    const html = await renderQuotePreview(OFF001);
    expect(html).toContain('€ 7.816,60');
  });

  it('OFF002 renders total € 11.495,00', async () => {
    const html = await renderQuotePreview(OFF002);
    expect(html).toContain('€ 11.495,00');
  });

  it('OFF003 renders total € 13.285,80 AND preserves the -800 discount line', async () => {
    const html = await renderQuotePreview(OFF003);
    expect(html).toContain('€ 13.285,80');
    // Negative subtotal row: 1 * -800 = -800
    expect(html).toContain('€ -800,00');
    // The discount fase label survives
    expect(html).toContain('Pakketkorting');
  });
});

describe('renderQuotePreview — scope handling', () => {
  it('renders "Nog niet ingevuld" placeholder when scope + buitenScope are empty', async () => {
    const blank = buildFixture({
      nummer: '2026-OFF999',
      onderwerp: 'Blank scope test',
      tagline: '',
      scope: '',
      buitenScope: '',
      lines: [{ fase: 'A', uren: 1, tarief: 100 }],
    });
    const html = await renderQuotePreview(blank);
    // Placeholder appears twice (once for scope, once for buitenScope)
    const matches = html.match(/Nog niet ingevuld/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('renderQuotePreview — removes hardcoded Marfa references', () => {
  it('replaces hardcoded 2026-OFF003 reference with the live quote nummer', async () => {
    const html = await renderQuotePreview(OFF001);
    // OFF001 fixture — OFF003 must not leak through
    expect(html).not.toContain('2026-OFF003');
    expect(html).toContain('2026-OFF001');
  });

  it('replaces hardcoded "10 mei 2026" date with the live geldigTot date', async () => {
    // Build a fixture with a distinctly different geldigTot so we can tell the
    // hardcoded Marfa date really got replaced (not just happened to match).
    const future = buildFixture({
      nummer: '2026-OFF777',
      onderwerp: 'Date replacement test',
      tagline: '',
      lines: [{ fase: 'A', uren: 1, tarief: 100 }],
    });
    future.geldigTot = new Date('2026-09-25'); // 25 september 2026
    const html = await renderQuotePreview(future);
    expect(html).toContain('25 september 2026');
    expect(html).not.toContain('10 mei 2026');
  });
});
