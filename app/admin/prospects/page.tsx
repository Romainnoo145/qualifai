'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Globe,
  Building2,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

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

export default function ProspectList() {
  const prospects = api.admin.listProspects.useQuery();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const copyLink = (prospect: {
    slug: string;
    readableSlug: string | null;
  }) => {
    const url = prospect.readableSlug
      ? `${window.location.origin}/voor/${prospect.readableSlug}`
      : `${window.location.origin}/discover/${prospect.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(prospect.slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Prospects
        </h1>
        <Link
          href="/admin/prospects/new"
          className="px-8 py-3 btn-pill-primary text-xs"
        >
          + New Prospect
        </Link>
      </div>

      {prospects.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-48" />
            </div>
          ))}
        </div>
      ) : prospects.data?.prospects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">No prospects yet</p>
          <Link
            href="/admin/prospects/new"
            className="text-sm font-semibold text-klarifai-blue hover:underline"
          >
            Create your first prospect
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(prospects.data?.prospects as any[])?.map((prospect: any) => (
            <div
              key={prospect.id}
              className="glass-card glass-card-hover p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between group"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden">
                  {prospect.logoUrl ? (
                    <img
                      src={prospect.logoUrl}
                      alt=""
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-slate-200" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      href={`/admin/prospects/${prospect.id}`}
                      className="text-xl font-black text-[#040026] tracking-tighter hover:text-[#007AFF] transition-all"
                    >
                      {prospect.companyName ?? prospect.domain}
                    </Link>
                    <span
                      className={cn(
                        'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
                        statusColors[prospect.status] ||
                          'bg-slate-50 text-slate-400 border-slate-100',
                      )}
                    >
                      {prospect.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 mt-2">
                    <span className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" /> {prospect.domain}
                    </span>
                    {prospect.industry && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                        <span>{prospect.industry}</span>
                      </>
                    )}
                    {prospect._count.sessions > 0 && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className="text-[#007AFF]">
                          {prospect._count.sessions} sessions
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
                  prospect.status,
                ) && (
                  <>
                    <button
                      onClick={() => copyLink(prospect)}
                      className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100"
                    >
                      {copiedSlug === prospect.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Share
                        </>
                      )}
                    </button>
                    <Link
                      href={
                        prospect.readableSlug
                          ? `/voor/${prospect.readableSlug}`
                          : `/discover/${prospect.slug}`
                      }
                      target="_blank"
                      className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl shadow-[#040026]/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Preview
                    </Link>
                  </>
                )}
                <Link
                  href={`/admin/prospects/${prospect.id}`}
                  className="ui-tap p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-[#040026] hover:bg-slate-100 border border-slate-100 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
