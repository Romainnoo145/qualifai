'use client';

import { api } from '@/components/providers';
import {
  Mail,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Search,
  Sparkles,
  Eye,
  Building2,
  Activity,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
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
    | 'outreach_sent';
  timestamp: Date | string;
  prospectId: string;
  prospectName: string;
  logoUrl: string | null;
  detail: string;
};

// --- Logo helper (matches companies tab) ---

function ProspectLogo({
  logoUrl,
  size = 'md',
}: {
  logoUrl: string | null;
  size?: 'sm' | 'md';
}) {
  const sizeClasses =
    size === 'sm' ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl';
  const imgClasses = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8';
  const iconClasses = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div
      className={cn(
        sizeClasses,
        'bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden shrink-0',
      )}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={cn(imgClasses, 'object-contain')}
        />
      ) : (
        <Building2 className={cn(iconClasses, 'text-slate-200')} />
      )}
    </div>
  );
}

// --- Feed config ---

const feedConfig: Record<
  FeedItem['type'],
  {
    icon: React.ComponentType<{ className?: string }>;
    dotColor: string;
    label: string;
  }
> = {
  research_complete: {
    icon: Search,
    dotColor: 'bg-emerald-400',
    label: 'Research afgerond',
  },
  analysis_generated: {
    icon: Sparkles,
    dotColor: 'bg-purple-400',
    label: 'Narrative analyse',
  },
  discover_visit: {
    icon: Eye,
    dotColor: 'bg-blue-400',
    label: 'Discover bezocht',
  },
  outreach_sent: {
    icon: Send,
    dotColor: 'bg-amber-400',
    label: 'Outreach verstuurd',
  },
};

// --- Feed row (prospect card style) ---

function FeedRow({ item }: { item: FeedItem }) {
  const cfg = feedConfig[item.type];
  const Icon = cfg.icon;

  return (
    <Link
      href={`/admin/prospects/${item.prospectId}`}
      className="glass-card glass-card-hover p-6 flex items-center gap-5 group"
    >
      <ProspectLogo logoUrl={item.logoUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-black text-[#040026] tracking-tighter group-hover:text-[#007AFF] transition-all">
            {item.prospectName}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest',
              'bg-slate-50 border border-slate-100 text-slate-500',
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dotColor)} />
            {cfg.label}
          </span>
        </div>
        <div className="admin-meta-text flex items-center gap-3 mt-1">
          <Icon className="w-3.5 h-3.5" />
          <span>{item.detail}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
        {timeAgo(item.timestamp)}
      </span>
    </Link>
  );
}

