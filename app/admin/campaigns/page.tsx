'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { FolderKanban, Plus, ChevronRight } from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function CampaignsPage() {
  const campaigns = api.campaigns.list.useQuery();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        action={
          <Link href="/admin/campaigns/new" className="admin-btn-primary">
            <Plus className="w-4 h-4" /> Create Campaign
          </Link>
        }
      />

      <div className="space-y-3">
        {campaigns.isLoading && <PageLoader label="Loading campaigns" />}

        {!campaigns.isLoading && (campaigns.data ?? []).length === 0 && (
          <EmptyState
            icon={<FolderKanban className="w-12 h-12" />}
            title="No campaigns yet"
            description="Start met de campaign setup wizard."
            action={
              <Link href="/admin/campaigns/new" className="admin-btn-primary">
                <Plus className="w-3.5 h-3.5" />
                Start Wizard
              </Link>
            }
          />
        )}

        {(campaigns.data ?? []).map((campaign) => (
          <Link
            key={campaign.id}
            href={`/admin/campaigns/${campaign.id}`}
            className="glass-card glass-card-hover p-6 rounded-[var(--radius-lg)] group flex items-center justify-between gap-6"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center group-hover:bg-[var(--color-ink)] group-hover:border-[var(--color-ink)] transition-all shrink-0">
                <FolderKanban className="w-5 h-5 text-[var(--color-ink)] group-hover:text-[var(--color-gold)] transition-colors" />
              </div>
              <div>
                <p className="text-base font-bold text-[var(--color-ink)] tracking-tight">
                  {campaign.name}
                </p>
                {campaign.nicheKey && (
                  <p className="text-[11px] text-[var(--color-muted)] font-medium mt-0.5">
                    {campaign.nicheKey}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <span className="admin-eyebrow">
                {campaign._count.campaignProspects}{' '}
                {campaign._count.campaignProspects === 1
                  ? 'company'
                  : 'companies'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--color-border-strong)] group-hover:text-[var(--color-ink)] transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
