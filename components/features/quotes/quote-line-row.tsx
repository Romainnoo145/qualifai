'use client';

/**
 * QuoteLineRow — single editable quote line with up/down/remove controls.
 *
 * Tarief is SIGNED. Negative values are allowed for discount lines
 * (Phase 60 Pitfall 5 — OFF003 Pakketkorting line stores a negative tarief).
 * Do NOT clamp the tarief input to non-negative values.
 */

import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

export interface LineDraft {
  fase: string;
  omschrijving: string;
  oplevering: string;
  uren: number;
  tarief: number; // SIGNED — negatives allowed (discount lines)
}

interface Props {
  line: LineDraft;
  index: number;
  onChange: (patch: Partial<LineDraft>) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export function QuoteLineRow({
  line,
  index,
  onChange,
  onUp,
  onDown,
  onRemove,
  disabled,
  isFirst,
  isLast,
}: Props) {
  return (
    <div className="glass-card p-6" data-testid={`quote-line-row-${index}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onUp}
            disabled={disabled || isFirst}
            className="p-1 disabled:opacity-30"
            aria-label="Omhoog"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDown}
            disabled={disabled || isLast}
            className="p-1 disabled:opacity-30"
            aria-label="Omlaag"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-4">
          <input
            className="input-minimal col-span-2"
            placeholder="Fase (bv. Discovery & architectuur)"
            value={line.fase}
            onChange={(e) => onChange({ fase: e.target.value })}
            disabled={disabled}
            aria-label={`Fase regel ${index + 1}`}
          />
          <input
            type="number"
            className="input-minimal"
            placeholder="Uren"
            value={line.uren}
            min={0}
            onChange={(e) => onChange({ uren: Number(e.target.value) || 0 })}
            disabled={disabled}
            aria-label={`Uren regel ${index + 1}`}
          />
          {/* SIGNED — negative tarief allowed for discount lines. Do NOT clamp to non-negative. */}
          <input
            type="number"
            className="input-minimal"
            placeholder="Tarief (€)"
            value={line.tarief}
            onChange={(e) => onChange({ tarief: Number(e.target.value) || 0 })}
            disabled={disabled}
            aria-label={`Tarief regel ${index + 1}`}
          />
          <textarea
            className="input-minimal col-span-2"
            rows={2}
            placeholder="Omschrijving"
            value={line.omschrijving}
            onChange={(e) => onChange({ omschrijving: e.target.value })}
            disabled={disabled}
            aria-label={`Omschrijving regel ${index + 1}`}
          />
          <input
            className="input-minimal col-span-2"
            placeholder="Oplevering"
            value={line.oplevering}
            onChange={(e) => onChange({ oplevering: e.target.value })}
            disabled={disabled}
            aria-label={`Oplevering regel ${index + 1}`}
          />
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-30"
            aria-label="Verwijder regel"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
