/**
 * FOUND-01: Single source of truth for ProspectStatus literal arrays.
 *
 * Each array carries `satisfies readonly ProspectStatus[]` so the compiler
 * enforces that every literal is a member of the live Prisma enum. Plan 02
 * extended the enum with QUOTE_SENT; this clause makes future drift
 * (a typo, a removed enum value) a build error.
 */
import type { ProspectStatus } from '@prisma/client';

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
] as const satisfies readonly ProspectStatus[];

/** Statuses where the public /discover/[slug] page is visible. */
export const PUBLIC_VISIBLE_STATUSES = [
  'READY',
  'SENT',
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
] as const satisfies readonly ProspectStatus[];

/** Statuses indicating the prospect has already viewed the discover page. */
export const POST_FIRST_VIEW_STATUSES = [
  'VIEWED',
  'ENGAGED',
  'QUOTE_SENT',
  'CONVERTED',
] as const satisfies readonly ProspectStatus[];

/** Statuses where a Quote is allowed to be sent. */
export const QUOTE_SENDABLE_STATUSES = [
  'ENGAGED',
  'QUOTE_SENT',
] as const satisfies readonly ProspectStatus[];

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
] as const satisfies readonly ProspectStatus[];

/**
 * Statuses where a prospect is ready to be picked up for first outreach.
 * Used by server/routers/admin.ts (action queue: "ready for first outreach" filter).
 */
export const READY_FOR_OUTREACH_STATUSES = [
  'READY',
  'ENRICHED',
] as const satisfies readonly ProspectStatus[];

export type AllProspectStatus = (typeof ALL_PROSPECT_STATUSES)[number];
export type PublicVisibleStatus = (typeof PUBLIC_VISIBLE_STATUSES)[number];
export type PostFirstViewStatus = (typeof POST_FIRST_VIEW_STATUSES)[number];
export type QuoteSendableStatus = (typeof QUOTE_SENDABLE_STATUSES)[number];
export type DashboardVisibleStatus =
  (typeof DASHBOARD_VISIBLE_STATUSES)[number];
export type ReadyForOutreachStatus =
  (typeof READY_FOR_OUTREACH_STATUSES)[number];
