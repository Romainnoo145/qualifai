'use client';

import { api } from '@/components/providers';
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  normalizeAdminToken,
} from '@/lib/admin-token';

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
    <div className="max-w-[1400px] space-y-10">
      <div className="pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Settings<span className="text-[var(--color-gold)]">.</span>
        </h1>
      </div>

      {/* Usage stats */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
            Usage
          </span>
          <span className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <div className="grid grid-cols-4 border-b border-[var(--color-ink)]">
          <div className="py-5 pr-6">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
              Credits
            </span>
            <p className="text-[32px] font-bold text-[var(--color-ink)] tracking-[-0.02em] leading-[1.1] mt-2">
              {stats.data?.creditsUsed ?? 0}
            </p>
          </div>
          <div className="py-5 px-6 border-l border-[var(--color-border)]">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
              Companies
            </span>
            <p className="text-[32px] font-bold text-[var(--color-ink)] tracking-[-0.02em] leading-[1.1] mt-2">
              {stats.data?.total ?? 0}
            </p>
          </div>
          <div className="py-5 px-6 border-l border-[var(--color-border)]">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
              Contacts
            </span>
            <p className="text-[32px] font-bold text-[var(--color-ink)] tracking-[-0.02em] leading-[1.1] mt-2">
              {stats.data?.totalContacts ?? 0}
            </p>
          </div>
          <div className="py-5 pl-6 border-l border-[var(--color-border)]">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
              Signals
            </span>
            <p className="text-[32px] font-bold text-[var(--color-ink)] tracking-[-0.02em] leading-[1.1] mt-2">
              {stats.data?.totalSignals ?? 0}
            </p>
          </div>
        </div>
      </section>

      {/* Data Export */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
            Data Export
          </span>
          <span className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void downloadExport('companies')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] rounded-md hover:border-[var(--color-ink)] transition-all disabled:opacity-50"
          >
            {exporting === 'companies' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {exporting === 'companies' ? 'Exporting...' : 'Export Companies'}
          </button>
          <button
            onClick={() => void downloadExport('contacts')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] rounded-md hover:border-[var(--color-ink)] transition-all disabled:opacity-50"
          >
            {exporting === 'contacts' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {exporting === 'contacts' ? 'Exporting...' : 'Export Contacts'}
          </button>
        </div>
        {exportError && (
          <p className="text-[12px] font-medium text-[var(--color-brand-danger)] mt-3">
            {exportError}
          </p>
        )}
        <p className="text-[11px] font-light text-[var(--color-muted)] mt-4">
          Export enriched company and contact data as CSV.
        </p>
      </section>

      {/* System Info */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
            System
          </span>
          <span className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <div>
          {[
            ['Platform', 'Qualifai'],
            ['Enrichment', 'Apollo Enrichment API'],
            ['AI Model', 'Gemini 2.5 Pro'],
            ['Email Delivery', 'Resend'],
            [
              'Scheduling',
              process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL
                ? 'Cal.com Link Active'
                : 'Not configured',
            ],
          ].map(([label, value], i, arr) => (
            <div
              key={label}
              className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-[var(--color-surface-2)]' : ''}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                {label}
              </span>
              <span className="text-[13px] font-medium text-[var(--color-ink)]">
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
