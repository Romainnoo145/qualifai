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
 * Plan 02 swapped the type import to `@prisma/client` once the live enum gained
 * QUOTE_SENT, so the transition map is now compiler-checked against the database.
 */
import { TRPCError } from '@trpc/server';
import type { ProspectStatus } from '@prisma/client';

// Phase 61 / O9: DRAFT/ENRICHED/READY/SENT → QUOTE_SENT added so DRAFT→SENT
// quote transitions cascade cleanly for prospects that bypassed the engagement
// funnel (imported, manually seeded, or data-only prospects). See Pitfall 7 in
// 61-RESEARCH.md. GENERATING stays closed (prospect is in an in-flight state);
// CONVERTED stays closed (QUOTE_SENT backwards from CONVERTED is nonsensical).
export const VALID_PROSPECT_TRANSITIONS: Record<
  ProspectStatus,
  readonly ProspectStatus[]
> = {
  DRAFT: ['ENRICHED', 'ARCHIVED', 'QUOTE_SENT'],
  ENRICHED: ['GENERATING', 'READY', 'DRAFT', 'ARCHIVED', 'QUOTE_SENT'],
  GENERATING: ['READY', 'ENRICHED', 'DRAFT', 'ARCHIVED'],
  READY: ['SENT', 'ENRICHED', 'ARCHIVED', 'QUOTE_SENT'],
  SENT: ['VIEWED', 'ENGAGED', 'READY', 'ARCHIVED', 'QUOTE_SENT'],
  VIEWED: ['ENGAGED', 'QUOTE_SENT', 'ARCHIVED'],
  ENGAGED: ['QUOTE_SENT', 'CONVERTED', 'ARCHIVED'],
  QUOTE_SENT: ['CONVERTED', 'ENGAGED', 'ARCHIVED'],
  CONVERTED: ['ARCHIVED'],
  ARCHIVED: [], // terminal
};

export function assertValidProspectTransition(
  current: ProspectStatus,
  next: ProspectStatus,
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
