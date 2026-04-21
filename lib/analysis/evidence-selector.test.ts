import { describe, it, expect } from 'vitest';
import {
  selectEvidenceForPrompt,
  buildSourceBreakdown,
} from './evidence-selector';
import type { EvidenceItem } from './types';

function makeItem(
  sourceType: string,
  confidenceScore: number,
  snippet = 'test snippet',
): EvidenceItem {
  return {
    sourceType,
    sourceUrl: null,
    title: null,
    snippet,
    confidenceScore,
    workflowTag: null,
  };
}

describe('selectEvidenceForPrompt', () => {
  it('returns exactly 20 items from 40 mixed inputs (4 source types × 10)', () => {
    // 4 sources × max 5 per source = 20 exactly
    const items: EvidenceItem[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeItem('WEBSITE', 0.5 + i * 0.01),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeItem('REVIEWS', 0.6 + i * 0.01),
      ),
      ...Array.from({ length: 10 }, (_, i) => makeItem('NEWS', 0.7 + i * 0.01)),
      ...Array.from({ length: 10 }, (_, i) =>
        makeItem('LINKEDIN', 0.8 + i * 0.01),
      ),
    ];
    const result = selectEvidenceForPrompt(items);
    expect(result).toHaveLength(20);
  });

  it('caps WEBSITE items at 5 even when 15 WEBSITE items are provided', () => {
    const items: EvidenceItem[] = [
      ...Array.from({ length: 15 }, (_, i) =>
        makeItem('WEBSITE', 0.9 - i * 0.01),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeItem('REVIEWS', 0.5 + i * 0.01),
      ),
    ];
    const result = selectEvidenceForPrompt(items);
    const websiteCount = result.filter(
      (x) => x.sourceType === 'WEBSITE',
    ).length;
    expect(websiteCount).toBeLessThanOrEqual(5);
  });

  it('returns all items when input has fewer than 20 items', () => {
    const items = [
      makeItem('WEBSITE', 0.8),
      makeItem('REVIEWS', 0.7),
      makeItem('NEWS', 0.6),
    ];
    const result = selectEvidenceForPrompt(items);
    expect(result).toHaveLength(3);
  });

  it('returns empty array for empty input', () => {
    const result = selectEvidenceForPrompt([]);
    expect(result).toHaveLength(0);
  });

  it('caps all items at maxPerSource when all are same sourceType', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem('WEBSITE', 0.9 - i * 0.01),
    );
    const result = selectEvidenceForPrompt(items);
    expect(result).toHaveLength(5);
    expect(result.every((x) => x.sourceType === 'WEBSITE')).toBe(true);
  });

  it('returns items sorted by confidenceScore descending', () => {
    const items = [
      makeItem('WEBSITE', 0.3),
      makeItem('REVIEWS', 0.9),
      makeItem('NEWS', 0.6),
      makeItem('LINKEDIN', 0.8),
      makeItem('REGISTRY', 0.5),
    ];
    const result = selectEvidenceForPrompt(items);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.confidenceScore).toBeGreaterThanOrEqual(
        result[i]!.confidenceScore,
      );
    }
  });

  it('respects custom opts { limit: 10, maxPerSource: 3 }', () => {
    // 4 sources × 3 items each = 12 > limit 10, so exactly 10 returned
    const items: EvidenceItem[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeItem('WEBSITE', 0.9 - i * 0.01),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeItem('REVIEWS', 0.8 - i * 0.01),
      ),
      ...Array.from({ length: 10 }, (_, i) => makeItem('NEWS', 0.7 - i * 0.01)),
      ...Array.from({ length: 10 }, (_, i) =>
        makeItem('LINKEDIN', 0.6 - i * 0.01),
      ),
    ];
    const result = selectEvidenceForPrompt(items, {
      limit: 10,
      maxPerSource: 3,
    });
    expect(result).toHaveLength(10);
    const websiteCount = result.filter(
      (x) => x.sourceType === 'WEBSITE',
    ).length;
    const reviewsCount = result.filter(
      (x) => x.sourceType === 'REVIEWS',
    ).length;
    expect(websiteCount).toBeLessThanOrEqual(3);
    expect(reviewsCount).toBeLessThanOrEqual(3);
  });

  it('does not return more than limit items when all sources have many items', () => {
    const items: EvidenceItem[] = Array.from({ length: 100 }, (_, i) =>
      makeItem(`SOURCE_${i % 10}`, Math.random()),
    );
    const result = selectEvidenceForPrompt(items);
    expect(result.length).toBeLessThanOrEqual(20);
  });
});

describe('buildSourceBreakdown', () => {
  it('returns correct counts for mixed sources', () => {
    const items = [
      ...Array.from({ length: 5 }, () => makeItem('WEBSITE', 0.5)),
      ...Array.from({ length: 3 }, () => makeItem('REVIEWS', 0.6)),
      ...Array.from({ length: 2 }, () => makeItem('NEWS', 0.7)),
    ];
    const result = buildSourceBreakdown(items);
    expect(result).toEqual({ WEBSITE: 5, REVIEWS: 3, NEWS: 2 });
  });

  it('returns empty object for empty input', () => {
    const result = buildSourceBreakdown([]);
    expect(result).toEqual({});
  });
});
