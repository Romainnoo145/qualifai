'use client';

import { api } from '@/components/providers';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  Linkedin,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const outreachColors: Record<string, string> = {
  NONE: 'bg-slate-100 text-slate-500',
  QUEUED: 'bg-amber-50 text-amber-600',
  EMAIL_SENT: 'bg-blue-50 text-blue-600',
  OPENED: 'bg-cyan-50 text-cyan-600',
  REPLIED: 'bg-purple-50 text-purple-600',
  CONVERTED: 'bg-emerald-50 text-emerald-600',
  OPTED_OUT: 'bg-red-50 text-red-500',
};

export default function ContactDetail() {
  const params = useParams();
  const id = params.id as string;
  const utils = api.useUtils();

  const contact = api.contacts.get.useQuery({ id });
  const latestLossMap = api.assets.getLatest.useQuery(
    { prospectId: contact.data?.prospect?.id ?? '' },
    { enabled: Boolean(contact.data?.prospect?.id) },
  );
  const queueOutreachDraft = api.assets.queueOutreachDraft.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.contacts.get.invalidate({ id }),
        utils.outreach.getQueue.invalidate(),
        utils.outreach.getTouchTaskQueue.invalidate(),
        utils.sequences.list.invalidate(),
      ]);
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queueTouchTask = (api.outreach.queueTouchTask as any).useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.contacts.get.invalidate({ id }),
        utils.outreach.getTouchTaskQueue.invalidate(),
      ]);
    },
  });

  if (contact.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-48 animate-pulse" />
        <div className="glass-card p-8 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-64 mb-4" />
          <div className="h-4 bg-slate-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!contact.data) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-slate-500">Contact not found</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = contact.data as any;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/contacts"
            className="ui-tap w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-100 text-slate-400 hover:text-[#040026] transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="px-4 py-1.5 rounded-full bg-[#040026]/5 text-[#040026] border border-[#040026]/10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Contact Profile
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 rounded-[2rem] bg-white border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-[#040026] transition-all">
              <span className="text-2xl font-black text-[#040026]">
                {c.firstName?.[0]}
                {c.lastName?.[0]}
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
                  {c.firstName} {c.lastName}
                </h1>
                <span
                  className={cn(
                    'text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border',
                    outreachColors[c.outreachStatus]
                      ?.replace('bg-', 'bg-')
                      .replace('text-', 'text-') ??
                      'bg-slate-50 text-slate-400 border-slate-100',
                  )}
                >
                  {c.outreachStatus}
                </span>
              </div>
              {c.jobTitle && (
                <p className="text-xl font-bold text-slate-400 tracking-tight">
                  {c.jobTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (!latestLossMap.data) return;
                queueOutreachDraft.mutate({
                  workflowLossMapId: latestLossMap.data.id,
                  contactId: id,
                });
              }}
              disabled={queueOutreachDraft.isPending || !latestLossMap.data}
              className="ui-tap px-8 py-3 btn-pill-primary text-xs disabled:opacity-50"
            >
              {queueOutreachDraft.isPending
                ? 'Initializing...'
                : latestLossMap.data
                  ? 'Initialize Outreach'
                  : 'No Report Yet'}
            </button>
            <button
              onClick={() =>
                queueTouchTask.mutate({ contactId: id, channel: 'call' })
              }
              disabled={queueTouchTask.isPending}
              className="ui-tap px-6 py-3 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Queue Call
            </button>
            <button
              onClick={() =>
                queueTouchTask.mutate({ contactId: id, channel: 'linkedin' })
              }
              disabled={queueTouchTask.isPending}
              className="ui-tap px-6 py-3 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Queue LinkedIn
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              Contact Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {c.seniority && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{c.seniority}</span>
                </div>
              )}
              {c.department && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{c.department}</span>
                </div>
              )}
              {c.primaryEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a
                    href={`mailto:${c.primaryEmail}`}
                    className="text-klarifai-blue hover:underline"
                  >
                    {c.primaryEmail}
                  </a>
                </div>
              )}
              {c.primaryPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{c.primaryPhone}</span>
                </div>
              )}
              {(c.city || c.country) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">
                    {[c.city, c.state, c.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {c.linkedinUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <Linkedin className="w-4 h-4 text-slate-400" />
                  <a
                    href={c.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-klarifai-blue hover:underline"
                  >
                    LinkedIn Profile
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Company info */}
          {c.prospect && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Company
              </h2>
              <Link
                href={`/admin/prospects/${c.prospect.id}`}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {c.prospect.logoUrl ? (
                  <img
                    src={c.prospect.logoUrl}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {c.prospect.companyName ?? c.prospect.domain}
                  </p>
                  <p className="text-xs text-slate-400">{c.prospect.domain}</p>
                </div>
              </Link>
            </div>
          )}

          {/* Outreach Log */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              Outreach History
            </h2>
            {c.outreachLogs?.length > 0 ? (
              <div className="space-y-3">
                {c.outreachLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        {log.type}
                      </span>
                      {log.subject && (
                        <span className="text-xs text-slate-400 ml-2">
                          {log.subject}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {log.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                No outreach yet
              </p>
            )}
          </div>
        </div>

        {/* Signals sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              Signals
            </h2>
            {c.signals?.length > 0 ? (
              <div className="space-y-3">
                {c.signals.map((signal: any) => (
                  <div key={signal.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3 text-klarifai-yellow-dark" />
                      <span className="text-xs font-medium text-slate-600">
                        {signal.signalType}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{signal.title}</p>
                    {signal.description && (
                      <p className="text-xs text-slate-400 mt-1">
                        {signal.description}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(signal.detectedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                No signals detected
              </p>
            )}
          </div>

          {/* Notes */}
          {c.outreachNotes && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">
                Notes
              </h2>
              <p className="text-sm text-slate-600">{c.outreachNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
