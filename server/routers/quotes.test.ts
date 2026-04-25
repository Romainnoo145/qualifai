/**
 * TEST-03 / DATA-08 / DATA-10 regression tests for `quotes` router.
 *
 * Covers:
 *  - Multi-project isolation: Project A admin sees zero quotes when only
 *    Project B has quotes. Every list/get/create path scopes through
 *    `prospect: { projectId: ctx.projectId }`.
 *  - Q9 immutability: quotes.update rejects non-DRAFT quotes with
 *    PRECONDITION_FAILED and the Prisma `update` is never invoked.
 *  - quotes.transition delegates to the state machine helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// Hoisted mocks — must come BEFORE importing the router under test (Pitfall 7)
// ---------------------------------------------------------------------------

vi.mock('@/env.mjs', () => ({
  env: {
    ADMIN_SECRET: 'test-secret',
    ATLANTIS_ADMIN_SECRET: 'atlantis-test-secret',
    RESEND_API_KEY: 'test-resend-key',
    ADMIN_EMAIL: 'admin@example.com',
    NEXT_PUBLIC_APP_URL: 'https://qualifai.example.com',
  },
}));

vi.mock('@/lib/outreach/send-email', () => ({
  sendOutreachEmail: vi
    .fn()
    .mockResolvedValue({ success: true, logId: 'log_test' }),
}));

vi.mock('@/lib/cadence/engine', () => ({
  evaluateCadence: vi.fn().mockResolvedValue(undefined),
  DEFAULT_CADENCE_CONFIG: {},
}));

vi.mock('@/lib/prospect-url', () => ({
  buildDiscoverUrl: vi.fn().mockReturnValue('https://example.com/analyse/x'),
}));

vi.mock('@/lib/ai/generate-outreach', () => ({
  generateIntroEmail: vi.fn(),
  generateFollowUp: vi.fn(),
  generateSignalEmail: vi.fn(),
}));

vi.mock('@/lib/automation/processor', () => ({
  processUnprocessedSignals: vi.fn(),
}));

vi.mock('@/lib/outreach/reply-workflow', () => ({
  applyReplyTriage: vi.fn(),
  captureInboundReply: vi.fn(),
}));

// Stub the state-machine helper so the router test does not exercise
// transactions or real Prisma behaviour. Hoisted mock object so we can
// also assert against `transitionQuote` imported below.
vi.mock('@/lib/state-machines/quote', () => ({
  transitionQuote: vi.fn().mockResolvedValue({ id: 'q1', status: 'SENT' }),
}));

import { appRouter } from './_app';
import { transitionQuote } from '@/lib/state-machines/quote';
import { sendOutreachEmail } from '@/lib/outreach/send-email';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PROJECT_A = {
  id: 'proj-a',
  slug: 'klarifai',
  name: 'Klarifai',
  projectType: 'KLARIFAI',
};

type Mock = ReturnType<typeof vi.fn>;

interface MockDb {
  project: { findUnique: Mock };
  quote: {
    findMany: Mock;
    findFirst: Mock;
    findUniqueOrThrow: Mock;
    create: Mock;
    update: Mock;
  };
  prospect: { findFirst: Mock };
  quoteLine: { deleteMany: Mock; createMany: Mock };
  $transaction: Mock;
  _txQuoteCreate?: Mock;
}

function makeMockDb(): MockDb {
  const txQuoteCreate = vi
    .fn()
    .mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'new-quote',
        ...data,
        lines: [],
      }),
    );

  const db: MockDb = {
    project: { findUnique: vi.fn().mockResolvedValue(PROJECT_A) },
    quote: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    prospect: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    quoteLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (cb: unknown) => {
      if (typeof cb === 'function') {
        return (cb as (tx: unknown) => unknown)({
          quote: {
            update: vi.fn().mockResolvedValue({ id: 'q1' }),
            create: txQuoteCreate,
          },
          quoteLine: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        });
      }
      return cb;
    }),
    _txQuoteCreate: txQuoteCreate,
  };
  return db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('quotes router — multi-project isolation (TEST-03 / DATA-10)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quotes.list: Project A admin sees zero quotes when only Project B has quotes', async () => {
    const db = makeMockDb();
    // findMany returns [] — because every query scopes through
    // `prospect: { projectId: 'proj-a' }`, any Project B rows are invisible.
    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    const result = await caller.quotes.list();

    expect(result).toEqual([]);
    expect(db.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prospect: expect.objectContaining({ projectId: 'proj-a' }),
        }),
      }),
    );
  });

  it('quotes.get: throws NOT_FOUND when the quote belongs to a different project', async () => {
    const db = makeMockDb();
    // assertQuoteInProject lookup returns null (cross-project row is invisible)
    db.quote.findFirst.mockResolvedValueOnce(null);

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    let thrown: TRPCError | null = null;
    try {
      await caller.quotes.get({ slug: 'q-other-project' });
    } catch (e) {
      thrown = e as TRPCError;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect(thrown?.code).toBe('NOT_FOUND');
    // The scoped fetch NEVER happens because the assertion throws first
    expect(db.quote.findUniqueOrThrow).not.toHaveBeenCalled();
    // And the findFirst call went through the prospect.projectId guard
    expect(db.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prospect: expect.objectContaining({ projectId: 'proj-a' }),
        }),
      }),
    );
  });

  it('quotes.create: throws NOT_FOUND when prospect belongs to a different project', async () => {
    const db = makeMockDb();
    // prospect.findFirst returns null → prospect is not in scope
    db.prospect.findFirst.mockResolvedValueOnce(null);

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    let thrown: TRPCError | null = null;
    try {
      await caller.quotes.create({
        prospectId: 'p-other',
        nummer: '2026-OFF999',
        datum: '2026-04-13',
        geldigTot: '2026-05-13',
        onderwerp: 'Test',
        btwPercentage: 21,
        lines: [],
      });
    } catch (e) {
      thrown = e as TRPCError;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect(thrown?.code).toBe('NOT_FOUND');
    // CRITICAL: no Quote created when prospect is cross-project
    expect(db.quote.create).not.toHaveBeenCalled();
    // Guard queried with the scoped projectId
    expect(db.prospect.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: 'proj-a' }),
      }),
    );
  });
});

describe('quotes router — immutability (DATA-08 / Q9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quotes.update: throws PRECONDITION_FAILED when quote.status is SENT', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({ id: 'q1', status: 'SENT' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    let thrown: TRPCError | null = null;
    try {
      await caller.quotes.update({ id: 'q1', onderwerp: 'New title' });
    } catch (e) {
      thrown = e as TRPCError;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect(thrown?.code).toBe('PRECONDITION_FAILED');
    expect(thrown?.message).toContain('DRAFT');
    // No Prisma write — the transaction callback was never invoked
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('quotes.update: allows DRAFT updates and runs inside a $transaction', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({ id: 'q1', status: 'DRAFT' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await caller.quotes.update({ id: 'q1', onderwerp: 'Updated title' });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('quotes router — transition delegation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quotes.transition delegates to transitionQuote helper after project scope check', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({ id: 'q1', status: 'DRAFT' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await caller.quotes.transition({ id: 'q1', newStatus: 'SENT' });

    expect(transitionQuote).toHaveBeenCalledWith(db, 'q1', 'SENT');
    // Scope check happened BEFORE delegation
    expect(db.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prospect: expect.objectContaining({ projectId: 'proj-a' }),
        }),
      }),
    );
  });

  it('quotes.transition: throws NOT_FOUND when quote is in a different project (no helper call)', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce(null);

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.quotes.transition({ id: 'q-other', newStatus: 'SENT' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(transitionQuote).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ADMIN-08 / Pitfall 3 — createVersion + suggestNextQuoteNumber
// ---------------------------------------------------------------------------

describe('quotes.createVersion', () => {
  beforeEach(() => vi.clearAllMocks());

  const ORIGINAL_LINES = [
    {
      id: 'l1',
      quoteId: 'q1',
      fase: 'Discovery & analyse',
      omschrijving: 'Huidige omgeving analyseren',
      oplevering: 'Architectuur-doc',
      uren: 8,
      tarief: 95,
      position: 0,
    },
    {
      id: 'l2',
      quoteId: 'q1',
      fase: 'Rebuild',
      omschrijving: 'Volledige rebuild',
      oplevering: 'Werkend platform',
      uren: 48,
      tarief: 95,
      position: 1,
    },
  ];

  const ORIGINAL_QUOTE = {
    id: 'q1',
    prospectId: 'p1',
    replacesId: null,
    status: 'SENT',
    nummer: '2026-OFF001',
    datum: new Date('2026-04-10'),
    geldigTot: new Date('2026-05-10'),
    onderwerp: 'Rebuild Plancraft',
    tagline: 'Pragmatische rebuild.',
    introductie: 'Intro tekst',
    uitdaging: 'Uitdaging tekst',
    aanpak: 'Aanpak tekst',
    btwPercentage: 21,
    scope: '- Rebuild\n- Migratie',
    buitenScope: '- Hosting',
    lines: ORIGINAL_LINES,
  };

  it('happy path: clones narrative + lines into DRAFT, sets replacesId, archives original in ONE $transaction', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({ id: 'q1', status: 'SENT' });
    db.quote.findUniqueOrThrow.mockResolvedValueOnce(ORIGINAL_QUOTE);

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await caller.quotes.createVersion({ fromId: 'q1' });

    // One and only one $transaction open
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    // tx.quote.create called with cloned fields + DRAFT status + replacesId
    expect(db._txQuoteCreate).toHaveBeenCalledTimes(1);
    const createArgs = db._txQuoteCreate!.mock.calls[0]![0] as {
      data: Record<string, unknown> & {
        lines: { create: Array<Record<string, unknown>> };
      };
    };
    expect(createArgs.data.replacesId).toBe('q1');
    expect(createArgs.data.status).toBe('DRAFT');
    expect(createArgs.data.prospectId).toBe('p1');
    expect(createArgs.data.onderwerp).toBe('Rebuild Plancraft');
    expect(createArgs.data.uitdaging).toBe('Uitdaging tekst');
    expect(createArgs.data.aanpak).toBe('Aanpak tekst');
    expect(createArgs.data.btwPercentage).toBe(21);
    expect(createArgs.data.scope).toBe('- Rebuild\n- Migratie');
    expect(createArgs.data.nummer).toBe('2026-OFF001-v2');
    // Lines cloned
    expect(createArgs.data.lines.create).toHaveLength(2);
    expect(createArgs.data.lines.create[0]?.fase).toBe('Discovery & analyse');
    expect(createArgs.data.lines.create[0]?.tarief).toBe(95);

    // transitionQuote called to ARCHIVE the source, inside the same tx
    expect(transitionQuote).toHaveBeenCalledWith(
      expect.anything(),
      'q1',
      'ARCHIVED',
    );
  });

  it('increments existing -vN suffix: 2026-OFF001-v2 -> 2026-OFF001-v3', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({ id: 'q1', status: 'SENT' });
    db.quote.findUniqueOrThrow.mockResolvedValueOnce({
      ...ORIGINAL_QUOTE,
      nummer: '2026-OFF001-v2',
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await caller.quotes.createVersion({ fromId: 'q1' });
    const createArgs = db._txQuoteCreate!.mock.calls[0]![0] as {
      data: { nummer: string };
    };
    expect(createArgs.data.nummer).toBe('2026-OFF001-v3');
  });

  it('cross-project reject: NOT_FOUND before any findUniqueOrThrow or $transaction', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce(null);

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.quotes.createVersion({ fromId: 'q-other-project' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(db.quote.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(transitionQuote).not.toHaveBeenCalled();
  });

  it('clones negative-tarief discount line without clamping', async () => {
    const db = makeMockDb();
    const discountLine = {
      id: 'l3',
      quoteId: 'q1',
      fase: 'Pakketkorting',
      omschrijving: 'Korting',
      oplevering: '',
      uren: 1,
      tarief: -800,
      position: 2,
    };
    db.quote.findFirst.mockResolvedValueOnce({ id: 'q1', status: 'SENT' });
    db.quote.findUniqueOrThrow.mockResolvedValueOnce({
      ...ORIGINAL_QUOTE,
      lines: [...ORIGINAL_LINES, discountLine],
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await caller.quotes.createVersion({ fromId: 'q1' });

    const createArgs = db._txQuoteCreate!.mock.calls[0]![0] as {
      data: { lines: { create: Array<{ fase: string; tarief: number }> } };
    };
    const korting = createArgs.data.lines.create.find(
      (l) => l.fase === 'Pakketkorting',
    );
    expect(korting).toBeDefined();
    expect(korting?.tarief).toBe(-800);
  });
});

describe('quotes.suggestNextQuoteNumber', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns YYYY-OFF001 when no quotes exist in scope', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce(null);

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    const result = await caller.quotes.suggestNextQuoteNumber();
    const currentYear = new Date().getFullYear();
    expect(result.nummer).toBe(`${currentYear}-OFF001`);
    // Query scoped via prospect.projectId
    expect(db.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prospect: expect.objectContaining({ projectId: 'proj-a' }),
        }),
      }),
    );
  });

  it('returns next sequential number when highest existing is OFF003', async () => {
    const db = makeMockDb();
    const currentYear = new Date().getFullYear();
    db.quote.findFirst.mockResolvedValueOnce({
      nummer: `${currentYear}-OFF003`,
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    const result = await caller.quotes.suggestNextQuoteNumber();
    expect(result.nummer).toBe(`${currentYear}-OFF004`);
  });
});

describe('quotes router — sendEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends email + transitions DRAFT to SENT atomically', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({
      id: 'q1',
      status: 'DRAFT',
      prospect: {
        id: 'p1',
        projectId: 'proj-a',
        contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
      },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    const result = await caller.quotes.sendEmail({
      id: 'q1',
      to: 'klant@maintix.io',
      subject: 'Voorstel Klarifai',
      body: 'Hierbij ons voorstel.\nhttps://qualifai.klarifai.nl/voorstel/maintix',
    });

    expect(result).toEqual({ ok: true });
    expect(sendOutreachEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 'c1',
        to: 'klant@maintix.io',
        subject: 'Voorstel Klarifai',
        type: 'QUOTE_DELIVERY',
        quoteId: 'q1',
      }),
    );
    expect(transitionQuote).toHaveBeenCalledWith(db, 'q1', 'SENT');
  });

  it('does NOT transition status when sendOutreachEmail throws', async () => {
    vi.mocked(sendOutreachEmail).mockRejectedValueOnce(
      new Error('resend network error'),
    );

    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({
      id: 'q1',
      status: 'DRAFT',
      prospect: {
        id: 'p1',
        projectId: 'proj-a',
        contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
      },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.quotes.sendEmail({
        id: 'q1',
        to: 'klant@maintix.io',
        subject: 'X',
        body: 'Y',
      }),
    ).rejects.toThrow(/resend network error/);

    expect(transitionQuote).not.toHaveBeenCalled();
  });

  it('does NOT transition status when sendOutreachEmail returns success=false', async () => {
    vi.mocked(sendOutreachEmail).mockResolvedValueOnce({
      success: false,
      logId: 'log_failed',
    });

    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({
      id: 'q1',
      status: 'DRAFT',
      prospect: {
        id: 'p1',
        projectId: 'proj-a',
        contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
      },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.quotes.sendEmail({
        id: 'q1',
        to: 'klant@maintix.io',
        subject: 'X',
        body: 'Y',
      }),
    ).rejects.toThrow(/Email kon niet verzonden/);

    expect(transitionQuote).not.toHaveBeenCalled();
  });

  it('rejects sendEmail when quote is not DRAFT', async () => {
    const db = makeMockDb();
    db.quote.findFirst.mockResolvedValueOnce({
      id: 'q1',
      status: 'SENT',
      prospect: {
        id: 'p1',
        projectId: 'proj-a',
        contacts: [{ id: 'c1', primaryEmail: 'klant@maintix.io' }],
      },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.quotes.sendEmail({
        id: 'q1',
        to: 'klant@maintix.io',
        subject: 'X',
        body: 'Y',
      }),
    ).rejects.toThrow(/niet meer in concept/);

    expect(sendOutreachEmail).not.toHaveBeenCalled();
    expect(transitionQuote).not.toHaveBeenCalled();
  });
});
