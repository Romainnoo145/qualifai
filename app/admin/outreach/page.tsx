'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Mail,
  Check,
  X,
  Clock,
  Phone,
  Linkedin,
  Building2,
  Loader2,
  Send,
  History,
  ShieldCheck,
  MessageSquare,
  ListChecks,
  WandSparkles,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type View = 'queue' | 'tasks' | 'replies' | 'sent';
type TouchChannel = 'email' | 'call' | 'linkedin' | 'whatsapp';

export default function OutreachPage() {
  const [view, setView] = useState<View>('queue');

  return (
    <div className="space-y-16 animate-fade-in-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Outreach
        </h1>
        <ProcessSignalsButton />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-4 border-b border-slate-50 overflow-x-auto pb-4">
        <button
          onClick={() => setView('queue')}
          className={cn(
            'ui-tap ui-focus flex items-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap',
            view === 'queue'
              ? 'bg-[#040026] text-white shadow-xl shadow-[#040026]/20'
              : 'text-slate-400 hover:text-[#040026] hover:bg-white',
          )}
        >
          <Mail className="w-4 h-4" /> Drafts Queue
        </button>
        <button
          onClick={() => setView('tasks')}
          className={cn(
            'ui-tap ui-focus flex items-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap',
            view === 'tasks'
              ? 'bg-[#040026] text-white shadow-xl shadow-[#040026]/20'
              : 'text-slate-400 hover:text-[#040026] hover:bg-white',
          )}
        >
          <ListChecks className="w-4 h-4" /> Multi-touch Tasks
        </button>
        <button
          onClick={() => setView('replies')}
          className={cn(
            'ui-tap ui-focus flex items-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap',
            view === 'replies'
              ? 'bg-[#040026] text-white shadow-xl shadow-[#040026]/20'
              : 'text-slate-400 hover:text-[#040026] hover:bg-white',
          )}
        >
          <MessageSquare className="w-4 h-4" /> Replies
        </button>
        <button
          onClick={() => setView('sent')}
          className={cn(
            'ui-tap ui-focus flex items-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all whitespace-nowrap',
            view === 'sent'
              ? 'bg-[#040026] text-white shadow-xl shadow-[#040026]/20'
              : 'text-slate-400 hover:text-[#040026] hover:bg-white',
          )}
        >
          <History className="w-4 h-4" /> Sent History
        </button>
      </div>

      {view === 'queue' ? (
        <DraftQueue />
      ) : view === 'tasks' ? (
        <TouchTaskQueue />
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
      className="ui-focus flex items-center justify-center gap-2 px-4 py-2 btn-pill-yellow text-sm disabled:opacity-50 w-full sm:w-auto"
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

function DraftQueue() {
  const queue = api.outreach.getDecisionInbox.useQuery({ limit: 150 });
  const utils = api.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approve = (api.outreach.approveDraft as any).useMutation({
    onSuccess: () => {
      utils.outreach.getDecisionInbox.invalidate();
      utils.outreach.getHistory.invalidate();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reject = (api.outreach.rejectDraft as any).useMutation({
    onSuccess: () => utils.outreach.getDecisionInbox.invalidate(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bulkApprove = (api.outreach.bulkApproveLowRisk as any).useMutation({
    onSuccess: () => {
      utils.outreach.getDecisionInbox.invalidate();
      utils.outreach.getHistory.invalidate();
    },
  });

  if (queue.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-64" />
          </div>
        ))}
      </div>
    );
  }

  const queueData = queue.data;
  if (!queueData) return null;

  const hasManualReviewLeads = (queueData.manualReviewLeads?.length ?? 0) > 0;
  if (!queueData.drafts?.length && !hasManualReviewLeads) {
    return (
      <div className="glass-card p-12 text-center">
        <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 mb-2">No drafts in queue</p>
        <p className="text-xs text-slate-400">
          Generate emails from contact pages or process signals to create drafts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>
            Total drafts: <strong>{queueData.summary.total}</strong>
          </span>
          <span className="text-klarifai-emerald">
            Low-risk: <strong>{queueData.summary.lowRisk}</strong>
          </span>
          <span className="text-klarifai-yellow-dark">
            Needs review: <strong>{queueData.summary.needsReview}</strong>
          </span>
          <span className="text-red-600">
            Blocked: <strong>{queueData.summary.blocked}</strong>
          </span>
          <span className="text-amber-700">
            Manual lead review:{' '}
            <strong>{queueData.summary.manualReviewLeads ?? 0}</strong>
          </span>
        </div>
        <button
          onClick={() => bulkApprove.mutate({ limit: 25 })}
          disabled={bulkApprove.isPending || queueData.summary.lowRisk === 0}
          className="ui-focus inline-flex items-center gap-2 px-4 py-2 btn-pill-yellow text-xs disabled:opacity-50"
        >
          {bulkApprove.isPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Sending...
            </>
          ) : (
            <>
              <ShieldCheck className="w-3 h-3" /> Approve Low-Risk (25)
            </>
          )}
        </button>
      </div>

      {(queueData.manualReviewLeads?.length ?? 0) > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-black text-[#040026] tracking-tight">
              Lead Data Review Queue
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Deze leads missen cruciale data (of e-mailkwaliteit) en moeten eerst
            worden aangevuld.
          </p>
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(queueData.manualReviewLeads as any[])
              .slice(0, 8)
              .map((lead: any) => (
                <Link
                  key={lead.id}
                  href={`/admin/contacts/${lead.id}`}
                  className="block rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3 hover:bg-amber-50/70 transition-all"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black text-[#040026]">
                        {lead.firstName} {lead.lastName}{' '}
                        <span className="text-[10px] text-slate-400 font-bold ml-1">
                          ({lead.priorityTier}, score {lead.priorityScore})
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        {lead.prospect?.companyName ?? lead.prospect?.domain}
                      </p>
                    </div>
                    <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                      {(lead.manualReviewReasons?.[0] as string) ??
                        'Missing data'}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(queueData.drafts as any[]).map((draft: any) => (
        <div key={draft.id} className="glass-card card-interactive p-8">
          <div className="mb-4 flex items-center gap-3">
            <span
              className={cn(
                'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
                draft.riskLevel === 'low'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : draft.riskLevel === 'blocked'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-amber-50 text-amber-600 border-amber-100',
              )}
            >
              Risk: {draft.riskLevel}
            </span>
            <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border bg-slate-50 text-slate-600 border-slate-100">
              {draft.priorityTier} • Score {draft.priorityScore}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
              {draft.riskReason}
            </span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div>
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-50 text-[#040026] uppercase tracking-wider">
                  {draft.type.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(draft.createdAt).toLocaleString()}
                </span>
              </div>
              <Link
                href={`/admin/contacts/${draft.contact.id}`}
                className="text-lg font-black text-[#040026] hover:text-[#007AFF] transition-all tracking-tight"
              >
                {draft.contact.firstName} {draft.contact.lastName}
              </Link>
              {draft.contact.prospect && (
                <span className="text-xs text-slate-400 font-bold ml-3 inline-flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {draft.contact.prospect.companyName ??
                    draft.contact.prospect.domain}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => approve.mutate({ id: draft.id })}
                disabled={approve.isPending || draft.riskLevel === 'blocked'}
                className="ui-focus ui-tap flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all disabled:opacity-50 shadow-lg shadow-[#040026]/10"
              >
                <Check className="w-3.5 h-3.5" /> Approve & Send
              </button>
              <button
                onClick={() => reject.mutate({ id: draft.id })}
                disabled={reject.isPending}
                className="ui-focus ui-tap flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </div>

          {/* Email preview */}
          <div className="bg-[#FCFCFD] rounded-2xl p-6 border border-slate-100">
            <p className="text-sm font-black text-[#040026] mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-300" />
              <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mr-2">
                Subject
              </span>
              {draft.subject}
            </p>
            <div
              className="text-sm text-slate-600 prose prose-sm max-w-none font-medium leading-relaxed"
              dangerouslySetInnerHTML={{ __html: draft.bodyHtml ?? '' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TouchTaskQueue() {
  const utils = api.useUtils();
  const [contactId, setContactId] = useState('');
  const [channel, setChannel] = useState<TouchChannel>('call');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');

  const contacts = api.contacts.list.useQuery({ limit: 150 });
  const tasks = api.outreach.getTouchTaskQueue.useQuery({
    status: 'open',
    limit: 200,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queueTask = (api.outreach.queueTouchTask as any).useMutation({
    onSuccess: async () => {
      setSubject('');
      setNotes('');
      setDueAt('');
      await Promise.all([
        utils.outreach.getTouchTaskQueue.invalidate(),
        utils.outreach.getHistory.invalidate(),
      ]);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completeTask = (api.outreach.completeTouchTask as any).useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.outreach.getTouchTaskQueue.invalidate(),
        utils.outreach.getHistory.invalidate(),
      ]);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skipTask = (api.outreach.skipTouchTask as any).useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.outreach.getTouchTaskQueue.invalidate(),
        utils.outreach.getHistory.invalidate(),
      ]);
    },
  });

  const taskItems = (tasks.data?.items ?? []) as any[];
  const contactOptions = (contacts.data?.contacts ?? []) as any[];

  const submitTask = () => {
    if (!contactId) return;
    queueTask.mutate({
      contactId,
      channel,
      subject: subject.trim() || undefined,
      notes: notes.trim() || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span>
          Open tasks: <strong>{tasks.data?.summary.open ?? 0}</strong>
        </span>
        <span className="text-amber-700">
          Overdue: <strong>{tasks.data?.summary.overdue ?? 0}</strong>
        </span>
        <span>
          Call: <strong>{tasks.data?.summary.byChannel.call ?? 0}</strong>
        </span>
        <span>
          LinkedIn:{' '}
          <strong>{tasks.data?.summary.byChannel.linkedin ?? 0}</strong>
        </span>
        <span>
          WhatsApp:{' '}
          <strong>{tasks.data?.summary.byChannel.whatsapp ?? 0}</strong>
        </span>
        <span>
          Email: <strong>{tasks.data?.summary.byChannel.email ?? 0}</strong>
        </span>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-black text-[#040026] tracking-tight">
          Queue New Touch Task
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as TouchChannel)}
            className="w-full px-4 py-2.5 input-minimal text-sm focus:outline-none focus:ring-2 focus:ring-[#EBCB4B]/40"
          >
            <option value="call">Call</option>
            <option value="linkedin">LinkedIn</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Manual Email</option>
          </select>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Task title (optional)"
            className="w-full px-4 py-2.5 input-minimal text-sm focus:outline-none focus:ring-2 focus:ring-[#EBCB4B]/40"
          />
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full px-4 py-2.5 input-minimal text-sm focus:outline-none focus:ring-2 focus:ring-[#EBCB4B]/40"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Context / notes for this touch"
          className="w-full px-4 py-2.5 input-minimal text-sm focus:outline-none focus:ring-2 focus:ring-[#EBCB4B]/40 resize-none"
        />
        <button
          onClick={submitTask}
          disabled={queueTask.isPending || !contactId}
          className="ui-focus inline-flex items-center gap-2 px-4 py-2 btn-pill-secondary text-xs disabled:opacity-50"
        >
          {queueTask.isPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Queueing...
            </>
          ) : (
            <>
              <ListChecks className="w-3 h-3" /> Add Task
            </>
          )}
        </button>
      </div>

      {taskItems.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No open multi-touch tasks.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {taskItems.map((task) => (
            <div
              key={task.id}
              className="glass-card card-interactive p-5 space-y-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#040026]">
                    {task.contact.firstName} {task.contact.lastName}
                  </p>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    {task.contact.prospect.companyName ??
                      task.contact.prospect.domain}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold uppercase tracking-wide">
                    {task.channel}
                  </span>
                  {task.task?.isOverdue && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold uppercase tracking-wide">
                      Overdue
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  {task.channel === 'call' ? (
                    <Phone className="w-3.5 h-3.5" />
                  ) : task.channel === 'linkedin' ? (
                    <Linkedin className="w-3.5 h-3.5" />
                  ) : task.channel === 'whatsapp' ? (
                    <MessageSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  {task.subject ?? 'Manual touch task'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {task.task?.dueAt
                    ? `Due ${new Date(task.task.dueAt).toLocaleString()}`
                    : 'No due date'}
                </span>
              </div>

              {task.task?.notes && (
                <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                  {task.task.notes}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => completeTask.mutate({ id: task.id })}
                  disabled={completeTask.isPending || skipTask.isPending}
                  className="ui-focus ui-tap px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> Completed
                  </span>
                </button>
                <button
                  onClick={() => skipTask.mutate({ id: task.id })}
                  disabled={completeTask.isPending || skipTask.isPending}
                  className="ui-focus ui-tap px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <X className="w-3 h-3" /> Skip
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
          <p className="text-sm text-slate-500">No pending replies.</p>
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
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    {reply.contact.prospect.companyName ??
                      reply.contact.prospect.domain}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(reply.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Suggestion:{' '}
                <span className="font-bold text-[#040026]">
                  {reply.suggestion.intent}
                </span>{' '}
                ({(reply.suggestion.confidence * 100).toFixed(0)}%)
              </div>
              <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
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
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-64" />
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
        <p className="text-slate-500">No outreach history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log: any) => (
        <div
          key={log.id}
          className="glass-card card-interactive p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
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
                <span className="text-xs text-slate-400 font-bold ml-2">
                  @ {log.contact.prospect.companyName}
                </span>
              )}
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {log.subject}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {log.type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(log.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
