'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Globe,
  Building2,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Trash2,
  Users,
  Search,
  Loader2,
  Plus,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type View = 'all' | 'search-companies' | 'search-contacts';
type SearchGuardrail = {
  code: string;
  title: string;
  message: string;
  recommendation?: string;
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ENRICHED: 'bg-blue-50 text-blue-600',
  GENERATING: 'bg-amber-50 text-amber-600',
  READY: 'bg-emerald-50 text-emerald-600',
  SENT: 'bg-indigo-50 text-indigo-600',
  VIEWED: 'bg-cyan-50 text-cyan-600',
  ENGAGED: 'bg-purple-50 text-purple-600',
  CONVERTED: 'bg-yellow-50 text-yellow-700',
  ARCHIVED: 'bg-slate-50 text-slate-400',
};

export default function ProspectList() {
  const [view, setView] = useState<View>('all');

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
          Prospects
        </h1>
        <Link
          href="/admin/prospects/new"
          className="px-8 py-3 btn-pill-primary text-xs"
        >
          + New Prospect
        </Link>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-50/80 rounded-2xl w-fit border border-slate-100">
        <button
          onClick={() => setView('all')}
          className={cn(
            'ui-tap flex items-center gap-2.5 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all whitespace-nowrap',
            view === 'all'
              ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50 border border-slate-100'
              : 'text-slate-400 hover:text-slate-900',
          )}
        >
          <Building2 className="w-4 h-4" /> All Companies
        </button>
        <button
          onClick={() => setView('search-companies')}
          className={cn(
            'ui-tap flex items-center gap-2.5 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all whitespace-nowrap',
            view === 'search-companies'
              ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50 border border-slate-100'
              : 'text-slate-400 hover:text-slate-900',
          )}
        >
          <Search className="w-4 h-4" /> Search Companies
        </button>
        <button
          onClick={() => setView('search-contacts')}
          className={cn(
            'ui-tap flex items-center gap-2.5 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all whitespace-nowrap',
            view === 'search-contacts'
              ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50 border border-slate-100'
              : 'text-slate-400 hover:text-slate-900',
          )}
        >
          <Users className="w-4 h-4" /> Search Contacts
        </button>
      </div>

      {view === 'all' && <AllCompanies />}
      {view === 'search-companies' && (
        <CompanySearch onImported={() => setView('all')} />
      )}
      {view === 'search-contacts' && <ContactSearch />}
    </div>
  );
}

