/**
 * Quote constants — Phase 61.
 *
 * Single source of truth for tunables the router + preview renderer + UI
 * all need to agree on. Keep this file tiny and dependency-free — it is
 * imported from both server and client code.
 */

// TODO(multi-brand): move to Project.defaultBtwPercentage when multi-brand
// ships. Until then every project uses 21% and the `create` mutation requires
// callers to pass the value explicitly so nobody forgets to review it.
export const DEFAULT_BTW_PERCENTAGE = 21;

/**
 * Tarief unit policy (O10): integer euros.
 *   tarief: 80    means €80/hour.
 *   tarief: -800  means a -€800 discount line.
 * totals math is plain arithmetic on these integers — NO cent division.
 */
export const TARIEF_UNIT = 'euro' as const;