// --- Draft row (prospect card style with Send button) ---

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
    <div className="glass-card glass-card-hover p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between group">
      <div className="flex items-center gap-5">
        <ProspectLogo logoUrl={draft.logoUrl} />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/admin/prospects/${draft.prospectId}`}
              className="text-lg font-black text-[#040026] tracking-tighter hover:text-[#007AFF] transition-all"
            >
              {draft.prospectName}
            </Link>
            {draft.contactName && (
              <span className="admin-meta-text">{draft.contactName}</span>
            )}
          </div>
          <div className="admin-meta-text flex items-center gap-3 mt-1">
            <Mail className="w-3.5 h-3.5" />
            <span className="truncate max-w-md">{draft.subject}</span>
          </div>
          {draft.preview && (
            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 max-w-lg">
              {draft.preview}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
          {timeAgo(draft.createdAt)}
        </span>
        <button
          onClick={() => onSend(draft.id)}
          disabled={isPending}
          className={cn(
            'ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
            isPending
              ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
              : 'bg-[#EBCB4B] text-[#040026] border-[#EBCB4B] hover:bg-[#D4B43B]',
          )}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send
        </button>
      </div>
    </div>
  );
}

// --- Reply row (prospect card style) ---

function ReplyRow({ reply }: { reply: Reply }) {
  return (
    <Link
      href="/admin/outreach"
      className="glass-card glass-card-hover p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between group"
    >
      <div className="flex items-center gap-5">
        <ProspectLogo logoUrl={reply.logoUrl} />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-black text-[#040026] tracking-tighter group-hover:text-[#007AFF] transition-all">
              {reply.prospectName}
            </span>
            {reply.contactName && (
              <span className="admin-meta-text">{reply.contactName}</span>
            )}
          </div>
          <div className="admin-meta-text flex items-center gap-3 mt-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="truncate max-w-md">{reply.subject}</span>
          </div>
          {reply.preview && (
            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 max-w-lg">
              {reply.preview}
            </p>
          )}
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
        {timeAgo(reply.createdAt)}
      </span>
    </Link>
  );
}

// --- Ready prospect row (prospect card style) ---

function ReadyProspectRow({ prospect }: { prospect: ReadyProspect }) {
  return (
    <Link
      href={`/admin/prospects/${prospect.id}`}
      className="glass-card glass-card-hover p-6 flex items-center gap-5 group"
    >
      <ProspectLogo logoUrl={prospect.logoUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-black text-[#040026] tracking-tighter group-hover:text-[#007AFF] transition-all">
            {prospect.companyName}
          </span>
          {prospect.industry && (
            <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-lg">
              {prospect.industry}
            </span>
          )}
        </div>
        <div className="admin-meta-text flex items-center gap-3 mt-1">
          <Globe className="w-3.5 h-3.5" />
          <span>{prospect.domain}</span>
          <span className="w-1 h-1 rounded-full bg-slate-200" />
          <span>
            {prospect.contactCount}{' '}
            {prospect.contactCount === 1 ? 'contact' : 'contacts'}
          </span>
        </div>
      </div>
      <span className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] hover:bg-[#D4B43B] transition-all border border-[#EBCB4B] shrink-0">
        Start Outreach
      </span>
    </Link>
  );
}

// --- Section heading ---

function SectionHeading({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-slate-500" />
      <h2 className="text-sm font-black text-[#040026] tracking-tight">
        {label}
      </h2>
      <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-bold text-slate-500">
        {count}
      </span>
    </div>
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
      <div className="glass-card p-12 text-center text-red-500 font-bold rounded-[2.5rem]">
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
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Dashboard
        </h1>
        {(counts?.total ?? 0) > 0 && (
          <span className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] border border-[#EBCB4B]">
            <Activity className="w-3.5 h-3.5" />
            {counts?.total} {counts?.total === 1 ? 'actie' : 'acties'}
          </span>
        )}
      </div>

      {/* View toggle */}
      <div className="overflow-x-auto">
        <div className="admin-toggle-group w-max">
          <button
            onClick={() => setView('actions')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'actions' && 'admin-toggle-btn-active',
            )}
          >
            <CheckCircle2 className="w-4 h-4" /> Acties
            {(counts?.total ?? 0) > 0 && (
              <span className="admin-toggle-count">{counts?.total}</span>
            )}
          </button>
          <button
            onClick={() => setView('activity')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'activity' && 'admin-toggle-btn-active',
            )}
          >
            <Activity className="w-4 h-4" /> Activiteit
            {feedItems.length > 0 && (
              <span className="admin-toggle-count">{feedItems.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Action Block */}
      {view === 'actions' && (
        <>
          {(counts?.total ?? 0) === 0 ? (
            <div className="glass-card p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-black text-[#040026] tracking-tight">
                All caught up
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                Geen openstaande acties.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {drafts.length > 0 && (
                <section>
                  <SectionHeading
                    icon={Mail}
                    label="Concepten goed te keuren"
                    count={drafts.length}
                  />
                  <div className="space-y-3">
                    {(drafts as Draft[]).map((draft) => (
                      <DraftRow
                        key={draft.id}
                        draft={draft}
                        onSend={(id) => approveDraft.mutate({ id })}
                        isPending={approveDraft.isPending}
                      />
                    ))}
                  </div>
                </section>
              )}

              {replies.length > 0 && (
                <section>
                  <SectionHeading
                    icon={MessageSquare}
                    label="Reacties te beantwoorden"
                    count={replies.length}
                  />
                  <div className="space-y-3">
                    {(replies as Reply[]).map((reply) => (
                      <ReplyRow key={reply.id} reply={reply} />
                    ))}
                  </div>
                </section>
              )}

              {readyProspects.length > 0 && (
                <section>
                  <SectionHeading
                    icon={Building2}
                    label="Klaar voor outreach"
                    count={readyProspects.length}
                  />
                  <div className="space-y-3">
                    {(readyProspects as ReadyProspect[]).map((prospect) => (
                      <ReadyProspectRow key={prospect.id} prospect={prospect} />
                    ))}
                  </div>
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
            <div className="glass-card p-12 text-center">
              <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-black text-[#040026] uppercase tracking-widest">
                Geen recente activiteit
              </p>
              <p className="admin-meta-text mt-2">
                Activiteit van de afgelopen 14 dagen verschijnt hier.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(feedItems as FeedItem[]).map((item) => (
                <FeedRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
