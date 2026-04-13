/**
 * Phase 61-01 / Pitfall 7 regression — Quote DRAFT→SENT cascade must not
 * crash on prospects whose current status bypassed the engagement funnel
 * (imported prospects, manually seeded prospects, data-only prospects).
 *
 * Exercises real transitionQuote() against a fake Prisma client, varying
 * prospect.status for each row. Asserts the widened
 * VALID_PROSPECT_TRANSITIONS map allows the QUOTE_SENT target from every
 * source status Romano needs, and keeps rejecting the intentionally-closed
 * sources (GENERATING, CONVERTED).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { ProspectStatus } from '@prisma/client';

// Bypass snapshot validation — the DRAFT→SENT freeze path is tested
// separately in quote.test.ts. Here we only care about the prospect cascade.
vi.mock('@/lib/schemas/quote-snapshot', () => ({
  QuoteSnapshotSchema: { parse: (x: unknown) => x },
  parseSnapshot: (x: unknown) => x,
  getSnapshotField: (_r: unknown, _k: string, fallback: unknown) => fallback,
}));

import { transitionQuote } from './quote';

interface FakeDb {
  $transaction: ReturnType<typeof vi.fn>;
  _tx: {
    quote: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    prospect: {
      update: ReturnType<typeof vi.fn>;
    };
  };
}

function buildFakeDb(prospectStatus: ProspectStatus): FakeDb {
  const quoteRow = {
    id: 'q1',
    nummer: '2026-OFF999',
    status: 'DRAFT' as const,
    onderwerp: 'Pitfall 7 test',
    tagline: '',
    introductie: '',
    uitdaging: '',
    aanpak: '',
    datum: new Date('2026-04-13'),
    geldigTot: new Date('2026-05-13'),
    btwPercentage: 21,
    scope: '',
    buitenScope: '',
    lines: [
      {
        id: 'l1',
        quoteId: 'q1',
        fase: 'A',
        omschrijving: '',
        oplevering: '',
        uren: 10,
        tarief: 95,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    prospect: {
      id: 'p1',
      status: prospectStatus,
      slug: 'acme-tester',
      companyName: 'Acme',
    },
  };

  const tx = {
    quote: {
      findUnique: vi.fn().mockResolvedValue(quoteRow),
      update: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...quoteRow,
          ...data,
        })),
    },
    prospect: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  };

  return {
    $transaction: vi
      .fn()
      .mockImplementation(async (cb: (txArg: typeof tx) => unknown) => cb(tx)),
    _tx: tx,
  };
}

describe('Quote DRAFT→SENT prospect source status compatibility (Pitfall 7)', () => {
  beforeEach(() => vi.clearAllMocks());

  const WIDENED_SOURCES: ProspectStatus[] = [
    'DRAFT',
    'ENRICHED',
    'READY',
    'SENT',
    'VIEWED',
    'ENGAGED',
  ];

  it.each(WIDENED_SOURCES)(
    'allows DRAFT quote → SENT when prospect is in %s (cascades to QUOTE_SENT)',
    async (sourceStatus) => {
      const db = buildFakeDb(sourceStatus);

      await expect(
        transitionQuote(
          db as unknown as Parameters<typeof transitionQuote>[0],
          'q1',
          'SENT',
        ),
      ).resolves.toBeDefined();

      // Quote.status was flipped to SENT
      expect(db._tx.quote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q1' },
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
      // Prospect.status was cascaded to QUOTE_SENT in the same tx
      expect(db._tx.prospect.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'QUOTE_SENT' },
      });
    },
  );

  it('rejects cascade when prospect is CONVERTED (terminal-ish guard)', async () => {
    const db = buildFakeDb('CONVERTED');
    let caught: unknown = null;
    try {
      await transitionQuote(
        db as unknown as Parameters<typeof transitionQuote>[0],
        'q1',
        'SENT',
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TRPCError);
    expect((caught as TRPCError).code).toBe('PRECONDITION_FAILED');
    expect((caught as TRPCError).message).toMatch(
      /Invalid prospect status transition/i,
    );
  });

  it('rejects cascade when prospect is GENERATING (intentionally omitted from widening)', async () => {
    const db = buildFakeDb('GENERATING');
    let caught: unknown = null;
    try {
      await transitionQuote(
        db as unknown as Parameters<typeof transitionQuote>[0],
        'q1',
        'SENT',
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(TRPCError);
    expect((caught as TRPCError).code).toBe('PRECONDITION_FAILED');
    expect((caught as TRPCError).message).toMatch(
      /Invalid prospect status transition/i,
    );
  });
});
