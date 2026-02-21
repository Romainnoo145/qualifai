'use client';

import { api } from '@/components/providers';
import {
  CreditCard,
  Building2,
  Users,
  Zap,
  Download,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const stats = api.admin.getDashboardStats.useQuery();
  const [exporting, setExporting] = useState<'companies' | 'contacts' | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);

  const downloadExport = async (kind: 'companies' | 'contacts') => {
    const token = localStorage.getItem('admin-token');
    if (!token) {
      setExportError('Admin token missing. Sign in again to export data.');
      return;
    }

    setExportError(null);
    setExporting(kind);
    try {
      const response = await fetch(`/api/export/${kind}`, {
        headers: { 'x-admin-token': token },
      });
      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}.`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fileName =
        match?.[1] ?? `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Export failed unexpectedly.',
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
        Settings
      </h1>

      {/* Credit usage */}
      <div className="glass-card p-10 rounded-[2.5rem]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 ml-1">
          Usage Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-8 bg-[#FCFCFD] rounded-3xl border border-slate-100 flex flex-col items-center justify-center space-y-3 shadow-inner">
            <CreditCard className="w-5 h-5 text-slate-200" />
            <p className="text-3xl font-black text-[#040026] tracking-tighter">
              {stats.data?.creditsUsed ?? 0}
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Credits Used
            </p>
          </div>
          <div className="p-8 bg-[#FCFCFD] rounded-3xl border border-slate-100 flex flex-col items-center justify-center space-y-3 shadow-inner">
            <Building2 className="w-5 h-5 text-slate-200" />
            <p className="text-3xl font-black text-[#040026] tracking-tighter">
              {stats.data?.total ?? 0}
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Companies
            </p>
          </div>
          <div className="p-8 bg-[#FCFCFD] rounded-3xl border border-slate-100 flex flex-col items-center justify-center space-y-3 shadow-inner">
            <Users className="w-5 h-5 text-slate-200" />
            <p className="text-3xl font-black text-[#040026] tracking-tighter">
              {stats.data?.totalContacts ?? 0}
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Contacts
            </p>
          </div>
          <div className="p-8 bg-[#FCFCFD] rounded-3xl border border-slate-100 flex flex-col items-center justify-center space-y-3 shadow-inner">
            <Zap className="w-5 h-5 text-slate-200" />
            <p className="text-3xl font-black text-[#040026] tracking-tighter">
              {stats.data?.totalSignals ?? 0}
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Signals
            </p>
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="glass-card p-10 rounded-[2.5rem]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 ml-1">
          Data Export
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => void downloadExport('companies')}
            disabled={exporting !== null}
            className="flex items-center justify-center gap-3 px-8 py-4 btn-pill-secondary text-xs w-full sm:w-auto font-black uppercase tracking-widest disabled:opacity-50"
          >
            {exporting === 'companies' ? (
              <Loader2 className="w-4 h-4 opacity-50 animate-spin" />
            ) : (
              <Download className="w-4 h-4 opacity-50" />
            )}{' '}
            {exporting === 'companies' ? 'Exporting...' : 'Export Companies'}
          </button>
          <button
            onClick={() => void downloadExport('contacts')}
            disabled={exporting !== null}
            className="flex items-center justify-center gap-3 px-8 py-4 btn-pill-secondary text-xs w-full sm:w-auto font-black uppercase tracking-widest disabled:opacity-50"
          >
            {exporting === 'contacts' ? (
              <Loader2 className="w-4 h-4 opacity-50 animate-spin" />
            ) : (
              <Download className="w-4 h-4 opacity-50" />
            )}{' '}
            {exporting === 'contacts' ? 'Exporting...' : 'Export Contacts'}
          </button>
        </div>
        {exportError && (
          <p className="text-xs font-bold text-red-500 mt-4 ml-1">
            {exportError}
          </p>
        )}
        <p className="text-[10px] font-bold text-slate-300 mt-6 leading-relaxed max-w-sm ml-1">
          Export enriched company and contact data as CSV.
        </p>
      </div>

      {/* Account info */}
      <div className="glass-card p-10 rounded-[2.5rem]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 ml-1">
          System Info
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-slate-50">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Platform
            </span>
            <span className="text-sm font-black text-[#040026]">Qualifai</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-slate-50">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Enrichment
            </span>
            <span className="text-sm font-black text-[#040026]">
              Apollo Enrichment API
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-slate-50">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              AI Model
            </span>
            <span className="text-sm font-black text-[#040026]">
              Claude 3.5 Sonnet (Anthropic)
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-slate-50">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Email Delivery
            </span>
            <span className="text-sm font-black text-[#040026]">Resend</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Scheduling
            </span>
            <span className="text-sm font-black text-[#040026]">
              {process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL
                ? 'Cal.com Link Active'
                : 'Not configured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
