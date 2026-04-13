/**
 * TEST-02 — Quote state machine + transitionQuote helper.
 *
 * Covers:
 *   - VALID_QUOTE_TRANSITIONS shape (all 7 keys, ARCHIVED terminal)
 *   - QUOTE_TO_PROSPECT_SYNC mapping (Q13 locked decision)
 *   - buildSnapshotFromQuote totals math (OFF001 fixture)
 *   - transitionQuote DRAFT -> SENT: writes Quote.SENT + Prospect.QUOTE_SENT
 *     in one $transaction AND freezes snapshot fields
 *   - transitionQuote SENT -> ACCEPTED: writes Quote.ACCEPTED + Prospect.CONVERTED
 *   - transitionQuote SENT -> REJECTED: writes Quote.REJECTED + Prospect.ENGAGED
 *   - transitionQuote SENT -> VIEWED: no prospect change
 *   - Invalid transition (ACCEPTED -> DRAFT): PRECONDITION_FAILED, no writes
 *   - NOT_FOUND propagates
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  VALID_QUOTE_TRANSITIONS,
  QUOTE_TO_PROSPECT_SYNC,
  transitionQuote,
  buildSnapshotFromQuote,
} from './quote';

// Helper to build a mock Prisma client with a $transaction passthrough
function mockDb(quote: unknown) {
  const tx = {
    quote: {
      findUnique: vi.fn().mockResolvedValue(quote),
      update: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...(quote as Record<string, unknown>),
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

const BASE_QUOTE = {
  id: 'q1',
  nummer: '2026-OFF001',
  status: 'DRAFT' as const,
  onderwerp: 'Test',
  tagline: 'tag',
  introductie: 'intro',
  uitdaging: 'uitdaging',
  aanpak: 'aanpak',
  datum: new Date('2026-04-10'),
  geldigTot: new Date('2026-05-10'),
  btwPercentage: 21,
  scope: 'scope',
  buitenScope: 'buiten',
  lines: [
    {
      id: 'l1',
      quoteId: 'q1',
      fase: 'A',
      omschrijving: 'x',
      oplevering: 'y',
      uren: 8,
      tarief: 95,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'l2',
      quoteId: 'q1',
      fase: 'B',
      omschrijving: 'x',
      oplevering: 'y',
      uren: 48,
      tarief: 95,
      position: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'l3',
      quoteId: 'q1',
      fase: 'C',
      omschrijving: 'x',
      oplevering: 'y',
      uren: 12,
      tarief: 95,
      position: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  prospect: {
    id: 'p1',
    status: 'ENGAGED' as const,
    slug: 'marfa-12char',
    companyName: 'Marfa',
  },
};

describe('VALID_QUOTE_TRANSITIONS', () => {
  it('has all 7 QuoteStatus keys', () => {
    expect(Object.keys(VALID_QUOTE_TRANSITIONS).sort()).toEqual([
      'ACCEPTED',
      'ARCHIVED',
      'DRAFT',
      'EXPIRED',
      'REJECTED',
      'SENT',
      'VIEWED',
    ]);
  });

  it('ARCHIVED is terminal (empty allowed list)', () => {
    expect(VALID_QUOTE_TRANSITIONS.ARCHIVED).toEqual([]);
  });
});

describe('QUOTE_TO_PROSPECT_SYNC', () => {
  it('SENT -> QUOTE_SENT, ACCEPTED -> CONVERTED, REJECTED -> ENGAGED', () => {
    expect(QUOTE_TO_PROSPECT_SYNC.SENT).toBe('QUOTE_SENT');
    expect(QUOTE_TO_PROSPECT_SYNC.ACCEPTED).toBe('CONVERTED');
    expect(QUOTE_TO_PROSPECT_SYNC.REJECTED).toBe('ENGAGED');
  });

  it('VIEWED and EXPIRED have no prospect change', () => {
    expect(QUOTE_TO_PROSPECT_SYNC.VIEWED).toBeUndefined();
    expect(QUOTE_TO_PROSPECT_SYNC.EXPIRED).toBeUndefined();
  });
});

describe('buildSnapshotFromQuote', () => {
  it('computes correct totals for OFF001 (8+48+12 hours @ 95)', () => {
    const snapshot = buildSnapshotFromQuote(
      BASE_QUOTE as unknown as Parameters<typeof buildSnapshotFromQuote>[0],
    );
    expect(snapshot.totals.netto).toBe(6460);
    expect(snapshot.totals.btw).toBeCloseTo(1356.6, 2);
    expect(snapshot.totals.bruto).toBeCloseTo(7816.6, 2);
    expect(snapshot.nummer).toBe('2026-OFF001');
  });
});

describe('transitionQuote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitionQuote DRAFT -> SENT writes Quote.SENT AND Prospect.QUOTE_SENT in one $transaction', async () => {
    const db = mockDb(BASE_QUOTE);
    await transitionQuote(
      db as unknown as Parameters<typeof transitionQuote>[0],
      'q1',
      'SENT',
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db._tx.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1' },
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
    expect(db._tx.prospect.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: 'QUOTE_SENT' },
    });
  });

  it('snapshot frozen on DRAFT -> SENT: snapshotData, snapshotAt, templateVersion, snapshotStatus populated', async () => {
    const db = mockDb(BASE_QUOTE);
    await transitionQuote(
      db as unknown as Parameters<typeof transitionQuote>[0],
      'q1',
      'SENT',
    );
    const updateCall = db._tx.quote.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.snapshotData).toBeDefined();
    expect(updateCall.data.snapshotAt).toBeInstanceOf(Date);
    expect(typeof updateCall.data.templateVersion).toBe('string');
    expect(updateCall.data.snapshotStatus).toBe('PENDING');
  });

  it('transitionQuote SENT -> ACCEPTED writes Quote.ACCEPTED + Prospect.CONVERTED', async () => {
    const sent = {
      ...BASE_QUOTE,
      status: 'SENT' as const,
      prospect: { ...BASE_QUOTE.prospect, status: 'QUOTE_SENT' as const },
    };
    const db = mockDb(sent);
    await transitionQuote(
      db as unknown as Parameters<typeof transitionQuote>[0],
      'q1',
      'ACCEPTED',
    );
    const call = db._tx.quote.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.status).toBe('ACCEPTED');
    expect(db._tx.prospect.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: 'CONVERTED' },
    });
  });

  it('transitionQuote SENT -> REJECTED writes Quote.REJECTED + Prospect.ENGAGED', async () => {
    const sent = {
      ...BASE_QUOTE,
      status: 'SENT' as const,
      prospect: { ...BASE_QUOTE.prospect, status: 'QUOTE_SENT' as const },
    };
    const db = mockDb(sent);
    await transitionQuote(
      db as unknown as Parameters<typeof transitionQuote>[0],
      'q1',
      'REJECTED',
    );
    const call = db._tx.quote.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.status).toBe('REJECTED');
    expect(db._tx.prospect.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: 'ENGAGED' },
    });
  });

  it('transitionQuote SENT -> VIEWED does NOT change Prospect status (no prospect.update call)', async () => {
    const sent = {
      ...BASE_QUOTE,
      status: 'SENT' as const,
      prospect: { ...BASE_QUOTE.prospect, status: 'QUOTE_SENT' as const },
    };
    const db = mockDb(sent);
    await transitionQuote(
      db as unknown as Parameters<typeof transitionQuote>[0],
      'q1',
      'VIEWED',
    );
    const call = db._tx.quote.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.status).toBe('VIEWED');
    expect(db._tx.prospect.update).not.toHaveBeenCalled();
  });

  it('invalid transition: ACCEPTED -> DRAFT throws PRECONDITION_FAILED and does not write', async () => {
    const accepted = {
      ...BASE_QUOTE,
      status: 'ACCEPTED' as const,
      prospect: { ...BASE_QUOTE.prospect, status: 'CONVERTED' as const },
    };
    const db = mockDb(accepted);
    let err: unknown = null;
    try {
      await transitionQuote(
        db as unknown as Parameters<typeof transitionQuote>[0],
        'q1',
        'DRAFT',
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
    expect(db._tx.quote.update).not.toHaveBeenCalled();
    expect(db._tx.prospect.update).not.toHaveBeenCalled();
  });

  it('not found: throws NOT_FOUND when quote does not exist', async () => {
    const db = mockDb(null);
    await expect(
      transitionQuote(
        db as unknown as Parameters<typeof transitionQuote>[0],
        'missing',
        'SENT',
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
