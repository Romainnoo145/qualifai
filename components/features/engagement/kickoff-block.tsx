'use client';

import { api } from '@/components/providers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function KickoffBlock({ engagement }: { engagement: any }) {
  // TODO: tRPC v11 inference gap — engagement.sendKickoffLink
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendMut = (api.engagement.sendKickoffLink as any).useMutation();
  // TODO: tRPC v11 inference gap — engagement.markKickoffBooked
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markBookedMut = (api.engagement.markKickoffBooked as any).useMutation();

  return (
    <section className="space-y-2">
      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        Kickoff
      </span>
      {engagement.kickoffBookedAt ? (
        <p className="text-[13px] text-[var(--color-ink)]">
          Geboekt op{' '}
          {new Date(engagement.kickoffBookedAt).toLocaleDateString('nl-NL')}
        </p>
      ) : (
        <>
          <p className="text-[13px] text-[var(--color-ink)]">
            Nog niet geboekt
          </p>
          {engagement.kickoffReminderCount > 0 && (
            <p className="text-[12px] text-[var(--color-muted)] mt-1">
              {engagement.kickoffReminderCount} herinnering(en) verzonden
              {engagement.kickoffReminderLastAt &&
                ` · laatste op ${new Date(engagement.kickoffReminderLastAt).toLocaleDateString('nl-NL')}`}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => sendMut.mutate({ engagementId: engagement.id })}
              disabled={sendMut.isPending}
              className="px-3 py-1.5 text-[13px] border border-[var(--color-border)] rounded disabled:opacity-50 hover:bg-zinc-50"
            >
              {sendMut.isPending ? 'Versturen…' : 'Stuur kickoff link opnieuw'}
            </button>
            <button
              onClick={() =>
                markBookedMut.mutate({ engagementId: engagement.id })
              }
              disabled={markBookedMut.isPending}
              className="px-3 py-1.5 text-[13px] border border-[var(--color-border)] rounded disabled:opacity-50 hover:bg-zinc-50"
            >
              {markBookedMut.isPending ? 'Opslaan…' : 'Markeer als geboekt'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
