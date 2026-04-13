/**
 * FOUND-01: Single source of truth for ProspectStatus literal arrays.
 *
 * Plan 01 deliberately uses `as const` WITHOUT `satisfies readonly ProspectStatus[]`
 * because Plan 02 has not yet added QUOTE_SENT to the Prisma enum. Plan 02 will
 * re-add the `satisfies` clause once the enum is extended.
 *
 * Do NOT widen these arrays without updating the Prisma enum first.
 */

export const ALL_PROSPECT_STATUSES = [
  'DRAFT',
  'ENRICHED',
  'GENERATING',
  'READY',
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
  'ARCHIVED',
] as const;

/** Statuses where the public /discover/[slug] page is visible. */
export const PUBLIC_VISIBLE_STATUSES = [
  'READY',
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
] as const;

/** Statuses indicating the prospect has already viewed the discover page. */
export const POST_FIRST_VIEW_STATUSES = [
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
] as const;

/** Statuses where a Quote is allowed to be sent. */
export const QUOTE_SENDABLE_STATUSES = ['ENGAGED', 'QUOTE_SENT'] as const;

/**
 * Statuses where the public dashboard validation block is shown.
 * Used by components/public/prospect-dashboard-client.tsx.
 */
export const DASHBOARD_VISIBLE_STATUSES = [
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
] as const;

/**
 * Statuses where a prospect is ready to be picked up for first outreach.
 * Used by server/routers/admin.ts (action queue: "ready for first outreach" filter).
 */
export const READY_FOR_OUTREACH_STATUSES = ['READY', 'ENRICHED'] as const;

export type AllProspectStatus = (typeof ALL_PROSPECT_STATUSES)[number];
export type PublicVisibleStatus = (typeof PUBLIC_VISIBLE_STATUSES)[number];
export type PostFirstViewStatus = (typeof POST_FIRST_VIEW_STATUSES)[number];
export type QuoteSendableStatus = (typeof QUOTE_SENDABLE_STATUSES)[number];
export type DashboardVisibleStatus =
  (typeof DASHBOARD_VISIBLE_STATUSES)[number];
export type ReadyForOutreachStatus =
  (typeof READY_FOR_OUTREACH_STATUSES)[number];
