/**
 * Tests for EnrichmentNoCoverageError — Phase 61.2 Plan 01
 *
 * RED phase: these tests fail before the implementation is added.
 * GREEN phase: EnrichmentNoCoverageError class + 422 detection in
 *   enrichCompanyWithFallbackQueries + noCoverageCount handling in
 *   runWithWaterfall all need to be in place.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/env.mjs', () => ({
  env: {
    APOLLO_API_KEY: 'test-key',
    ENRICHMENT_PROVIDER: 'apollo',
    ENRICHMENT_MEMORY_CACHE_TTL_SECONDS: 900,
    ENRICHMENT_SEARCH_CACHE_TTL_SECONDS: 240,
    ENRICHMENT_CACHE_MAX_ENTRIES: 1500,
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    creditUsage: { create: vi.fn().mockResolvedValue({}) },
  },
}));

// We need to control fetch so Apollo HTTP calls return specific status codes.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Use fake timers so rateLimitWait + backoff delays don't slow down tests.
vi.useFakeTimers();

describe('EnrichmentNoCoverageError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache so each test gets a fresh import (avoids in-flight dedup)
    vi.resetModules();
  });

  it('Test 1: enrichCompanyWithFallbackQueries throws EnrichmentNoCoverageError on all-422 responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({ error: "Required parameter 'domain' missing" }),
    });

    const { apolloProvider, EnrichmentNoCoverageError } =
      await import('@/lib/enrichment/providers/apollo');

    if (!apolloProvider.enrichCompany)
      throw new Error('enrichCompany not defined');

    let caught: unknown;
    const promise = apolloProvider
      .enrichCompany('marfa.nl')
      .catch((err: unknown) => {
        caught = err;
      });
    // Advance all pending timers (rateLimitWait)
    await vi.runAllTimersAsync();
    await promise;

    expect(caught).toBeInstanceOf(EnrichmentNoCoverageError);
  }, 15_000);

  it('Test 2: enrichCompanyWithFallbackQueries throws original error on non-422 responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: async () => 'Bad Request',
    });

    const { apolloProvider, EnrichmentNoCoverageError } =
      await import('@/lib/enrichment/providers/apollo');

    if (!apolloProvider.enrichCompany)
      throw new Error('enrichCompany not defined');

    // Catch immediately to avoid unhandled rejection — then verify after timers
    let caught: unknown;
    const promise = apolloProvider
      .enrichCompany('marfa.nl')
      .catch((err: unknown) => {
        caught = err;
      });
    await vi.runAllTimersAsync();
    await promise;

    // Must NOT be a no-coverage error
    expect(caught).not.toBeInstanceOf(EnrichmentNoCoverageError);
    // Must be a regular Error with the Apollo message
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('400');
  }, 15_000);

  it('Test 3: runWithWaterfall returns minimal EnrichedCompanyData when all providers throw EnrichmentNoCoverageError', async () => {
    // 422 -> enrichCompanyWithFallbackQueries throws EnrichmentNoCoverageError
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({ error: "Required parameter 'domain' missing" }),
    });

    const { enrichCompany } = await import('@/lib/enrichment/service');

    const promise = enrichCompany('marfa.nl');
    await vi.runAllTimersAsync();
    const result = await promise;

    // Must return minimal data, NOT throw
    expect(result).toBeDefined();
    expect(result.domain).toBe('marfa.nl');
    expect(result.companyName).toBeNull();
    expect(result.industry).toBeNull();
    expect(result.description).toBeNull();
  }, 15_000);

  it('Test 4: runWithWaterfall still throws combined error when a provider throws a generic Error', async () => {
    // 500 = generic non-422 error — should still be a hard failure
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: async () => 'Internal Server Error',
    });

    const { enrichCompany } = await import('@/lib/enrichment/service');

    let caught: unknown;
    const promise = enrichCompany('marfa.nl').catch((err: unknown) => {
      caught = err;
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/all providers failed/);
  }, 15_000);
});
