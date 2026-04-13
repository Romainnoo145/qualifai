/**
 * FOUND-02: Prospect status state machine.
 *
 * Single source of truth for what status transitions are valid on a Prospect.
 * Used by:
 *   - server/routers/admin.ts updateProspect (validates manual admin edits)
 *   - lib/state-machines/quote.ts transitionQuote (validates auto-sync writes
 *     when a Quote transition cascades a status change to the parent Prospect)
 *
 * Pure function: takes (current, next), no DB. Throws TRPCError('PRECONDITION_FAILED')
 * on invalid transitions. Same-state self-transitions are allowed (idempotent).
 *
 * NOTE: Plan 01 ships this file BEFORE the Prisma enum gains QUOTE_SENT (that lands
 * in Plan 02). The map below references QUOTE_SENT as a string literal typed against
 * the Plan 01 constants module, NOT @prisma/client, to avoid a type error pre-migration.
 * Plan 02's executor will swap the type import to @prisma/client once the enum extends.
 */
import { TRPCError } from '@trpc/server';
import type { AllProspectStatus } from '@/lib/constants/prospect-statuses';

export const VALID_PROSPECT_TRANSITIONS: Record<
  AllProspectStatus,
  readonly AllProspectStatus[]
> = {
  DRAFT: ['ENRICHED', 'ARCHIVED'],
  ENRICHED: ['GENERATING', 'READY', 'DRAFT', 'ARCHIVED'],
  GENERATING: ['READY', 'ENRICHED', 'DRAFT', 'ARCHIVED'],
  READY: ['SENT', 'ENRICHED', 'ARCHIVED'],
  SENT: ['VIEWED', 'ENGAGED', 'READY', 'ARCHIVED'],
  VIEWED: ['ENGAGED', 'QUOTE_SENT', 'ARCHIVED'],
  ENGAGED: ['QUOTE_SENT', 'CONVERTED', 'ARCHIVED'],
  QUOTE_SENT: ['CONVERTED', 'ENGAGED', 'ARCHIVED'],
  CONVERTED: ['ARCHIVED'],
  ARCHIVED: [], // terminal
};

export function assertValidProspectTransition(
  current: AllProspectStatus,
  next: AllProspectStatus,
): void {
  if (current === next) return; // idempotent
  const allowed = VALID_PROSPECT_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Invalid prospect status transition: ${current} -> ${next}`,
    });
  }
}
