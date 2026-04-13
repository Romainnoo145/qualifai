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
  sendOutreachEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/cadence/engine', () => ({
  evaluateCadence: vi.fn().mockResolvedValue(undefined),
  DEFAULT_CADENCE_CONFIG: {},
}));

vi.mock('@/lib/prospect-url', () => ({
  buildDiscoverUrl: vi.fn().mockReturnValue('https://example.com/discover/x'),
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
}

function makeMockDb(): MockDb {
  return {
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
          },
          quoteLine: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        });
      }
      return cb;
    }),
  };
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
      await caller.quotes.get({ id: 'q-other-project' });
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
