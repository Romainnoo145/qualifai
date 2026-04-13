import { describe, it, expect } from 'vitest';
import {
  QuoteSnapshotSchema,
  parseSnapshot,
  getSnapshotField,
  type QuoteSnapshot,
} from './quote-snapshot';

const VALID_SNAPSHOT: QuoteSnapshot = {
  templateVersion: '2026-04-13',
  capturedAt: '2026-04-13T12:00:00.000Z',
  tagline: 'Een pragmatische rebuild',
  introductie: 'Samen met Marfa uitschrijven...',
  uitdaging: 'TODO uitdaging',
  aanpak: 'TODO aanpak',
  nummer: '2026-OFF001',
  onderwerp: 'Rebuild Plancraft in Marfa-vorm',
  datum: '2026-04-10',
  geldigTot: '2026-05-10',
  lines: [
    {
      fase: 'Discovery & analyse',
      omschrijving: 'x',
      oplevering: 'y',
      uren: 8,
      tarief: 95,
    },
    {
      fase: 'Rebuild & development',
      omschrijving: 'x',
      oplevering: 'y',
      uren: 48,
      tarief: 95,
    },
    {
      fase: 'Testing & oplevering',
      omschrijving: 'x',
      oplevering: 'y',
      uren: 12,
      tarief: 95,
    },
  ],
  btwPercentage: 21,
  scope: '- volledige rebuild...',
  buitenScope: '- nieuwe features...',
  totals: { netto: 6460, btw: 1356.6, bruto: 7816.6 },
  prospect: {
    slug: 'marfa',
    companyName: 'Marfa',
    contactName: 'Marfa',
    contactEmail: 'info@marfa.nl',
  },
};

describe('QuoteSnapshotSchema', () => {
  it('reject malformed: missing required field nummer throws ZodError', () => {
    const { nummer: _omit, ...withoutNummer } = VALID_SNAPSHOT;
    const result = QuoteSnapshotSchema.safeParse(withoutNummer);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.path.join('.'));
      expect(issues).toContain('nummer');
    }
  });

  it('accept valid: full snapshot parses successfully', () => {
    const result = QuoteSnapshotSchema.safeParse(VALID_SNAPSHOT);
    expect(result.success).toBe(true);
  });

  it('accept negative tarief: OFF003 Pakketkorting line with tarief -800 parses', () => {
    const off003: QuoteSnapshot = {
      ...VALID_SNAPSHOT,
      nummer: '2026-OFF003',
      lines: [
        {
          fase: 'Discovery',
          omschrijving: 'x',
          oplevering: 'y',
          uren: 16,
          tarief: 95,
        },
        {
          fase: 'Rebuild',
          omschrijving: 'x',
          oplevering: 'y',
          uren: 72,
          tarief: 95,
        },
        {
          fase: 'Extras',
          omschrijving: 'x',
          oplevering: 'y',
          uren: 20,
          tarief: 95,
        },
        {
          fase: 'Testing',
          omschrijving: 'x',
          oplevering: 'y',
          uren: 16,
          tarief: 95,
        },
        {
          fase: 'Pakketkorting',
          omschrijving: 'discount',
          oplevering: '-',
          uren: 1,
          tarief: -800,
        },
      ],
      totals: { netto: 10980, btw: 2305.8, bruto: 13285.8 },
    };
    const result = QuoteSnapshotSchema.safeParse(off003);
    expect(result.success).toBe(true);
  });

  it('parse null: parseSnapshot(null) returns null without throwing', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot(undefined)).toBeNull();
  });

  it('parse malformed: parseSnapshot returns null on Zod failure', () => {
    expect(parseSnapshot({ nummer: 'only-this-field' })).toBeNull();
  });

  it('accessor present: getSnapshotField returns the stored value', () => {
    const result = getSnapshotField(
      VALID_SNAPSHOT,
      'nummer',
      'fallback-nummer',
    );
    expect(result).toBe('2026-OFF001');
  });

  it('accessor missing: getSnapshotField returns the fallback when snapshot is null', () => {
    const result = getSnapshotField(null, 'nummer', 'fallback-nummer');
    expect(result).toBe('fallback-nummer');
  });

  it('accessor missing: getSnapshotField returns the fallback when snapshot is malformed', () => {
    const malformed = { nummer: 123 }; // wrong type
    const result = getSnapshotField(malformed, 'nummer', 'fallback-nummer');
    expect(result).toBe('fallback-nummer');
  });
});
