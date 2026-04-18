'use client';

import { api } from '@/components/providers';
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  normalizeAdminToken,
} from '@/lib/admin-token';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';

export default function SettingsPage() {
  const stats = api.admin.getDashboardStats.useQuery();
  const [exporting, setExporting] = useState<'companies' | 'contacts' | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);

  const downloadExport = async (kind: 'companies' | 'contacts') => {
    const storedToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    const token = normalizeAdminToken(storedToken);
    if (!token) {
      setExportError('Admin token missing. Sign in again to export data.');
      return;
    }

    if (storedToken !== token) {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
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
      <PageHeader title="Settings" />

      {/* Credit usage */}
      <div className="glass-card p-10 rounded-[2.5rem]">
        <h2 className="admin-eyebrow mb-8 ml-1">Usage Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            eyebrow="Credits Used"
            value={stats.data?.creditsUsed ?? 0}
          />
          <StatCard eyebrow="Companies" value={stats.data?.total ?? 0} />
          <StatCard eyebrow="Contacts" value={stats.data?.totalContacts ?? 0} />
          <StatCard eyebrow="Signals" value={stats.data?.totalSignals ?? 0} />
        </div>
      </div>

      {/* Data Export */}
      <div className="glass-card p-10 rounded-[2.5rem]">
        <h2 className="admin-eyebrow mb-8 ml-1">Data Export</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => void downloadExport('companies')}
            disabled={exporting !== null}
            className="admin-btn-secondary w-full sm:w-auto disabled:opacity-50"
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
            className="admin-btn-secondary w-full sm:w-auto disabled:opacity-50"
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
          <p className="text-xs font-bold text-[var(--color-brand-danger)] mt-4 ml-1">
            {exportError}
          </p>
        )}
        <p className="admin-meta-text mt-6 leading-relaxed max-w-sm ml-1">
          Export enriched company and contact data as CSV.
        </p>
      </div>

      {/* Account info */}
      <div className="glass-card p-10 rounded-[2.5rem]">
        <h2 className="admin-eyebrow mb-8 ml-1">System Info</h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-[var(--color-border)]">
            <span className="admin-eyebrow">Platform</span>
            <span className="text-sm font-bold text-[var(--color-ink)]">
              Qualifai
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-[var(--color-border)]">
            <span className="admin-eyebrow">Enrichment</span>
            <span className="text-sm font-bold text-[var(--color-ink)]">
              Apollo Enrichment API
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-[var(--color-border)]">
            <span className="admin-eyebrow">AI Model</span>
            <span className="text-sm font-bold text-[var(--color-ink)]">
              Claude 3.5 Sonnet (Anthropic)
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-[var(--color-border)]">
            <span className="admin-eyebrow">Email Delivery</span>
            <span className="text-sm font-bold text-[var(--color-ink)]">
              Resend
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4">
            <span className="admin-eyebrow">Scheduling</span>
            <span className="text-sm font-bold text-[var(--color-ink)]">
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
