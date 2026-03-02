/**
 * DEBT-03: E2E send test exercising the tRPC quality gate path.
 *
 * Tests that outreach.sendEmail:
 *  - Allows sends when the quality gate is GREEN (evidenceCount, sourceTypeCount, avgConf pass)
 *  - Rejects sends with PRECONDITION_FAILED when the gate is RED (thin evidence)
 *
 * sendOutreachEmail (the actual Resend call) is mocked — we verify the gate logic
 * in the procedure, not the email delivery.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before imports that load these modules
// ---------------------------------------------------------------------------

vi.mock('@/env.mjs', () => ({
  env: {
    ADMIN_SECRET: 'test-secret',
    RESEND_API_KEY: 'test-resend-key',
    ADMIN_EMAIL: 'admin@example.com',
    NEXT_PUBLIC_APP_URL: 'https://qualifai.example.com',
  },
}));

vi.mock('@/lib/outreach/send-email', () => ({
  sendOutreachEmail: vi
    .fn()
    .mockResolvedValue({ success: true, logId: 'mock-log-id' }),
}));

// Mock the cadence evaluator to avoid side-effect DB calls after send
vi.mock('@/lib/cadence/engine', () => ({
  evaluateCadence: vi.fn().mockResolvedValue(undefined),
  DEFAULT_CADENCE_CONFIG: {},
}));

// Mock the build-discover-url utility (used by sendWizardLink, not sendEmail, but safe)
vi.mock('@/lib/prospect-url', () => ({
  buildDiscoverUrl: vi
    .fn()
    .mockReturnValue('https://qualifai.example.com/discover/test'),
}));

// Mock generate-outreach AI calls
vi.mock('@/lib/ai/generate-outreach', () => ({
  generateIntroEmail: vi.fn(),
  generateFollowUp: vi.fn(),
  generateSignalEmail: vi.fn(),
}));

// Mock automation processor
vi.mock('@/lib/automation/processor', () => ({
  processUnprocessedSignals: vi.fn(),
}));

// Mock reply-workflow
vi.mock('@/lib/outreach/reply-workflow', () => ({
  applyReplyTriage: vi.fn(),
  captureInboundReply: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Now import the router (after all mocks are established)
// ---------------------------------------------------------------------------

import { appRouter } from '@/server/routers/_app';
import { sendOutreachEmail } from '@/lib/outreach/send-email';

// ---------------------------------------------------------------------------
// Shared mock contact data
// ---------------------------------------------------------------------------

const MOCK_CONTACT = {
  id: 'contact-001',
  prospectId: 'prospect-001',
  primaryEmail: 'jan.de.vries@acme.nl',
  firstName: 'Jan',
  lastName: 'de Vries',
  jobTitle: 'Directeur',
  seniority: 'C-Level',
  department: 'Directie',
  primaryPhone: '+31 6 12345678',
  linkedinUrl: 'https://linkedin.com/in/jandevries',
  outreachStatus: 'NONE',
};

// Gate data that produces GREEN (evidenceCount=10, sourceTypeCount=4, avgConf=0.72)
const GREEN_GATE_SUMMARY = {
  gate: {
    evidenceCount: 10,
    sourceTypeCount: 4,
    averageConfidence: 0.72,
  },
};

// Gate data that produces RED (evidenceCount=1, sourceTypeCount=0, avgConf=0)
const RED_GATE_SUMMARY = {
  gate: {
    evidenceCount: 1,
    sourceTypeCount: 0,
    averageConfidence: 0.0,
  },
};

const SEND_INPUT = {
  contactId: 'contact-001',
  subject: 'AI kan uw planning automatiseren',
  bodyHtml: '<p>Test outreach body</p>',
  bodyText: 'Test outreach body',
  type: 'INTRO_EMAIL' as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('outreach.sendEmail — quality gate via tRPC', () => {
  let mockDb: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      contact: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(MOCK_CONTACT),
        update: vi.fn().mockResolvedValue(MOCK_CONTACT),
      },
      researchRun: {
        findFirst: vi.fn(),
      },
      outreachLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-001' }),
      },
      outreachSequence: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(null),
      },
      outreachStep: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      outreachDraft: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      workflowHypothesis: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: vi
        .fn()
        .mockImplementation(async (ops: Promise<unknown>[]) => {
          return Promise.all(ops);
        }),
    };
  });

  it('GREEN gate: allows send and calls sendOutreachEmail', async () => {
    // Mock researchRun with GREEN gate data and qualityApproved=true
    (mockDb.researchRun as Record<string, unknown>).findFirst = vi
      .fn()
      .mockResolvedValue({
        summary: GREEN_GATE_SUMMARY,
        qualityApproved: true,
      });

    const caller = appRouter.createCaller({
      db: mockDb as never,
      adminToken: 'test-secret',
    });

    const result = await caller.outreach.sendEmail(SEND_INPUT);

    expect(result).toEqual({ success: true, logId: 'mock-log-id' });
    expect(sendOutreachEmail).toHaveBeenCalledOnce();
    expect(sendOutreachEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 'contact-001',
        to: 'jan.de.vries@acme.nl',
        subject: 'AI kan uw planning automatiseren',
        type: 'INTRO_EMAIL',
      }),
    );
  });

  it('RED gate: rejects with PRECONDITION_FAILED and does not call sendOutreachEmail', async () => {
    // Mock researchRun with RED gate data (thin evidence — 1 item, 0 source types)
    (mockDb.researchRun as Record<string, unknown>).findFirst = vi
      .fn()
      .mockResolvedValue({
        summary: RED_GATE_SUMMARY,
        qualityApproved: null,
      });

    const caller = appRouter.createCaller({
      db: mockDb as never,
      adminToken: 'test-secret',
    });

    await expect(caller.outreach.sendEmail(SEND_INPUT)).rejects.toThrow(
      TRPCError,
    );

    // Verify it's specifically PRECONDITION_FAILED
    let thrownError: TRPCError | undefined;
    try {
      await caller.outreach.sendEmail(SEND_INPUT);
    } catch (error) {
      thrownError = error as TRPCError;
    }
    expect(thrownError).toBeDefined();
    expect(thrownError?.code).toBe('PRECONDITION_FAILED');

    // sendOutreachEmail must NOT have been called
    expect(sendOutreachEmail).not.toHaveBeenCalled();
  });
});
