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

vi.mock('@/lib/invoice-pdf', () => ({
  renderInvoicePdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
}));

// sendEmailMock is declared via vi.hoisted so it is available inside vi.mock factories
// (which are hoisted to the top of the file by Vitest, before any imports run).
const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi
    .fn()
    .mockResolvedValue({ data: { id: 'email-id' }, error: null }),
}));

vi.mock('resend', () => {
  const MockResend = function (this: {
    emails: { send: typeof sendEmailMock };
  }) {
    this.emails = { send: sendEmailMock };
  };
  return { Resend: MockResend };
});

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
import { renderInvoicePdf } from '@/lib/invoice-pdf';

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
  invoice: {
    create: Mock;
    findFirst: Mock;
    findMany: Mock;
    groupBy: Mock;
    aggregate: Mock;
    update: Mock;
  };
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
    invoice: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
      update: vi.fn(),
    },
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

// ---------------------------------------------------------------------------
// invoice.send tests
// ---------------------------------------------------------------------------

describe('invoice.send', () => {
  let db: ReturnType<typeof makeMockDb>;

  const draftInvoice = {
    id: 'inv-1',
    status: 'DRAFT',
    invoiceNumber: 'F-2026-001',
    amountCents: 500000,
    vatPercentage: 21,
    termijnLabel: 'Bij ondertekening',
    termijnIndex: 0,
    sentAt: null,
    dueAt: null,
    paidAt: null,
    pdfUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    engagementId: 'eng-1',
    engagement: {
      id: 'eng-1',
      projectId: 'tenant-klarifai',
      quote: {
        id: 'q-1',
        nummer: 'OFF-001',
        btwPercentage: 21,
        lines: [],
      },
      prospect: {
        id: 'p-1',
        companyName: 'TestCo',
        domain: 'test.co',
        contacts: [{ primaryEmail: 'klant@test.co' }],
      },
    },
  };

  beforeEach(() => {
    sendEmailMock.mockClear();
    vi.mocked(renderInvoicePdf).mockClear();
    db = makeMockDb();
  });

  it('renders PDF, sends email with attachment, transitions DRAFT → SENT atomically', async () => {
    db.invoice.findFirst.mockResolvedValue(draftInvoice);
    db.invoice.update.mockResolvedValue({ ...draftInvoice, status: 'SENT' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await caller.invoice.send({ invoiceId: 'inv-1' });

    expect(renderInvoicePdf).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'klant@test.co',
        subject: expect.stringContaining('F-2026-001'),
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: 'F-2026-001.pdf' }),
        ]),
      }),
    );
    expect(db.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'inv-1', status: 'DRAFT' }),
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
          dueAt: expect.any(Date),
        }),
      }),
    );
  });

  it('throws CONFLICT if invoice is not in DRAFT', async () => {
    db.invoice.findFirst.mockResolvedValue({
      ...draftInvoice,
      status: 'SENT',
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await expect(
      caller.invoice.send({ invoiceId: 'inv-1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('throws NOT_FOUND if invoice is in different tenant', async () => {
    db.invoice.findFirst.mockResolvedValue({
      ...draftInvoice,
      engagement: { ...draftInvoice.engagement, projectId: 'tenant-other' },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await expect(
      caller.invoice.send({ invoiceId: 'inv-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// invoice.markPaid tests
// ---------------------------------------------------------------------------

describe('invoice.markPaid', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('SENT → PAID with paidAt timestamp', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'SENT',
      engagement: { projectId: 'tenant-klarifai' },
    });
    db.invoice.update = vi
      .fn()
      .mockResolvedValue({ id: 'inv-1', status: 'PAID' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await caller.invoice.markPaid({ invoiceId: 'inv-1' });

    expect(db.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'inv-1',
          status: { in: ['SENT', 'OVERDUE'] },
        }),
        data: expect.objectContaining({
          status: 'PAID',
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it('throws NOT_FOUND for invoice in different tenant', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'SENT',
      engagement: { projectId: 'tenant-other' },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await expect(
      caller.invoice.markPaid({ invoiceId: 'inv-1' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// invoice.cancel tests
// ---------------------------------------------------------------------------

describe('invoice.cancel', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('DRAFT → CANCELLED', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'DRAFT',
      engagement: { projectId: 'tenant-klarifai' },
    });
    db.invoice.update = vi
      .fn()
      .mockResolvedValue({ id: 'inv-1', status: 'CANCELLED' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await caller.invoice.cancel({ invoiceId: 'inv-1' });

    expect(db.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });

  it('PAID → CANCELLED throws CONFLICT', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'PAID',
      engagement: { projectId: 'tenant-klarifai' },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await expect(
      caller.invoice.cancel({ invoiceId: 'inv-1' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

// ---------------------------------------------------------------------------
// invoice.update tests
// ---------------------------------------------------------------------------

describe('invoice.update', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('updates DRAFT fields', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'DRAFT',
      engagement: { projectId: 'tenant-klarifai' },
    });
    db.invoice.update = vi.fn().mockResolvedValue({ id: 'inv-1' });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await caller.invoice.update({ invoiceId: 'inv-1', notes: 'Test note' });

    expect(db.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: 'Test note' }),
      }),
    );
  });

  it('refuses update on SENT', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'SENT',
      engagement: { projectId: 'tenant-klarifai' },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await expect(
      caller.invoice.update({ invoiceId: 'inv-1', notes: 'late edit' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

// ---------------------------------------------------------------------------
// invoice.getById tests
// ---------------------------------------------------------------------------

describe('invoice.getById', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('returns invoice in scope', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      engagement: { projectId: 'tenant-klarifai' },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    const result = await caller.invoice.getById({ invoiceId: 'inv-1' });
    expect(result?.id).toBe('inv-1');
  });

  it('throws NOT_FOUND for invoice in different tenant', async () => {
    db.invoice.findFirst = vi.fn().mockResolvedValue({
      id: 'inv-1',
      engagement: { projectId: 'tenant-other' },
    });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await expect(
      caller.invoice.getById({ invoiceId: 'inv-1' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// invoice.listForTenant tests
// ---------------------------------------------------------------------------

describe('invoice.listForTenant', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('returns scoped invoices + status totals + outstanding sum', async () => {
    db.invoice.findMany = vi.fn().mockResolvedValue([
      {
        id: 'i1',
        status: 'SENT',
        amountCents: 100000,
        engagement: { prospect: { companyName: 'A' } },
      },
      {
        id: 'i2',
        status: 'PAID',
        amountCents: 50000,
        engagement: { prospect: { companyName: 'B' } },
      },
    ]);
    db.invoice.groupBy = vi.fn().mockResolvedValue([
      { status: 'SENT', _sum: { amountCents: 100000 }, _count: 1 },
      { status: 'PAID', _sum: { amountCents: 50000 }, _count: 1 },
    ]);
    db.invoice.aggregate = vi
      .fn()
      .mockResolvedValue({ _sum: { amountCents: 50000 } });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    const result = await caller.invoice.listForTenant({});

    expect(result.invoices).toHaveLength(2);
    expect(result.totals.outstanding).toBe(100000);
    expect(result.totals.paidThisMonth).toBe(50000);
    expect(result.totals.countByStatus).toEqual({ SENT: 1, PAID: 1 });
  });

  it('filters by status when provided', async () => {
    db.invoice.findMany = vi.fn().mockResolvedValue([]);
    db.invoice.groupBy = vi.fn().mockResolvedValue([]);
    db.invoice.aggregate = vi
      .fn()
      .mockResolvedValue({ _sum: { amountCents: 0 } });

    const caller = appRouter.createCaller({
      db: db as never,
      adminToken: 'test-secret',
    });
    await caller.invoice.listForTenant({ status: 'OVERDUE' });

    expect(db.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'OVERDUE' }),
      }),
    );
  });
});
