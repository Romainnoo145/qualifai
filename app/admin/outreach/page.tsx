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
  Settings,
  Save,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { PageLoader } from '@/components/ui/page-loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

type View = 'queue' | 'sent' | 'settings';

export default function OutreachPage() {
  const [view, setView] = useState<View>('queue');

  return (
    <div className="space-y-10 animate-fade-in-up">
      <PageHeader title="Outreach" action={<ProcessSignalsButton />} />

      {/* View toggle */}
      <div className="overflow-x-auto">
        <div className="admin-toggle-group w-max">
          <button
            onClick={() => setView('queue')}
            className={cn(
              'admin-toggle-btn',
              view === 'queue' && 'admin-toggle-btn-active',
            )}
          >
            <Mail className="w-4 h-4" /> Drafts Queue
          </button>
          <button
            onClick={() => setView('sent')}
            className={cn(
              'admin-toggle-btn',
              view === 'sent' && 'admin-toggle-btn-active',
            )}
          >
            <History className="w-4 h-4" /> Sent History
          </button>
          <button
            onClick={() => setView('settings')}
            className={cn(
              'admin-toggle-btn',
              view === 'settings' && 'admin-toggle-btn-active',
            )}
          >
            <Settings className="w-4 h-4" /> Instellingen
          </button>
        </div>
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
      className="admin-btn-primary w-full sm:w-auto"
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
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-[var(--color-muted)]" />
        <h3 className="admin-eyebrow">Reminders</h3>
        <span className="admin-state-pill admin-state-neutral text-[10px]">
          {items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item: any) => {
          const now = Date.now();
          const dueAt = item.task?.dueAt ? new Date(item.task.dueAt) : null;
          const isOverdue = dueAt !== null && dueAt.getTime() < now;
          const notes = item.task?.notes ?? item.subject;

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-2.5"
            >
              <Link
                href={`/admin/contacts/${item.contact.id}`}
                className="flex-1 min-w-0 flex items-center gap-3 hover:text-[#007AFF] transition-colors"
              >
                <span className="text-xs font-bold text-[var(--color-ink)] truncate">
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
                    ? 'admin-state-info'
                    : item.channel === 'whatsapp'
                      ? 'admin-state-success'
                      : 'admin-state-neutral',
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-bold admin-state-success hover:opacity-80 transition-all disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Done
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    skip.mutate({ id: item.id });
                  }}
                  disabled={skip.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-bold admin-state-neutral hover:opacity-80 transition-all disabled:opacity-50"
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

  if (queue.isLoading) {
    return (
      <PageLoader
        label="Loading outreach"
        description="Collecting drafts and replies."
      />
    );
  }

  const queueData = queue.data;
  if (!queueData) return null;

  if (!queueData.drafts?.length) {
    return (
      <EmptyState
        icon={<Mail className="w-12 h-12" />}
        title="Inbox leeg"
        description="Geen concepten om te beoordelen."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs font-bold text-[var(--color-muted)]">
          {queueData.summary.total} concept
          {queueData.summary.total !== 1 ? 'en' : ''}
        </span>
        <button
          onClick={() => bulkApprove.mutate({ limit: 25 })}
          disabled={bulkApprove.isPending || queueData.summary.lowRisk === 0}
          className="admin-btn-primary disabled:opacity-50"
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
      <div className="glass-card rounded-[var(--radius-md)] overflow-hidden divide-y divide-[var(--color-border)]">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {groupByDate(queueData.drafts as any[]).map((group) => (
          <div key={group.label}>
            <div className="px-6 py-2 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
              <span className="admin-eyebrow">{group.label}</span>
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
                      'w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-2)] transition-colors',
                      isExpanded && 'bg-[var(--color-surface-2)]',
                    )}
                  >
                    {/* Company logo */}
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
                      {draft.contact.prospect?.logoUrl ? (
                        <img
                          src={draft.contact.prospect.logoUrl}
                          alt=""
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Building2 className="w-4 h-4 text-[var(--color-border-strong)]" />
                      )}
                    </div>

                    {/* From / Company */}
                    <div className="w-44 shrink-0 min-w-0">
                      <Link
                        href={`/admin/prospects/${draft.contact.prospect?.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-bold text-[var(--color-ink)] truncate tracking-tight hover:text-[#007AFF] transition-colors"
                      >
                        {companyName}
                      </Link>
                      <p className="text-[11px] text-[var(--color-muted)] truncate">
                        {toName}
                      </p>
                    </div>

                    {/* Subject + preview */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--color-ink)] truncate">
                        {draft.subject}
                      </p>
                      <p className="text-sm text-[var(--color-muted)] truncate">
                        {previewText}
                      </p>
                    </div>

                    {/* Kind chip + Timestamp */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'admin-state-pill text-[9px] shrink-0',
                          kind === 'signal_draft'
                            ? 'admin-state-accent'
                            : kind === 'cadence_draft'
                              ? 'admin-state-info'
                              : 'admin-state-neutral',
                        )}
                      >
                        {kindLabel}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--color-muted)] tabular-nums">
                        {new Date(draft.createdAt).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </button>

                  {/* Expanded email view */}
                  {isExpanded && (
                    <div className="bg-[var(--color-surface)] border-t border-[var(--color-border)] px-6 py-6">
                      {/* Email header */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                            <span className="font-bold text-[var(--color-muted)]">
                              Van
                            </span>
                            <span className="font-semibold text-[var(--color-ink)]">
                              Romano Kanters &lt;info@klarifai.nl&gt;
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                            <span className="font-bold text-[var(--color-muted)]">
                              Aan
                            </span>
                            <span className="font-semibold text-[var(--color-ink)]">
                              {toName}
                              {toEmail ? ` <${toEmail}>` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                            <span className="font-bold text-[var(--color-muted)]">
                              Onderwerp
                            </span>
                            <span className="font-semibold text-[var(--color-ink)]">
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
                              'inline-flex items-center gap-1.5 px-3 py-2.5 rounded-[var(--radius-md)] text-[10px] font-bold uppercase tracking-[0.14em] border transition-all disabled:opacity-50',
                              (draft.metadata as Record<string, unknown>)
                                ?.language === 'en'
                                ? 'bg-[var(--color-ink)] text-[var(--color-surface)] border-[var(--color-ink)]'
                                : 'bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border-strong)] hover:border-[var(--color-border-strong)]',
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
                            className="admin-btn-primary disabled:opacity-50"
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
                            className="admin-btn-secondary disabled:opacity-50 hover:admin-state-danger"
                          >
                            <X className="w-3.5 h-3.5" /> Verwijder
                          </button>
                        </div>
                      </div>

                      {/* Email body */}
                      <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-md)] p-6 border border-[var(--color-border)]">
                        {draft.bodyHtml ? (
                          <div
                            className="text-sm text-[var(--color-muted-dark)] prose prose-sm max-w-none font-medium leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
                          />
                        ) : (
                          <pre className="text-sm text-[var(--color-muted-dark)] font-medium leading-relaxed whitespace-pre-wrap font-[inherit]">
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

  if (history.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-5 bg-[var(--color-surface-2)] rounded-[var(--radius-md)] w-64" />
          </div>
        ))}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (history.data ?? []) as any[];

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<History className="w-12 h-12" />}
        title="No outreach history yet"
        description="Verzonden interacties verschijnen hier zodra de eerste run live gaat."
      />
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log: any) => (
        <div
          key={log.id}
          className="glass-card card-interactive p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${
                log.status === 'sent'
                  ? 'bg-[var(--color-tag-enrich-text)]'
                  : log.status === 'failed'
                    ? 'bg-[var(--color-brand-danger)]'
                    : 'bg-[var(--color-border-strong)]'
              }`}
            />
            <div>
              <span className="text-sm font-bold text-[var(--color-ink)]">
                {log.contact?.firstName} {log.contact?.lastName}
              </span>
              {log.contact?.prospect && (
                <span className="admin-meta-text ml-2">
                  @ {log.contact.prospect.companyName}
                </span>
              )}
              <p className="admin-meta-text mt-0.5">{log.subject}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="admin-state-pill admin-state-neutral">
              {log.type.replace(/_/g, ' ')}
            </span>
            <span className="admin-meta-text">
              {new Date(log.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
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

  if (settings.isLoading) {
    return (
      <PageLoader
        label="Loading settings"
        description="Outreach configuratie laden."
      />
    );
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
      <div className="glass-card p-6 space-y-4">
        <h3 className="admin-eyebrow">Email Identiteit</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--color-muted-dark)] mb-1 block">
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
            <label className="text-xs font-bold text-[var(--color-muted-dark)] mb-1 block">
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
      <div className="glass-card p-6 space-y-4">
        <h3 className="admin-eyebrow">Outreach Stijl</h3>
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
                'relative text-left rounded-[var(--radius-md)] border p-4 transition-all cursor-pointer',
                toneId === style.id
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5 ring-1 ring-[var(--color-gold)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[var(--color-ink)] tracking-tight">
                    {style.label}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)] mt-1 leading-snug">
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
                  className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
                >
                  <Info className="w-3 h-3 text-[var(--color-muted)]" />
                </button>
              </div>
              {expandedInfo === style.id && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                  <p className="text-[11px] text-[var(--color-muted-dark)] leading-relaxed">
                    {style.tone}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Signature */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="admin-eyebrow">Handtekening</h3>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
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
          <div className="bg-[var(--color-surface-2)] rounded-[var(--radius-md)] p-6 border border-[var(--color-border)]">
            <p className="text-xs font-bold text-[var(--color-muted)] mb-3">
              HTML Preview
            </p>
            <div
              className="text-sm text-[var(--color-muted-dark)] prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: signatureHtml }}
            />
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-[var(--color-muted-dark)] mb-1 block">
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
          className="admin-btn-primary disabled:opacity-50"
        >
          {update.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Opslaan
        </button>
        {saved && (
          <span className="text-xs font-bold text-[var(--color-tag-enrich-text)] animate-fade-in-up">
            Opgeslagen
          </span>
        )}
      </div>
    </div>
  );
}
