/**
 * Tests for `invoice.prepare` mutation.
 *
 * Covers:
 *  - Happy path: amountCents derived from termijn percentage of quote netto (excl BTW)
 *  - CONFLICT when an invoice for the same termijn already exists
 *  - NOT_FOUND when engagement is in a different tenant
 *  - BAD_REQUEST when termijnIndex is out of bounds
 *
 * Convention: termijn percentages apply to the EXCLUSIVE-of-BTW subtotal (netto).
 * Each invoice has its own BTW on top. This matches Dutch B2B practice.
 * computeQuoteTotals returns euros (not cents); we multiply by 100.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must come BEFORE importing the router under test
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

vi.mock('@/lib/invoice-number', () => ({
  nextInvoiceNumber: vi.fn().mockResolvedValue('F-2026-001'),
}));

// Stub dependencies pulled in transitively by other routers
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
vi.mock('@/lib/state-machines/quote', () => ({
  transitionQuote: vi.fn().mockResolvedValue({ id: 'q1', status: 'SENT' }),
}));

import { appRouter } from './_app';
import { nextInvoiceNumber } from '@/lib/invoice-number';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT_A = {
  id: 'tenant-klarifai',
  slug: 'klarifai',
  name: 'Klarifai',
  projectType: 'KLARIFAI',
};

type Mock = ReturnType<typeof vi.fn>;

interface MockDb {
  project: { findUnique: Mock };
  engagement: { findFirst: Mock };
  invoice: { create: Mock };
  // Other models needed by appRouter's other sub-routers at import time
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
    engagement: { findFirst: vi.fn() },
    invoice: { create: vi.fn() },
    // Stub out fields used by other routers mounted in appRouter
    quote: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    prospect: { findFirst: vi.fn().mockResolvedValue(null) },
    quoteLine: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('invoice.prepare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nextInvoiceNumber).mockResolvedValue('F-2026-001');
  });

  it('creates Invoice with amountCents derived from termijn percentage of quote netto (excl BTW)', async () => {
    // Quote: 1 line — 80 hours @ €100/h = €8.000 netto excl BTW
    // Payment schedule: 50% bij ondertekening → 50% × €8.000 = €4.000 → 400.000 cents
    const db = makeMockDb();
    db.engagement.findFirst.mockResolvedValue({
      id: 'eng-1',
      projectId: 'tenant-klarifai',
      quote: {
        id: 'q-1',
        btwPercentage: 21,
        paymentSchedule: [
          { label: 'Bij ondertekening', percentage: 50 },
          { label: 'Bij oplevering', percentage: 50 },
        ],
        lines: [{ uren: 80, tarief: 100 }],
      },
      invoices: [],
    });
    db.invoice.create.mockResolvedValue({ id: 'inv-1' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await caller.invoice.prepare({ engagementId: 'eng-1', termijnIndex: 0 });

    expect(db.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engagementId: 'eng-1',
          invoiceNumber: 'F-2026-001',
          termijnIndex: 0,
          termijnLabel: 'Bij ondertekening',
          amountCents: 400000, // 50% × €8.000 netto excl BTW = €4.000 = 400.000 cents
          status: 'DRAFT',
          vatPercentage: 21,
        }),
      }),
    );
  });

  it('throws CONFLICT when an invoice for the same termijn already exists', async () => {
    const db = makeMockDb();
    db.engagement.findFirst.mockResolvedValue({
      id: 'eng-1',
      projectId: 'tenant-klarifai',
      quote: {
        id: 'q-1',
        btwPercentage: 21,
        paymentSchedule: [{ label: 'Bij ondertekening', percentage: 50 }],
        lines: [{ uren: 80, tarief: 100 }],
      },
      invoices: [{ termijnIndex: 0 }],
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.invoice.prepare({ engagementId: 'eng-1', termijnIndex: 0 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('throws NOT_FOUND when engagement is in a different tenant', async () => {
    const db = makeMockDb();
    db.engagement.findFirst.mockResolvedValue(null);

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.invoice.prepare({ engagementId: 'eng-1', termijnIndex: 0 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws BAD_REQUEST when termijnIndex is out of bounds', async () => {
    const db = makeMockDb();
    db.engagement.findFirst.mockResolvedValue({
      id: 'eng-1',
      projectId: 'tenant-klarifai',
      quote: {
        id: 'q-1',
        btwPercentage: 21,
        paymentSchedule: [{ label: 'Bij ondertekening', percentage: 100 }],
        lines: [{ uren: 80, tarief: 100 }],
      },
      invoices: [],
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });

    await expect(
      caller.invoice.prepare({ engagementId: 'eng-1', termijnIndex: 5 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
