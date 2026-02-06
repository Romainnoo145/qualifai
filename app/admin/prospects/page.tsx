'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { Globe, Building2, ExternalLink, Copy, Check } from 'lucide-react';
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

export default function ProspectList() {
  const prospects = api.admin.listProspects.useQuery();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/discover/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-slate-900">
          Prospects
        </h1>
        <Link
          href="/admin/prospects/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors"
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
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(prospects.data?.prospects as any[])?.map((prospect: any) => (
            <div
              key={prospect.id}
              className="glass-card glass-card-hover p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                {prospect.logoUrl ? (
                  <img
                    src={prospect.logoUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/prospects/${prospect.id}`}
                      className="font-semibold text-slate-900 hover:text-klarifai-blue transition-colors"
                    >
                      {prospect.companyName ?? prospect.domain}
                    </Link>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColors[prospect.status] ?? ''}`}
                    >
                      {prospect.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span>{prospect.domain}</span>
                    {prospect.industry && (
                      <>
                        <span className="text-slate-300">/</span>
                        <span>{prospect.industry}</span>
                      </>
                    )}
                    {prospect._count.sessions > 0 && (
                      <>
                        <span className="text-slate-300">/</span>
                        <span>{prospect._count.sessions} sessions</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
                  prospect.status,
                ) && (
                  <>
                    <button
                      onClick={() => copyLink(prospect.slug)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      {copiedSlug === prospect.slug ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy Link
                        </>
                      )}
                    </button>
                    <Link
                      href={`/discover/${prospect.slug}`}
                      target="_blank"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Preview
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
