import { describe, it, expect } from 'vitest';
import {
  addLine,
  updateLine,
  removeLine,
  moveUp,
  moveDown,
  emptyLine,
  type LineDraft,
} from './quote-line-list';

const L = (fase: string): LineDraft => ({ ...emptyLine(), fase });

describe('QuoteLineList state helpers', () => {
  it('addLine appends an empty row', () => {
    const xs = [L('a'), L('b')];
    const next = addLine(xs);
    expect(next).toHaveLength(3);
    expect(next[0]!.fase).toBe('a');
    expect(next[1]!.fase).toBe('b');
    expect(next[2]!.fase).toBe('');
    expect(next[2]!.uren).toBe(0);
    // Immutability: original is unchanged
    expect(xs).toHaveLength(2);
  });

  it('updateLine patches only the matching index', () => {
    const xs = [L('a'), L('b'), L('c')];
    const next = updateLine(xs, 1, { fase: 'B!', uren: 10 });
    expect(next[0]!.fase).toBe('a');
    expect(next[1]!.fase).toBe('B!');
    expect(next[1]!.uren).toBe(10);
    expect(next[2]!.fase).toBe('c');
    // Immutability
    expect(xs[1]!.fase).toBe('b');
  });

  it('removeLine drops the target index', () => {
    const xs = [L('a'), L('b'), L('c')];
    const next = removeLine(xs, 1);
    expect(next).toHaveLength(2);
    expect(next[0]!.fase).toBe('a');
    expect(next[1]!.fase).toBe('c');
  });

  it('moveUp swaps with previous', () => {
    const xs = [L('a'), L('b'), L('c')];
    const next = moveUp(xs, 2);
    expect(next.map((x) => x.fase)).toEqual(['a', 'c', 'b']);
  });

  it('moveUp on index 0 is a no-op (returns same content)', () => {
    const xs = [L('a'), L('b'), L('c')];
    const next = moveUp(xs, 0);
    expect(next.map((x) => x.fase)).toEqual(['a', 'b', 'c']);
  });

  it('moveDown swaps with next', () => {
    const xs = [L('a'), L('b'), L('c')];
    const next = moveDown(xs, 0);
    expect(next.map((x) => x.fase)).toEqual(['b', 'a', 'c']);
  });

  it('moveDown on last is a no-op (returns same content)', () => {
    const xs = [L('a'), L('b'), L('c')];
    const next = moveDown(xs, 2);
    expect(next.map((x) => x.fase)).toEqual(['a', 'b', 'c']);
  });

  it('preserves negative tarief through updateLine', () => {
    const xs: LineDraft[] = [
      {
        fase: 'Korting',
        omschrijving: '',
        oplevering: '',
        uren: 1,
        tarief: 0,
      },
    ];
    const next = updateLine(xs, 0, { tarief: -800 });
    expect(next[0]!.tarief).toBe(-800);
  });
});
