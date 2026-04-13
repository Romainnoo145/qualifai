/**
 * DATA-09 — Quote state machine + transitionQuote helper.
 *
 * The ONLY authorised path for mutating Quote.status. The router's `update`
 * mutation MUST omit `status` from its Zod input.
 *
 * Snapshot freeze (Q9): on DRAFT -> SENT, the helper builds a QuoteSnapshot
 * object, validates it via QuoteSnapshotSchema.parse, and writes it inside
 * the same Prisma $transaction as the status change.
 *
 * Auto-sync (Q13): when newStatus has a Quote -> Prospect mapping, the
 * Prospect.status is updated in the same transaction. Validated via
 * assertValidProspectTransition to prevent illegal cascades.
 */
import { TRPCError } from '@trpc/server';
import type {
  Prisma,
  PrismaClient,
  QuoteStatus,
  ProspectStatus,
} from '@prisma/client';
import { assertValidProspectTransition } from './prospect';
import {
  QuoteSnapshotSchema,
  type QuoteSnapshot,
} from '@/lib/schemas/quote-snapshot';

export const VALID_QUOTE_TRANSITIONS: Record<
  QuoteStatus,
  readonly QuoteStatus[]
> = {
  DRAFT: ['SENT', 'ARCHIVED'],
  SENT: ['VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'ARCHIVED'],
  VIEWED: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'ARCHIVED'],
  ACCEPTED: ['ARCHIVED'],
  REJECTED: ['ARCHIVED'],
  EXPIRED: ['ARCHIVED'],
  ARCHIVED: [], // terminal
};

/** Q13 sync mapping — every entry is a transactional cascade. */
export const QUOTE_TO_PROSPECT_SYNC: Partial<
  Record<QuoteStatus, ProspectStatus>
> = {
  SENT: 'QUOTE_SENT',
  ACCEPTED: 'CONVERTED',
  REJECTED: 'ENGAGED',
  // VIEWED, EXPIRED, ARCHIVED -> no prospect change
};

type QuoteWithProspectAndLines = Prisma.QuoteGetPayload<{
  include: {
    prospect: {
      select: { id: true; status: true; slug: true; companyName: true };
    };
    lines: true;
  };
}>;

/**
 * Build a QuoteSnapshot object from a hydrated Quote (with prospect + lines).
 * Used inside transitionQuote during the DRAFT -> SENT freeze.
 *
 * Computes totals from line items: netto = sum(uren * tarief),
 * btw = netto * btwPercentage / 100.
 */
export function buildSnapshotFromQuote(
  quote: QuoteWithProspectAndLines,
): QuoteSnapshot {
  const netto = quote.lines.reduce((sum, l) => sum + l.uren * l.tarief, 0);
  const btw = netto * (quote.btwPercentage / 100);
  const bruto = netto + btw;

  return {
    templateVersion:
      process.env.QUOTE_TEMPLATE_VERSION ??
      new Date().toISOString().slice(0, 10),
    capturedAt: new Date().toISOString(),
    tagline: quote.tagline ?? '',
    introductie: quote.introductie ?? '',
    uitdaging: quote.uitdaging ?? '',
    aanpak: quote.aanpak ?? '',
    nummer: quote.nummer,
    onderwerp: quote.onderwerp,
    datum: quote.datum.toISOString().slice(0, 10),
    geldigTot: quote.geldigTot.toISOString().slice(0, 10),
    lines: quote.lines.map((l) => ({
      fase: l.fase,
      omschrijving: l.omschrijving ?? '',
      oplevering: l.oplevering ?? '',
      uren: l.uren,
      tarief: l.tarief,
    })),
    btwPercentage: quote.btwPercentage,
    scope: quote.scope ?? '',
    buitenScope: quote.buitenScope ?? '',
    totals: { netto, btw, bruto },
    prospect: {
      slug: quote.prospect.slug,
      companyName: quote.prospect.companyName,
      contactName: null, // Phase 60: Contact import is out of scope
      contactEmail: null,
    },
  };
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function transitionQuote(
  db: DbClient,
  quoteId: string,
  newStatus: QuoteStatus,
) {
  // If caller already started a transaction (Prisma.TransactionClient has no
  // $transaction method), run inline on the passed client so nested callers
  // like quotes.createVersion keep a single atomic unit. Otherwise open our
  // own transaction for the read-then-write atomicity guarantee.
  const maybeTx = (db as PrismaClient).$transaction;
  if (typeof maybeTx !== 'function') {
    return runTransition(db as Prisma.TransactionClient, quoteId, newStatus);
  }
  return (db as PrismaClient).$transaction(async (tx) =>
    runTransition(tx, quoteId, newStatus),
  );
}

async function runTransition(
  tx: Prisma.TransactionClient,
  quoteId: string,
  newStatus: QuoteStatus,
) {
  const quote = await tx.quote.findUnique({
    where: { id: quoteId },
    include: {
      prospect: {
        select: { id: true, status: true, slug: true, companyName: true },
      },
      lines: true,
    },
  });

  if (!quote) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Quote ${quoteId} not found`,
    });
  }

  // 1. Quote-side transition validation
  if (
    quote.status !== newStatus &&
    !VALID_QUOTE_TRANSITIONS[quote.status].includes(newStatus)
  ) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Invalid quote status transition: ${quote.status} -> ${newStatus}`,
    });
  }

  // 2. Snapshot-on-SENT freeze (Q9)
  const updateData: Prisma.QuoteUpdateInput = { status: newStatus };
  if (newStatus === 'SENT' && quote.status === 'DRAFT') {
    const snapshot = QuoteSnapshotSchema.parse(buildSnapshotFromQuote(quote));
    updateData.snapshotData = snapshot as unknown as Prisma.InputJsonValue;
    updateData.snapshotAt = new Date();
    updateData.templateVersion =
      process.env.QUOTE_TEMPLATE_VERSION ??
      new Date().toISOString().slice(0, 10);
    updateData.snapshotStatus = 'PENDING';
  }

  const updatedQuote = await tx.quote.update({
    where: { id: quoteId },
    data: updateData,
  });

  // 3. Prospect sync (Q13) — same transaction
  const targetProspectStatus = QUOTE_TO_PROSPECT_SYNC[newStatus];
  if (targetProspectStatus && quote.prospect.status !== targetProspectStatus) {
    assertValidProspectTransition(quote.prospect.status, targetProspectStatus);
    await tx.prospect.update({
      where: { id: quote.prospect.id },
      data: { status: targetProspectStatus },
    });
  }

  return updatedQuote;
}
