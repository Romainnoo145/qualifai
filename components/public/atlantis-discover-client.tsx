'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCalApi } from '@calcom/embed-react';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  Handshake,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileDown,
  CheckCircle2,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { api } from '@/components/providers';
import type { MasterAnalysis, TriggerCategory } from '@/lib/analysis/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AtlantisDiscoverClientProps = {
  companyName: string;
  industry: string | null;
  prospectSlug: string;
  analysis: MasterAnalysis;
  projectBrandName: string;
  bookingUrl: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  analysisDate: string | null;
};

// ─── Step configuration ──────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: 'Context', icon: Sparkles },
  { id: 1, label: 'Waarom Nu', icon: TrendingUp },
  { id: 2, label: 'Samenwerking', icon: Handshake },
  { id: 3, label: 'Intake', icon: Phone },
];

const TRIGGER_BORDER_COLORS: Record<TriggerCategory, string> = {
  market: 'border-l-[#2563EB]',
  compliance_esg: 'border-l-[#059669]',
  capital_derisking: 'border-l-[#D97706]',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AtlantisDiscoverClient({
  companyName,
  prospectSlug,
  analysis,
  projectBrandName,
  bookingUrl,
  whatsappNumber,
  phoneNumber,
  contactEmail,
  analysisDate,
}: AtlantisDiscoverClientProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [quoteRequested, setQuoteRequested] = useState(false);
  const stepTimesRef = useRef<Record<string, number>>({});
  const stepStartRef = useRef<number>(Date.now());

  const normalizedBrandName = projectBrandName?.trim();
  const brandName =
    normalizedBrandName && normalizedBrandName.length > 0
      ? normalizedBrandName
      : 'Atlantis';
  const brandMark = brandName.charAt(0).toUpperCase();

  const startSession = api.wizard.startSession.useMutation();
  const trackProgress = api.wizard.trackProgress.useMutation();
  const trackCall = api.wizard.trackCallBooked.useMutation();
  const requestQuote = api.wizard.requestQuote.useMutation();

  // Start session on mount
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

  const canBookCall = Boolean(bookingUrl);

  // Extract Cal.com path from full URL
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

  // WhatsApp message
  const whatsappClean = whatsappNumber?.replace(/[^0-9]/g, '') ?? '';
  const whatsappText = encodeURIComponent(
    `Hallo ${brandName}, ik heb de partnership analyse voor ${companyName} bekeken en wil graag meer informatie.`,
  );

  // Animation variants
  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  // Safe data access
  const kpis = analysis.context?.kpis ?? [];
  const triggers = analysis.triggers ?? [];
  const tracks = analysis.tracks ?? [];

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* Header */}
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
            {/* ── Step 0: Context ──────────────────────────────────────── */}
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
                      Voorstel op maat
                    </span>
                  </motion.div>

                  <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl md:text-5xl font-heading font-black text-[#040026] tracking-tight leading-tight"
                  >
                    Partnership kansen voor {companyName}
                  </motion.h1>

                  {analysis.context?.hook && (
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-lg text-slate-600 max-w-prose mx-auto leading-relaxed"
                    >
                      {analysis.context.hook}
                    </motion.p>
                  )}
                </div>

                {/* KPI row */}
                {kpis.length > 0 && (
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto"
                  >
                    {kpis.slice(0, 3).map((kpi, i) => (
                      <div key={i} className="text-center">
                        <div className="text-3xl md:text-4xl font-black text-[#040026] tracking-tight">
                          {kpi.value}
                        </div>
                        <div className="text-xs uppercase tracking-wide text-gray-500 mt-2">
                          {kpi.label}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Executive hook */}
                {analysis.context?.executiveHook && (
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-sm text-slate-500 max-w-prose mx-auto leading-relaxed"
                  >
                    {analysis.context.executiveHook}
                  </motion.p>
                )}
              </div>
            )}

            {/* ── Step 1: Waarom Nu (Triggers) ─────────────────────────── */}
            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Waarom nu
                  </h2>
                  <p className="text-slate-500 mt-2">
                    Actuele signalen die partnership relevant maken voor{' '}
                    {companyName}
                  </p>
                </div>

                {triggers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {triggers.map((trigger, i) => {
                      const borderColor =
                        TRIGGER_BORDER_COLORS[trigger.category] ??
                        'border-l-[#2563EB]';
                      const firstNumber =
                        trigger.numbers && trigger.numbers.length > 0
                          ? trigger.numbers[0]
                          : null;

                      return (
                        <motion.div
                          key={i}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${borderColor}`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {trigger.title}
                              </h3>
                              {trigger.urgency === 'high' && (
                                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                              )}
                            </div>

                            {firstNumber && (
                              <div className="text-xl font-bold text-[#040026]">
                                {firstNumber}
                              </div>
                            )}

                            <p className="text-sm text-gray-600 leading-relaxed">
                              {trigger.narrative}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-card p-12 text-center">
                    <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">
                      Triggersignalen worden momenteel geanalyseerd.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Samenwerking (Partnership) ───────────────────── */}
            {currentStep === 2 && (
              <div className="space-y-8">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Samenwerkingsroutes
                  </h2>
                  <p className="text-slate-500 mt-2">
                    Relevante partnership tracks voor {companyName}
                  </p>
                </div>

                {tracks.length > 0 ? (
                  <div className="space-y-4">
                    {tracks.map((track, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white rounded-xl shadow-sm p-6"
                      >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <h3 className="font-semibold text-slate-900">
                              {track.spvName}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {track.scope}
                            </p>
                            <p className="text-sm italic text-[#040026]/70">
                              {track.relevance}
                            </p>
                            {track.strategicTags &&
                              track.strategicTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {track.strategicTags.map((tag, j) => (
                                    <span
                                      key={j}
                                      className="inline-flex rounded-full bg-gray-100 text-xs px-2 py-0.5 text-gray-600"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                          <button
                            onClick={
                              canBookCall
                                ? handleBookCall
                                : contactEmail
                                  ? () =>
                                      window.open(
                                        `mailto:${contactEmail}?subject=${encodeURIComponent(`Interesse in ${track.spvName} - ${companyName}`)}`,
                                      )
                                  : undefined
                            }
                            className="shrink-0 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-lg shadow-[#040026]/10"
                          >
                            Interesse
                          </button>
                        </div>
                      </motion.div>
                    ))}

                    {/* General CTA */}
                    <div className="pt-4 text-center">
                      <button
                        onClick={() => goToStep(3)}
                        className="inline-flex items-center gap-3 px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] hover:bg-[#D4B83E] transition-all shadow-xl shadow-[#EBCB4B]/20"
                      >
                        Plan een intake
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card p-12 text-center">
                    <Handshake className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">
                      Samenwerkingsroutes worden momenteel samengesteld. Plan
                      een intake om prioriteiten te bepalen.
                    </p>
                    <button
                      onClick={() => goToStep(3)}
                      className="mt-6 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl"
                    >
                      Plan intake
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Intake ────────────────────────────────────────── */}
            {currentStep === 3 && (
              <div className="space-y-8 max-w-2xl mx-auto">
                <div className="text-center">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Klaar voor partnership intake?
                  </h2>
                  <p className="text-slate-500 mt-2">
                    Kies hoe je het partnershipgesprek wilt starten
                  </p>
                </div>

                {/* Download + Book call row */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    disabled
                    className="glass-card glass-card-hover p-6 rounded-2xl border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed group text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <FileDown className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#040026] tracking-tight">
                          Download Context Pack
                        </p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Nog niet beschikbaar
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
                          Plan Intake Call
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
                          href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Partnership intake - ${companyName}`)}`}
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
                      Partnership Intake Aanvragen
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
                          Ja, start partnership intake
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer with analysis date */}
      {analysisDate && (
        <div className="text-center py-2">
          <span className="text-[10px] text-slate-400 tracking-wide">
            Analyse van {analysisDate}
          </span>
        </div>
      )}

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
