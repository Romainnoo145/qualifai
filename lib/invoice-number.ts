import prisma from '@/lib/prisma';

/**
 * Atomic per-year sequential invoice number generator.
 * Uses InvoiceSequence row (year as PK, lastSequence as counter).
 * `upsert` + `increment` is atomic in Postgres — two parallel calls
 * always produce two distinct sequence numbers.
 */
export async function nextInvoiceNumber(
  year: number = new Date().getFullYear(),
): Promise<string> {
  const result = await prisma.invoiceSequence.upsert({
    where: { year },
    create: { year, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  });
  return `F-${year}-${String(result.lastSequence).padStart(3, '0')}`;
}
