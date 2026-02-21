'use client';

import { api } from '@/components/providers';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Globe,
  MapPin,
  Users,
  DollarSign,
  Check,
  ExternalLink,
  ArrowLeft,
  Clock,
  Phone,
  Briefcase,
  Loader2,
  Calendar,
  Linkedin,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { EvidenceSection } from '@/components/features/prospects/evidence-section';

type DiscoveryGuardrail = {
  code: string;
  title: string;
  message: string;
  recommendation?: string;
};

const SECTION_NAV = [
  { id: 'evidence', label: 'Evidence' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'outreach-preview', label: 'Outreach Preview' },
  { id: 'results', label: 'Results' },
];

export default function ProspectDetail() {
  const params = useParams();
  const id = params.id as string;
  const [copied, setCopied] = useState(false);
  const [contactDiscoveryGuardrail, setContactDiscoveryGuardrail] =
    useState<DiscoveryGuardrail | null>(null);

  const prospect = api.admin.getProspect.useQuery({ id });
  const utils = api.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoverContacts = (api.contacts.discoverForCompany as any).useMutation(
    {
      onSuccess: (data: any) => {
        setContactDiscoveryGuardrail(
          (data.guardrail as DiscoveryGuardrail | null) ?? null,
        );
        utils.admin.getProspect.invalidate({ id });
      },
    },
  );

  const copyLink = () => {
    if (!prospect.data) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = prospect.data as any;
    const url = data.readableSlug
      ? `${window.location.origin}/voor/${data.readableSlug}`
      : `${window.location.origin}/discover/${prospect.data.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  if (prospect.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-48 animate-pulse" />
        <div className="glass-card p-8 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-64 mb-4" />
          <div className="h-4 bg-slate-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!prospect.data) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-slate-500">Prospect not found</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prospect.data as any;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/prospects"
            className="ui-tap p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-[#040026] hover:bg-slate-100 border border-slate-100 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <StatusBadge status={p.status} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#040026] tracking-tighter">
              {p.companyName ?? p.domain}
            </h1>
            {p.description && (
              <p className="text-sm text-slate-400 mt-2 max-w-2xl">
                {p.description}
              </p>
            )}
          </div>
          <button
            onClick={copyLink}
            className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100 w-fit"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Copied
              </>
            ) : (
              <>
                <ExternalLink className="w-3.5 h-3.5" /> Share
              </>
            )}
          </button>
        </div>
      </div>

      {/* Company Info */}
      <section className="glass-card p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          {p.industry && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p.industry}
                {p.subIndustry ? ` / ${p.subIndustry}` : ''}
              </span>
            </div>
          )}
          {(p.city ?? p.country) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {[p.city, p.state, p.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {(p.employeeRange || p.employeeCount) && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p.employeeCount
                  ? `${p.employeeCount.toLocaleString()} employees`
                  : `${p.employeeRange} employees`}
              </span>
            </div>
          )}
          {(p.revenueRange || p.revenueEstimate) && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p.revenueEstimate ?? p.revenueRange}
              </span>
            </div>
          )}
          {p.foundedYear && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">Founded {p.foundedYear}</span>
            </div>
          )}
          {p.linkedinUrl && (
            <div className="flex items-center gap-2 text-sm">
              <Linkedin className="w-4 h-4 text-slate-400" />
              <a
                href={p.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-focus text-klarifai-blue hover:underline rounded-full px-1"
              >
                LinkedIn
              </a>
            </div>
          )}
          {(p._count?.sessions ?? 0) > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p._count.sessions} sessions
              </span>
            </div>
          )}
          {(p.notificationLogs?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">
                {p.notificationLogs.length} notifications
              </span>
            </div>
          )}
        </div>
        {p.technologies?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5">
              {p.technologies.map((tech: string) => (
                <span
                  key={tech}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}
        {p.internalNotes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-600">{p.internalNotes}</p>
          </div>
        )}
      </section>

      {/* Contacts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
            Contacts ({p.contacts?.length ?? 0})
          </h2>
          <button
            onClick={() => {
              setContactDiscoveryGuardrail(null);
              discoverContacts.mutate({ prospectId: id });
            }}
            disabled={discoverContacts.isPending}
            className="ui-tap flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100 disabled:opacity-50"
          >
            {discoverContacts.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Discovering...
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5" /> Discover Contacts
              </>
            )}
          </button>
        </div>

        {contactDiscoveryGuardrail && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-amber-900">
                  {contactDiscoveryGuardrail.title}
                </p>
                <p className="text-xs font-bold text-amber-800 mt-1">
                  {contactDiscoveryGuardrail.message}
                </p>
                {contactDiscoveryGuardrail.recommendation && (
                  <p className="text-xs font-semibold text-amber-700 mt-2">
                    {contactDiscoveryGuardrail.recommendation}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {p.contacts?.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {p.contacts.map((contact: any) => (
              <Link
                key={contact.id}
                href={`/admin/contacts/${contact.id}`}
                className="glass-card glass-card-hover ui-focus px-4 py-3 flex items-center gap-3 shrink-0"
              >
                <div className="w-9 h-9 rounded-full bg-klarifai-indigo/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-klarifai-indigo">
                    {contact.firstName?.[0]}
                    {contact.lastName?.[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-klarifai-midnight truncate">
                    {contact.firstName} {contact.lastName}
                  </p>
                  {contact.jobTitle && (
                    <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                      <Briefcase className="w-3 h-3 shrink-0" />
                      {contact.jobTitle}
                    </p>
                  )}
                </div>
                {contact.seniority && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                    {contact.seniority}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-slate-400">
              No contacts yet. Click &quot;Discover Contacts&quot; to find
              people at this company.
            </p>
          </div>
        )}
      </section>

      {/* Sticky Section Nav */}
      <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 p-1.5 bg-slate-50/80 rounded-2xl w-fit border border-slate-100">
          {SECTION_NAV.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                'px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all',
                'text-slate-400 hover:text-slate-900',
              )}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Section 1: Evidence */}
      <section id="evidence" className="scroll-mt-16">
        <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">
          Evidence
        </h2>
        <EvidenceSection prospectId={id} signals={p.signals} />
      </section>

      {/* Section 2: Analysis */}
      <section id="analysis" className="scroll-mt-16">
        <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">
          Analysis
        </h2>
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-slate-400">
            Analysis section — coming in plan 13-02
          </p>
        </div>
      </section>

      {/* Section 3: Outreach Preview */}
      <section id="outreach-preview" className="scroll-mt-16">
        <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">
          Outreach Preview
        </h2>
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-slate-400">
            Outreach Preview section — coming in plan 13-03
          </p>
        </div>
      </section>

      {/* Section 4: Results */}
      <section id="results" className="scroll-mt-16">
        <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">
          Results
        </h2>
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-slate-400">
            Results section — coming in plan 13-04
          </p>
        </div>
      </section>
    </div>
  );
}
