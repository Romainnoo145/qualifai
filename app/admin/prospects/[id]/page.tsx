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
  FileDown,
  Phone,
  Zap,
  Briefcase,
  Loader2,
  Calendar,
  Linkedin,
  Beaker,
  Target,
  FileText,
  ClipboardList,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import { useState } from 'react';
import { CommandCenter } from '@/components/features/prospects/command-center';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CadenceTab } from '@/components/features/CadenceTab';

type Tab =
  | 'signals'
  | 'wizard'
  | 'research'
  | 'hypotheses'
  | 'lossmap'
  | 'callprep'
  | 'cadence';

type DiscoveryGuardrail = {
  code: string;
  title: string;
  message: string;
  recommendation?: string;
};

export default function ProspectDetail() {
  const params = useParams();
  const id = params.id as string;
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('signals');
  const [manualResearchUrls, setManualResearchUrls] = useState('');
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchSignals = (api.signals.fetchForCompany as any).useMutation({
    onSuccess: () => {
      utils.admin.getProspect.invalidate({ id });
    },
  });

  const researchRuns = api.research.listRuns.useQuery({
    prospectId: id,
    limit: 10,
  });
  const hypothesisData = api.hypotheses.listByProspect.useQuery({
    prospectId: id,
  });
  const latestLossMap = api.assets.getLatest.useQuery({ prospectId: id });
  const latestCallPrep = api.callPrep.getLatest.useQuery({ prospectId: id });

  const startResearch = api.research.startRun.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.research.listRuns.invalidate({ prospectId: id, limit: 10 }),
        utils.hypotheses.listByProspect.invalidate({ prospectId: id }),
      ]);
    },
  });

  const matchProof = api.proof.matchForRun.useMutation({
    onSuccess: async () => {
      await utils.hypotheses.listByProspect.invalidate({ prospectId: id });
    },
  });

  const generateLossMap = api.assets.generate.useMutation({
    onSuccess: async () => {
      await utils.assets.getLatest.invalidate({ prospectId: id });
      await utils.assets.list.invalidate();
    },
  });

  const queueLossMapDraft = api.assets.queueOutreachDraft.useMutation({
    onSuccess: async () => {
      await utils.outreach.getQueue.invalidate();
      await utils.sequences.list.invalidate();
    },
    onError: (error) => {
      if (error.data?.code === 'PRECONDITION_FAILED') {
        alert(error.message);
      }
    },
  });

  const generateCallPrep = api.callPrep.regenerate.useMutation({
    onSuccess: async () => {
      await utils.callPrep.getLatest.invalidate({ prospectId: id });
    },
  });

  const setHypothesisStatus = api.hypotheses.setStatus.useMutation({
    onSuccess: async () => {
      await utils.hypotheses.listByProspect.invalidate({ prospectId: id });
    },
  });

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
  const latestRunId =
    researchRuns.data?.[0]?.id ??
    latestLossMap.data?.researchRunId ??
    latestCallPrep.data?.researchRunId ??
    null;
  const latestLossMapId = latestLossMap.data?.id ?? null;

  const runLossMapGeneration = () => {
    if (!latestRunId) return;
    generateLossMap.mutate({ runId: latestRunId });
  };

  const runCallPrepGeneration = () => {
    if (!latestRunId) return;
    generateCallPrep.mutate({ runId: latestRunId });
  };

  const queueOutreachForContact = (contactId?: string) => {
    if (!contactId || !latestLossMapId) return;
    queueLossMapDraft.mutate({
      workflowLossMapId: latestLossMapId,
      contactId,
    });
  };

  const tabs = [
    {
      key: 'signals' as const,
      label: `Signals (${p._count?.signals ?? 0})`,
      icon: Zap,
    },
    {
      key: 'research' as const,
      label: `Research (${researchRuns.data?.length ?? 0})`,
      icon: Beaker,
    },
    {
      key: 'hypotheses' as const,
      label: `Hypotheses (${hypothesisData.data?.hypotheses.length ?? 0})`,
      icon: Target,
    },
    {
      key: 'lossmap' as const,
      label: 'Workflow Report',
      icon: FileText,
    },
    {
      key: 'callprep' as const,
      label: 'Call Brief',
      icon: ClipboardList,
    },
    { key: 'wizard' as const, label: 'Wizard', icon: ExternalLink },
    { key: 'cadence' as const, label: 'Cadence', icon: Timer },
  ];

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
          <div className="flex items-center gap-3">
            <button
              onClick={copyLink}
              className="ui-tap flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100"
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
      </div>

      {/* Company Info (inline) */}
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

      {/* Contacts (inline) */}
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

      {/* Command Center */}
      <section>
        <CommandCenter
          prospect={p}
          researchRuns={researchRuns.data}
          hypothesisData={hypothesisData.data}
          latestLossMap={latestLossMap.data}
          latestCallPrep={latestCallPrep.data}
          isResearching={startResearch.isPending}
          isMatchingProof={matchProof.isPending}
          isGeneratingLossMap={generateLossMap.isPending}
          isQueueing={queueLossMapDraft.isPending}
          onStartResearch={() =>
            startResearch.mutate({
              prospectId: id,
              manualUrls: manualResearchUrls.split('\n').filter(Boolean),
            })
          }
          onMatchProof={(runId: string) => matchProof.mutate({ runId })}
          onSetHypothesisStatus={(kind: any, entryId: string, status: any) =>
            setHypothesisStatus.mutate({ kind, id: entryId, status })
          }
          onGenerateLossMap={runLossMapGeneration}
          onQueueOutreach={queueOutreachForContact}
        />
      </section>

      {/* Tabs (7 remaining) */}
      <section>
        <div className="flex items-center gap-2 p-1.5 bg-slate-50/80 rounded-2xl w-fit mb-12 border border-slate-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2.5 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all',
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50 border border-slate-100'
                  : 'text-slate-400 hover:text-slate-900',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.key === 'signals' ||
              tab.key === 'research' ||
              tab.key === 'hypotheses'
                ? tab.label.split(' ')[0]
                : tab.label}
            </button>
          ))}
        </div>

        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          {activeTab === 'signals' && (
            <SignalsTab
              p={p}
              onFetch={() => fetchSignals.mutate({ prospectId: id })}
              isFetching={fetchSignals.isPending}
            />
          )}
          {activeTab === 'research' && (
            <ResearchTab
              runs={researchRuns.data ?? []}
              manualUrls={manualResearchUrls}
              onManualUrlsChange={setManualResearchUrls}
              onRun={() =>
                startResearch.mutate({
                  prospectId: id,
                  manualUrls: manualResearchUrls
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              onMatchProof={(runId) => matchProof.mutate({ runId })}
              isRunning={startResearch.isPending}
              isMatchingProof={matchProof.isPending}
            />
          )}
          {activeTab === 'hypotheses' && (
            <HypothesesTab
              data={hypothesisData.data}
              onSetStatus={(kind, entryId, status) =>
                setHypothesisStatus.mutate({ kind, id: entryId, status })
              }
            />
          )}
          {activeTab === 'lossmap' && (
            <LossMapTab
              lossMap={latestLossMap.data}
              contacts={p.contacts ?? []}
              onGenerate={runLossMapGeneration}
              onQueueDraft={queueOutreachForContact}
              canGenerate={Boolean(latestRunId)}
              isGenerating={generateLossMap.isPending}
              isQueueing={queueLossMapDraft.isPending}
            />
          )}
          {activeTab === 'callprep' && (
            <CallPrepTab
              plan={latestCallPrep.data}
              onGenerate={runCallPrepGeneration}
              canGenerate={Boolean(latestRunId)}
              isGenerating={generateCallPrep.isPending}
            />
          )}
          {activeTab === 'wizard' && (
            <div className="bg-white border border-slate-200 border-dashed p-12 text-center rounded-2xl space-y-6">
              <p className="text-sm text-slate-500">
                Interactive Prospect Experience
              </p>
              {p.readableSlug && (
                <div className="flex items-center justify-center gap-2">
                  <code className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                    /voor/{p.readableSlug}
                  </code>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {p.readableSlug && (
                  <Link
                    href={`/voor/${p.readableSlug}`}
                    target="_blank"
                    className="btn-pill-primary px-8 py-3 text-sm inline-flex items-center gap-2"
                  >
                    Open Dashboard <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
                <Link
                  href={`/discover/${p.slug}`}
                  target="_blank"
                  className="btn-pill-secondary px-8 py-3 text-sm inline-flex items-center gap-2"
                >
                  Open Legacy Wizard <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
          {activeTab === 'cadence' && <CadenceTab prospectId={id} />}
        </div>
      </section>
    </div>
  );
}

function SignalsTab({
  p,
  onFetch,
  isFetching,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p: any;
  onFetch: () => void;
  isFetching: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {p.signals?.length ?? 0} signals detected
        </p>
        <button
          onClick={onFetch}
          disabled={isFetching}
          className="ui-focus flex items-center justify-center gap-2 px-4 py-2 btn-pill-primary text-sm disabled:opacity-50 w-full sm:w-auto"
        >
          {isFetching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Fetching...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" /> Fetch Signals
            </>
          )}
        </button>
      </div>

      {p.signals?.length > 0 ? (
        <div className="space-y-3">
          {p.signals.map((signal: any) => (
            <div key={signal.id} className="glass-card card-interactive p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Zap className="w-3 h-3 text-klarifai-yellow-dark" />
                <span className="text-xs font-medium text-slate-600">
                  {signal.signalType.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(signal.detectedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm font-medium text-klarifai-midnight">
                {signal.title}
              </p>
              {signal.description && (
                <p className="text-xs text-slate-500 mt-1">
                  {signal.description}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            No signals yet. Click &quot;Fetch Signals&quot; to check for buying
            signals.
          </p>
        </div>
      )}
    </div>
  );
}

function ResearchTab({
  runs,
  manualUrls,
  onManualUrlsChange,
  onRun,
  onMatchProof,
  isRunning,
  isMatchingProof,
}: {
  runs: any[];
  manualUrls: string;
  onManualUrlsChange: (value: string) => void;
  onRun: () => void;
  onMatchProof: (runId: string) => void;
  isRunning: boolean;
  isMatchingProof: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">{runs.length} research runs</p>
          <Button
            onClick={onRun}
            isLoading={isRunning}
            size="md"
            className="w-full sm:w-auto"
            leftIcon={<Beaker className="w-4 h-4" />}
          >
            Run Research
          </Button>
        </div>
        <textarea
          value={manualUrls}
          onChange={(event) => onManualUrlsChange(event.target.value)}
          rows={3}
          placeholder="Manual source URLs (review pages preferred, one per line)"
          className="w-full px-4 py-2.5 rounded-3xl border border-slate-200 bg-white/85 text-sm focus:outline-none focus:ring-2 focus:ring-klarifai-yellow/40 resize-none"
        />
      </div>

      {runs.length > 0 ? (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="glass-card card-interactive p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-klarifai-midnight">
                    {run.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    Evidence: {run._count.evidenceItems} / Hypotheses:{' '}
                    {run._count.workflowHypotheses} / Opportunities:{' '}
                    {run._count.automationOpportunities}
                  </p>
                </div>
                <button
                  onClick={() => onMatchProof(run.id)}
                  disabled={isMatchingProof}
                  className="ui-focus inline-flex items-center justify-center gap-1.5 px-3 py-1.5 btn-pill-secondary text-xs disabled:opacity-50 w-full sm:w-auto"
                >
                  {isMatchingProof ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Target className="w-3 h-3" />
                  )}
                  Match Proof
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-slate-500">No research run yet.</p>
        </div>
      )}
    </div>
  );
}

function HypothesesTab({
  data,
  onSetStatus,
}: {
  data: any;
  onSetStatus: (
    kind: 'hypothesis' | 'opportunity',
    entryId: string,
    status: 'DRAFT' | 'ACCEPTED' | 'REJECTED',
  ) => void;
}) {
  const hypotheses = data?.hypotheses ?? [];
  const opportunities = data?.opportunities ?? [];

  const statusPill = (status: string) =>
    status === 'ACCEPTED'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'REJECTED'
        ? 'bg-red-50 text-red-600'
        : 'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-klarifai-midnight mb-3">
          Bottlenecks ({hypotheses.length})
        </h3>
        <div className="space-y-3">
          {hypotheses.map((item: any) => (
            <div key={item.id} className="glass-card card-interactive p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-klarifai-midnight">
                  {item.title}
                </p>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${statusPill(item.status)}`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{item.problemStatement}</p>
              {item.proofMatches?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Matched Use Cases
                  </p>
                  <div className="space-y-1">
                    {item.proofMatches.map((match: any) => (
                      <div
                        key={match.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="font-mono text-emerald-600 font-bold text-[10px]">
                          {(match.score * 100).toFixed(0)}%
                        </span>
                        <span className="text-slate-700">
                          {match.useCase?.title ?? match.proofTitle}
                        </span>
                        {match.useCase?.category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400">
                            {match.useCase.category}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {item.evidenceItems?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Supporting Evidence
                  </p>
                  <div className="space-y-1.5">
                    {item.evidenceItems.slice(0, 4).map((ev: any) => (
                      <div key={ev.id} className="text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {ev.workflowTag && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                              {ev.workflowTag}
                            </span>
                          )}
                          {ev.sourceUrl && (
                            <a
                              href={ev.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-500 hover:underline truncate max-w-[200px]"
                            >
                              {ev.title ?? ev.sourceUrl}
                            </a>
                          )}
                        </div>
                        {ev.snippet && (
                          <p className="text-slate-400 line-clamp-2">
                            {ev.snippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onSetStatus('hypothesis', item.id, 'ACCEPTED')}
                  className="ui-focus ui-tap text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700"
                >
                  Accept
                </button>
                <button
                  onClick={() => onSetStatus('hypothesis', item.id, 'REJECTED')}
                  className="ui-focus ui-tap text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-600"
                >
                  Reject
                </button>
                <button
                  onClick={() => onSetStatus('hypothesis', item.id, 'DRAFT')}
                  className="ui-focus ui-tap text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700"
                >
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-klarifai-midnight mb-3">
          Automation Opportunities ({opportunities.length})
        </h3>
        <div className="space-y-3">
          {opportunities.map((item: any) => (
            <div key={item.id} className="glass-card card-interactive p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-klarifai-midnight">
                  {item.title}
                </p>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${statusPill(item.status)}`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{item.description}</p>
              {item.proofMatches?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Matched Use Cases
                  </p>
                  <div className="space-y-1">
                    {item.proofMatches.map((match: any) => (
                      <div
                        key={match.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="font-mono text-emerald-600 font-bold text-[10px]">
                          {(match.score * 100).toFixed(0)}%
                        </span>
                        <span className="text-slate-700">
                          {match.useCase?.title ?? match.proofTitle}
                        </span>
                        {match.useCase?.category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400">
                            {match.useCase.category}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {item.evidenceItems?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Supporting Evidence
                  </p>
                  <div className="space-y-1.5">
                    {item.evidenceItems.slice(0, 4).map((ev: any) => (
                      <div key={ev.id} className="text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {ev.workflowTag && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                              {ev.workflowTag}
                            </span>
                          )}
                          {ev.sourceUrl && (
                            <a
                              href={ev.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-500 hover:underline truncate max-w-[200px]"
                            >
                              {ev.title ?? ev.sourceUrl}
                            </a>
                          )}
                        </div>
                        {ev.snippet && (
                          <p className="text-slate-400 line-clamp-2">
                            {ev.snippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    onSetStatus('opportunity', item.id, 'ACCEPTED')
                  }
                  className="ui-focus ui-tap text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700"
                >
                  Accept
                </button>
                <button
                  onClick={() =>
                    onSetStatus('opportunity', item.id, 'REJECTED')
                  }
                  className="ui-focus ui-tap text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-600"
                >
                  Reject
                </button>
                <button
                  onClick={() => onSetStatus('opportunity', item.id, 'DRAFT')}
                  className="ui-focus ui-tap text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700"
                >
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LossMapTab({
  lossMap,
  contacts,
  onGenerate,
  onQueueDraft,
  canGenerate,
  isGenerating,
  isQueueing,
}: {
  lossMap: any;
  contacts: any[];
  onGenerate: () => void;
  onQueueDraft: (contactId: string) => void;
  canGenerate: boolean;
  isGenerating: boolean;
  isQueueing: boolean;
}) {
  const firstContactId = contacts[0]?.id as string | undefined;
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !canGenerate}
          className="ui-focus inline-flex items-center justify-center gap-2 px-4 py-2 btn-pill-primary text-sm disabled:opacity-50 w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" /> Generate Report
            </>
          )}
        </button>
        <button
          onClick={() => {
            if (!firstContactId) return;
            onQueueDraft(firstContactId);
          }}
          disabled={!lossMap || !firstContactId || isQueueing}
          className="ui-focus inline-flex items-center justify-center gap-2 px-4 py-2 btn-pill-secondary text-sm disabled:opacity-50 w-full sm:w-auto"
        >
          {isQueueing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Queueing...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" /> Queue Outreach Draft
            </>
          )}
        </button>
      </div>
      {!canGenerate && (
        <p className="text-xs text-slate-400">
          Run research first to generate the workflow report.
        </p>
      )}

      {lossMap ? (
        <div className="glass-card p-6">
          <p className="text-sm font-semibold text-klarifai-midnight mb-2">
            {lossMap.title}
          </p>
          <p className="text-xs text-slate-500 mb-3">
            CTA1: {lossMap.ctaStep1}
            <br />
            CTA2: {lossMap.ctaStep2}
            {process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ? (
              <>
                <br />
                Booking: {process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL}
              </>
            ) : null}
          </p>
          <pre className="bg-slate-50 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-wrap overflow-auto">
            {lossMap.markdown}
          </pre>
          <a
            href={`/api/export/loss-map/${lossMap.id}?format=pdf`}
            target="_blank"
            className="ui-focus inline-flex items-center gap-1.5 mt-3 text-xs text-klarifai-blue hover:underline rounded-full px-1"
          >
            <FileDown className="w-3.5 h-3.5" /> Download (PDF)
          </a>
          {process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL ? (
            <a
              href={process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL}
              target="_blank"
              className="ui-focus inline-flex items-center gap-1.5 mt-3 sm:ml-4 text-xs text-klarifai-blue hover:underline rounded-full px-1"
            >
              <Calendar className="w-3.5 h-3.5" /> Open booking page
            </a>
          ) : null}
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-slate-500">
            No workflow report generated yet.
          </p>
        </div>
      )}
    </div>
  );
}

function CallPrepTab({
  plan,
  onGenerate,
  canGenerate,
  isGenerating,
}: {
  plan: any;
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onGenerate}
        disabled={isGenerating || !canGenerate}
        className="ui-focus inline-flex items-center justify-center gap-2 px-4 py-2 btn-pill-primary text-sm disabled:opacity-50 w-full sm:w-auto"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Generating...
          </>
        ) : (
          <>
            <ClipboardList className="w-4 h-4" /> Generate 30/60/90 Plan
          </>
        )}
      </button>
      {!canGenerate && (
        <p className="text-xs text-slate-400">
          Run research first to generate a 30/60/90 plan.
        </p>
      )}

      {plan ? (
        <div className="glass-card p-6 space-y-3">
          <p className="text-sm font-semibold text-klarifai-midnight">
            {plan.summary}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-700 mb-1">
                30 days
              </p>
              <pre className="text-[11px] text-slate-600 whitespace-pre-wrap">
                {JSON.stringify(plan.plan30, null, 2)}
              </pre>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-700 mb-1">
                60 days
              </p>
              <pre className="text-[11px] text-slate-600 whitespace-pre-wrap">
                {JSON.stringify(plan.plan60, null, 2)}
              </pre>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-700 mb-1">
                90 days
              </p>
              <pre className="text-[11px] text-slate-600 whitespace-pre-wrap">
                {JSON.stringify(plan.plan90, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-slate-500">
            No call prep plan generated yet.
          </p>
        </div>
      )}
    </div>
  );
}
