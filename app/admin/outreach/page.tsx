'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Mail,
  Check,
  X,
  Building2,
  Loader2,
  Send,
  History,
  MessageSquare,
  Phone,
  Linkedin,
  Save,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useDelayedLoading } from '@/lib/hooks/use-delayed-loading';
import {
  OutreachQueueSkeleton,
  OutreachSettingsSkeleton,
} from '@/components/features/outreach/outreach-skeleton';

type View = 'queue' | 'sent' | 'settings';

export default function OutreachPage() {
  const [view, setView] = useState<View>('queue');

  return (
    <div className="max-w-[1400px] space-y-10">
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Outreach<span className="text-[var(--color-gold)]">.</span>
        </h1>
        <ProcessSignalsButton />
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('queue')}
          className={cn(
            'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
            view === 'queue'
              ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
              : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
          )}
        >
          Drafts Queue
        </button>
        <button
          onClick={() => setView('sent')}
          className={cn(
            'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
            view === 'sent'
              ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
              : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
          )}
        >
          Sent History
        </button>
        <button
          onClick={() => setView('settings')}
          className={cn(
            'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
            view === 'settings'
              ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
              : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
          )}
        >
          Instellingen
        </button>
      </div>

      {view === 'queue' ? (
        <DraftQueue />
      ) : view === 'sent' ? (
        <SentHistory />
      ) : (
        <OutreachSettings />
      )}
    </div>
  );
}

function ProcessSignalsButton() {
  const utils = api.useUtils();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const process = (api.outreach.processSignals as any).useMutation({
    onSuccess: () => {
      utils.outreach.getDecisionInbox.invalidate();
    },
  });

  return (
    <button
      onClick={() => process.mutate()}
      disabled={process.isPending}
      className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
    >
      {process.isPending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Processing...
        </>
      ) : (
        <>
          <Send className="w-4 h-4" /> Process Signals
        </>
      )}
    </button>
  );
}

