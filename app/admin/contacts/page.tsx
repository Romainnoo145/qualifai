'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import { Users, Mail, Briefcase, Building2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const outreachColors: Record<string, string> = {
  NONE: 'bg-slate-100 text-slate-500',
  QUEUED: 'bg-amber-50 text-amber-600',
  EMAIL_SENT: 'bg-blue-50 text-blue-600',
  OPENED: 'bg-cyan-50 text-cyan-600',
  REPLIED: 'bg-purple-50 text-purple-600',
  CONVERTED: 'bg-emerald-50 text-emerald-600',
  OPTED_OUT: 'bg-red-50 text-red-500',
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
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Contacts
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Intelligence Database..."
            className="w-full px-6 py-3.5 rounded-2xl border border-slate-100 bg-white text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
          />
        </div>
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="px-6 py-3.5 rounded-2xl border border-slate-100 bg-white text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
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
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-8 animate-pulse rounded-[2.5rem]"
            >
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-50" />
                <div className="space-y-3 flex-1">
                  <div className="h-4 bg-slate-50 rounded w-1/4" />
                  <div className="h-3 bg-slate-50 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : contacts.data?.contacts.length === 0 ? (
        <div className="glass-card p-20 text-center rounded-[2.5rem]">
          <Users className="w-16 h-16 text-slate-100 mx-auto mb-6" />
          <p className="text-sm font-black text-[#040026] uppercase tracking-widest">
            No nodes detected
          </p>
          <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
            Propagate research from company profiles to initialize node
            discovery.
          </p>
        </div>
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
                <div className="w-14 h-14 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden group-hover:bg-[#040026] group-hover:border-[#040026] transition-all">
                  <span className="text-sm font-black text-[#040026] group-hover:text-[#EBCB4B] transition-colors">
                    {contact.firstName?.[0]}
                    {contact.lastName?.[0]}
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-black text-[#040026] tracking-tight">
                      {contact.firstName} {contact.lastName}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border',
                        outreachColors[contact.outreachStatus]
                          ?.replace('bg-', 'bg-')
                          .replace('text-', 'text-') ??
                          'bg-slate-50 text-slate-400 border-slate-100',
                      )}
                    >
                      {contact.outreachStatus}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-400 mt-2">
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
                  <span className="text-[10px] px-4 py-1.5 rounded-xl bg-slate-50 text-slate-400 font-black uppercase tracking-widest border border-slate-100">
                    {contact.seniority}
                  </span>
                )}
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <ChevronRight className="w-4 h-4 text-[#040026]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
