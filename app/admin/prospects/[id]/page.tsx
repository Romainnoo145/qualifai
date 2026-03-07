'use client';

import type { Prisma } from '@prisma/client';
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
  ShieldAlert,
} from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { PipelineChip } from '@/components/features/prospects/pipeline-chip';
import { computePipelineStage } from '@/lib/pipeline-stage';
import { EvidenceSection } from '@/components/features/prospects/evidence-section';
import { SourceSetSection } from '@/components/features/prospects/source-set-section';
import { AnalysisSection } from '@/components/features/prospects/analysis-section';
import { OutreachPreviewSection } from '@/components/features/prospects/outreach-preview-section';
import { ResultsSection } from '@/components/features/prospects/results-section';
import { ContactsSection } from '@/components/features/prospects/contacts-section';
import { QualityChip } from '@/components/features/prospects/quality-chip';
import { IntentSignalsSection } from '@/components/features/prospects/intent-signals-section';
import { buildDiscoverPath } from '@/lib/prospect-url';
import { deepAnalysisStatus } from '@/lib/deep-analysis';

// ---------------------------------------------------------------------------
// Typed helper for ResearchRun rows returned by api.research.listRuns
// Mirrors the include shape of the listRuns query exactly to replace TS2589 as any casts
// ---------------------------------------------------------------------------

type ResearchRunRow = Prisma.ResearchRunGetPayload<{
  include: {
    prospect: { select: { id: true; companyName: true; domain: true } };
    campaign: {
      select: { id: true; name: true; nicheKey: true; strictGate: true };
    };
    _count: {
      select: {
        evidenceItems: true;
        workflowHypotheses: true;
        automationOpportunities: true;
        workflowLossMaps: true;
      };
    };
  };
}>;

// ---------------------------------------------------------------------------
// Gate type badge helper
// ---------------------------------------------------------------------------

function gateTypeBadgeClass(gateType: string): string {
  if (gateType === 'pain') {
    return 'admin-state-pill admin-state-warning';
  }
  return 'admin-state-pill admin-state-danger';
}

// ---------------------------------------------------------------------------
// Debug mode — toggle via browser console:
//   localStorage.setItem('qualifai-debug', 'true')  → show debug sections
//   localStorage.removeItem('qualifai-debug')        → hide debug sections
// ---------------------------------------------------------------------------

function subscribeDebugMode(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'qualifai-debug') onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

function getDebugModeSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('qualifai-debug') === 'true';
}

function useDebugMode(): boolean {
  return useSyncExternalStore(
    subscribeDebugMode,
    getDebugModeSnapshot,
    () => false,
  );
}

const BASE_TABS = [
  { id: 'evidence', label: 'Evidence' },
  { id: 'intent-signals', label: 'Intent Signals' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'outreach-preview', label: 'Outreach Preview' },
  { id: 'results', label: 'Results' },
] as const;

type TabId = (typeof BASE_TABS)[number]['id'];

