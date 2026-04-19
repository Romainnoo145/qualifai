/**
 * TEST-01 / FOUND-02 regression test for `admin.updateProspect`.
 *
 * Verifies that the state-machine guard rejects an invalid prospect status
 * transition with TRPCError code PRECONDITION_FAILED and that the Prisma
 * `update` call is NEVER invoked when the assertion throws.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// Hoisted mocks — must come before importing the router under test
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

import { appRouter } from './_app';

const PROJECT = {
  id: 'proj-a',
  slug: 'klarifai',
  name: 'Klarifai',
  projectType: 'KLARIFAI',
};

describe('admin.updateProspect — invalid transition (TEST-01)', () => {
  let mockDb: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      project: {
        findUnique: vi.fn().mockResolvedValue(PROJECT),
      },
      prospect: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pros_test',
          status: 'CONVERTED',
        }),
        update: vi.fn().mockResolvedValue({ id: 'pros_test', status: 'DRAFT' }),
      },
    };
  });

  it('rejects CONVERTED -> DRAFT with PRECONDITION_FAILED and performs no DB write', async () => {
    const caller = appRouter.createCaller({
      db: mockDb as never,
      adminToken: 'test-secret',
    });

    let thrown: TRPCError | null = null;
    try {
      await caller.admin.updateProspect({
        id: 'pros_test',
        status: 'DRAFT',
      });
    } catch (e) {
      thrown = e as TRPCError;
    }

    expect(thrown).toBeInstanceOf(TRPCError);
    expect(thrown?.code).toBe('PRECONDITION_FAILED');
    expect(thrown?.message).toContain('CONVERTED');
    expect(thrown?.message).toContain('DRAFT');

    // Critical: no DB write attempted
    expect(
      (mockDb.prospect as { update: ReturnType<typeof vi.fn> }).update,
    ).not.toHaveBeenCalled();
  });

  it('valid transition: ENRICHED -> READY succeeds and writes to DB', async () => {
    (
      mockDb.prospect as { findFirst: ReturnType<typeof vi.fn> }
    ).findFirst.mockResolvedValueOnce({
      id: 'pros_test',
      status: 'ENRICHED',
    });

    const caller = appRouter.createCaller({
      db: mockDb as never,
      adminToken: 'test-secret',
    });

    await caller.admin.updateProspect({
      id: 'pros_test',
      status: 'READY',
    });

    expect(
      (mockDb.prospect as { update: ReturnType<typeof vi.fn> }).update,
    ).toHaveBeenCalledOnce();
    expect(
      (mockDb.prospect as { update: ReturnType<typeof vi.fn> }).update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pros_test' },
        data: expect.objectContaining({ status: 'READY' }),
      }),
    );
  });
});
