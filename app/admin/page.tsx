'use client';

import { api } from '@/components/providers';
import {
  Mail,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Building2,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/ui/page-loader';

// --- Helpers ---

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m geleden`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}u geleden`;
  return `${Math.floor(diffHr / 24)}d geleden`;
}

// --- Types ---

type Draft = {
  id: string;
  prospectId: string;
  prospectName: string;
  domain: string;
  logoUrl: string | null;
  contactName: string;
  subject: string;
  preview: string;
  createdAt: Date | string;
};

type Reply = {
  id: string;
  prospectId: string;
  prospectName: string;
  domain: string;
  logoUrl: string | null;
  contactName: string;
  subject: string;
  preview: string;
  createdAt: Date | string;
};

type ReadyProspect = {
  id: string;
  companyName: string;
  domain: string;
  logoUrl: string | null;
  industry: string | null;
  contactCount: number;
  updatedAt: Date | string;
};

type FeedItem = {
  id: string;
  type:
    | 'research_complete'
    | 'analysis_generated'
    | 'discover_visit'
    | 'outreach_sent'
    | 'quote_viewed'
    | 'quote_accepted';
  timestamp: Date | string;
  prospectId: string;
  prospectName: string;
  logoUrl: string | null;
  detail: string;
};

// --- Logo helper ---

function DashLogo({ logoUrl }: { logoUrl: string | null }) {
  return (
    <div className="w-11 h-11 rounded-[10px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="w-6 h-6 object-contain" />
      ) : (
        <Building2 className="w-4 h-4 text-[var(--color-border-strong)]" />
      )}
    </div>
  );
}

// --- Section header with extending line ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

// --- Feed config ---

const FEED_TAG_CLASS: Record<FeedItem['type'], string> = {
  research_complete:
    'bg-[var(--color-tag-run-bg)] text-[var(--color-tag-run-text)] border-[var(--color-tag-run-border)]',
  analysis_generated:
    'bg-[var(--color-tag-quality-bg)] text-[var(--color-tag-quality-text)] border-[var(--color-tag-quality-border)]',
  discover_visit:
    'bg-[var(--color-tag-evidence-bg)] text-[var(--color-tag-evidence-text)] border-[var(--color-tag-evidence-border)]',
  outreach_sent:
    'bg-[var(--color-tag-outreach-bg)] text-[var(--color-tag-outreach-text)] border-[var(--color-tag-outreach-border)]',
  quote_viewed:
    'bg-[rgba(225,195,60,0.10)] text-[var(--color-ink)] border-[rgba(225,195,60,0.35)]',
  quote_accepted:
    'bg-[rgba(225,195,60,0.18)] text-[var(--color-ink)] border-[var(--color-gold)]',
};

const FEED_LABEL: Record<FeedItem['type'], string> = {
  research_complete: 'Run',
  analysis_generated: 'Analyse',
  discover_visit: 'Visit',
  outreach_sent: 'Outreach',
  quote_viewed: 'Geopend',
  quote_accepted: 'Akkoord',
};

// --- Feed row ---

function FeedRow({ item }: { item: FeedItem }) {
  const d =
    typeof item.timestamp === 'string'
      ? new Date(item.timestamp)
      : item.timestamp;
  const day = d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link
      href={`/admin/prospects/${item.prospectId}`}
      className="grid grid-cols-[56px_1fr_auto] gap-4 py-3.5 border-b border-[var(--color-surface-2)] hover:pl-1.5 transition-all"
    >
      <div className="text-[10px] font-medium text-[var(--color-muted)]">
        <span className="block font-bold text-[var(--color-gold)]">{day}</span>
        {time}
      </div>
      <div>
        <span className="text-[14px] font-medium text-[var(--color-ink)]">
          {item.prospectName}
        </span>
        <span className="text-[13px] font-light text-[var(--color-muted)]">
          {' '}
          — {item.detail}
        </span>
      </div>
      <span
        className={cn(
          'self-start text-[9px] font-medium uppercase tracking-[0.1em] px-2 py-0.5 rounded border whitespace-nowrap',
          FEED_TAG_CLASS[item.type],
        )}
      >
        {FEED_LABEL[item.type]}
      </span>
    </Link>
  );
}

