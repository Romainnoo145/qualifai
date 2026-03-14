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
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/ui/page-loader';

// --- Helpers ---

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// --- Types (inferred from backend response shape) ---

type Draft = {
  id: string;
  prospectId: string;
  prospectName: string;
  contactName: string;
  subject: string;
  preview: string;
  createdAt: Date | string;
};

type Reply = {
  id: string;
  prospectId: string;
  prospectName: string;
  contactName: string;
  subject: string;
  preview: string;
  createdAt: Date | string;
};

type ReadyProspect = {
  id: string;
  companyName: string;
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
  detail: string;
};

// --- Feed row component (compact, NOT glass-card) ---

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

function FeedRow({ item }: { item: FeedItem }) {
  const cfg = feedConfig[item.type];
  const Icon = cfg.icon;

  return (
    <Link
      href={`/admin/prospects/${item.prospectId}`}
      className="flex items-center gap-3 px-1 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors rounded-sm group"
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dotColor)} />
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-[#040026]">
          {item.prospectName}
        </span>
        {item.detail && (
          <span className="text-sm text-slate-500"> — {item.detail}</span>
        )}
      </span>
      <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
        {timeAgo(item.timestamp)}
      </span>
    </Link>
  );
}

// --- Draft row (with inline Send button) ---

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
    <div className="glass-card p-4 mb-2 rounded-2xl flex items-center gap-4">
      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[#040026]">
          {draft.prospectName}
          {draft.contactName && (
            <span className="font-normal text-slate-500">
              {' '}
              · {draft.contactName}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 truncate">{draft.subject}</p>
        {draft.preview && (
          <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 max-w-lg">
            {draft.preview}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-slate-400">
          {timeAgo(draft.createdAt)}
        </span>
        <button
          onClick={() => onSend(draft.id)}
          disabled={isPending}
          className={cn(
            'ui-tap flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all',
            isPending
              ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
              : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
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
    </div>
  );
}

// --- Reply row ---

function ReplyRow({ reply }: { reply: Reply }) {
  return (
    <Link
      href="/admin/outreach"
      className="glass-card p-4 mb-2 rounded-2xl flex items-center gap-4 hover:border-[#EBCB4B]/30 transition-all"
    >
      <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[#040026]">
          {reply.prospectName}
          {reply.contactName && (
            <span className="font-normal text-slate-500">
              {' '}
              · {reply.contactName}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 truncate">{reply.subject}</p>
        {reply.preview && (
          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 max-w-lg">
            {reply.preview}
          </p>
        )}
      </div>
      <span className="text-[10px] text-slate-400 shrink-0">
        {timeAgo(reply.createdAt)}
      </span>
    </Link>
  );
}

// --- Ready prospect row ---

function ReadyProspectRow({ prospect }: { prospect: ReadyProspect }) {
  return (
    <Link
      href={`/admin/prospects/${prospect.id}`}
      className="glass-card p-4 mb-2 rounded-2xl flex items-center gap-4 hover:border-[#EBCB4B]/30 transition-all"
    >
      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[#040026]">
          {prospect.companyName}
        </p>
        {prospect.industry && (
          <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded mt-0.5">
            {prospect.industry}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold">
          {prospect.contactCount}{' '}
          {prospect.contactCount === 1 ? 'contact' : 'contacts'}
        </span>
      </div>
    </Link>
  );
}

// --- Section heading helper ---

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
    <div className="flex items-center gap-2 mb-3">
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
  const feed = api.admin.getDashboardFeed.useQuery();
  const actions = api.admin.getDashboardActions.useQuery();
  const utils = api.useUtils();

  const approveDraft = api.outreach.approveDraft.useMutation({
    onSuccess: () => {
      void utils.admin.getDashboardActions.invalidate();
      void utils.admin.getDashboardFeed.invalidate();
    },
    onError: () => {
      // Refresh — draft was likely already sent (idempotency guard)
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

  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#040026] tracking-tighter">
            Dashboard
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1 capitalize">
            {today}
          </p>
        </div>
        {(counts?.total ?? 0) > 0 && (
          <span className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1 rounded-full mt-1">
            {counts?.total}{' '}
            {counts?.total === 1 ? 'item vraagt' : 'items vragen'} aandacht
          </span>
        )}
      </div>

      {/* Action Block */}
      {(counts?.total ?? 0) === 0 ? (
        <div className="glass-card p-12 text-center rounded-[2.5rem]">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-[#040026] tracking-tight">
            All caught up
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Geen openstaande acties.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Drafts to Approve */}
          {drafts.length > 0 && (
            <section>
              <SectionHeading
                icon={Mail}
                label="Concepten goed te keuren"
                count={drafts.length}
              />
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

          {/* Replies to Handle */}
          {replies.length > 0 && (
            <section>
              <SectionHeading
                icon={MessageSquare}
                label="Reacties te beantwoorden"
                count={replies.length}
              />
              {(replies as Reply[]).map((reply) => (
                <ReplyRow key={reply.id} reply={reply} />
              ))}
            </section>
          )}

          {/* Ready for Outreach */}
          {readyProspects.length > 0 && (
            <section>
              <SectionHeading
                icon={Building2}
                label="Klaar voor outreach"
                count={readyProspects.length}
              />
              {(readyProspects as ReadyProspect[]).map((prospect) => (
                <ReadyProspectRow key={prospect.id} prospect={prospect} />
              ))}
            </section>
          )}
        </div>
      )}

      {/* Activity Feed */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-black text-[#040026] tracking-tight">
            Recente activiteit
          </h2>
          {feedItems.length > 0 && (
            <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-bold text-slate-500">
              {feedItems.length}
            </span>
          )}
        </div>

        {feedItems.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">
            Geen recente activiteit.
          </p>
        ) : (
          <div className="glass-card rounded-2xl px-4 py-1">
            {(feedItems as FeedItem[]).map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
