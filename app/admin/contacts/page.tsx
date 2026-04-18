'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { Users, Mail, Briefcase, Building2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { PageLoader } from '@/components/ui/page-loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

const outreachColors: Record<string, string> = {
  NONE: 'admin-state-neutral',
  QUEUED: 'admin-state-warning',
  EMAIL_SENT: 'admin-state-info',
  OPENED: 'admin-state-info',
  REPLIED: 'admin-state-accent',
  CONVERTED: 'admin-state-success',
  OPTED_OUT: 'admin-state-danger',
};

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [seniority, setSeniority] = useState('');

  const contacts = api.contacts.list.useQuery({
    search: search || undefined,
    seniority: seniority || undefined,
  });

  return (
    <div className="space-y-10">
      <PageHeader title="Contacts" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Intelligence Database..."
            className="input-minimal w-full px-6 py-3.5 rounded-[var(--radius-md)]"
          />
        </div>
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="input-minimal px-6 py-3.5 rounded-[var(--radius-md)] appearance-none"
        >
          <option value="">All seniorities</option>
          <option value="C-Level">C-Level</option>
          <option value="VP">VP</option>
          <option value="Director">Director</option>
          <option value="Manager">Manager</option>
          <option value="Senior">Senior</option>
          <option value="Entry">Entry</option>
        </select>
      </div>

      {/* Contact list */}
      {contacts.isLoading ? (
        <PageLoader
          label="Loading contacts"
          description="Pulling the latest contact list."
        />
      ) : contacts.data?.contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="w-16 h-16" />}
          title="No nodes detected"
          description="Propagate research from company profiles to initialize node discovery."
        />
      ) : (
        <div className="space-y-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(contacts.data?.contacts as any[])?.map((contact: any) => (
            <Link
              key={contact.id}
              href={`/admin/contacts/${contact.id}`}
              className="glass-card glass-card-hover p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between block group rounded-[2.5rem]"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden group-hover:bg-[var(--color-ink)] group-hover:border-[var(--color-ink)] transition-all">
                  <span className="text-sm font-bold text-[var(--color-ink)] group-hover:text-[var(--color-gold)] transition-colors">
                    {contact.firstName?.[0]}
                    {contact.lastName?.[0]}
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-bold text-[var(--color-ink)] tracking-tight">
                      {contact.firstName} {contact.lastName}
                    </span>
                    <span
                      className={cn(
                        'admin-state-pill',
                        outreachColors[contact.outreachStatus] ??
                          'admin-state-neutral',
                      )}
                    >
                      {contact.outreachStatus}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-[var(--color-muted)] mt-2">
                    {contact.jobTitle && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 opacity-50" />
                        {contact.jobTitle}
                      </span>
                    )}
                    {contact.prospect && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 opacity-50" />
                        {contact.prospect.companyName ??
                          contact.prospect.domain}
                      </span>
                    )}
                    {contact.primaryEmail && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 opacity-50" />
                        {contact.primaryEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {contact.seniority && (
                  <span className="admin-eyebrow px-4 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-[var(--color-muted)] border border-[var(--color-border)]">
                    {contact.seniority}
                  </span>
                )}
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <ChevronRight className="w-4 h-4 text-[var(--color-ink)]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
