'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { Users, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { PageLoader } from '@/components/ui/page-loader';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [seniority, setSeniority] = useState('');

  const contacts = api.contacts.list.useQuery({
    search: search || undefined,
    seniority: seniority || undefined,
  });

  return (
    <div className="max-w-[1400px] space-y-10">
      <div className="pb-6 border-b border-[var(--color-border)]">
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          Contacts<span className="text-[var(--color-gold)]">.</span>
        </h1>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3 border border-[var(--color-border)] rounded-lg focus-within:border-[var(--color-ink)] transition-colors max-w-2xl">
        <Search className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op naam, email of bedrijf..."
          className="flex-1 text-[14px] font-light text-[var(--color-ink)] bg-transparent border-none outline-none placeholder:text-[var(--color-border-strong)]"
        />
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)] bg-transparent border-none outline-none appearance-none cursor-pointer"
        >
          <option value="">Alle niveaus</option>
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
        <div className="py-20 text-center">
          <Users className="w-12 h-12 text-[var(--color-border-strong)] mx-auto mb-4" />
          <p className="text-[15px] font-medium text-[var(--color-ink)] mb-1">
            Geen contacts
          </p>
          <p className="text-[13px] font-light text-[var(--color-muted)]">
            Contacts verschijnen zodra research runs contact discovery
            uitvoeren.
          </p>
        </div>
      ) : (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
              {contacts.data?.contacts.length ?? 0} contacts
            </span>
            <span className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(contacts.data?.contacts as any[])?.map((contact: any) => (
            <Link
              key={contact.id}
              href={`/admin/contacts/${contact.id}`}
              className="flex items-center gap-5 py-4 border-b border-[var(--color-surface-2)] hover:pl-2 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--color-ink)] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[var(--color-gold)]">
                  {contact.firstName?.[0]}
                  {contact.lastName?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[15px] font-medium text-[var(--color-ink)]">
                  {contact.firstName} {contact.lastName}
                </span>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] font-light text-[var(--color-muted)]">
                  {contact.jobTitle && <span>{contact.jobTitle}</span>}
                  {contact.prospect && (
                    <>
                      <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
                      <span>
                        {contact.prospect.companyName ??
                          contact.prospect.domain}
                      </span>
                    </>
                  )}
                  {contact.primaryEmail && (
                    <>
                      <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-strong)]" />
                      <span>{contact.primaryEmail}</span>
                    </>
                  )}
                </div>
              </div>
              {contact.seniority && (
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  {contact.seniority}
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] font-medium uppercase tracking-[0.06em]',
                  contact.outreachStatus === 'NONE' &&
                    'text-[var(--color-muted)]',
                  contact.outreachStatus === 'CONVERTED' &&
                    'text-[var(--color-brand-success)]',
                  contact.outreachStatus === 'OPTED_OUT' &&
                    'text-[var(--color-brand-danger)]',
                  !['NONE', 'CONVERTED', 'OPTED_OUT'].includes(
                    contact.outreachStatus,
                  ) && 'text-[var(--color-ink)]',
                )}
              >
                {contact.outreachStatus === 'NONE'
                  ? ''
                  : contact.outreachStatus?.replace(/_/g, ' ')}
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
