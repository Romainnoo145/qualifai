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
}

interface DashboardClientProps {
  prospectSlug: string;
  companyName: string;
  logoUrl: string | null;
  industry: string | null;
  hypotheses: HypothesisData[];
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
}

// ─── Step configuration ───────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: 'Welkom', icon: Sparkles },
  { id: 1, label: 'Pijnpunten', icon: AlertCircle },
  { id: 2, label: 'Oplossingen', icon: Lightbulb },
  { id: 3, label: 'Contact', icon: Phone },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient({
  prospectSlug,
  companyName,
  industry,
  hypotheses,
  lossMapId,
  bookingUrl,
  whatsappNumber,
  phoneNumber,
  contactEmail,
  heroContent,
  dataOpportunities,
  automationAgents,
  successStories,
}: DashboardClientProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [quoteRequested, setQuoteRequested] = useState(false);
  const stepTimesRef = useRef<Record<string, number>>({});
  const stepStartRef = useRef<number>(Date.now());

  const startSession = api.wizard.startSession.useMutation();
  const trackProgress = api.wizard.trackProgress.useMutation();
  const trackPdf = api.wizard.trackPdfDownload.useMutation();
  const trackCall = api.wizard.trackCallBooked.useMutation();
  const requestQuote = api.wizard.requestQuote.useMutation();

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

  // ─── Animation variants ─────────────────────────────────────────────────────

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  // WhatsApp message
  const whatsappClean = whatsappNumber?.replace(/[^0-9]/g, '') ?? '';
  const whatsappText = encodeURIComponent(
    `Hallo Klarifai, ik heb de analyse voor ${companyName} bekeken en wil graag meer informatie.`,
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* Top progress bar */}
      <header className="sticky top-0 z-50 bg-[#F8F9FA]/80 backdrop-blur-3xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-2xl bg-[#040026] flex items-center justify-center shadow-lg shadow-[#040026]/10">
              <span className="text-[#EBCB4B] font-black text-xs">K</span>
            </div>
            <span className="text-md font-black text-[#040026] tracking-tighter">
              {companyName}
            </span>
          </div>

          {/* Step indicators */}
          <nav className="hidden md:flex items-center gap-1">
            {STEPS.map((step) => (
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
            {currentStep + 1} / {STEPS.length}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-klarifai-yellow to-klarifai-cyan transition-all duration-500"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
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
            {/* ── Step 0: Welkom ──────────────────────────────────────────── */}
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
                      Workflow Analyse
                    </span>
                  </motion.div>

                  <h1 className="text-5xl md:text-7xl font-black text-[#040026] leading-[0.9] tracking-tighter">
                    {hero.headline ?? `Workflow kansen voor ${companyName}`}
                  </h1>

                  <p className="text-xl font-bold text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    {hero.subheadline ??
                      'Op basis van bewijs uit jouw sector laten we zien waar automatisering directe impact maakt.'}
                  </p>
                </div>

                {/* Summary stats */}
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

                {/* Industry insight */}
                {(hero.industryInsight ?? industry) && (
                  <div className="glass-card p-6 text-left">
                    <p className="text-sm text-slate-600 italic">
                      &ldquo;
                      {hero.industryInsight ??
                        `Bedrijven in ${industry} besparen gemiddeld significant op handmatige workflows door slimme automatisering.`}
                      &rdquo;
                    </p>
                  </div>
                )}

                {/* Powered by Klarifai */}
              </div>
            )}

            {/* ── Step 1: Pijnpunten ──────────────────────────────────────── */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Bewezen Pijnpunten
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {hypotheses.length > 0
                      ? `${hypotheses.length} bottlenecks geïdentificeerd op basis van bewijs uit jouw sector`
                      : 'Jouw analyse wordt nog verfijnd door ons team'}
                  </p>
                </div>

                {hypotheses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                ) : (
                  /* Fallback: old JSON data opportunities */
                  <div className="space-y-6">
                    {data.opportunities && data.opportunities.length > 0 ? (
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
                          Jouw analyse wordt nog verfijnd door ons team. Neem
                          gerust alvast contact op.
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

            {/* ── Step 2: Oplossingen ─────────────────────────────────────── */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Bewezen Oplossingen
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {uniqueUseCases.length > 0
                      ? `${uniqueUseCases.length} bewezen use cases die direct toepasbaar zijn voor ${companyName}`
                      : `Oplossingen voor ${companyName}`}
                  </p>
                </div>

                {uniqueUseCases.length > 0 ? (
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
                    {agents.agents && agents.agents.length > 0 ? (
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
                    Klaar om te starten?
                  </h2>
                  <p className="text-slate-500 mt-2">
                    Kies hoe je contact wilt opnemen met ons team
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
                          Download Rapport
                        </p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {canDownloadReport
                            ? 'Alle kansen en aanbevelingen als PDF'
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
                          Plan een Gesprek
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
                          href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Offerte aanvraag - ${companyName}`)}`}
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
                      Offerte Aanvragen
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
                          Ja, ik wil een offerte
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
            {STEPS.map((step) => (
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
