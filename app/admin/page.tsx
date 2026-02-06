'use client';

import { api } from '@/components/providers';
import { Users, Eye, Zap, Trophy, Clock } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const stats = api.admin.getDashboardStats.useQuery();

  if (stats.isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-heading text-slate-900">
          Dashboard
        </h1>
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="h-8 bg-slate-200 rounded w-12 mb-2" />
              <div className="h-4 bg-slate-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-slate-500">
          Failed to load dashboard. Check your admin token.
        </p>
      </div>
    );
  }

  const data = stats.data;
  const statCards = [
    {
      label: 'Total Prospects',
      value: data?.total ?? 0,
      icon: Users,
      color: 'text-klarifai-blue',
    },
    {
      label: 'Ready to Send',
      value: data?.ready ?? 0,
      icon: Zap,
      color: 'text-klarifai-yellow-dark',
    },
    {
      label: 'Viewed',
      value: data?.viewed ?? 0,
      icon: Eye,
      color: 'text-klarifai-cyan',
    },
    {
      label: 'Engaged',
      value: data?.engaged ?? 0,
      icon: Clock,
      color: 'text-klarifai-purple',
    },
    {
      label: 'Converted',
      value: data?.converted ?? 0,
      icon: Trophy,
      color: 'text-klarifai-emerald',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-slate-900">
          Dashboard
        </h1>
        <Link
          href="/admin/prospects/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors"
        >
          + New Prospect
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="glass-card p-6">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="text-3xl font-bold text-slate-900 font-heading">
              {stat.value}
            </div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Recent Sessions
        </h2>
        {data?.recentSessions && data.recentSessions.length > 0 ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(data.recentSessions as any[]).map((session: any) => (
              <div
                key={session.id}
                className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {session.prospect.companyName ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">
                    Step {session.maxStepReached}/5
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {session.pdfDownloaded && (
                    <span className="text-xs bg-klarifai-emerald/10 text-klarifai-emerald px-2 py-1 rounded-full">
                      PDF
                    </span>
                  )}
                  {session.callBooked && (
                    <span className="text-xs bg-klarifai-yellow/10 text-klarifai-yellow-dark px-2 py-1 rounded-full font-semibold">
                      Call Booked
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">
            No sessions yet. Create your first prospect to get started.
          </p>
        )}
      </div>
    </div>
  );
}
