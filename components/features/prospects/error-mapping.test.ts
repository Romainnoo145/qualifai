/**
 * Tests for mapMutationError — POLISH-08
 *
 * Verifies that Gemini 503/429/quota errors are mapped to verbatim Dutch
 * friendly messages, and that precedence rules (quota > 429 > 503) are upheld.
 */
import { describe, it, expect } from 'vitest';
import {
  mapMutationError,
  FRIENDLY_ERROR_GEMINI_503,
  FRIENDLY_ERROR_GEMINI_QUOTA,
  FRIENDLY_ERROR_GEMINI_RATELIMIT,
  FRIENDLY_ERROR_GEMINI_FALLBACK,
  FRIENDLY_ERROR_UNKNOWN,
} from './error-mapping';

describe('mapMutationError', () => {
  it('returns 503 message for Gemini Service Unavailable error', () => {
    expect(mapMutationError(new Error('503 Service Unavailable'))).toBe(
      FRIENDLY_ERROR_GEMINI_503,
    );
  });

  it('returns 503 message for "Service Unavailable" without status code', () => {
    expect(
      mapMutationError(new Error('Service Unavailable response from API')),
    ).toBe(FRIENDLY_ERROR_GEMINI_503);
  });

  it('returns quota message when "quota" appears in message', () => {
    expect(mapMutationError(new Error('quota exceeded for project'))).toBe(
      FRIENDLY_ERROR_GEMINI_QUOTA,
    );
  });

  it('returns rate-limit message for 429 error', () => {
    expect(mapMutationError(new Error('429 Too Many Requests'))).toBe(
      FRIENDLY_ERROR_GEMINI_RATELIMIT,
    );
  });

  it('returns rate-limit message for "rate-limit" in message', () => {
    expect(mapMutationError(new Error('API rate-limit reached'))).toBe(
      FRIENDLY_ERROR_GEMINI_RATELIMIT,
    );
  });

  it('returns rate-limit message for "rate limit" (space) in message', () => {
    expect(mapMutationError(new Error('exceeded rate limit'))).toBe(
      FRIENDLY_ERROR_GEMINI_RATELIMIT,
    );
  });

  it('quota takes precedence over 429 in message', () => {
    // Edge case: message contains both "quota" and "429" — quota wins (checked first)
    expect(mapMutationError(new Error('429 quota exceeded'))).toBe(
      FRIENDLY_ERROR_GEMINI_QUOTA,
    );
  });

  it('truncates a long generic error to 120 chars', () => {
    const longMessage = 'A'.repeat(200);
    const result = mapMutationError(new Error(longMessage));
    expect(result).toHaveLength(120);
    expect(result).toBe('A'.repeat(120));
  });

  it('returns unknown message for null', () => {
    expect(mapMutationError(null)).toBe(FRIENDLY_ERROR_UNKNOWN);
  });

  it('returns unknown message for undefined', () => {
    expect(mapMutationError(undefined)).toBe(FRIENDLY_ERROR_UNKNOWN);
  });

  it('returns unknown message for Error with empty message', () => {
    expect(mapMutationError(new Error(''))).toBe(FRIENDLY_ERROR_UNKNOWN);
  });

  it('handles plain string error (not an Error instance)', () => {
    const result = mapMutationError('Something went wrong with the request');
    expect(result).toBe('Something went wrong with the request');
  });
});

describe('exported constants', () => {
  it('FRIENDLY_ERROR_GEMINI_FALLBACK is exported for Plan 04 consumption', () => {
    expect(typeof FRIENDLY_ERROR_GEMINI_FALLBACK).toBe('string');
    expect(FRIENDLY_ERROR_GEMINI_FALLBACK).toContain('fallback model gebruikt');
  });
});
