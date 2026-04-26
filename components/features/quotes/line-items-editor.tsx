'use client';

import { Plus, Trash2 } from 'lucide-react';
import { computeQuoteTotals, formatEuro } from '@/lib/quotes/quote-totals';

export interface LineItemDraft {
  omschrijving: string;
  uren: number;
  tarief: number;
}

interface LineItemsEditorProps {
  lines: LineItemDraft[];
  btwPercentage: number;
  isReadOnly: boolean;
  onChange: (lines: LineItemDraft[]) => void;
}

export function LineItemsEditor({
  lines,
  btwPercentage,
  isReadOnly,
  onChange,
}: LineItemsEditorProps) {
  const totals = computeQuoteTotals(
    lines.map((l) => ({ uren: l.uren, tarief: l.tarief })),
    btwPercentage,
  );

  const updateLine = (index: number, patch: Partial<LineItemDraft>) => {
    const next = lines.map((l, i) => (i === index ? { ...l, ...patch } : l));
    onChange(next);
  };

  const addLine = () => {
    onChange([...lines, { omschrijving: '', uren: 0, tarief: 80 }]);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Omschrijving
            </th>
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-right w-[80px]">
              Uren
            </th>
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-right w-[100px]">
              Tarief
            </th>
            <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-right w-[120px]">
              Subtotaal
            </th>
            {!isReadOnly && <th className="w-[40px]" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-[var(--color-border)]">
              <td className="py-2 pr-4">
                {isReadOnly ? (
                  <span className="text-[var(--color-ink)]">
                    {line.omschrijving || '—'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={line.omschrijving}
                    onChange={(e) =>
                      updateLine(i, { omschrijving: e.target.value })
                    }
                    placeholder="Wat wordt opgeleverd"
                    className="w-full bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)] focus:bg-[var(--color-surface-2)] rounded px-2 py-1 -mx-2 transition-colors"
                  />
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {isReadOnly ? (
                  <span className="tabular-nums text-[var(--color-ink)]">
                    {line.uren}
                  </span>
                ) : (
                  <input
                    type="number"
                    value={line.uren}
                    onChange={(e) =>
                      updateLine(i, { uren: Number(e.target.value) || 0 })
                    }
                    min={0}
                    className="w-full bg-transparent text-right text-[var(--color-ink)] tabular-nums outline-none focus:bg-[var(--color-surface-2)] rounded px-2 py-1 transition-colors"
                  />
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                {isReadOnly ? (
                  <span className="tabular-nums text-[var(--color-ink)]">
                    €{line.tarief}
                  </span>
                ) : (
                  <input
                    type="number"
                    value={line.tarief}
                    onChange={(e) =>
                      updateLine(i, { tarief: Number(e.target.value) || 0 })
                    }
                    min={0}
                    className="w-full bg-transparent text-right text-[var(--color-ink)] tabular-nums outline-none focus:bg-[var(--color-surface-2)] rounded px-2 py-1 transition-colors"
                  />
                )}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums font-medium text-[var(--color-ink)]">
                {formatEuro(line.uren * line.tarief)}
              </td>
              {!isReadOnly && (
                <td className="py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-[var(--color-muted)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!isReadOnly && (
        <button
          type="button"
          onClick={addLine}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Regel toevoegen
        </button>
      )}

      {/* Totals */}
      <div className="mt-6 border-t border-[var(--color-border)] pt-4 ml-auto w-[280px] space-y-2">
        <div className="flex justify-between text-[12px]">
          <span className="uppercase tracking-wider text-[var(--color-muted)]">
            Subtotaal
          </span>
          <span className="tabular-nums text-[var(--color-ink)]">
            {formatEuro(totals.netto)}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="uppercase tracking-wider text-[var(--color-muted)]">
            BTW {btwPercentage}%
          </span>
          <span className="tabular-nums text-[var(--color-ink)]">
            {formatEuro(totals.btw)}
          </span>
        </div>
        <div className="flex justify-between text-[14px] font-medium border-t-2 border-[var(--color-gold)] pt-2">
          <span className="uppercase tracking-wider text-[var(--color-ink)]">
            Totaal incl. BTW
          </span>
          <span className="tabular-nums text-[var(--color-ink)]">
            {formatEuro(totals.bruto)}
          </span>
        </div>
      </div>
    </div>
  );
}
