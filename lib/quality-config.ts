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
 * Calibrated: 2026-02-27 against real Dutch marketing agency prospects.
 * See: .planning/phases/26-quality-calibration/26-01-SUMMARY.md for calibration data.
 */

/** Minimum number of evidence items required to avoid RED */
export const MIN_EVIDENCE_COUNT = 3;

/** Source type count threshold for AMBER (1 source type → RED; 2 → AMBER; 3+ → GREEN) */
export const AMBER_MIN_SOURCE_TYPES = 2;

/** Source type count threshold for GREEN (must meet or exceed this to be GREEN) */
export const GREEN_MIN_SOURCE_TYPES = 3;

/** Minimum average confidence score (secondary signal, used when source types alone are borderline) */
export const MIN_AVERAGE_CONFIDENCE = 0.65;