function AllCompanies() {
  const prospects = api.admin.listProspects.useQuery();
  const deleteMutation = api.admin.deleteProspect.useMutation({
    onSuccess: () => prospects.refetch(),
  });
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const copyLink = (prospect: {
    slug: string;
    readableSlug: string | null;
  }) => {
    const url = prospect.readableSlug
      ? `${window.location.origin}/voor/${prospect.readableSlug}`
      : `${window.location.origin}/discover/${prospect.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(prospect.slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (prospects.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-48" />
          </div>
        ))}
      </div>
    );
  }

  if (prospects.data?.prospects.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 mb-4">No prospects yet</p>
        <Link
          href="/admin/prospects/new"
          className="text-sm font-semibold text-klarifai-blue hover:underline"
        >
          Create your first prospect
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(prospects.data?.prospects as any[])?.map((prospect: any) => (
        <div
          key={prospect.id}
          className="glass-card glass-card-hover p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between group"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden">
              {prospect.logoUrl ? (
                <img
                  src={prospect.logoUrl}
                  alt=""
                  className="w-8 h-8 object-contain"
                />
              ) : (
                <Building2 className="w-6 h-6 text-slate-200" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={`/admin/prospects/${prospect.id}`}
                  className="text-xl font-black text-[#040026] tracking-tighter hover:text-[#007AFF] transition-all"
                >
                  {prospect.companyName ?? prospect.domain}
                </Link>
                <span
                  className={cn(
                    'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
                    statusColors[prospect.status] ||
                      'bg-slate-50 text-slate-400 border-slate-100',
                  )}
                >
                  {prospect.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 mt-2">
                <span className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> {prospect.domain}
                </span>
                {prospect.industry && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                    <span>{prospect.industry}</span>
                  </>
                )}
                {prospect._count.sessions > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                    <span className="text-[#007AFF]">
                      {prospect._count.sessions} sessions
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
              prospect.status,
            ) && (
              <>
                <button
                  onClick={() => copyLink(prospect)}
                  className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100"
                >
                  {copiedSlug === prospect.slug ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Share
                    </>
                  )}
                </button>
                <Link
                  href={
                    prospect.readableSlug
                      ? `/voor/${prospect.readableSlug}`
                      : `/discover/${prospect.slug}`
                  }
                  target="_blank"
                  className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl shadow-[#040026]/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview
                </Link>
              </>
            )}
            <button
              onClick={() => {
                if (
                  confirm(`Delete ${prospect.companyName ?? prospect.domain}?`)
                )
                  deleteMutation.mutate({ id: prospect.id });
              }}
              className="ui-tap p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-100 transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <Link
              href={`/admin/prospects/${prospect.id}`}
              className="ui-tap p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-[#040026] hover:bg-slate-100 border border-slate-100 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompanySearch({ onImported }: { onImported: () => void }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[] | null>(null);
  const [guardrail, setGuardrail] = useState<SearchGuardrail | null>(null);

  const utils = api.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = (api.search.companies as any).useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      setResults(data.results);
      setGuardrail((data.guardrail as SearchGuardrail | null) ?? null);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importCompany = (api.search.importCompany as any).useMutation({
    onSuccess: () => {
      utils.admin.listProspects.invalidate();
      onImported();
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search.mutate({
      companyName: name || undefined,
      domain: domain || undefined,
      industries: industry ? [industry] : undefined,
      countries: country ? [country] : undefined,
    });
  };

  return (
    <div className="space-y-10">
      <form
        onSubmit={handleSearch}
        className="glass-card p-10 rounded-[2.5rem] space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe, OpenAI"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. stripe.com"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Industry
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Fintech, AI"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Country
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United States"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={search.isPending}
          className="ui-tap flex items-center justify-center gap-3 px-10 py-4 btn-pill-primary text-xs font-black uppercase tracking-widest disabled:opacity-50 w-full sm:w-auto shadow-xl shadow-[#040026]/10"
        >
          {search.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" /> Search Companies
            </>
          )}
        </button>
      </form>

      {results !== null && (
        <div className="space-y-6">
          {guardrail && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-6 py-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-900 tracking-tight">
                    {guardrail.title}
                  </p>
                  <p className="text-xs font-bold text-amber-800 mt-1">
                    {guardrail.message}
                  </p>
                  {guardrail.recommendation && (
                    <p className="text-xs font-semibold text-amber-700 mt-2">
                      {guardrail.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2">
            {results.length} results
          </p>
          {results.length === 0 ? (
            <div className="glass-card p-20 text-center rounded-[2.5rem]">
              <Search className="w-16 h-16 text-slate-100 mx-auto mb-6" />
              <p className="text-sm font-black text-[#040026] uppercase tracking-widest">
                No matching companies found
              </p>
              <p className="text-xs font-bold text-slate-400 mt-2">
                Try expanding your search parameters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((company: any, i: number) => (
                <div
                  key={company.lushaCompanyId ?? i}
                  className="glass-card p-8 rounded-[2.5rem] flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between group transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner overflow-hidden">
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          alt=""
                          className="w-10 h-10 object-contain"
                        />
                      ) : (
                        <Globe className="w-6 h-6 text-slate-100" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-black text-[#040026] tracking-tight">
                        {company.companyName ?? company.domain}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                        <span className="text-[#040026]">{company.domain}</span>
                        {company.industry && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            {company.industry}
                          </span>
                        )}
                        {company.employeeRange && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            {company.employeeRange} employees
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      importCompany.mutate({
                        domain: company.domain,
                        companyName: company.companyName ?? undefined,
                      })
                    }
                    disabled={importCompany.isPending}
                    className="ui-tap flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#EBCB4B] hover:text-[#040026] transition-all disabled:opacity-50 w-full sm:w-auto shadow-lg shadow-[#040026]/10"
                  >
                    <Plus className="w-4 h-4" /> Import
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContactSearch() {
  const [jobTitle, setJobTitle] = useState('');
  const [seniority, setSeniority] = useState('');
  const [department, setDepartment] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[] | null>(null);
  const [guardrail, setGuardrail] = useState<SearchGuardrail | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = (api.search.contacts as any).useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      setResults(data.results);
      setGuardrail((data.guardrail as SearchGuardrail | null) ?? null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search.mutate({
      jobTitles: jobTitle ? [jobTitle] : undefined,
      seniorities: seniority ? [seniority] : undefined,
      departments: department ? [department] : undefined,
      companyDomains: companyDomain ? [companyDomain] : undefined,
    });
  };

  return (
    <div className="space-y-10">
      <form
        onSubmit={handleSearch}
        className="glass-card p-10 rounded-[2.5rem] space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Job Title
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Chief Technical Officer"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Seniority
            </label>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all appearance-none"
            >
              <option value="">All Seniority Levels</option>
              <option value="C-Level">C-Level Executive</option>
              <option value="VP">Vice President</option>
              <option value="Director">Director Level</option>
              <option value="Manager">Management</option>
              <option value="Senior">Senior Contributor</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Operations"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">
              Company Domain
            </label>
            <input
              type="text"
              value={companyDomain}
              onChange={(e) => setCompanyDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={search.isPending}
          className="ui-tap flex items-center justify-center gap-3 px-10 py-4 btn-pill-primary text-xs font-black uppercase tracking-widest disabled:opacity-50 w-full sm:w-auto shadow-xl shadow-[#040026]/10"
        >
          {search.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" /> Search Contacts
            </>
          )}
        </button>
      </form>

      {results !== null && (
        <div className="space-y-6">
          {guardrail && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-6 py-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-900 tracking-tight">
                    {guardrail.title}
                  </p>
                  <p className="text-xs font-bold text-amber-800 mt-1">
                    {guardrail.message}
                  </p>
                  {guardrail.recommendation && (
                    <p className="text-xs font-semibold text-amber-700 mt-2">
                      {guardrail.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2">
            {results.length} results
          </p>
          {results.length === 0 ? (
            <div className="glass-card p-20 text-center rounded-[2.5rem]">
              <Users className="w-16 h-16 text-slate-100 mx-auto mb-6" />
              <p className="text-sm font-black text-[#040026] uppercase tracking-widest">
                No matching contacts found
              </p>
              <p className="text-xs font-bold text-slate-400 mt-2">
                Try adjusting seniority or job title filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((contact: any, i: number) => (
                <div
                  key={contact.lushaPersonId ?? i}
                  className="glass-card p-8 rounded-[2.5rem] flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between group transition-all"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#FCFCFD] border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-[#040026] group-hover:border-[#040026] transition-all">
                      <span className="text-sm font-black text-[#040026] group-hover:text-[#EBCB4B] transition-colors">
                        {contact.firstName?.[0]}
                        {contact.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-black text-[#040026] tracking-tight transition-colors">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                        {contact.jobTitle && (
                          <span className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 opacity-50" />
                            {contact.jobTitle}
                          </span>
                        )}
                        {contact.company?.companyName && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                            {contact.company.companyName}
                          </span>
                        )}
                        {contact.seniority && (
                          <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[#040026]">
                            {contact.seniority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
