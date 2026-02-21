'use client';

import { api } from '@/components/providers';
import {
  Building2,
  Zap,
  TrendingUp,
  Mail,
  ArrowRight,
  Search,
  FileText,
  BarChart3,
  Plus,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const stats = api.admin.getDashboardStats.useQuery();

  if (stats.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Command Center
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-6 h-32 bg-slate-100 rounded-[2rem]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="glass-card p-12 text-center text-red-500 font-bold">
        Failed to load dashboard. Check connection.
      </div>
    );
  }

  const data = stats.data;
  const pipeline = data?.pipeline || {
    queued: 0,
    sent: 0,
    opened: 0,
    replied: 0,
    booked: 0,
    converted: 0,
  };

  // KPI Configuration
  const kpis = [
    {
      label: 'Total Companies',
      value: data?.total ?? 0,
      icon: Building2,
      trend: '+12%',
      color: 'text-[#040026]',
    },
    {
      label: 'Active Signals',
      value: data?.unprocessedSignals ?? 0,
      icon: Zap,
      trend: 'High Activity',
      color: 'text-[#EBCB4B]',
    },
    {
      label: 'Pending Drafts',
      value: data?.pendingDrafts ?? 0,
      icon: Mail,
      trend: 'Action Needed',
      color: 'text-[#040026]',
    },
    {
      label: 'Reply Rate',
      value:
        pipeline.sent > 0
          ? `${Math.round((pipeline.replied / pipeline.sent) * 100)}%`
          : '0%',
      icon: TrendingUp,
      trend: 'vs last week',
      color: 'text-[#007AFF]',
    },
  ];

  // Quick Actions Configuration
  const actions = [
    {
      label: 'New Search',
      icon: Search,
      href: '/admin/prospects',
      bg: 'bg-[#040026]',
      text: 'text-white',
      iconColor: 'text-[#EBCB4B]',
    },
    {
      label: 'Process Signals',
      icon: Play,
      href: '/admin/outreach',
      bg: 'bg-white',
      text: 'text-[#040026]',
      iconColor: 'text-[#EBCB4B]',
    },
    {
      label: 'View Briefs',
      icon: FileText,
      href: '/admin/briefs',
      bg: 'bg-white',
      text: 'text-[#040026]',
      iconColor: 'text-[#040026]',
    },
    {
      label: 'Add Company',
      icon: Plus,
      href: '/admin/prospects/new',
      bg: 'bg-white',
      text: 'text-[#040026]',
      iconColor: 'text-[#040026]',
    },
  ];

  // Pipeline Data for Chart
  const funnelStages = [
    { label: 'Sent', value: pipeline.sent, color: 'bg-slate-300' },
    { label: 'Opened', value: pipeline.opened, color: 'bg-[#007AFF]' },
    { label: 'Replied', value: pipeline.replied, color: 'bg-[#EBCB4B]' },
    { label: 'Booked', value: pipeline.booked, color: 'bg-[#040026]' },
  ];

  const maxVal = Math.max(pipeline.sent, 1);

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
            Command Center
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* 1. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="glass-card p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300"
          >
            <div className="absolute -right-4 -top-4 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity scale-150">
              <kpi.icon className="w-24 h-24 text-[#040026]" />
            </div>
            <div className="flex flex-col justify-between h-full relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                </div>
                {i === 1 && (
                  <span className="w-2 h-2 rounded-full bg-[#EBCB4B] animate-pulse" />
                )}
              </div>
              <div>
                <div className="text-4xl font-black text-[#040026] tracking-tighter mb-1">
                  {kpi.value}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {kpi.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Quick Actions Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className={cn(
              'group p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 transition-all hover:shadow-lg hover:border-[#EBCB4B]/30',
              action.bg,
            )}
          >
            <div
              className={cn(
                'p-2.5 rounded-xl transition-transform group-hover:scale-110',
                action.bg === 'bg-[#040026]'
                  ? 'bg-[#EBCB4B]/10'
                  : 'bg-slate-50',
              )}
            >
              <action.icon className={cn('w-5 h-5', action.iconColor)} />
            </div>
            <span
              className={cn('font-black text-sm tracking-tight', action.text)}
            >
              {action.label}
            </span>
            {action.bg === 'bg-[#040026]' && (
              <ArrowRight className="w-4 h-4 text-white/50 ml-auto group-hover:translate-x-1 transition-transform" />
            )}
          </Link>
        ))}
      </div>

      {/* 3. Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Conversion Pipeline Chart */}
        <div className="lg:col-span-2 glass-card p-8 rounded-[2rem]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-[#040026] tracking-tight">
                Conversion Pipeline
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Last 30 Days Performance
              </p>
            </div>
            <div className="p-3 rounded-full bg-slate-50">
              <BarChart3 className="w-5 h-5 text-[#040026]" />
            </div>
          </div>

          <div className="space-y-6">
            {funnelStages.map((stage, i) => {
              const widthPercentage = (stage.value / maxVal) * 100;
              // Calculate conversion from previous step
              const previousValue =
                i > 0
                  ? (funnelStages[i - 1]?.value ?? stage.value)
                  : stage.value;
              const conversionRate =
                previousValue > 0
                  ? Math.round((stage.value / previousValue) * 100)
                  : 0;

              return (
                <div key={stage.label} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-[#040026] w-16">
                        {stage.label}
                      </span>
                      <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                        {stage.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      {i === 0 ? '100%' : `${conversionRate}% conv.`}
                    </div>
                  </div>

                  <div className="h-10 w-full bg-[#FCFCFD] rounded-xl border border-slate-100 overflow-hidden relative">
                    {/* Background grid lines for effect */}
                    <div className="absolute inset-0 grid grid-cols-12 opacity-5 pointer-events-none">
                      {Array.from({ length: 12 }).map((_, j) => (
                        <div key={j} className="border-r border-[#040026]" />
                      ))}
                    </div>

                    <div
                      className={cn(
                        'h-full rounded-r-xl transition-all duration-1000 ease-out relative',
                        stage.color,
                      )}
                      style={{ width: `${Math.max(widthPercentage, 2)}%` }}
                    >
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/90">
                        {Math.round(widthPercentage)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Recent Engagement Feed */}
        <div className="glass-card p-8 rounded-[2rem] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-[#040026] tracking-tight">
              Live Feed
            </h2>
            <div className="w-2 h-2 rounded-full bg-[#EBCB4B] animate-pulse" />
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {(data?.recentSessions ?? []).length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm font-bold text-slate-400">
                  No recent activity
                </p>
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (data?.recentSessions as any[]).map((session) => (
                <div
                  key={session.id}
                  className="group p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xs font-black text-[#040026] shadow-sm shrink-0">
                      {session.prospect.companyName?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#040026] leading-tight group-hover:text-[#007AFF] transition-colors">
                        {session.prospect.companyName}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
                          Step {session.maxStepReached}
                        </span>
                        {session.pdfDownloaded && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 uppercase tracking-wide">
                            PDF
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-300 mt-2">
                        {new Date(session.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            href="/admin/signals"
            className="mt-auto pt-6 text-center text-xs font-black uppercase tracking-widest text-slate-400 hover:text-[#040026] transition-colors flex items-center justify-center gap-2"
          >
            View All Signals <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