// --- Draft row ---

function DraftRow({
  draft,
  onSend,
  isPending,
}: {
  draft: Draft;
  onSend: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-5 py-4 border-b border-[var(--color-surface-2)] group">
      <DashLogo logoUrl={draft.logoUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/prospects/${draft.prospectId}`}
            className="text-[15px] font-medium text-[var(--color-ink)] hover:text-[var(--color-gold)] transition-colors"
          >
            {draft.prospectName}
          </Link>
          {draft.contactName && (
            <span className="text-[12px] font-light text-[var(--color-muted)]">
              {draft.contactName}
            </span>
          )}
        </div>
        <div className="text-[12px] font-light text-[var(--color-muted)] mt-0.5 flex items-center gap-2">
          <Mail className="w-3 h-3" />
          <span className="truncate max-w-md">{draft.subject}</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-[var(--color-muted)] tabular-nums shrink-0">
        {timeAgo(draft.createdAt)}
      </span>
      <button
        onClick={() => onSend(draft.id)}
        disabled={isPending}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] border transition-all shrink-0',
          isPending
            ? 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-border)] cursor-not-allowed'
            : 'bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border-[#e4c33c]',
        )}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Send className="w-3 h-3" />
        )}
        Send
      </button>
    </div>
  );
}

// --- Reply row ---

function ReplyRow({ reply }: { reply: Reply }) {
  return (
    <Link
      href="/admin/outreach"
      className="flex items-center gap-5 py-4 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
    >
      <DashLogo logoUrl={reply.logoUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-medium text-[var(--color-ink)]">
            {reply.prospectName}
          </span>
          {reply.contactName && (
            <span className="text-[12px] font-light text-[var(--color-muted)]">
              {reply.contactName}
            </span>
          )}
        </div>
        <div className="text-[12px] font-light text-[var(--color-muted)] mt-0.5 flex items-center gap-2">
          <MessageSquare className="w-3 h-3" />
          <span className="truncate max-w-md">{reply.subject}</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-[var(--color-muted)] tabular-nums shrink-0">
        {timeAgo(reply.createdAt)}
      </span>
      <span className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-gold)] group-hover:border-[var(--color-ink)] transition-all shrink-0 text-[12px]">
        →
      </span>
    </Link>
  );
}

// --- Ready prospect row ---

function ReadyProspectRow({ prospect }: { prospect: ReadyProspect }) {
  const router = useRouter();
  return (
    <Link
      href={`/admin/prospects/${prospect.id}`}
      className="flex items-center gap-5 py-4 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
    >
      <DashLogo logoUrl={prospect.logoUrl} />
      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-medium text-[var(--color-ink)]">
          {prospect.companyName}
        </span>
        <div className="text-[12px] font-light text-[var(--color-muted)] mt-0.5 flex items-center gap-2">
          <span>{prospect.domain}</span>
          {prospect.industry && (
            <>
              <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
              <span>{prospect.industry}</span>
            </>
          )}
          <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
          <span>
            {prospect.contactCount}{' '}
            {prospect.contactCount === 1 ? 'contact' : 'contacts'}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(`/admin/prospects/${prospect.id}/outreach`);
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] shrink-0 cursor-pointer hover:brightness-105 transition-all"
      >
        Start Outreach
      </button>
    </Link>
  );
}

// --- Page ---

export default function AdminDashboard() {
  const [view, setView] = useState<'actions' | 'activity'>('actions');
  const feed = api.admin.getDashboardFeed.useQuery();
  const actions = api.admin.getDashboardActions.useQuery();
  const utils = api.useUtils();

  const approveDraft = api.outreach.approveDraft.useMutation({
    onSuccess: () => {
      void utils.admin.getDashboardActions.invalidate();
      void utils.admin.getDashboardFeed.invalidate();
    },
    onError: () => {
      void utils.admin.getDashboardActions.invalidate();
    },
  });

  if (feed.isLoading || actions.isLoading) {
    return (
      <PageLoader
        label="Dashboard laden"
        description="Recente activiteit en acties ophalen."
      />
    );
  }

  if (feed.error || actions.error) {
    return (
      <div className="py-16 text-center text-[var(--color-brand-danger)] font-medium">
        Dashboard kon niet laden. Controleer de verbinding.
      </div>
    );
  }

  const feedItems = feed.data?.items ?? [];
  const {
    drafts = [],
    replies = [],
    readyProspects = [],
    counts,
  } = actions.data ?? {
    drafts: [],
    replies: [],
    readyProspects: [],
    counts: { drafts: 0, replies: 0, readyProspects: 0, total: 0 },
  };

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Dashboard<span className="text-[var(--color-gold)]">.</span>
        </h1>
        {(counts?.total ?? 0) > 0 && (
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            <strong className="text-[var(--color-ink)]">{counts?.total}</strong>{' '}
            openstaande {counts?.total === 1 ? 'actie' : 'acties'}
          </span>
        )}
      </div>

      {/* Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('actions')}
          className={cn(
            'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
            view === 'actions'
              ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
              : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
          )}
        >
          Acties
          {(counts?.total ?? 0) > 0 && (
            <span className="ml-1.5 opacity-60">{counts?.total}</span>
          )}
        </button>
        <button
          onClick={() => setView('activity')}
          className={cn(
            'px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] rounded-md border transition-all',
            view === 'activity'
              ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
              : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
          )}
        >
          Activiteit
          {feedItems.length > 0 && (
            <span className="ml-1.5 opacity-60">{feedItems.length}</span>
          )}
        </button>
      </div>

      {/* Actions */}
      {view === 'actions' && (
        <>
          {(counts?.total ?? 0) === 0 ? (
            <div className="py-20 text-center">
              <CheckCircle2 className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
              <p className="text-[15px] font-medium text-[var(--color-ink)]">
                All caught up
              </p>
              <p className="text-[13px] font-light text-[var(--color-muted)] mt-1">
                Geen openstaande acties.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {drafts.length > 0 && (
                <section>
                  <SectionLabel>Concepten goed te keuren</SectionLabel>
                  {(drafts as Draft[]).map((draft) => (
                    <DraftRow
                      key={draft.id}
                      draft={draft}
                      onSend={(id) => approveDraft.mutate({ id })}
                      isPending={approveDraft.isPending}
                    />
                  ))}
                </section>
              )}

              {replies.length > 0 && (
                <section>
                  <SectionLabel>Reacties te beantwoorden</SectionLabel>
                  {(replies as Reply[]).map((reply) => (
                    <ReplyRow key={reply.id} reply={reply} />
                  ))}
                </section>
              )}

              {readyProspects.length > 0 && (
                <section>
                  <SectionLabel>Klaar voor outreach</SectionLabel>
                  {(readyProspects as ReadyProspect[]).map((prospect) => (
                    <ReadyProspectRow key={prospect.id} prospect={prospect} />
                  ))}
                </section>
              )}
            </div>
          )}
        </>
      )}

      {/* Activity Feed */}
      {view === 'activity' && (
        <section>
          {feedItems.length === 0 ? (
            <div className="py-20 text-center">
              <Activity className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
              <p className="text-[15px] font-medium text-[var(--color-ink)]">
                Geen recente activiteit
              </p>
              <p className="text-[13px] font-light text-[var(--color-muted)] mt-1">
                Activiteit van de afgelopen 14 dagen verschijnt hier.
              </p>
            </div>
          ) : (
            <>
              <SectionLabel>Recente activiteit</SectionLabel>
              {(feedItems as FeedItem[]).map((item) => (
                <FeedRow key={item.id} item={item} />
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
