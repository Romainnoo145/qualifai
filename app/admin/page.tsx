'use client';

import { api } from '@/components/providers';
import {
  Lightbulb,
  Mail,
  Phone,
  MessageSquare,
  MessageCircle,
  Linkedin,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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

// --- Sub-components ---

type ActionItem = {
  id: string;
  type: 'hypothesis' | 'draft' | 'task' | 'reply';
  prospectId: string;
  prospectName: string;
  title: string;
  createdAt: Date | string;
  urgency: 'overdue' | 'normal';
  channel?: string | null;
  dueAt?: string | null;
};

const ChannelIcon = ({ channel }: { channel: string | null | undefined }) => {
  if (channel === 'linkedin')
    return <Linkedin className="w-3 h-3 text-slate-400" />;
  if (channel === 'whatsapp')
    return <MessageCircle className="w-3 h-3 text-slate-400" />;
  if (channel === 'email') return <Mail className="w-3 h-3 text-slate-400" />;
  return <Phone className="w-3 h-3 text-slate-400" />;
};

const CountCard = ({
  icon: Icon,
  label,
  count,
  href,
  overdueCount,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
  overdueCount?: number;
}) => (
  <Link
    href={href}
    className={cn(
      'glass-card p-4 block transition-all hover:border-[#EBCB4B]/30',
      count === 0 && 'opacity-50',
    )}
  >
    <div className="flex items-start justify-between mb-2">
      <Icon className="w-4 h-4 text-slate-400" />
      {overdueCount && overdueCount > 0 ? (
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      ) : null}
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-black text-[#040026]">{count}</span>
      {overdueCount && overdueCount > 0 ? (
        <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
          {overdueCount} overdue
        </span>
      ) : null}
    </div>
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
      {label}
    </p>
  </Link>
);

const ActionRow = ({ item }: { item: ActionItem }) => {
  const href =
    item.type === 'hypothesis'
      ? `/admin/prospects/${item.prospectId}#analysis`
      : '/admin/outreach';

  const isOverdue = item.urgency === 'overdue';

  return (
    <Link
      href={href}
      className={cn(
        'glass-card p-4 mb-2 flex items-center justify-between hover:border-[#EBCB4B]/30 transition-all',
        isOverdue && 'border-l-4 border-red-500',
      )}
    >
      <div className="flex-1 min-w-0 mr-4">
        <p className="font-bold text-sm text-[#040026]">{item.prospectName}</p>
        <p className="text-xs text-slate-500 truncate max-w-md">{item.title}</p>
        {item.type === 'task' && item.channel && (
          <div className="flex items-center gap-1 mt-1">
            <ChannelIcon channel={item.channel} />
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {isOverdue && (
          <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
            OVERDUE
          </span>
        )}
        {item.type === 'task' && item.dueAt && !isOverdue && (
          <span className="text-[10px] text-slate-400">
            {new Date(item.dueAt).toLocaleDateString('nl-NL', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
        <span className="text-[10px] text-slate-400">
          {timeAgo(item.createdAt)}
        </span>
      </div>
    </Link>
  );
};

const ActionSection = ({
  id,
  icon: Icon,
  label,
  items,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: ActionItem[];
}) => {
  if (items.length === 0) return null;
  return (
    <section id={id} className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-black text-[#040026] tracking-tight">
          {label}
        </h2>
        <span className="bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-bold text-slate-500">
          {items.length}
        </span>
      </div>
      {items.map((item) => (
        <ActionRow key={item.id} item={item} />
      ))}
    </section>
  );
};

// --- Page ---

export default function AdminDashboard() {
  const queue = api.admin.getActionQueue.useQuery();

  if (queue.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-100 rounded-2xl h-20" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate-50 rounded-xl h-14" />
          ))}
        </div>
      </div>
    );
  }

  if (queue.error) {
    return (
      <div className="glass-card p-12 text-center text-red-500 font-bold">
        Failed to load dashboard. Check connection.
      </div>
    );
  }

  const { items = [], counts } = queue.data ?? {
    items: [],
    counts: {
      hypotheses: 0,
      drafts: 0,
      tasks: 0,
      overdueTasks: 0,
      replies: 0,
      total: 0,
    },
  };

  const hypothesisItems = items.filter((i) => i.type === 'hypothesis');
  const draftItems = items.filter((i) => i.type === 'draft');
  const taskItems = items.filter((i) => i.type === 'task');
  const replyItems = items.filter((i) => i.type === 'reply');

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
        {counts.total > 0 && (
          <span className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1 rounded-full mt-1">
            {counts.total} items need attention
          </span>
        )}
      </div>

      {/* Count strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CountCard
          icon={Lightbulb}
          label="Review"
          count={counts.hypotheses}
          href="#hypotheses"
        />
        <CountCard
          icon={Mail}
          label="Approve"
          count={counts.drafts}
          href="#drafts"
        />
        <CountCard
          icon={Phone}
          label="Tasks"
          count={counts.tasks}
          href="#tasks"
          overdueCount={counts.overdueTasks}
        />
        <CountCard
          icon={MessageSquare}
          label="Replies"
          count={counts.replies}
          href="#replies"
        />
      </div>

      {/* Empty state */}
      {counts.total === 0 && (
        <div className="glass-card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#040026]">All caught up!</h2>
          <p className="text-sm text-slate-400 mt-1">
            No pending decisions right now.
          </p>
        </div>
      )}

      {/* Action sections */}
      {counts.total > 0 && (
        <div className="space-y-8">
          <ActionSection
            id="hypotheses"
            icon={Lightbulb}
            label="Hypotheses to Review"
            items={hypothesisItems as ActionItem[]}
          />
          <ActionSection
            id="drafts"
            icon={Mail}
            label="Drafts to Approve"
            items={draftItems as ActionItem[]}
          />
          <ActionSection
            id="tasks"
            icon={Phone}
            label="Tasks Due"
            items={taskItems as ActionItem[]}
          />
          <ActionSection
            id="replies"
            icon={MessageSquare}
            label="Replies to Handle"
            items={replyItems as ActionItem[]}
          />
        </div>
      )}
    </div>
  );
}
