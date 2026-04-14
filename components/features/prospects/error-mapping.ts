/**
 * Map tRPC mutation errors to friendly Dutch messages for the Acties panel.
 *
 * Phase 61.1 POLISH-08: Gemini 5xx/429/quota errors must render as Dutch
 * friendly messages, never stack traces. Fallback is the first 120 chars
 * of the error message.
 *
 * SC #2 groundwork: FRIENDLY_ERROR_GEMINI_FALLBACK is a positive-success
 * warning copy for the "fallback model used" case. It is NOT returned by
 * `mapMutationError` — Plan 04 reads it directly from ProspectLastRunStatus.
 */

// Verbatim Dutch copy — do NOT change without updating POLISH-08 copy in
// REQUIREMENTS.md and the grep acceptance criteria below.
export const FRIENDLY_ERROR_GEMINI_503 =
  'AI tijdelijk niet beschikbaar — Gemini API spike, probeer over een paar minuten opnieuw.';
export const FRIENDLY_ERROR_GEMINI_QUOTA =
  'AI quota uitgeput voor vandaag — Gemini free-tier limiet bereikt.';
export const FRIENDLY_ERROR_GEMINI_RATELIMIT =
  'AI rate limit — even wachten en opnieuw proberen.';
export const FRIENDLY_ERROR_GEMINI_FALLBACK =
  'AI tijdelijk niet beschikbaar — fallback model gebruikt';
export const FRIENDLY_ERROR_UNKNOWN = 'Onbekende fout — probeer opnieuw.';

/**
 * Translate a thrown error into a user-facing Dutch message.
 * Order matters: more specific patterns first (quota before 429 before 5xx).
 */
export function mapMutationError(error: unknown): string {
  if (error === null || error === undefined) {
    return FRIENDLY_ERROR_UNKNOWN;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (!message.trim()) {
    return FRIENDLY_ERROR_UNKNOWN;
  }

  if (/quota/i.test(message)) {
    return FRIENDLY_ERROR_GEMINI_QUOTA;
  }
  if (/429|rate.?limit/i.test(message)) {
    return FRIENDLY_ERROR_GEMINI_RATELIMIT;
  }
  if (/503|Service Unavailable/i.test(message)) {
    return FRIENDLY_ERROR_GEMINI_503;
  }

  return message.slice(0, 120);
}
