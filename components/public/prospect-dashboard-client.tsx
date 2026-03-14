'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCalApi } from '@calcom/embed-react';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileDown,
  Clock,
  TrendingUp,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { api } from '@/components/providers';
import {
  getProjectUiProfile,
  type AppProjectType,
} from '@/lib/project-ui-profile';
import type {
  NarrativeAnalysis,
  KlarifaiNarrativeAnalysis,
} from '@/lib/analysis/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCaseData {
  id: string;
  title: string;
  summary: string;
  category: string;
  outcomes: string[];
}

interface ProofMatchData {
  id: string;
  score: number;
  useCase: UseCaseData | null;
}

interface HypothesisData {
  id: string;
  title: string;
  problemStatement: string;
  confidenceScore: number;
  hoursSavedWeekLow: number | null;
  hoursSavedWeekMid: number | null;
  hoursSavedWeekHigh: number | null;
  handoffSpeedGainPct: number | null;
  errorReductionPct: number | null;
  revenueLeakageRecoveredMid: number | null;
  proofMatches: ProofMatchData[];
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'DECLINED';
}

interface TrustSnapshot {
  combinedConfidencePct: number | null;
  enrichmentLabel: string | null;
  kvkNumber: string | null;
  kvkLegalForm: string | null;
  lastUpdateLabel: string | null;
  researchStatusLabel: string | null;
  qualityLabel: string | null;
  evidenceCount: number;
  sourceTypeCount: number;
  diagnosticsWarningCount: number;
}

interface AtlantisDashboardContext {
  triggerCount?: number;
  readinessScore?: number;
  bridgeCount?: number;
  topReason?: string | null;
  spvName?: string | null;
  contextBadge?: string | null;
  contextHeadline?: string | null;
  contextSubtitle?: string | null;
  executiveHook?: string | null;
  kpis?: Array<{ value: string; label: string }> | null;
}

interface DashboardClientProps {
  prospectSlug: string;
  companyName: string;
  industry: string | null;
  hypotheses: HypothesisData[];
  prospectStatus: string;
  lossMapId: string | null;
  bookingUrl: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  heroContent: Record<string, unknown>;
  dataOpportunities: Record<string, unknown>;
  automationAgents: Record<string, unknown>;
  successStories: Record<string, unknown>;
  aiRoadmap: Record<string, unknown>;
  trustSnapshot?: TrustSnapshot;
  projectType?: AppProjectType;
  projectBrandName?: string | null;
  atlantisContext?: AtlantisDashboardContext | null;
  narrativeAnalysis?: NarrativeAnalysis | null;
  klarifaiNarrativeAnalysis?: KlarifaiNarrativeAnalysis | null;
  analysisDate?: string | null;
}

// ─── Step configuration ───────────────────────────────────────────────────────

const DEFAULT_STEPS = [
  { id: 0, label: 'Welkom', icon: Sparkles },
  { id: 1, label: 'Pijnpunten', icon: AlertCircle },
  { id: 2, label: 'Oplossingen', icon: Lightbulb },
  { id: 3, label: 'Contact', icon: Phone },
];

