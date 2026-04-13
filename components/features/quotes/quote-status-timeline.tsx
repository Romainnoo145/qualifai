/**
 * QuoteStatusTimeline — ADMIN-06.
 *
 * 4-slot timeline reading `createdAt` + `snapshotAt` from the Quote row.
 * `viewedAt` + `acceptedAt` remain placeholder slots in Phase 61 (those
 * columns land in Phase 62). Dutch locale date formatting.
 */

import { cn } from '@/lib/utils';

interface Props {
  createdAt: Date | string;
  snapshotAt: Date | string | null;
  viewedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
}

const FORMATTER = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatOrPlaceholder(value: Date | string | null | undefined): string {
  if (!value) return '— nog niet';
  return FORMATTER.format(new Date(value));
}

export function QuoteStatusTimeline({
  createdAt,
  snapshotAt,
  viewedAt = null,
  acceptedAt = null,
}: Props) {
  const slots: { label: string; value: Date | string | null | undefined }[] = [
    { label: 'Aangemaakt', value: createdAt },
    { label: 'Verstuurd', value: snapshotAt },
    { label: 'Bekeken', value: viewedAt },
    { label: 'Geaccepteerd', value: acceptedAt },
  ];

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500">
        Tijdlijn
      </h3>
      <ol className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {slots.map((slot) => {
          const filled = Boolean(slot.value);
          return (
            <li key={slot.label} className="flex flex-col gap-1">
              <span
                className={cn(
                  'text-xs font-bold uppercase tracking-wide',
                  filled ? 'text-[#040026]' : 'text-slate-400',
                )}
              >
                {slot.label}
              </span>
              <span
                className={cn(
                  'text-sm',
                  filled
                    ? 'font-black text-[#040026]'
                    : 'font-semibold text-slate-400',
                )}
              >
                {formatOrPlaceholder(slot.value)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-slate-400">
        Bekeken en Geaccepteerd worden vanaf Phase 62 automatisch bijgewerkt.
      </p>
    </div>
  );
}
