/**
 * Quality calibration thresholds for the Qualifai research pipeline.
 *
 * Primary signal: source type diversity — how many distinct sourceType values
 * (homepage, google, sitemap, kvk, linkedin, etc.) contributed evidence items.
 *
 * Tier semantics:
 *   GREEN  = 3+ source types — strong multi-source evidence, ready to outreach
 *   AMBER  = 2 source types — some evidence but limited diversity — BLOCKS send
 *             until admin explicitly reviews and approves
 *   RED    = 0-1 source types or < MIN_EVIDENCE_COUNT items — too thin to proceed
 *
 * Note: AMBER is a HARD gate (not soft warn-and-proceed). The send queue will
 * not allow outreach for AMBER prospects unless qualityApproved === true.
 *
 * Calibrated: 2026-03-02 against 7 prospects with AI-scored evidence pipeline.
 * AI scoring (evidence-scorer.ts) assigns relevance/depth per item, quality gate
 * excludes items with aiRelevance < 0.50 from average. The honest scoring centers
 * lower than the old static scores — 0.55 threshold separates weak from strong.
 * Active source types: WEBSITE, CAREERS, LINKEDIN, NEWS, REVIEWS (KVK/REGISTRY inactive — no API key).
 */

/** Minimum number of evidence items required to avoid RED */
export const MIN_EVIDENCE_COUNT = 3;

/** Source type count threshold for AMBER (1 source type → RED; 2 → AMBER; 3+ → GREEN) */
export const AMBER_MIN_SOURCE_TYPES = 2;

/** Source type count threshold for GREEN (must meet or exceed this to be GREEN) */
export const GREEN_MIN_SOURCE_TYPES = 3;

/** Minimum average confidence score (secondary signal — computed over items with aiRelevance >= 0.50 only) */
export const MIN_AVERAGE_CONFIDENCE = 0.55;

/**
 * Minimum number of distinct sourceType values required for a workflowTag
 * to be considered "confirmed" (cross-source pain signal).
 *
 * GATE-01: A pain tag backed by 2+ distinct sourceTypes is confirmed.
 * Advisory-only (GATE-03): unconfirmed tags do NOT block outreach.
 */
export const PAIN_CONFIRMATION_MIN_SOURCES = 2;

/** Traffic light tier for prospect quality gating */
export type TrafficLight = 'red' | 'amber' | 'green';

/**
 * computeTrafficLight — pure function mapping evidence metrics to a traffic light.
 *
 * Client-safe: no Node.js dependencies. Used by both server (workflow-engine)
 * and client (quality-chip) components.
 */
export function computeTrafficLight(
  evidenceCount: number,
  sourceTypeCount: number,
  averageConfidence: number,
): TrafficLight {
  if (evidenceCount < MIN_EVIDENCE_COUNT || sourceTypeCount < 1) return 'red';
  if (
    sourceTypeCount < GREEN_MIN_SOURCE_TYPES ||
    averageConfidence < MIN_AVERAGE_CONFIDENCE
  )
    return 'amber';
  return 'green';
}
