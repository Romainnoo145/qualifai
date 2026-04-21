import { describe, it, expect } from 'vitest';
import {
  normalizeSnippet,
  computeContentHash,
  passesRelevanceGate,
} from './research-executor';

describe('normalizeSnippet', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeSnippet('  Hello  World!  ')).toBe('hello world!');
  });
  it('normalizes newlines to single space', () => {
    expect(normalizeSnippet('Hello\n\nWorld')).toBe('hello world');
  });
  it('handles empty string', () => {
    expect(normalizeSnippet('')).toBe('');
  });
});

describe('computeContentHash', () => {
  it('returns 64-char hex string', () => {
    const hash = computeContentHash('test snippet');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('same content different whitespace produces same hash', () => {
    expect(computeContentHash('hello world')).toBe(
      computeContentHash('  Hello   World  '),
    );
  });
  it('different content produces different hash', () => {
    expect(computeContentHash('snippet A')).not.toBe(
      computeContentHash('snippet B'),
    );
  });
});

describe('passesRelevanceGate', () => {
  it('drops item with aiRelevance=0.10 for WEBSITE (threshold 0.25)', () => {
    expect(passesRelevanceGate({ aiRelevance: 0.1 }, 'WEBSITE')).toBe(false);
  });

  it('passes item with aiRelevance=0.30 for WEBSITE (threshold 0.25)', () => {
    expect(passesRelevanceGate({ aiRelevance: 0.3 }, 'WEBSITE')).toBe(true);
  });

  it('drops item with aiRelevance=0.40 for REVIEWS (threshold 0.45)', () => {
    expect(passesRelevanceGate({ aiRelevance: 0.4 }, 'REVIEWS')).toBe(false);
  });

  it('passes item with aiRelevance=0.50 for REVIEWS (threshold 0.45)', () => {
    expect(passesRelevanceGate({ aiRelevance: 0.5 }, 'REVIEWS')).toBe(true);
  });

  it('passes item with aiRelevance=0.25 for WEBSITE (boundary — equal to threshold passes)', () => {
    expect(passesRelevanceGate({ aiRelevance: 0.25 }, 'WEBSITE')).toBe(true);
  });

  it('passes item with no aiScore (undefined — scorer failure fallback)', () => {
    expect(passesRelevanceGate(undefined, 'WEBSITE')).toBe(true);
  });

  it('uses DEFAULT_RELEVANCE_THRESHOLD (0.3) for unknown sourceType', () => {
    // 0.29 < 0.3 (default) — should drop
    expect(passesRelevanceGate({ aiRelevance: 0.29 }, 'UNKNOWN_TYPE')).toBe(
      false,
    );
    // 0.30 >= 0.3 (default) — should pass
    expect(passesRelevanceGate({ aiRelevance: 0.3 }, 'UNKNOWN_TYPE')).toBe(
      true,
    );
  });
});