const ATLANTIS_STEPS = [
  { id: 0, label: 'Context', icon: Sparkles },
  { id: 1, label: 'Kansen', icon: AlertCircle },
  { id: 2, label: 'Waarde', icon: Lightbulb },
  { id: 3, label: 'Intake', icon: Phone },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient({
  prospectSlug,
  companyName,
  industry,
  hypotheses,
  prospectStatus,
  lossMapId,
  bookingUrl,
  whatsappNumber,
  phoneNumber,
  contactEmail,
  heroContent,
  dataOpportunities,
  automationAgents,
  successStories,
  projectType,
  projectBrandName,
  atlantisContext,
  narrativeAnalysis,
  klarifaiNarrativeAnalysis,
  analysisDate,
}: DashboardClientProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [quoteRequested, setQuoteRequested] = useState(false);
  const stepTimesRef = useRef<Record<string, number>>({});
  const stepStartRef = useRef<number>(Date.now());
  const isAtlantis = projectType === 'ATLANTIS';
  const hasNarrative =
    (isAtlantis && !!narrativeAnalysis) ||
    (!isAtlantis && !!klarifaiNarrativeAnalysis);
  const activeNarrative =
    narrativeAnalysis ?? klarifaiNarrativeAnalysis ?? null;
  const steps = isAtlantis ? ATLANTIS_STEPS : DEFAULT_STEPS;
  const uiProfile = getProjectUiProfile(projectType);
  const normalizedBrandName = projectBrandName?.trim();
  const brandName =
    normalizedBrandName && normalizedBrandName.length > 0
      ? normalizedBrandName
      : 'Klarifai';
  const brandMark = brandName.charAt(0).toUpperCase();

  // Hypothesis validation state — optimistic updates
  const [validationState, setValidationState] = useState<
    Record<string, 'confirmed' | 'declined' | null>
  >({});

  const startSession = api.wizard.startSession.useMutation();
  const trackProgress = api.wizard.trackProgress.useMutation();
  const trackPdf = api.wizard.trackPdfDownload.useMutation();
  const trackCall = api.wizard.trackCallBooked.useMutation();
  const requestQuote = api.wizard.requestQuote.useMutation();

  // Pre-populate validation state from server-provided hypothesis status
  useEffect(() => {
    const initial: Record<string, 'confirmed' | 'declined' | null> = {};
    for (const h of hypotheses) {
      if (h.status === 'ACCEPTED') initial[h.id] = 'confirmed';
      if (h.status === 'DECLINED') initial[h.id] = 'declined';
      // PENDING = null (not yet validated by prospect)
    }
    setValidationState(initial);
  }, [hypotheses]);

  const validateHypothesis = api.hypotheses.validateByProspect.useMutation();

  const handleValidate = (
    hypothesisId: string,
    action: 'confirm' | 'decline',
  ) => {
    // Optimistic update BEFORE server call — instant feedback, prevents double-click
    setValidationState((prev) => ({
      ...prev,
      [hypothesisId]: action === 'confirm' ? 'confirmed' : 'declined',
    }));
    validateHypothesis.mutate({ slug: prospectSlug, hypothesisId, action });
  };

  const canDownloadReport = Boolean(lossMapId);
  const canBookCall = Boolean(bookingUrl);

  // Start session on mount — CRITICAL: use prospectSlug (nanoid), NOT readableSlug
  useEffect(() => {
    startSession.mutate(
      { slug: prospectSlug, userAgent: navigator.userAgent },
      {
        onSuccess: (data) => {
          if (data) setSessionId(data.sessionId);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToStep = (step: number) => {
    const elapsed = Math.floor((Date.now() - stepStartRef.current) / 1000);
    stepTimesRef.current[String(currentStep)] = elapsed;
    stepStartRef.current = Date.now();

    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);

    if (sessionId) {
      trackProgress.mutate({
        sessionId,
        currentStep: step,
        stepTimes: stepTimesRef.current,
      });
    }
  };

  const next = () => {
    if (currentStep < 3) goToStep(currentStep + 1);
  };

  const prev = () => {
    if (currentStep > 0) goToStep(currentStep - 1);
  };

  const handlePdfDownload = () => {
    if (!lossMapId) return;
    if (sessionId) trackPdf.mutate({ sessionId });
    window.open(
      `/api/export/loss-map/${lossMapId}?format=pdf`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  // Extract Cal.com path from full URL (e.g. "https://cal.com/klarifai/demo" -> "klarifai/demo")
  const calLink = (() => {
    if (!bookingUrl) return null;
    try {
      const url = new URL(bookingUrl);
      return url.pathname.replace(/^\//, '');
    } catch {
      return bookingUrl;
    }
  })();

  // Initialize Cal.com embed API
  useEffect(() => {
    if (!canBookCall) return;
    (async () => {
      const cal = await getCalApi();
      cal('ui', {
        theme: 'light',
        cssVarsPerTheme: {
          light: { 'cal-brand': '#040026' },
          dark: { 'cal-brand': '#EBCB4B' },
        },
        hideEventTypeDetails: false,
      });
    })();
  }, [canBookCall]);

  const handleBookCall = useCallback(() => {
    if (!calLink) return;
    if (sessionId) trackCall.mutate({ sessionId });
    (async () => {
      const cal = await getCalApi();
      cal('modal', {
        calLink,
        config: {
          layout: 'month_view',
          name: companyName,
        },
      });
    })();
  }, [calLink, sessionId, trackCall, companyName]);

  const handleRequestQuote = () => {
    if (!sessionId || quoteRequested) return;
    requestQuote.mutate(
      { sessionId },
      {
        onSuccess: () => {
          setQuoteRequested(true);
          // Small confetti burst on success
          void import('canvas-confetti').then((mod) => {
            const confetti = mod.default;
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.7 },
              colors: ['#EBCB4B', '#007AFF', '#00C9A7'],
            });
          });
        },
      },
    );
  };

  // ─── Derived data ───────────────────────────────────────────────────────────

  // Show validation section only after first outreach email is sent
  const showValidation = ['SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
    prospectStatus,
  );

  // Total hours saved from all hypotheses
  const totalHoursSaved = hypotheses.reduce(
    (sum, h) => sum + (h.hoursSavedWeekMid ?? 0),
    0,
  );

  // Aggregate unique use cases from all proof matches
  const allUseCases = hypotheses.flatMap((h) =>
    h.proofMatches.filter((pm) => pm.useCase !== null).map((pm) => pm.useCase!),
  );
  const uniqueUseCases = allUseCases.filter(
    (uc, idx, arr) => arr.findIndex((u) => u.id === uc.id) === idx,
  );
  const atlantisBadgeLabel =
    atlantisContext?.contextBadge?.trim() &&
    atlantisContext.contextBadge.trim().length > 0
      ? atlantisContext.contextBadge.trim()
      : 'Voorstel op maat';
  const atlantisHeadline =
    atlantisContext?.contextHeadline?.trim() &&
    atlantisContext.contextHeadline.trim().length > 0
      ? atlantisContext.contextHeadline.trim()
      : `${companyName} × Atlantis`;
  const atlantisSubheadline =
    atlantisContext?.contextSubtitle?.trim() &&
    atlantisContext.contextSubtitle.trim().length > 0
      ? atlantisContext.contextSubtitle.trim()
      : atlantisContext?.spvName
        ? `Atlantis verbindt ${companyName} met concrete groeikansen binnen ${atlantisContext.spvName}.`
        : `Atlantis verbindt ${companyName} met concrete groeikansen en uitvoerbare samenwerking.`;
  const atlantisKpis =
    Array.isArray(atlantisContext?.kpis) && atlantisContext.kpis.length > 0
      ? atlantisContext.kpis.slice(0, 3)
      : [
          {
            value: `${Math.max(1, hypotheses.length)}`,
            label: 'Concrete kansen',
          },
          {
            value: `${Math.min(3, Math.max(1, hypotheses.length))} stappen`,
            label: 'Voorstel plan',
          },
          { value: 'Kernkans', label: 'Hoofdinzicht' },
        ];
  const atlantisInsight =
    atlantisContext?.executiveHook?.trim() &&
    atlantisContext.executiveHook.trim().length > 0
      ? atlantisContext.executiveHook.trim()
      : atlantisContext?.topReason?.trim() &&
          atlantisContext.topReason.trim().length > 0
        ? atlantisContext.topReason.trim()
        : industry
          ? `${companyName} opereert in ${industry}; focus ligt op partnership-fit en uitvoerbare brugkansen.`
          : null;

  // Fallback content from old JSON fields
  const heroSource =
    heroContent && typeof heroContent === 'object' ? heroContent : {};
  const hero = heroSource as {
    headline?: string;
    subheadline?: string;
    industryInsight?: string;
  };

  const dataSource =
    dataOpportunities && typeof dataOpportunities === 'object'
      ? dataOpportunities
      : {};
  const data = dataSource as {
    opportunities?: Array<{
      title: string;
      description: string;
      impact: string;
    }>;
  };

  const agentsSource =
    automationAgents && typeof automationAgents === 'object'
      ? automationAgents
      : {};
  const agents = agentsSource as {
    agents?: Array<{ name: string; description: string }>;
  };

  const storiesSource =
    successStories && typeof successStories === 'object' ? successStories : {};
  const stories = storiesSource as {
    stories?: Array<{ companyName: string; solution: string; quote: string }>;
  };
  const insightText = isAtlantis
    ? atlantisInsight
    : (hero.industryInsight ??
      (industry
        ? `Bedrijven in ${industry} besparen gemiddeld significant op handmatige workflows door slimme automatisering.`
        : null));

  // ─── Animation variants ─────────────────────────────────────────────────────

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  // WhatsApp message
  const whatsappClean = whatsappNumber?.replace(/[^0-9]/g, '') ?? '';
  const whatsappText = encodeURIComponent(
    `Hallo ${brandName}, ik heb de analyse voor ${companyName} bekeken en wil graag meer informatie.`,
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* Top progress bar */}
      <header className="sticky top-0 z-50 bg-[#F8F9FA]/80 backdrop-blur-3xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-2xl bg-[#040026] flex items-center justify-center shadow-lg shadow-[#040026]/10">
              <span className="text-[#EBCB4B] font-black text-xs">
                {brandMark}
              </span>
            </div>
            <span className="text-md font-black text-[#040026] tracking-tighter">
              {companyName}
            </span>
          </div>

          {/* Step indicators */}
          <nav className="hidden md:flex items-center gap-1">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => goToStep(step.id)}
                className={`flex items-center gap-3 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  currentStep === step.id
                    ? 'bg-[#040026] text-white shadow-xl shadow-[#040026]/10'
                    : currentStep > step.id
                      ? 'text-emerald-500 bg-emerald-50/50'
                      : 'text-slate-400 hover:text-[#040026] hover:bg-white'
                }`}
              >
                <step.icon className="w-3.5 h-3.5" />
                {step.label}
              </button>
            ))}
          </nav>

          {/* Mobile step indicator */}
          <div className="md:hidden text-xs text-slate-500">
            {currentStep + 1} / {steps.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-klarifai-yellow to-klarifai-cyan transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* ── Step 0: Welkom / Context ─────────────────────────────── */}
            {currentStep === 0 && (
              <div className="space-y-12 text-center max-w-4xl mx-auto py-12">
                <div className="space-y-8">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#EBCB4B]/10 border border-[#EBCB4B]/20 shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 text-[#EBCB4B]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#040026]">
                      {hasNarrative
                        ? isAtlantis
                          ? 'Vertrouwelijk voorstel'
                          : 'Workflow Analyse'
                        : isAtlantis
                          ? atlantisBadgeLabel
                          : 'Workflow Analyse'}
                    </span>
                  </motion.div>

                  <h1 className="text-5xl md:text-7xl font-black text-[#040026] leading-[0.9] tracking-tighter">
                    {hasNarrative
                      ? isAtlantis
                        ? `Partnership analyse — ${companyName}`
                        : `Workflow analyse — ${companyName}`
                      : isAtlantis
                        ? atlantisHeadline
                        : (hero.headline ??
                          `Workflow kansen voor ${companyName}`)}
                  </h1>

                  <p className="text-xl font-bold text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    {hasNarrative
                      ? activeNarrative!.openingHook
                      : isAtlantis
                        ? atlantisSubheadline
                        : (hero.subheadline ??
                          'Op basis van bewijs uit jouw sector laten we zien waar automatisering directe impact maakt.')}
                  </p>

                  {hasNarrative && analysisDate && (
                    <p className="text-xs text-slate-400">
                      Opgesteld {analysisDate}
                    </p>
                  )}
                </div>

                {/* Executive summary (narrative v2) or summary stats */}
                {hasNarrative ? (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-8 text-left border border-[#EBCB4B]/35 bg-gradient-to-r from-[#FFFDF2] to-[#F5FAFF]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                      Samenvatting
                    </p>
                    <p className="text-base text-[#1E1E4A] leading-relaxed font-medium">
                      {activeNarrative!.executiveSummary}
                    </p>
                  </motion.div>
                ) : isAtlantis ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {atlantisKpis.map((kpi, index) => (
                        <motion.div
                          key={`${kpi.label}-${index}`}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 + index * 0.1 }}
                          className={`glass-card p-6 border ${
                            index === 0
                              ? 'border-[#87C8FF]/45 bg-[#EFF7FF]'
                              : index === 1
                                ? 'border-[#EBCB4B]/45 bg-[#FFFBEA]'
                                : 'border-[#8FE3B8]/45 bg-[#EFFAF4]'
                          }`}
                        >
                          {index === 0 ? (
                            <AlertCircle className="w-5 h-5 text-[#2D7FF9] mx-auto mb-2" />
                          ) : index === 1 ? (
                            <Clock className="w-5 h-5 text-[#C28700] mx-auto mb-2" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-[#1B8A5A] mx-auto mb-2" />
                          )}
                          <div className="text-2xl font-bold font-heading text-slate-900">
                            {kpi.value}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {kpi.label}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {insightText && (
                      <div className="glass-card p-7 text-left border border-[#EBCB4B]/35 bg-gradient-to-r from-[#FFFDF2] to-[#F5FAFF]">
                        <p className="text-base text-[#1E1E4A] leading-relaxed font-medium">
                          {insightText}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-6"
                      >
                        <AlertCircle className="w-5 h-5 text-klarifai-blue mx-auto mb-2" />
                        <div className="text-2xl font-bold font-heading text-slate-900">
                          {hypotheses.length}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Bewezen pijnpunten
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-6"
                      >
                        <Clock className="w-5 h-5 text-klarifai-blue mx-auto mb-2" />
                        <div className="text-2xl font-bold font-heading text-slate-900">
                          {totalHoursSaved > 0 ? `${totalHoursSaved}u` : '—'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Uur bespaard per week
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card p-6"
                      >
                        <CheckCircle2 className="w-5 h-5 text-klarifai-blue mx-auto mb-2" />
                        <div className="text-2xl font-bold font-heading text-slate-900">
                          {uniqueUseCases.length}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Bewezen oplossingen
                        </div>
                      </motion.div>
                    </div>

                    {insightText && (
                      <div className="glass-card p-6 text-left">
                        <p className="text-sm text-slate-600 italic">
                          &ldquo;{insightText}&rdquo;
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Step 1: Kansen / Pijnpunten ────────────────────────────── */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    {hasNarrative
                      ? isAtlantis
                        ? 'Strategische Kansen'
                        : 'Geidentificeerde Pijnpunten'
                      : isAtlantis
                        ? 'Jouw Kansen'
                        : 'Bewezen Pijnpunten'}
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {hasNarrative
                      ? `${activeNarrative!.sections.length} thema's geïdentificeerd op basis van marktanalyse`
                      : hypotheses.length > 0
                        ? isAtlantis
                          ? `${hypotheses.length} concrete kansen voor samenwerking in beeld`
                          : `${hypotheses.length} bottlenecks geïdentificeerd op basis van bewijs uit jouw sector`
                        : 'Jouw analyse wordt nog verfijnd door ons team'}
                  </p>
                </div>

                {/* Narrative sections from analysis-v2 */}
                {hasNarrative ? (
                  <div className="space-y-6">
                    {activeNarrative!.sections.map((section, i) => (
                      <motion.div
                        key={section.id}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card glass-card-hover p-6 text-left"
                      >
                        <h3 className="font-semibold text-slate-900 mb-3">
                          {section.title}
                        </h3>
                        <div className="space-y-3">
                          {section.body.split('\n\n').map((paragraph, j) => (
                            <p
                              key={j}
                              className="text-sm text-slate-600 leading-relaxed"
                            >
                              {paragraph}
                            </p>
                          ))}
                        </div>
                        {section.citations && section.citations.length > 0 && (
                          <div className="pt-3 mt-3 border-t border-slate-100">
                            <p className="text-xs text-slate-400 italic">
                              {section.citations.join(' · ')}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : hypotheses.length > 0 ? (
                  <>
                    <div
                      className={
                        isAtlantis
                          ? 'grid grid-cols-1 md:grid-cols-3 gap-4'
                          : 'grid grid-cols-1 md:grid-cols-2 gap-4'
                      }
                    >
                      {hypotheses.map((hypothesis, i) => (
                        <motion.div
                          key={hypothesis.id}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: i * 0.08 }}
                          className="glass-card glass-card-hover p-6"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <AlertCircle className="w-5 h-5 text-klarifai-blue shrink-0" />
                            {hypothesis.hoursSavedWeekMid &&
                              hypothesis.hoursSavedWeekMid > 0 && (
                                <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  {hypothesis.hoursSavedWeekMid}u/week
                                </div>
                              )}
                          </div>

                          <h3 className="font-semibold text-slate-900 mb-2">
                            {hypothesis.title}
                          </h3>
                          <p className="text-sm text-slate-500 mb-3">
                            {hypothesis.problemStatement}
                          </p>

                          {/* Metrics row */}
                          {(hypothesis.hoursSavedWeekLow ||
                            hypothesis.errorReductionPct ||
                            hypothesis.handoffSpeedGainPct) && (
                            <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
                              {hypothesis.hoursSavedWeekMid &&
                                hypothesis.hoursSavedWeekLow &&
                                hypothesis.hoursSavedWeekHigh && (
                                  <div className="text-xs text-slate-400">
                                    <span className="font-semibold text-slate-600">
                                      {hypothesis.hoursSavedWeekMid}u
                                    </span>{' '}
                                    ({hypothesis.hoursSavedWeekLow}–
                                    {hypothesis.hoursSavedWeekHigh}u) per week
                                  </div>
                                )}
                              {hypothesis.errorReductionPct && (
                                <div className="text-xs text-slate-400">
                                  <TrendingUp className="w-3 h-3 inline mr-1" />
                                  <span className="font-semibold text-slate-600">
                                    {hypothesis.errorReductionPct}%
                                  </span>{' '}
                                  minder fouten
                                </div>
                              )}
                            </div>
                          )}

                          {/* Matched use cases preview */}
                          {hypothesis.proofMatches.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                Bewezen oplossingen
                              </p>
                              <div className="space-y-1">
                                {hypothesis.proofMatches
                                  .filter((pm) => pm.useCase !== null)
                                  .slice(0, 2)
                                  .map((pm) => (
                                    <div
                                      key={pm.id}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                      <span className="text-slate-600">
                                        {pm.useCase!.title}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                    {/* Hypothesis validation section — only for SENT+ prospects */}
                    {showValidation && (
                      <div className="mt-8 space-y-4">
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-700">
                            Herkent u deze pijnpunten?
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Laat ons weten welke punten bij uw situatie passen
                          </p>
                        </div>

                        <div className="space-y-3">
                          {hypotheses.map((hypothesis) => {
                            const state = validationState[hypothesis.id];
                            return (
                              <motion.div
                                key={`validate-${hypothesis.id}`}
                                layout
                                className={`glass-card p-4 transition-all ${
                                  state === 'confirmed'
                                    ? 'border-emerald-200 bg-emerald-50/50'
                                    : state === 'declined'
                                      ? 'opacity-50 bg-slate-50'
                                      : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-slate-900">
                                      {hypothesis.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1">
                                      {hypothesis.problemStatement}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {state === 'confirmed' ? (
                                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 px-3 py-1.5 rounded-lg bg-emerald-100">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Bevestigd
                                      </span>
                                    ) : state === 'declined' ? (
                                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">
                                        Niet van toepassing
                                      </span>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() =>
                                            handleValidate(
                                              hypothesis.id,
                                              'confirm',
                                            )
                                          }
                                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Ja, herkenbaar
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleValidate(
                                              hypothesis.id,
                                              'decline',
                                            )
                                          }
                                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all"
                                        >
                                          Nee
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Fallback: old JSON data opportunities */
                  <div className="space-y-6">
                    {!isAtlantis &&
                    data.opportunities &&
                    data.opportunities.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.opportunities.map((opp, i) => (
                          <motion.div
                            key={i}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: i * 0.08 }}
                            className="glass-card glass-card-hover p-6"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <AlertCircle className="w-5 h-5 text-klarifai-blue" />
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  opp.impact === 'HIGH'
                                    ? 'bg-klarifai-emerald/10 text-klarifai-emerald'
                                    : 'bg-blue-50 text-blue-600'
                                }`}
                              >
                                {opp.impact} IMPACT
                              </span>
                            </div>
                            <h3 className="font-semibold text-slate-900 mb-2">
                              {opp.title}
                            </h3>
                            <p className="text-sm text-slate-500">
                              {opp.description}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="glass-card p-12 text-center">
                        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">
                          {isAtlantis
                            ? 'Deze analyse wordt momenteel afgerond. Plan een intake om de eerste kansen direct te verkennen.'
                            : 'Jouw analyse wordt nog verfijnd door ons team. Neem gerust alvast contact op.'}
                        </p>
                        <button
                          onClick={() => goToStep(3)}
                          className="mt-6 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl"
                        >
                          Neem contact op
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Waarde / Oplossingen ─────────────────────────────── */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    {hasNarrative
                      ? isAtlantis
                        ? 'Samenwerkingsroutes'
                        : 'Bewezen Oplossingen'
                      : isAtlantis
                        ? 'Samenwerkingsrichtingen'
                        : 'Bewezen Oplossingen'}
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {hasNarrative
                      ? isAtlantis && narrativeAnalysis
                        ? `${narrativeAnalysis.spvRecommendations.length} concrete samenwerkingsroutes voor ${companyName}`
                        : klarifaiNarrativeAnalysis
                          ? `${klarifaiNarrativeAnalysis.useCaseRecommendations.length} bewezen oplossingen voor ${companyName}`
                          : `Oplossingen voor ${companyName}`
                      : uniqueUseCases.length > 0
                        ? isAtlantis
                          ? `${uniqueUseCases.length} bewezen ${uiProfile.discoverEvidencePluralLabel} als onderbouwing voor partnership-hypotheses`
                          : `${uniqueUseCases.length} bewezen ${uiProfile.discoverEvidencePluralLabel} die direct toepasbaar zijn voor ${companyName}`
                        : isAtlantis
                          ? `Samenwerkingsopties voor ${companyName}`
                          : `Oplossingen voor ${companyName}`}
                  </p>
                </div>

                {/* SPV recommendations from analysis-v2 (Atlantis) */}
                {isAtlantis && narrativeAnalysis ? (
                  narrativeAnalysis.spvRecommendations.length > 0 ? (
                    <div className="space-y-4">
                      {narrativeAnalysis.spvRecommendations.map((rec, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: 40, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="glass-card glass-card-hover p-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#040026]/5 flex items-center justify-center shrink-0">
                              <Lightbulb className="w-6 h-6 text-[#040026]" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 mb-2">
                                {rec.spvName}
                              </h3>
                              <p className="text-sm text-slate-500 mb-3">
                                {rec.relevanceNarrative}
                              </p>
                              {rec.strategicTags &&
                                rec.strategicTags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {rec.strategicTags.map((tag, j) => (
                                      <span
                                        key={j}
                                        className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded-lg"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-card p-12 text-center">
                      <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">
                        Samenwerkingsroutes worden samengesteld. Plan een intake
                        om prioriteiten te bepalen.
                      </p>
                      <button
                        onClick={() => goToStep(3)}
                        className="mt-6 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl"
                      >
                        Plan intake
                      </button>
                    </div>
                  )
                ) : !isAtlantis && klarifaiNarrativeAnalysis ? (
                  /* Use Case recommendations from analysis-v2 (Klarifai) */
                  klarifaiNarrativeAnalysis.useCaseRecommendations.length >
                  0 ? (
                    <div className="space-y-4">
                      {klarifaiNarrativeAnalysis.useCaseRecommendations.map(
                        (rec, i) => (
                          <motion.div
                            key={i}
                            initial={{ x: 40, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card glass-card-hover p-6"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-[#040026]/5 flex items-center justify-center shrink-0">
                                <Lightbulb className="w-6 h-6 text-[#040026]" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <h3 className="font-semibold text-slate-900">
                                    {rec.useCaseTitle}
                                  </h3>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                    {rec.category}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-500 mb-3">
                                  {rec.relevanceNarrative}
                                </p>
                                {rec.applicableOutcomes &&
                                  rec.applicableOutcomes.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {rec.applicableOutcomes
                                        .slice(0, 3)
                                        .map((outcome, j) => (
                                          <span
                                            key={j}
                                            className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg"
                                          >
                                            <CheckCircle2 className="w-3 h-3" />
                                            {outcome}
                                          </span>
                                        ))}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </motion.div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="glass-card p-12 text-center">
                      <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">
                        Oplossingen worden samengesteld. Neem contact op om de
                        mogelijkheden te bespreken.
                      </p>
                      <button
                        onClick={() => goToStep(3)}
                        className="mt-6 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl"
                      >
                        Neem contact op
                      </button>
                    </div>
                  )
                ) : uniqueUseCases.length > 0 ? (
                  <div className="space-y-4">
                    {uniqueUseCases.map((uc, i) => (
                      <motion.div
                        key={uc.id}
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card glass-card-hover p-6"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#040026]/5 flex items-center justify-center shrink-0">
                            <Lightbulb className="w-6 h-6 text-[#040026]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <h3 className="font-semibold text-slate-900">
                                {uc.title}
                              </h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                {uc.category}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mb-3">
                              {uc.summary}
                            </p>
                            {uc.outcomes.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {uc.outcomes.slice(0, 3).map((outcome, j) => (
                                  <span
                                    key={j}
                                    className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    {outcome}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : hypotheses.length > 0 ? (
                  /* Hypotheses exist but no proof matches yet */
                  <div className="space-y-4">
                    {hypotheses.map((h, i) => (
                      <motion.div
                        key={h.id}
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card glass-card-hover p-6"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#040026]/5 flex items-center justify-center shrink-0">
                            <Lightbulb className="w-6 h-6 text-[#040026]" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-1">
                              {h.title}
                            </h3>
                            <p className="text-xs text-slate-400 italic">
                              Oplossing in voorbereiding door ons team
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  /* No hypotheses at all — fallback to agents/stories */
                  <div className="space-y-4">
                    {isAtlantis ? (
                      <div className="glass-card p-12 text-center">
                        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">
                          Samenwerkingsrichtingen worden nu samengesteld uit
                          nieuwe evidence. Plan een intake om prioriteiten te
                          bepalen.
                        </p>
                        <button
                          onClick={() => goToStep(3)}
                          className="mt-6 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl"
                        >
                          Plan intake
                        </button>
                      </div>
                    ) : agents.agents && agents.agents.length > 0 ? (
                      agents.agents.map((agent, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: 40, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="glass-card glass-card-hover p-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#040026]/5 flex items-center justify-center shrink-0">
                              <Lightbulb className="w-6 h-6 text-[#040026]" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 mb-1">
                                {agent.name}
                              </h3>
                              <p className="text-sm text-slate-500">
                                {agent.description}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : stories.stories && stories.stories.length > 0 ? (
                      stories.stories.map((story, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: 40, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="glass-card glass-card-hover p-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#040026]/5 flex items-center justify-center shrink-0">
                              <Lightbulb className="w-6 h-6 text-[#040026]" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 mb-1">
                                {story.companyName}
                              </h3>
                              <p className="text-sm text-slate-500 mb-2">
                                {story.solution}
                              </p>
                              {story.quote && (
                                <p className="text-xs text-slate-400 italic">
                                  &ldquo;{story.quote}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="glass-card p-12 text-center">
                        <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">
                          Jouw analyse wordt nog verfijnd door ons team. Neem
                          gerust alvast contact op.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Contact ─────────────────────────────────────────── */}
            {currentStep === 3 && (
              <div className="space-y-8 max-w-2xl mx-auto">
                <div className="text-center">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    {isAtlantis
                      ? 'Klaar voor partnership intake?'
                      : 'Klaar om te starten?'}
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {isAtlantis
                      ? 'Kies hoe je het partnershipgesprek wilt starten'
                      : 'Kies hoe je contact wilt opnemen met ons team'}
                  </p>
                </div>

                {/* Download + Book call row */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handlePdfDownload}
                    disabled={!canDownloadReport}
                    className="glass-card glass-card-hover p-6 rounded-2xl border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed group text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <FileDown className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#040026] tracking-tight">
                          {isAtlantis
                            ? 'Download Context Pack'
                            : 'Download Rapport'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {canDownloadReport
                            ? isAtlantis
                              ? 'Partnership samenvatting en evidence als PDF'
                              : 'Alle kansen en aanbevelingen als PDF'
                            : 'Nog niet beschikbaar'}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleBookCall}
                    disabled={!canBookCall}
                    className="p-6 rounded-2xl bg-[#040026] hover:bg-[#1E1E4A] transition-all group shadow-xl shadow-[#040026]/20 disabled:opacity-60 disabled:cursor-not-allowed text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Calendar className="w-5 h-5 text-[#EBCB4B]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white tracking-tight">
                          {isAtlantis ? 'Plan Intake Call' : 'Plan een Gesprek'}
                        </p>
                        <p className="text-xs text-white/50 mt-1 leading-relaxed">
                          {canBookCall
                            ? 'Kies een moment dat jou uitkomt'
                            : 'Niet beschikbaar'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Additional contact channels */}
                {(whatsappNumber || phoneNumber || contactEmail) && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                      Of neem direct contact op
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {whatsappNumber && (
                        <a
                          href={`https://wa.me/${whatsappClean}?text=${whatsappText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition-all border border-[#25D366]/20"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </a>
                      )}
                      {phoneNumber && (
                        <a
                          href={`tel:${phoneNumber}`}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all border border-slate-100"
                        >
                          <Phone className="w-4 h-4" />
                          Bel ons
                        </a>
                      )}
                      {contactEmail && (
                        <a
                          href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                            isAtlantis
                              ? `Partnership intake - ${companyName}`
                              : `Offerte aanvraag - ${companyName}`,
                          )}`}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all border border-slate-100"
                        >
                          <Mail className="w-4 h-4" />
                          E-mail
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Quote request */}
                <div className="glass-card p-8 text-center space-y-4">
                  <MessageSquare className="w-8 h-8 text-[#EBCB4B] mx-auto" />
                  <div>
                    <p className="text-lg font-black text-[#040026] tracking-tight">
                      {isAtlantis
                        ? 'Partnership Intake Aanvragen'
                        : 'Offerte Aanvragen'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Wij nemen binnen 1 werkdag contact met je op
                    </p>
                  </div>

                  {quoteRequested ? (
                    <div className="flex items-center justify-center gap-3 py-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-bold text-emerald-600">
                        Aanvraag ontvangen! Wij nemen snel contact op.
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={handleRequestQuote}
                      disabled={
                        !sessionId || requestQuote.isPending || quoteRequested
                      }
                      className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] hover:bg-[#D4B83E] transition-all shadow-xl shadow-[#EBCB4B]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {requestQuote.isPending ? (
                        <span>Versturen...</span>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          {isAtlantis
                            ? 'Ja, start partnership intake'
                            : 'Ja, ik wil een offerte'}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Powered by Klarifai */}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom navigation */}
      <footer className="sticky bottom-0 bg-[#F8F9FA]/80 backdrop-blur-3xl border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={currentStep === 0}
            className="ui-tap flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#040026] hover:bg-white disabled:opacity-0 disabled:cursor-default transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Vorige
          </button>

          {/* Mobile step dots */}
          <div className="flex items-center gap-3 md:hidden">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentStep === step.id
                    ? 'bg-[#040026] scale-150 shadow-lg shadow-[#040026]/20'
                    : currentStep > step.id
                      ? 'bg-emerald-400'
                      : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {currentStep < 3 ? (
            <button
              onClick={next}
              className="ui-tap flex items-center gap-3 px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl shadow-[#040026]/10"
            >
              Volgende
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </footer>
    </div>
  );
}
