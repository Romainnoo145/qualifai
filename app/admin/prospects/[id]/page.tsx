'use client';

import { api } from '@/components/providers';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Globe,
  MapPin,
  Users,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  Clock,
  FileDown,
  Phone,
} from 'lucide-react';
import { useState } from 'react';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ENRICHED: 'bg-blue-50 text-blue-600',
  GENERATING: 'bg-amber-50 text-amber-600',
  READY: 'bg-emerald-50 text-emerald-600',
  SENT: 'bg-indigo-50 text-indigo-600',
  VIEWED: 'bg-cyan-50 text-cyan-600',
  ENGAGED: 'bg-purple-50 text-purple-600',
  CONVERTED: 'bg-yellow-50 text-yellow-700',
  ARCHIVED: 'bg-slate-50 text-slate-400',
};

export default function ProspectDetail() {
  const params = useParams();
  const id = params.id as string;
  const [copied, setCopied] = useState(false);

  const prospect = api.admin.getProspect.useQuery({ id });

  const copyLink = () => {
    if (!prospect.data) return;
    const url = `${window.location.origin}/discover/${prospect.data.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (prospect.isLoading) {
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

  if (!prospect.data) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-slate-500">Prospect not found</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prospect.data as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/prospects"
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-heading text-slate-900">
                {p.companyName ?? p.domain}
              </h1>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[p.status] ?? ''}`}
              >
                {p.status}
              </span>
            </div>
            <p className="text-sm text-slate-400">{p.domain}</p>
          </div>
        </div>

        {['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
          p.status,
        ) && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </>
              )}
            </button>
            <Link
              href={`/discover/${p.slug}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Wizard
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Company Info */}
        <div className="col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              Company Profile
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {p.industry && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">
                    {p.industry}
                    {p.subIndustry ? ` / ${p.subIndustry}` : ''}
                  </span>
                </div>
              )}
              {(p.city ?? p.country) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">
                    {[p.city, p.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {p.employeeRange && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">
                    {p.employeeRange} employees
                  </span>
                </div>
              )}
              {p.revenueRange && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{p.revenueRange}</span>
                </div>
              )}
            </div>
            {p.description && (
              <p className="text-sm text-slate-500 mt-4 border-t border-slate-100 pt-4">
                {p.description}
              </p>
            )}
            {p.technologies.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Technologies
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {p.technologies.map((tech: string) => (
                    <span
                      key={tech}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Internal Notes */}
          {p.internalNotes && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">
                Internal Notes
              </h2>
              <p className="text-sm text-slate-600">{p.internalNotes}</p>
            </div>
          )}

          {/* Content Preview */}
          {p.heroContent && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">
                Generated Content Preview
              </h2>
              <div className="text-sm text-slate-600 space-y-2">
                <p>
                  <strong>Hero:</strong>{' '}
                  {(p.heroContent as Record<string, string>).headline}
                </p>
                <p className="text-xs text-slate-400">
                  {(p.heroContent as Record<string, string>).subheadline}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sessions sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              Sessions ({p._count.sessions})
            </h2>
            {p.sessions.length > 0 ? (
              <div className="space-y-3">
                {p.sessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="p-3 bg-slate-50 rounded-lg text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">
                        {new Date(session.createdAt).toLocaleString()}
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        Step {session.maxStepReached}/5
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {session.pdfDownloaded && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                          <FileDown className="w-3 h-3" /> PDF
                        </span>
                      )}
                      {session.callBooked && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">
                          <Phone className="w-3 h-3" /> Call
                        </span>
                      )}
                      {!session.pdfDownloaded && !session.callBooked && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" /> Browsing
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                No sessions yet
              </p>
            )}
          </div>

          {/* Notification log */}
          {p.notificationLogs.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">
                Notifications
              </h2>
              <div className="space-y-2">
                {p.notificationLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-600">{log.type}</span>
                    <span
                      className={
                        log.status === 'sent'
                          ? 'text-green-600'
                          : 'text-red-500'
                      }
                    >
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