export default function ProspectDetail() {
  const params = useParams();
  const id = params.id as string;
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('evidence');
  const debugMode = useDebugMode();

  const prospect = api.admin.getProspect.useQuery({ id });
  const researchRuns = api.research.listRuns.useQuery({ prospectId: id });
  const latestRunId = researchRuns.data?.[0]?.id ?? null;
  const overrideAudits = api.research.listOverrideAudits.useQuery(
    { runId: latestRunId! },
    { enabled: !!latestRunId },
  );
  const utils = api.useUtils();

  const copyLink = () => {
    if (!prospect.data) return;
    // TODO: tRPC v11 inference — getProspect return type too deep; p is typed as any below
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = prospect.data as any;
    const url = `${window.location.origin}${buildDiscoverPath({
      slug: data.slug,
      readableSlug: data.readableSlug ?? null,
      companyName: data.companyName ?? null,
      domain: data.domain ?? null,
    })}`;
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

  // TODO: tRPC v11 inference — getProspect return type too deep for TS to infer Prospect fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prospect.data as any;
  const enrichmentMeta =
    p.lushaRawData &&
    typeof p.lushaRawData === 'object' &&
    !Array.isArray(p.lushaRawData)
      ? (p.lushaRawData as Record<string, unknown>)
      : null;
  const kvkMeta =
    enrichmentMeta?.kvk &&
    typeof enrichmentMeta.kvk === 'object' &&
    !Array.isArray(enrichmentMeta.kvk)
      ? (enrichmentMeta.kvk as Record<string, unknown>)
      : null;
  const confidenceMeta =
    enrichmentMeta?.confidence &&
    typeof enrichmentMeta.confidence === 'object' &&
    !Array.isArray(enrichmentMeta.confidence)
      ? (enrichmentMeta.confidence as Record<string, unknown>)
      : null;
  const combinedConfidence =
    typeof confidenceMeta?.combined === 'number'
      ? Math.round((confidenceMeta.combined as number) * 100)
      : null;
  const metaPillClass =
    'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_1px_0_0_rgba(15,23,42,0.03)]';
  // ResearchRunRow mirrors the listRuns query include shape — replaces TS2589 as any casts
  const runs = researchRuns.data as ResearchRunRow[] | undefined;
  const latestRun = runs?.[0] ?? null;
  const latestDeepRun = runs?.find(
    (run) => deepAnalysisStatus(run) !== 'not_started',
  );
  const deepStatus = deepAnalysisStatus(latestDeepRun);
  const deepStatusLabel =
    deepStatus === 'completed'
      ? 'Deep Analysis Done'
      : deepStatus === 'running'
        ? 'Deep Analysis Running'
        : deepStatus === 'failed'
          ? 'Deep Analysis Failed'
          : null;
  const deepStatusClass =
    deepStatus === 'completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : deepStatus === 'running'
        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
        : deepStatus === 'failed'
          ? 'bg-red-50 text-red-700 border-red-200'
          : null;
  const deepCompletedLabel =
    deepStatus === 'completed' && latestDeepRun?.completedAt
      ? new Date(latestDeepRun.completedAt).toLocaleDateString('nl-NL', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : null;

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
        <PipelineChip
          stage={computePipelineStage({
            status: p.status,
            researchRun: runs?.[0]
              ? {
                  status: runs[0].status,
                  qualityApproved: runs[0].qualityApproved ?? null,
                }
              : null,
            hasCompletedResearch:
              runs?.some((run) => run.status === 'COMPLETED') ?? false,
            hasActiveResearch:
              runs?.some((run) =>
                [
                  'PENDING',
                  'CRAWLING',
                  'EXTRACTING',
                  'HYPOTHESIS',
                  'BRIEFING',
                ].includes(run.status),
              ) ?? false,
            hasSession: (p._count?.sessions ?? 0) > 0,
            hasBookedSession:
              p.sessions?.some((s: any) => s.callBooked) ?? false,
          })}
        />
        {runs?.[0] && (
          <QualityChip
            runId={runs[0].id}
            evidenceCount={runs[0]._count.evidenceItems}
            hypothesisCount={runs[0]._count.workflowHypotheses}
            qualityApproved={runs[0].qualityApproved ?? null}
            qualityReviewedAt={runs[0].qualityReviewedAt ?? null}
            runStatus={runs[0].status}
            summary={runs[0].summary}
          />
        )}
      </div>

      {/* Hero */}
      <div className="relative flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#040026] to-[#040026]/60 tracking-tighter pb-1">
            {p.companyName ?? p.domain}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {combinedConfidence !== null && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Data Confidence
                </span>
                <span className="text-sm font-black text-[#040026]">
                  {combinedConfidence}%
                </span>
              </div>
            )}
            <button
              onClick={copyLink}
              className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:text-[#040026] hover:bg-[#EBCB4B]/20 hover:border-[#D4B43B] shadow-sm border border-slate-200 transition-all w-fit"
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
        {p.description && (
          <p className="text-[15px] font-medium text-slate-500 max-w-3xl leading-relaxed">
            {p.description}
          </p>
        )}
      </div>

      {/* Company metadata — bare row, no card */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {p.industry && (
            <div className={metaPillClass}>
              <Globe className="w-4 h-4 text-slate-400" />
              <span>
                {p.industry}
                {p.subIndustry ? ` / ${p.subIndustry}` : ''}
              </span>
            </div>
          )}
          {(p.city ?? p.country) && (
            <div className={metaPillClass}>
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>
                {[p.city, p.state, p.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
          {(p.employeeRange || p.employeeCount) && (
            <div className={metaPillClass}>
              <Users className="w-4 h-4 text-indigo-500" />
              <span>
                {p.employeeCount
                  ? `${p.employeeCount.toLocaleString()} employees`
                  : `${p.employeeRange} employees`}
              </span>
            </div>
          )}
          {(p.revenueRange || p.revenueEstimate) && (
            <div className={metaPillClass}>
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>{p.revenueEstimate ?? p.revenueRange}</span>
            </div>
          )}
          {p.foundedYear && (
            <div className={metaPillClass}>
              <Calendar className="w-4 h-4 text-sky-500" />
              <span>Founded {p.foundedYear}</span>
            </div>
          )}
          {p.linkedinUrl && (
            <div className={metaPillClass}>
              <Linkedin className="w-4 h-4 text-[#0A66C2]" />
              <a
                href={p.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-focus text-[#0A66C2] hover:text-[#004182] font-semibold hover:underline rounded-full"
              >
                LinkedIn
              </a>
            </div>
          )}
          {typeof kvkMeta?.kvkNummer === 'string' && kvkMeta.kvkNummer && (
            <div className={metaPillClass}>
              <span className="text-slate-400 text-[10px] font-black tracking-wider uppercase">
                KvK
              </span>
              <span>{kvkMeta.kvkNummer}</span>
            </div>
          )}
          {typeof kvkMeta?.rechtsvorm === 'string' && kvkMeta.rechtsvorm && (
            <div className={metaPillClass}>
              <span className="text-slate-400 text-[10px] font-black tracking-wider uppercase">
                Rechtsvorm
              </span>
              <span>{kvkMeta.rechtsvorm}</span>
            </div>
          )}

          {(p._count?.sessions ?? 0) > 0 && (
            <div className={metaPillClass}>
              <Clock className="w-4 h-4 text-amber-500" />
              <span>{p._count.sessions} sessions</span>
            </div>
          )}
          {deepStatusLabel && deepStatusClass && (
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold',
                deepStatusClass,
              )}
            >
              <span>{deepStatusLabel}</span>
              {deepCompletedLabel && <span>· {deepCompletedLabel}</span>}
            </div>
          )}
          {(p.notificationLogs?.length ?? 0) > 0 && (
            <div className={metaPillClass}>
              <Phone className="w-4 h-4 text-teal-500" />
              <span>{p.notificationLogs.length} notifications</span>
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

      {/* Tab nav */}
      <nav className="mt-8 mb-6 overflow-x-auto">
        <div className="admin-toggle-group w-max">
          {BASE_TABS.filter(
            (tab) =>
              tab.id !== 'intent-signals' ||
              p.project?.projectType === 'ATLANTIS',
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'ui-tap ui-focus admin-toggle-btn admin-toggle-btn-sm',
                activeTab === tab.id && 'admin-toggle-btn-active',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* All sections stay mounted, inactive ones hidden via CSS */}
      <div
        className={cn(
          'pt-1 space-y-4',
          activeTab === 'evidence' ? '' : 'hidden',
        )}
      >
        {debugMode && latestRunId && (
          <SourceSetSection
            runId={latestRunId}
            inputSnapshot={latestRun?.inputSnapshot ?? null}
            prospectId={id}
          />
        )}
        <EvidenceSection
          prospectId={id}
          latestRunId={latestRunId}
          projectType={p.project?.projectType}
          signals={p.signals}
          latestRunSummary={latestRun?.summary}
          latestRunError={latestRun?.error ?? null}
          latestRunInputSnapshot={latestRun?.inputSnapshot ?? null}
        />
        {(overrideAudits.data?.length ?? 0) > 0 && (
          <div className="glass-card p-6 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Override History
            </h3>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(overrideAudits.data as any[]).map(
              (audit: {
                id: string;
                createdAt: Date;
                gateType: string;
                reason: string;
              }) => (
                <div
                  key={audit.id}
                  className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">
                      {new Date(audit.createdAt).toLocaleDateString('nl-NL')}{' '}
                      {new Date(audit.createdAt).toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className={gateTypeBadgeClass(audit.gateType)}>
                      {audit.gateType}
                    </span>
                  </div>
                  <p className="text-slate-600">{audit.reason}</p>
                </div>
              ),
            )}
          </div>
        )}
      </div>
      {p.project?.projectType === 'ATLANTIS' && (
        <div
          className={cn('pt-1', activeTab === 'intent-signals' ? '' : 'hidden')}
        >
          <IntentSignalsSection runId={latestRunId} />
        </div>
      )}
      <div className={cn('pt-1', activeTab === 'analysis' ? '' : 'hidden')}>
        <AnalysisSection
          prospectId={id}
          projectType={p.project?.projectType ?? null}
        />
      </div>
      <div
        className={cn('pt-1', activeTab === 'outreach-preview' ? '' : 'hidden')}
      >
        <OutreachPreviewSection
          prospectId={id}
          prospect={p}
          latestRunId={latestRunId}
        />
      </div>
      <div className={cn('pt-1', activeTab === 'results' ? '' : 'hidden')}>
        <ResultsSection prospectId={id} prospect={p} />
      </div>
    </div>
  );
}
