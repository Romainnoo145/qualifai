/**
 * POLISH-05/07/08: tests for admin.createProspect favicon wiring
 * and the new runResearchRun + runMasterAnalysis mutations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ---- Hoisted mocks ----
vi.mock('@/env.mjs', () => ({
  env: {
    ADMIN_SECRET: 'test-secret',
    ATLANTIS_ADMIN_SECRET: 'atlantis-test-secret',
    RESEND_API_KEY: 'test-resend-key',
    ADMIN_EMAIL: 'admin@example.com',
    NEXT_PUBLIC_APP_URL: 'https://qualifai.example.com',
    ENRICHMENT_REENRICH_AFTER_HOURS: 72,
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
  buildDiscoverUrl: vi.fn().mockReturnValue('https://example.com/x'),
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

// The key mocks for this plan:
vi.mock('@/lib/enrichment/favicon', () => ({
  getFaviconUrl: vi
    .fn()
    .mockResolvedValue(
      'https://www.google.com/s2/favicons?domain=marfa.nl&sz=128',
    ),
  buildInlineGoogleFaviconUrl: vi.fn(),
}));

vi.mock('@/lib/research-executor', () => ({
  executeResearchRun: vi.fn().mockResolvedValue({ runId: 'run-1' }),
}));

vi.mock('@/lib/analysis/master-analyzer', () => ({
  generateNarrativeAnalysis: vi
    .fn()
    .mockResolvedValue({ modelUsed: 'gemini-2.5-pro', fallbackUsed: false }),
  generateKlarifaiNarrativeAnalysis: vi
    .fn()
    .mockResolvedValue({ modelUsed: 'gemini-2.5-pro', fallbackUsed: false }),
  recordAnalysisFailure: vi.fn().mockResolvedValue(undefined),
  recordAnalysisSuccess: vi.fn().mockResolvedValue(undefined),
}));

import { appRouter } from './_app';
import { getFaviconUrl } from '@/lib/enrichment/favicon';
import { executeResearchRun } from '@/lib/research-executor';

const PROJECT_KLARIFAI = {
  id: 'proj-klarifai',
  slug: 'klarifai',
  name: 'Klarifai',
  projectType: 'KLARIFAI',
};

function buildMockDb(
  options: {
    prospectFindFirst?: unknown;
    prospectCreate?: unknown;
    prospectUpdate?: unknown;
    project?: unknown;
  } = {},
) {
  return {
    project: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.project ?? PROJECT_KLARIFAI),
    },
    prospect: {
      create: vi.fn().mockResolvedValue(
        options.prospectCreate ?? {
          id: 'prospect-1',
          domain: 'marfa.nl',
          slug: 'abc12345',
          status: 'DRAFT',
          projectId: 'proj-klarifai',
          logoUrl: null,
        },
      ),
      update: vi.fn().mockResolvedValue(options.prospectUpdate ?? {}),
      findFirst: vi.fn().mockResolvedValue(options.prospectFindFirst ?? null),
      findFirstOrThrow: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

describe('admin retrigger mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProspect favicon wiring', () => {
    it('kicks off getFaviconUrl after create and returns prospect immediately', async () => {
      const mockDb = buildMockDb();
      const caller = appRouter.createCaller({
        db: mockDb as never,
        adminToken: 'test-secret',
      });

      const result = await caller.admin.createProspect({ domain: 'marfa.nl' });

      expect(result.id).toBe('prospect-1');
      // give the void IIFE a tick to run
      await new Promise((r) => setImmediate(r));
      expect(getFaviconUrl).toHaveBeenCalledWith('marfa.nl');
      expect(mockDb.prospect.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            logoUrl: expect.stringContaining('google.com/s2/favicons'),
          }),
        }),
      );
    });

    it('does not throw when getFaviconUrl rejects', async () => {
      (
        getFaviconUrl as unknown as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error('favicon service down'));
      const mockDb = buildMockDb();
      const caller = appRouter.createCaller({
        db: mockDb as never,
        adminToken: 'test-secret',
      });

      const result = await caller.admin.createProspect({
        domain: 'broken.example',
      });

      expect(result.id).toBe('prospect-1');
      await new Promise((r) => setImmediate(r));
      expect(mockDb.prospect.update).not.toHaveBeenCalled();
    });
  });

  describe('runResearchRun', () => {
    it('throws NOT_FOUND when prospect is not in active project scope', async () => {
      const mockDb = buildMockDb({ prospectFindFirst: null });
      const caller = appRouter.createCaller({
        db: mockDb as never,
        adminToken: 'test-secret',
      });

      await expect(
        caller.admin.runResearchRun({ id: 'prospect-from-other-project' }),
      ).rejects.toThrow(TRPCError);
      expect(executeResearchRun).not.toHaveBeenCalled();
    });

    it('calls executeResearchRun with manualUrls=[] and deepCrawl=true on valid scope', async () => {
      const mockDb = buildMockDb({ prospectFindFirst: { id: 'prospect-1' } });
      const caller = appRouter.createCaller({
        db: mockDb as never,
        adminToken: 'test-secret',
      });

      const result = await caller.admin.runResearchRun({ id: 'prospect-1' });

      expect(result).toEqual({ ok: true });
      expect(executeResearchRun).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prospectId: 'prospect-1',
          manualUrls: [],
          deepCrawl: true,
        }),
      );
    });
  });

  describe('runMasterAnalysis', () => {
    it('throws NOT_FOUND when prospect is in a different project', async () => {
      const mockDb = buildMockDb({ prospectFindFirst: null });
      const caller = appRouter.createCaller({
        db: mockDb as never,
        adminToken: 'test-secret',
      });

      await expect(
        caller.admin.runMasterAnalysis({ id: 'prospect-from-project-b' }),
      ).rejects.toThrow(TRPCError);
    });

    it('throws PRECONDITION_FAILED with Dutch message when prospect is in scope', async () => {
      const mockDb = buildMockDb({
        prospectFindFirst: { id: 'prospect-1' },
      });
      const caller = appRouter.createCaller({
        db: mockDb as never,
        adminToken: 'test-secret',
      });

      await expect(
        caller.admin.runMasterAnalysis({ id: 'prospect-1' }),
      ).rejects.toThrow(/Analyse herhalen niet ondersteund/);
    });
  });
});
