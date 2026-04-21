import { describe, it, expect } from 'vitest';
import { normalizeSnippet, computeContentHash } from './research-executor';

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
