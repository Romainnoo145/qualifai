import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { invoiceSequence: { upsert: vi.fn() } },
}));

import prisma from '@/lib/prisma';
import { nextInvoiceNumber } from './invoice-number';

describe('nextInvoiceNumber', () => {
  beforeEach(() => {
    (prisma.invoiceSequence.upsert as any).mockReset();
  });

  it('returns F-YYYY-001 for the first invoice of a year', async () => {
    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: 2026,
      lastSequence: 1,
    });
    const num = await nextInvoiceNumber(2026);
    expect(num).toBe('F-2026-001');
  });

  it('zero-pads up to 3 digits, then expands', async () => {
    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: 2026,
      lastSequence: 42,
    });
    expect(await nextInvoiceNumber(2026)).toBe('F-2026-042');

    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: 2026,
      lastSequence: 1234,
    });
    expect(await nextInvoiceNumber(2026)).toBe('F-2026-1234');
  });

  it('uses current year by default', async () => {
    (prisma.invoiceSequence.upsert as any).mockResolvedValue({
      year: new Date().getFullYear(),
      lastSequence: 1,
    });
    const num = await nextInvoiceNumber();
    expect(num).toMatch(/^F-\d{4}-001$/);
  });
});
