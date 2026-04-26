'use client';

/**
 * QuoteLineList — dynamic list of QuoteLineRow with add/remove/reorder.
 *
 * Exports pure state helpers (addLine/updateLine/removeLine/moveUp/moveDown)
 * so they can be unit-tested without mounting React. Helpers are immutable —
 * they return a NEW array and never mutate the input.
 */

import { Plus } from 'lucide-react';
import { QuoteLineRow, type LineDraft } from './quote-line-row';

export { type LineDraft };

interface Props {
  lines: LineDraft[];
  onChange: (next: LineDraft[]) => void;
  disabled: boolean;
}

export function emptyLine(): LineDraft {
  return { fase: '', omschrijving: '', oplevering: '', uren: 0, tarief: 80 };
}

export function addLine(xs: LineDraft[]): LineDraft[] {
  return [...xs, emptyLine()];
}

export function updateLine(
  xs: LineDraft[],
  idx: number,
  patch: Partial<LineDraft>,
): LineDraft[] {
  return xs.map((x, i) => (i === idx ? { ...x, ...patch } : x));
}

export function removeLine(xs: LineDraft[], idx: number): LineDraft[] {
  return xs.filter((_, i) => i !== idx);
}

export function moveUp(xs: LineDraft[], idx: number): LineDraft[] {
  if (idx <= 0) return xs;
  return [
    ...xs.slice(0, idx - 1),
    xs[idx]!,
    xs[idx - 1]!,
    ...xs.slice(idx + 1),
  ];
}

export function moveDown(xs: LineDraft[], idx: number): LineDraft[] {
  if (idx >= xs.length - 1) return xs;
  return [...xs.slice(0, idx), xs[idx + 1]!, xs[idx]!, ...xs.slice(idx + 2)];
}

export function QuoteLineList({ lines, onChange, disabled }: Props) {
  return (
    <div className="space-y-4">
      {lines.map((line, idx) => (
        <QuoteLineRow
          key={idx}
          line={line}
          index={idx}
          onChange={(patch) => onChange(updateLine(lines, idx, patch))}
          onUp={() => onChange(moveUp(lines, idx))}
          onDown={() => onChange(moveDown(lines, idx))}
          onRemove={() => onChange(removeLine(lines, idx))}
          disabled={disabled}
          isFirst={idx === 0}
          isLast={idx === lines.length - 1}
        />
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange(addLine(lines))}
          className="btn-pill-secondary inline-flex items-center gap-2"
          aria-label="Regel toevoegen"
        >
          <Plus className="h-4 w-4" /> Regel toevoegen
        </button>
      )}
    </div>
  );
}
