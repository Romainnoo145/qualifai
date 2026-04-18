'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';

export default function CampaignsPage() {
  const campaigns = api.campaigns.list.useQuery();

  return (
    <div className="max-w-[1400px] space-y-10">
      <div className="flex items-baseline justify-between pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Campaigns<span className="text-[var(--color-gold)]">.</span>
        </h1>
        <Link
          href="/admin/campaigns/new"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
        >
          <Plus className="w-3.5 h-3.5" /> Create Campaign
        </Link>
      </div>

      {campaigns.isLoading && <PageLoader label="Loading campaigns" />}

      {!campaigns.isLoading && (campaigns.data ?? []).length === 0 && (
        <div className="py-20 text-center">
          <FolderKanban className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
          <p className="text-[15px] font-medium text-[var(--color-ink)] mb-1">
            No campaigns yet
          </p>
          <p className="text-[13px] font-light text-[var(--color-muted)] mb-6">
            Start met de campaign setup wizard.
          </p>
          <Link
            href="/admin/campaigns/new"
            className="inline-flex items-center gap-2 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] rounded-full"
          >
            <Plus className="w-3.5 h-3.5" /> Start Wizard
          </Link>
        </div>
      )}

      {(campaigns.data ?? []).length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
              Actieve campaigns
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          {(campaigns.data ?? []).map((campaign) => (
            <Link
              key={campaign.id}
              href={`/admin/campaigns/${campaign.id}`}
              className="flex items-center gap-5 py-4 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
            >
              <div className="w-10 h-10 rounded-[8px] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-ink)] group-hover:border-[var(--color-ink)] transition-all">
                <FolderKanban className="w-4 h-4 text-[var(--color-ink)] group-hover:text-[var(--color-gold)] transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[15px] font-medium text-[var(--color-ink)]">
                  {campaign.name}
                </span>
                {campaign.nicheKey && (
                  <p className="text-[11px] font-light text-[var(--color-muted)] mt-0.5">
                    {campaign.nicheKey}
                  </p>
                )}
              </div>
              <span className="text-[11px] font-light text-[var(--color-muted)]">
                {campaign._count.campaignProspects}{' '}
                {campaign._count.campaignProspects === 1
                  ? 'company'
                  : 'companies'}
              </span>
              <span className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-muted)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-gold)] group-hover:border-[var(--color-ink)] transition-all shrink-0 text-[12px]">
                →
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
