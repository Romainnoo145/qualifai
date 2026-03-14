'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Mail,
  Check,
  X,
  Clock,
  Building2,
  Loader2,
  Send,
  History,
  MessageSquare,
  WandSparkles,
  Sparkles,
  Phone,
  Linkedin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { PageLoader } from '@/components/ui/page-loader';

type View = 'queue' | 'replies' | 'sent';

export default function OutreachPage() {
  const [view, setView] = useState<View>('queue');

  return (
    <div className="space-y-10 animate-fade-in-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Outreach
        </h1>
        <ProcessSignalsButton />
      </div>

      {/* View toggle */}
      <div className="overflow-x-auto">
        <div className="admin-toggle-group w-max">
          <button
            onClick={() => setView('queue')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'queue' && 'admin-toggle-btn-active',
            )}
          >
            <Mail className="w-4 h-4" /> Drafts Queue
          </button>
          <button
            onClick={() => setView('replies')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'replies' && 'admin-toggle-btn-active',
            )}
          >
            <MessageSquare className="w-4 h-4" /> Replies
          </button>
          <button
            onClick={() => setView('sent')}
            className={cn(
              'ui-tap ui-focus admin-toggle-btn',
              view === 'sent' && 'admin-toggle-btn-active',
            )}
          >
            <History className="w-4 h-4" /> Sent History
          </button>
        </div>
      </div>

      {view === 'queue' ? (
        <DraftQueue />
      ) : view === 'replies' ? (
        <ReplyInbox />
      ) : (
        <SentHistory />
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
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-black text-[#040026] tracking-tight">
          Reminders
        </h3>
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
              className="flex items-center gap-3 rounded-xl bg-white/60 border border-indigo-50 px-4 py-2.5"
            >
              <Link
                href={`/admin/contacts/${item.contact.id}`}
                className="flex-1 min-w-0 flex items-center gap-3 hover:text-[#007AFF] transition-colors"
              >
                <span className="text-xs font-black text-[#040026] truncate">
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
                  className="ui-focus ui-tap inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Done
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    skip.mutate({ id: item.id });
                  }}
                  disabled={skip.isPending}
                  className="ui-focus ui-tap inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all disabled:opacity-50"
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

function DraftQueue() {
  const queue = api.outreach.getDecisionInbox.useQuery({ limit: 150 });
  const utils = api.useUtils();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      <div className="glass-card p-12 text-center">
        <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-sm font-black text-[#040026] uppercase tracking-widest mb-2">
          Inbox leeg
        </p>
        <p className="admin-meta-text">Geen concepten om te beoordelen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs font-bold text-slate-400">
          {queueData.summary.total} concept
          {queueData.summary.total !== 1 ? 'en' : ''}
        </span>
        <button
          onClick={() => bulkApprove.mutate({ limit: 25 })}
          disabled={bulkApprove.isPending || queueData.summary.lowRisk === 0}
          className="ui-tap inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] border border-[#EBCB4B] hover:bg-[#D4B43B] transition-all disabled:opacity-50"
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
      <div className="glass-card rounded-2xl overflow-hidden divide-y divide-slate-100">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(queueData.drafts as any[]).map((draft: any) => {
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

          return (
            <div key={draft.id}>
              {/* Inbox row — click to expand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                className={cn(
                  'w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-slate-50/80 transition-colors',
                  isExpanded && 'bg-slate-50/60',
                )}
              >
                {/* Company logo */}
                <div className="w-10 h-10 rounded-xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden shrink-0">
                  {draft.contact.prospect?.logoUrl ? (
                    <img
                      src={draft.contact.prospect.logoUrl}
                      alt=""
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-slate-200" />
                  )}
                </div>

                {/* From / Company */}
                <div className="w-44 shrink-0 min-w-0">
                  <p className="text-sm font-black text-[#040026] truncate tracking-tight">
                    {companyName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {toName}
                  </p>
                </div>

                {/* Subject + preview */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#040026] truncate">
                    {draft.subject}
                  </p>
                  <p className="text-sm text-slate-400 truncate">
                    {previewText}
                  </p>
                </div>

                {/* Timestamp */}
                <span className="text-[11px] font-bold text-slate-400 tabular-nums shrink-0">
                  {new Date(draft.createdAt).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </button>

              {/* Expanded email view */}
              {isExpanded && (
                <div className="bg-white border-t border-slate-100 px-6 py-6">
                  {/* Email header */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-400">Van</span>
                        <span className="font-semibold text-[#040026]">
                          Romano Kanters &lt;info@klarifai.nl&gt;
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-400">Aan</span>
                        <span className="font-semibold text-[#040026]">
                          {toName}
                          {toEmail ? ` <${toEmail}>` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-400">
                          Onderwerp
                        </span>
                        <span className="font-semibold text-[#040026]">
                          {draft.subject}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => approve.mutate({ id: draft.id })}
                        disabled={approve.isPending}
                        className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] border border-[#EBCB4B] hover:bg-[#D4B43B] transition-all disabled:opacity-50"
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
                        className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-500 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Verwijder
                      </button>
                    </div>
                  </div>

                  {/* Email body */}
                  <div className="bg-[#FCFCFD] rounded-2xl p-6 border border-slate-100">
                    {draft.bodyHtml ? (
                      <div
                        className="text-sm text-slate-700 prose prose-sm max-w-none font-medium leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
                      />
                    ) : (
                      <pre className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap font-[inherit]">
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
    </div>
  );
}

function ReplyInbox() {
  const [contactId, setContactId] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const utils = api.useUtils();
  const replies = api.outreach.getReplyInbox.useQuery({
    limit: 100,
    status: 'pending',
  });
  const contacts = api.contacts.list.useQuery({ limit: 100 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captureReply = (api.outreach.captureReply as any).useMutation({
    onSuccess: () => {
      setReplySubject('');
      setReplyBody('');
      utils.outreach.getReplyInbox.invalidate();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triageReply = (api.outreach.triageReply as any).useMutation({
    onSuccess: () => {
      utils.outreach.getReplyInbox.invalidate();
      utils.contacts.list.invalidate();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runSweep = (api.outreach.runReplyTriageSweep as any).useMutation({
    onSuccess: () => {
      utils.outreach.getReplyInbox.invalidate();
      utils.contacts.list.invalidate();
    },
  });

  const contactOptions = (contacts.data?.contacts ?? []) as Array<any>;
  const replyItems = (replies.data?.replies ?? []) as Array<any>;

  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-[#040026] tracking-tight">
            Reply Triage
          </h2>
          <button
            onClick={() => runSweep.mutate({ limit: 50 })}
            disabled={
              runSweep.isPending || (replies.data?.summary.pending ?? 0) === 0
            }
            className="ui-focus inline-flex items-center gap-2 px-4 py-2 btn-pill-yellow text-xs disabled:opacity-50"
          >
            {runSweep.isPending ? (
              <>
                <Clock className="w-3 h-3 animate-spin" /> Running...
              </>
            ) : (
              <>
                <WandSparkles className="w-3 h-3" /> Auto-triage pending
              </>
            )}
          </button>
        </div>
        <div className="text-xs text-slate-500">
          Pending replies: <strong>{replies.data?.summary.pending ?? 0}</strong>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h3 className="text-lg font-black text-[#040026] tracking-tight">
          Simulate Inbound Reply
        </h3>
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="w-full px-4 py-2.5 input-minimal text-sm focus:outline-none focus:ring-2 focus:ring-[#EBCB4B]/40"
        >
          <option value="">Select contact</option>
          {contactOptions.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.firstName} {contact.lastName} -{' '}
              {contact.prospect.companyName ?? contact.prospect.domain}
            </option>
          ))}
        </select>
        <input
          value={replySubject}
          onChange={(e) => setReplySubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full px-4 py-2.5 input-minimal text-sm focus:outline-none focus:ring-2 focus:ring-[#EBCB4B]/40"
        />
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          rows={4}
          placeholder="Paste incoming reply text"
          className="w-full px-4 py-2.5 input-minimal text-sm focus:outline-none focus:ring-2 focus:ring-[#EBCB4B]/40 resize-none"
        />
        <button
          onClick={() => {
            if (!contactId || replyBody.trim().length < 2) return;
            captureReply.mutate({
              contactId,
              subject: replySubject || undefined,
              bodyText: replyBody,
              source: 'manual-test',
            });
          }}
          disabled={
            captureReply.isPending || !contactId || replyBody.trim().length < 2
          }
          className="ui-focus inline-flex items-center gap-2 px-4 py-2 btn-pill-secondary text-xs disabled:opacity-50"
        >
          {captureReply.isPending ? (
            <>
              <Clock className="w-3 h-3 animate-spin" /> Capturing...
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3" /> Add Test Reply
            </>
          )}
        </button>
      </div>

      {replyItems.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-[#040026] uppercase tracking-widest mb-2">
            No pending replies
          </p>
          <p className="admin-meta-text">
            Inkomende reacties worden hier automatisch geparkeerd.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {replyItems.map((reply: any) => (
            <div
              key={reply.id}
              className="glass-card card-interactive p-5 space-y-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#040026]">
                    {reply.contact.firstName} {reply.contact.lastName}
                  </p>
                  <p className="admin-meta-text mt-0.5">
                    {reply.contact.prospect.companyName ??
                      reply.contact.prospect.domain}
                  </p>
                </div>
                <span className="admin-meta-text">
                  {new Date(reply.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="admin-meta-text">
                Suggestion:{' '}
                <span className="font-bold text-[#040026]">
                  {reply.suggestion.intent}
                </span>{' '}
                ({(reply.suggestion.confidence * 100).toFixed(0)}%)
              </div>
              <p className="admin-meta-text-strong whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                {reply.bodyText ?? '(no body)'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => triageReply.mutate({ replyLogId: reply.id })}
                  disabled={triageReply.isPending}
                  className="ui-focus ui-tap px-3 py-1.5 rounded-full text-xs font-semibold bg-[#040026] text-white disabled:opacity-50"
                >
                  Auto
                </button>
                <button
                  onClick={() =>
                    triageReply.mutate({
                      replyLogId: reply.id,
                      categoryOverride: 'interested',
                    })
                  }
                  disabled={triageReply.isPending}
                  className="ui-focus ui-tap px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 disabled:opacity-50"
                >
                  Interested
                </button>
                <button
                  onClick={() =>
                    triageReply.mutate({
                      replyLogId: reply.id,
                      categoryOverride: 'later',
                    })
                  }
                  disabled={triageReply.isPending}
                  className="ui-focus ui-tap px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 disabled:opacity-50"
                >
                  Later
                </button>
                <button
                  onClick={() =>
                    triageReply.mutate({
                      replyLogId: reply.id,
                      categoryOverride: 'not_fit',
                    })
                  }
                  disabled={triageReply.isPending}
                  className="ui-focus ui-tap px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 disabled:opacity-50"
                >
                  Not fit
                </button>
                <button
                  onClick={() =>
                    triageReply.mutate({
                      replyLogId: reply.id,
                      categoryOverride: 'stop',
                    })
                  }
                  disabled={triageReply.isPending}
                  className="ui-focus ui-tap px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 disabled:opacity-50"
                >
                  Stop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
            <div className="h-5 bg-slate-200 rounded-xl w-64" />
          </div>
        ))}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (history.data ?? []) as any[];

  if (logs.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-sm font-black text-[#040026] uppercase tracking-widest mb-2">
          No outreach history yet
        </p>
        <p className="admin-meta-text">
          Verzonden interacties verschijnen hier zodra de eerste run live gaat.
        </p>
      </div>
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
                  ? 'bg-emerald-400'
                  : log.status === 'failed'
                    ? 'bg-red-400'
                    : 'bg-slate-300'
              }`}
            />
            <div>
              <span className="text-sm font-black text-[#040026]">
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