function ReminderSection() {
  const reminders = api.outreach.getReminders.useQuery({
    status: 'open',
    limit: 50,
  });
  const utils = api.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const complete = (api.outreach.completeTouchTask as any).useMutation({
    onSuccess: () => {
      utils.outreach.getReminders.invalidate();
      utils.outreach.getDecisionInbox.invalidate();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skip = (api.outreach.skipTouchTask as any).useMutation({
    onSuccess: () => {
      utils.outreach.getReminders.invalidate();
      utils.outreach.getDecisionInbox.invalidate();
    },
  });

  const items = (reminders.data?.items ?? []) as Array<any>;
  if (reminders.isLoading || items.length === 0) return null;

  const channelIcon = (channel: string) => {
    switch (channel) {
      case 'call':
        return <Phone className="w-3.5 h-3.5" />;
      case 'linkedin':
        return <Linkedin className="w-3.5 h-3.5" />;
      case 'whatsapp':
        return <MessageSquare className="w-3.5 h-3.5" />;
      default:
        return <Phone className="w-3.5 h-3.5" />;
    }
  };

  const channelLabel = (channel: string) => {
    switch (channel) {
      case 'call':
        return 'Bellen';
      case 'linkedin':
        return 'LinkedIn';
      case 'whatsapp':
        return 'WhatsApp';
      default:
        return channel;
    }
  };

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
          Reminders
        </span>
        <span className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      <div className="space-y-1.5">
        {items.map((item: any) => {
          // eslint-disable-next-line react-hooks/purity -- pre-existing reminder list, Date.now() is stable enough for due-date comparison
          const now = Date.now();
          const dueAt = item.task?.dueAt ? new Date(item.task.dueAt) : null;
          const isOverdue = dueAt !== null && dueAt.getTime() < now;
          const notes = item.task?.notes ?? item.subject;

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 py-3 border-b border-[var(--color-surface-2)]"
            >
              <Link
                href={`/admin/contacts/${item.contact.id}`}
                className="flex-1 min-w-0 flex items-center gap-3 hover:text-[#007AFF] transition-colors"
              >
                <span className="text-[13px] font-medium text-[var(--color-ink)] truncate">
                  {item.contact.firstName} {item.contact.lastName}
                </span>
                {item.contact.prospect && (
                  <span className="admin-meta-text text-[11px] truncate hidden sm:inline">
                    {item.contact.prospect.companyName ??
                      item.contact.prospect.domain}
                  </span>
                )}
              </Link>

              <span
                className={cn(
                  'admin-state-pill text-[10px] flex items-center gap-1',
                  item.channel === 'linkedin'
                    ? 'bg-blue-50 text-blue-700'
                    : item.channel === 'whatsapp'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-slate-100 text-slate-600',
                )}
              >
                {channelIcon(item.channel)}
                {channelLabel(item.channel)}
              </span>

              {dueAt && (
                <span
                  className={cn(
                    'admin-meta-text text-[10px] hidden md:inline',
                    isOverdue && 'text-amber-600 font-bold',
                  )}
                >
                  {isOverdue ? 'Overdue' : dueAt.toLocaleDateString()}
                </span>
              )}

              {notes && (
                <span className="admin-meta-text text-[10px] truncate max-w-[160px] hidden lg:inline">
                  {notes}
                </span>
              )}

              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    complete.mutate({ id: item.id });
                  }}
                  disabled={complete.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-ink)] transition-all disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Done
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    skip.mutate({ id: item.id });
                  }}
                  disabled={skip.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[#b45a3b] hover:border-[#b45a3b] transition-all disabled:opacity-50"
                >
                  <X className="w-3 h-3" /> Skip
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupByDate<T extends { createdAt: string | Date }>(
  items: T[],
): { label: string; items: T[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const date = new Date(item.createdAt);
    date.setHours(0, 0, 0, 0);
    let label: string;
    if (date.getTime() === today.getTime()) {
      label = 'Vandaag';
    } else if (date.getTime() === tomorrow.getTime()) {
      label = 'Morgen';
    } else {
      label = date.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    const existing = buckets.get(label) ?? [];
    existing.push(item);
    buckets.set(label, existing);
  }

  return Array.from(buckets.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

const KIND_LABELS: Record<string, string> = {
  intro_draft: 'Intro',
  cadence_draft: 'Follow-up',
  signal_draft: 'Signaal',
};

function DraftQueue() {
  const queue = api.outreach.getDecisionInbox.useQuery({ limit: 150 });
  const utils = api.useUtils();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regenerate = (api.outreach.regenerateDraft as any).useMutation({
    onSuccess: () => {
      utils.outreach.getDecisionInbox.invalidate();
      setRegeneratingId(null);
    },
    onError: () => setRegeneratingId(null),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approve = (api.outreach.approveDraft as any).useMutation({
    onSuccess: () => {
      utils.outreach.getDecisionInbox.invalidate();
      utils.outreach.getHistory.invalidate();
      utils.admin.getDashboardActions.invalidate();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reject = (api.outreach.rejectDraft as any).useMutation({
    onSuccess: () => {
      utils.outreach.getDecisionInbox.invalidate();
      utils.admin.getDashboardActions.invalidate();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bulkApprove = (api.outreach.bulkApproveLowRisk as any).useMutation({
    onSuccess: () => {
      utils.outreach.getDecisionInbox.invalidate();
      utils.outreach.getHistory.invalidate();
      utils.admin.getDashboardActions.invalidate();
    },
  });

  const showQueueSkeleton = useDelayedLoading(queue.isLoading);
  if (queue.isLoading) {
    return showQueueSkeleton ? <OutreachQueueSkeleton /> : null;
  }

  const queueData = queue.data;
  if (!queueData) return null;

  if (!queueData.drafts?.length) {
    return (
      <div className="py-20 text-center">
        <Mail className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
        <p className="text-[15px] font-medium text-[var(--color-ink)] mb-1">
          Inbox leeg
        </p>
        <p className="text-[13px] font-light text-[var(--color-muted)]">
          Geen concepten om te beoordelen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-light text-[var(--color-muted)]">
          {queueData.summary.total} concept
          {queueData.summary.total !== 1 ? 'en' : ''}
        </span>
        <button
          onClick={() => bulkApprove.mutate({ limit: 25 })}
          disabled={bulkApprove.isPending || queueData.summary.lowRisk === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] disabled:opacity-50 transition-all"
        >
          {bulkApprove.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Verstuur alle ({queueData.summary.lowRisk})
        </button>
      </div>

      <ReminderSection />

      {/* Gmail-style inbox */}
      <div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {groupByDate(queueData.drafts as any[]).map((group) => (
          <div key={group.label}>
            <div className="py-3 border-b border-[var(--color-surface-2)]">
              <span className="text-[10px] font-bold text-[var(--color-gold)] uppercase tracking-[0.15em]">
                {group.label}
              </span>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {group.items.map((draft: any) => {
              const isExpanded = expandedId === draft.id;
              const toName = [draft.contact.firstName, draft.contact.lastName]
                .filter(Boolean)
                .join(' ');
              const toEmail =
                draft.contact.primaryEmail ?? draft.contact.emails?.[0] ?? '';
              const companyName =
                draft.contact.prospect?.companyName ??
                draft.contact.prospect?.domain ??
                '';
              const previewText =
                draft.bodyText?.slice(0, 120)?.replace(/\n/g, ' ') ?? '';
              const kind = (draft.metadata as Record<string, unknown>)?.kind as
                | string
                | undefined;
              const kindLabel = kind ? (KIND_LABELS[kind] ?? 'Email') : 'Email';

              return (
                <div key={draft.id}>
                  {/* Inbox row — click to expand */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                    className={cn(
                      'w-full text-left py-3.5 flex items-center gap-4 hover:pl-1.5 transition-all',
                      isExpanded && 'pl-1.5',
                    )}
                  >
                    {/* Company logo */}
                    <div className="w-9 h-9 rounded-[8px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
                      {draft.contact.prospect?.logoUrl ? (
                        <img
                          src={draft.contact.prospect.logoUrl}
                          alt=""
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 text-[var(--color-border-strong)]" />
                      )}
                    </div>

                    {/* From / Company */}
                    <div className="w-44 shrink-0 min-w-0">
                      <Link
                        href={`/admin/prospects/${draft.contact.prospect?.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[13px] font-medium text-[var(--color-ink)] truncate hover:text-[var(--color-gold)] transition-colors"
                      >
                        {companyName}
                      </Link>
                      <p className="text-[11px] font-light text-[var(--color-muted)] truncate">
                        {toName}
                      </p>
                    </div>

                    {/* Subject + preview */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--color-ink)] truncate">
                        {draft.subject}
                      </p>
                      <p className="text-[12px] font-light text-[var(--color-muted)] truncate">
                        {previewText}
                      </p>
                    </div>

                    {/* Kind chip + Timestamp */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'text-[9px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded border shrink-0',
                          kind === 'signal_draft'
                            ? 'bg-[var(--color-tag-outreach-bg)] text-[var(--color-tag-outreach-text)] border-[var(--color-tag-outreach-border)]'
                            : kind === 'cadence_draft'
                              ? 'bg-[var(--color-tag-run-bg)] text-[var(--color-tag-run-text)] border-[var(--color-tag-run-border)]'
                              : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-border)]',
                        )}
                      >
                        {kindLabel}
                      </span>
                      <span className="text-[10px] font-medium text-[var(--color-muted)] tabular-nums">
                        {new Date(draft.createdAt).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </button>

                  {/* Expanded email view */}
                  {isExpanded && (
                    <div className="py-6 border-b border-[var(--color-border)]">
                      {/* Email header */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
                            <span className="font-medium text-[var(--color-muted)]">
                              Van
                            </span>
                            <span className="font-medium text-[var(--color-ink)]">
                              Romano Kanters &lt;info@klarifai.nl&gt;
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
                            <span className="font-medium text-[var(--color-muted)]">
                              Aan
                            </span>
                            <span className="font-medium text-[var(--color-ink)]">
                              {toName}
                              {toEmail ? ` <${toEmail}>` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-[var(--color-muted)]">
                            <span className="font-medium text-[var(--color-muted)]">
                              Onderwerp
                            </span>
                            <span className="font-medium text-[var(--color-ink)]">
                              {draft.subject}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              const isEn =
                                (draft.metadata as Record<string, unknown>)
                                  ?.language === 'en';
                              setRegeneratingId(draft.id);
                              regenerate.mutate({
                                draftId: draft.id,
                                language: isEn ? 'nl' : 'en',
                              });
                            }}
                            disabled={regeneratingId === draft.id}
                            className={cn(
                              'ui-tap inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all disabled:opacity-50',
                              (draft.metadata as Record<string, unknown>)
                                ?.language === 'en'
                                ? 'bg-[#040026] text-white border-[#040026]'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300',
                            )}
                          >
                            {regeneratingId === draft.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            EN
                          </button>
                          <button
                            onClick={() => approve.mutate({ id: draft.id })}
                            disabled={approve.isPending}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] transition-all disabled:opacity-50"
                          >
                            {approve.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Verstuur
                          </button>
                          <button
                            onClick={() => reject.mutate({ id: draft.id })}
                            disabled={reject.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-[10px] font-medium uppercase tracking-[0.08em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:text-[#b45a3b] hover:border-[#b45a3b] transition-all disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> Verwijder
                          </button>
                        </div>
                      </div>

                      {/* Email body */}
                      <div className="max-w-[620px]">
                        {draft.bodyHtml ? (
                          <div
                            className="text-[14px] font-light text-[var(--color-muted-dark)] leading-[1.65] max-w-none"
                            dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
                          />
                        ) : (
                          <pre className="text-[14px] font-light text-[var(--color-muted-dark)] leading-[1.65] whitespace-pre-wrap font-[inherit]">
                            {draft.bodyText}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SentHistory() {
  const history = api.outreach.getHistory.useQuery({ limit: 50 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="py-4 animate-pulse">
            <div className="h-5 bg-[var(--color-surface-2)] rounded w-64" />
          </div>
        ))}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (history.data ?? []) as any[];

  if (logs.length === 0) {
    return (
      <div className="py-20 text-center">
        <History className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
        <p className="text-[15px] font-medium text-[var(--color-ink)] mb-1">
          No outreach history yet
        </p>
        <p className="text-[13px] font-light text-[var(--color-muted)]">
          Verzonden interacties verschijnen hier zodra de eerste run live gaat.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
          Verzonden
        </span>
        <span className="flex-1 h-px bg-[var(--color-border)]" />
      </div>
      {logs.map((log: any) => {
        const isExpanded = expandedId === log.id;
        const toName = [log.contact?.firstName, log.contact?.lastName]
          .filter(Boolean)
          .join(' ');
        const toEmail = log.contact?.primaryEmail ?? '';
        const companyName = log.contact?.prospect?.companyName ?? '';
        const sentDate = new Date(log.createdAt);

        return (
          <div key={log.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className={cn(
                'w-full text-left flex items-center gap-4 py-3.5 border-b border-[var(--color-surface-2)] hover:pl-1.5 transition-all',
                isExpanded && 'pl-1.5',
              )}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  log.status === 'sent'
                    ? 'bg-[var(--color-brand-success)]'
                    : log.status === 'failed'
                      ? 'bg-[var(--color-brand-danger)]'
                      : 'bg-[var(--color-border-strong)]',
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-medium text-[var(--color-ink)]">
                    {companyName || toName}
                  </span>
                  {companyName && toName && (
                    <span className="text-[11px] font-light text-[var(--color-muted)]">
                      {toName}
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-light text-[var(--color-muted)] truncate mt-0.5">
                  {log.subject}
                </p>
              </div>
              <span className="text-[10px] font-medium text-[var(--color-muted)] tabular-nums shrink-0">
                {sentDate.toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </button>

            {isExpanded && (
              <div className="py-6 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2 text-[12px] text-[var(--color-muted)] mb-4">
                  <span className="font-medium">Aan:</span>
                  <span className="font-medium text-[var(--color-ink)]">
                    {toName}
                    {toEmail ? ` <${toEmail}>` : ''}
                  </span>
                  <span className="ml-auto text-[10px] font-medium tabular-nums">
                    {sentDate.toLocaleDateString('nl-NL')}{' '}
                    {sentDate.toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {log.subject && (
                  <h3 className="text-[18px] font-medium text-[var(--color-ink)] tracking-[-0.01em] mb-4">
                    {log.subject}
                  </h3>
                )}
                <div className="max-w-[620px]">
                  {log.bodyHtml ? (
                    <div
                      className="text-[14px] font-light text-[var(--color-muted-dark)] leading-[1.65]"
                      dangerouslySetInnerHTML={{ __html: log.bodyHtml }}
                    />
                  ) : log.bodyText ? (
                    <pre className="text-[14px] font-light text-[var(--color-muted-dark)] leading-[1.65] whitespace-pre-wrap font-[inherit]">
                      {log.bodyText}
                    </pre>
                  ) : (
                    <p className="text-[13px] font-light text-[var(--color-muted)] italic">
                      Geen email body beschikbaar.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const OUTREACH_STYLES = [
  {
    id: 'machiavelli',
    label: 'Machiavelli',
    description:
      'Strategisch, feiten als wapen, discover page als lokaas. Gecontroleerde exits.',
    tone: 'Strategisch en beheerst. Elke zin dient een doel. Gebruik feiten, cijfers en concrete projecten als hefboom. Verwijs naar de persoonlijke discover page als voorproefje. Geen smalltalk, geen opvulzinnen. Geef de ontvanger een uitweg — maar jij kiest welke.',
  },
  {
    id: 'professioneel',
    label: 'Professioneel',
    description:
      'Formeel, warm Europees, standaard B2B. Respectvol en uitnodigend.',
    tone: 'Professioneel en warm. Europese zakelijke toon — respectvol, niet opdringerig. Open met relevantie voor hun bedrijf, sluit af met een uitnodigende CTA. Geen uitroeptekens, geen hype.',
  },
  {
    id: 'direct',
    label: 'Direct',
    description: "Kort, geen opsmuk, to the point. Maximaal 3 alinea's.",
    tone: "Ultra-direct. Maximaal 3 korte alinea's. Geen inleiding, geen opbouw — begin met de kern. Eindig met een ja/nee CTA. Tijd van de ontvanger respecteren door bondigheid.",
  },
  {
    id: 'partnership',
    label: 'Partnership',
    description:
      'Samenwerking, wederzijdse waarde. Ideaal voor consortia en joint ventures.',
    tone: 'Partnership-gericht. Benadruk wederzijdse waarde en gedeelde doelen. Positioneer als gelijkwaardige partner, niet als verkoper. Verwijs naar concrete synergiën tussen beide organisaties.',
  },
];

function OutreachSettings() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (api.admin.getOutreachSettings as any).useQuery();
  const utils = api.useUtils();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update = (api.admin.updateOutreachSettings as any).useMutation({
    onSuccess: () => {
      utils.admin.getOutreachSettings.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [toneId, setToneId] = useState('machiavelli');
  const [companyPitch, setCompanyPitch] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [expandedInfo, setExpandedInfo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Populate form when data loads
  if (settings.data && !initialized) {
    const d = settings.data as Record<string, string>;
    setFromName(d.fromName ?? '');
    setFromEmail(d.fromEmail ?? '');
    // Match saved tone text to a style ID, default to machiavelli
    const savedTone = d.tone ?? '';
    const matched = OUTREACH_STYLES.find((s) => s.tone === savedTone);
    setToneId(matched?.id ?? 'machiavelli');
    setCompanyPitch(d.companyPitch ?? '');
    setSignatureHtml(d.signatureHtml ?? '');
    setInitialized(true);
  }

  const showSettingsSkeleton = useDelayedLoading(settings.isLoading);
  if (settings.isLoading) {
    return showSettingsSkeleton ? <OutreachSettingsSkeleton /> : null;
  }

  const handleSave = () => {
    const selectedStyle = OUTREACH_STYLES.find((s) => s.id === toneId);
    // Auto-derive plaintext from HTML
    const autoPlaintext = signatureHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
    update.mutate({
      fromName,
      fromEmail,
      replyTo: fromEmail,
      tone: selectedStyle?.tone ?? '',
      companyPitch,
      signatureHtml,
      signatureText: autoPlaintext,
    });
  };

  return (
    <div className="space-y-4">
      {/* Email Identity */}
      <div className="space-y-4 pb-8 border-b border-[var(--color-surface-2)]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
            Email Identiteit
          </span>
          <span className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">
              Naam afzender
            </label>
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Romano Kanters"
              className="w-full px-4 py-2.5 input-minimal text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">
              Email adres
            </label>
            <input
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="info@klarifai.nl"
              className="w-full px-4 py-2.5 input-minimal text-sm"
            />
          </div>
        </div>
      </div>

      {/* Outreach Style */}
      <div className="space-y-4 pb-8 border-b border-[var(--color-surface-2)]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
            Outreach Stijl
          </span>
          <span className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {OUTREACH_STYLES.map((style) => (
            <div
              key={style.id}
              role="button"
              tabIndex={0}
              onClick={() => setToneId(style.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setToneId(style.id);
              }}
              className={cn(
                'relative text-left rounded-md border p-4 transition-all cursor-pointer',
                toneId === style.id
                  ? 'border-[var(--color-ink)] bg-transparent'
                  : 'border-[var(--color-border)] bg-transparent hover:border-[var(--color-border-strong)]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-ink)]">
                    {style.label}
                  </p>
                  <p className="text-[11px] font-light text-[var(--color-muted)] mt-1 leading-snug">
                    {style.description}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedInfo(
                      expandedInfo === style.id ? null : style.id,
                    );
                  }}
                  className="ui-tap shrink-0 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  <Info className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              {expandedInfo === style.id && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {style.tone}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Signature */}
      <div className="space-y-4 pb-8 border-b border-[var(--color-surface-2)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
              Handtekening
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors ml-4"
          >
            {showPreview ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {showPreview ? 'Editor' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          <div className="max-w-[620px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-3">
              HTML Preview
            </p>
            <div
              className="text-sm text-slate-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: signatureHtml }}
            />
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">
              HTML handtekening
            </label>
            <textarea
              value={signatureHtml}
              onChange={(e) => setSignatureHtml(e.target.value)}
              rows={10}
              placeholder='<p style="margin-top:24px;">Met vriendelijke groet,</p>...'
              className="w-full px-4 py-2.5 input-minimal text-xs font-mono resize-none"
            />
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] transition-all disabled:opacity-50"
        >
          {update.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Opslaan
        </button>
        {saved && (
          <span className="text-xs font-bold text-emerald-600 animate-fade-in-up">
            Opgeslagen
          </span>
        )}
      </div>
    </div>
  );
}
