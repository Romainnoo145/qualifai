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
  Calendar,
  Linkedin,
} from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { EvidenceSection } from '@/components/features/prospects/evidence-section';
import { AnalysisSection } from '@/components/features/prospects/analysis-section';
import { OutreachPreviewSection } from '@/components/features/prospects/outreach-preview-section';
import { ResultsSection } from '@/components/features/prospects/results-section';
import { ContactsSection } from '@/components/features/prospects/contacts-section';
import { QualityChip } from '@/components/features/prospects/quality-chip';

const TABS = [
  { id: 'evidence', label: 'Evidence' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'outreach-preview', label: 'Outreach Preview' },
  { id: 'results', label: 'Results' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ProspectDetail() {
  const params = useParams();
  const id = params.id as string;
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('evidence');

  const prospect = api.admin.getProspect.useQuery({ id });
  const researchRuns = api.research.listRuns.useQuery({ prospectId: id });
  const utils = api.useUtils();

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

  if (prospect.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded-2xl w-48 animate-pulse" />
        <div className="glass-card p-8 rounded-[2.5rem] animate-pulse">
          <div className="h-6 bg-slate-200 rounded-xl w-64 mb-4" />
          <div className="h-4 bg-slate-200 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  if (!prospect.data) {
    return (
      <div className="glass-card p-12 text-center rounded-[2.5rem]">
        <p className="text-slate-500">Prospect not found</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prospect.data as any;
  const latestRunId = researchRuns.data?.[0]?.id ?? null;

  return (
    <div className="space-y-8">
      {/* Back row */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/prospects"
          className="ui-tap p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-[#040026] hover:bg-slate-100 border border-slate-100 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <StatusBadge status={p.status} />
        {researchRuns.data?.[0] && (
          <QualityChip
            runId={researchRuns.data[0].id}
            evidenceCount={researchRuns.data[0]._count.evidenceItems}
            hypothesisCount={researchRuns.data[0]._count.workflowHypotheses}
            qualityApproved={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (researchRuns.data[0] as any).qualityApproved ?? null
            }
            qualityReviewedAt={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (researchRuns.data[0] as any).qualityReviewedAt ?? null
            }
            runStatus={researchRuns.data[0].status}
          />
        )}
      </div>

      {/* Hero */}
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

      {/* Company metadata — bare row, no card */}
      <div className="space-y-4">
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
        )}
        {p.internalNotes && (
          <p className="text-sm text-slate-600">{p.internalNotes}</p>
        )}
      </div>

      {/* Contacts */}
      <ContactsSection
        prospectId={id}
        contacts={p.contacts}
        onContactCreated={() => utils.admin.getProspect.invalidate({ id })}
      />

      {/* Tab nav — full-width underline tabs */}
      <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm py-3 border-b border-slate-100">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 pb-2 text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-all',
                activeTab === tab.id
                  ? 'text-[#040026] border-[#EBCB4B]'
                  : 'text-slate-400 border-transparent hover:text-slate-600',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* All sections stay mounted, inactive ones hidden via CSS */}
      <div className={activeTab === 'evidence' ? '' : 'hidden'}>
        <EvidenceSection prospectId={id} signals={p.signals} />
      </div>
      <div className={activeTab === 'analysis' ? '' : 'hidden'}>
        <AnalysisSection prospectId={id} />
      </div>
      <div className={activeTab === 'outreach-preview' ? '' : 'hidden'}>
        <OutreachPreviewSection
          prospectId={id}
          prospect={p}
          latestRunId={latestRunId}
        />
      </div>
      <div className={activeTab === 'results' ? '' : 'hidden'}>
        <ResultsSection prospectId={id} prospect={p} />
      </div>
    </div>
  );
}
