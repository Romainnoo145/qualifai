'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCalApi } from '@calcom/embed-react';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Database,
  Bot,
  BookOpen,
  Map,
  Calendar,
  FileDown,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Users,
  Zap,
  Clock,
  Target,
  CheckCircle2,
  Quote,
} from 'lucide-react';
import { api } from '@/components/providers';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3,
  TrendingUp,
  Users,
  Database,
  Zap,
  Bot,
  Clock,
  Target,
  Sparkles,
  CheckCircle2,
  Map,
  Calendar,
  BookOpen,
  FileDown,
  ArrowRight,
};

function getIcon(name: string) {
  return iconMap[name] ?? Sparkles;
}

interface WizardProps {
  slug: string;
  companyName: string;
  logoUrl: string | null;
  heroContent: Record<string, unknown>;
  dataOpportunities: Record<string, unknown>;
  automationAgents: Record<string, unknown>;
  successStories: Record<string, unknown>;
  aiRoadmap: Record<string, unknown>;
  lossMapId: string | null;
  bookingUrl: string | null;
}

const STEPS = [
  { id: 0, label: 'Welcome', icon: Sparkles },
  { id: 1, label: 'Data', icon: Database },
  { id: 2, label: 'Automation', icon: Bot },
  { id: 3, label: 'Stories', icon: BookOpen },
  { id: 4, label: 'Roadmap', icon: Map },
  { id: 5, label: 'Next Steps', icon: Calendar },
];

function nowMs(): number {
  if (typeof window !== 'undefined' && window.performance?.now) {
    return window.performance.now();
  }
  return Date.now();
}

export function WizardClient({
  slug,
  companyName,
  heroContent,
  dataOpportunities,
  automationAgents,
  successStories,
  aiRoadmap,
  lossMapId,
  bookingUrl,
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const stepTimesRef = useRef<Record<string, number>>({});
  const stepStartRef = useRef<number>(nowMs());

  const startSession = api.wizard.startSession.useMutation();
  const trackProgress = api.wizard.trackProgress.useMutation();
  const trackPdf = api.wizard.trackPdfDownload.useMutation();
  const trackCall = api.wizard.trackCallBooked.useMutation();
  const canDownloadReport = Boolean(lossMapId);
  const canBookCall = Boolean(bookingUrl);

  // Start session on mount
  useEffect(() => {
    startSession.mutate(
      { slug, userAgent: navigator.userAgent },
      {
        onSuccess: (data) => {
          if (data) setSessionId(data.sessionId);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToStep = (step: number) => {
    // Track time spent on current step
    const elapsedMs = Math.max(0, nowMs() - stepStartRef.current);
    const elapsed = Math.floor(elapsedMs / 1000);
    stepTimesRef.current[String(currentStep)] = elapsed;
    stepStartRef.current = nowMs();

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
    if (currentStep < 5) goToStep(currentStep + 1);
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
      // Strip leading slash from pathname
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

  const heroSource =
    heroContent && typeof heroContent === 'object' ? heroContent : {};
  const hero = heroSource as {
    headline: string;
    subheadline: string;
    stats: Array<{ label: string; value: string; icon: string }>;
    industryInsight: string;
  };
  const safeHero = {
    headline: hero.headline ?? `AI kansen voor ${companyName}`,
    subheadline:
      hero.subheadline ??
      'In een paar minuten zie je waar automatisering en AI directe impact kunnen maken.',
    stats: Array.isArray(hero.stats) ? hero.stats : [],
    industryInsight:
      hero.industryInsight ??
      'De grootste winst zit vaak in slimmere overdrachten, minder fouten en kortere doorlooptijden.',
  };

  const dataSource =
    dataOpportunities && typeof dataOpportunities === 'object'
      ? dataOpportunities
      : {};
  const data = dataSource as {
    opportunities: Array<{
      title: string;
      icon: string;
      description: string;
      impact: string;
      dataSource: string;
      exampleOutcome: string;
    }>;
  };

  const agentsSource =
    automationAgents && typeof automationAgents === 'object'
      ? automationAgents
      : {};
  const agents = agentsSource as {
    agents: Array<{
      name: string;
      icon: string;
      description: string;
      automatedTasks: string[];
      effort: string;
      impact: string;
      timeToValue: string;
    }>;
  };

  const storiesSource =
    successStories && typeof successStories === 'object' ? successStories : {};
  const stories = storiesSource as {
    stories: Array<{
      companyName: string;
      industry: string;
      challenge: string;
      solution: string;
      results: Array<{ metric: string; before: string; after: string }>;
      timeline: string;
      quote: string;
    }>;
  };

  const roadmapSource =
    aiRoadmap && typeof aiRoadmap === 'object' ? aiRoadmap : {};
  const roadmap = roadmapSource as {
    phases: Array<{
      name: string;
      duration: string;
      icon: string;
      items: Array<{
        title: string;
        description: string;
        effort: string;
        expectedOutcome: string;
      }>;
    }>;
    estimatedROI: string;
    nextStep: string;
  };
  const safeRoadmap = {
    phases: Array.isArray(roadmap.phases) ? roadmap.phases : [],
    estimatedROI:
      roadmap.estimatedROI ??
      'Verwachte ROI: meetbaar binnen 60-90 dagen na implementatie.',
    nextStep:
      roadmap.nextStep ??
      'Plan een korte teardown om prioriteiten en snelle wins te bevestigen.',
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

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
            {/* Step 0: Hero */}
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
                      Intelligence Asset 01
                    </span>
                  </motion.div>
                  <h1 className="text-5xl md:text-7xl font-black text-[#040026] leading-[0.9] tracking-tighter">
                    {safeHero.headline}
                  </h1>
                  <p className="text-xl font-bold text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    {safeHero.subheadline}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {safeHero.stats?.map((stat, i) => {
                    const Icon = getIcon(stat.icon);
                    return (
                      <motion.div
                        key={i}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="glass-card p-6"
                      >
                        <Icon className="w-5 h-5 text-klarifai-blue mx-auto mb-2" />
                        <div className="text-2xl font-bold font-heading text-slate-900">
                          {stat.value}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {stat.label}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Industry insight */}
                <div className="glass-card p-6 text-left">
                  <p className="text-sm text-slate-600 italic">
                    &ldquo;{safeHero.industryInsight}&rdquo;
                  </p>
                </div>
              </div>
            )}

            {/* Step 1: Data Opportunities */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Your Data Opportunities
                  </h2>
                  <p className="text-slate-500 mt-2">
                    {data.opportunities?.length ?? 0} ways your existing data
                    could create new value
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.opportunities?.map((opp, i) => {
                    const Icon = getIcon(opp.icon);
                    return (
                      <motion.div
                        key={i}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className="glass-card glass-card-hover p-6"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <Icon className="w-5 h-5 text-klarifai-blue" />
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
                        <p className="text-sm text-slate-500 mb-3">
                          {opp.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-100">
                          <span>
                            <strong className="text-slate-600">Source:</strong>{' '}
                            {opp.dataSource}
                          </span>
                        </div>
                        <div className="mt-2 text-xs font-medium text-klarifai-blue">
                          {opp.exampleOutcome}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Automation & AI Agents */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Automation & AI Agents
                  </h2>
                  <p className="text-slate-500 mt-2">
                    Processes you can automate with intelligent AI agents
                  </p>
                </div>
                <div className="space-y-4">
                  {agents.agents?.map((agent, i) => {
                    const Icon = getIcon(agent.icon);
                    return (
                      <motion.div
                        key={i}
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card glass-card-hover p-6"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#040026]/5 flex items-center justify-center shrink-0">
                            <Icon className="w-6 h-6 text-[#040026]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold text-slate-900">
                                {agent.name}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {agent.effort} EFFORT
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    agent.impact === 'HIGH'
                                      ? 'bg-klarifai-emerald/10 text-klarifai-emerald'
                                      : 'bg-blue-50 text-blue-600'
                                  }`}
                                >
                                  {agent.impact} IMPACT
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-slate-500 mb-3">
                              {agent.description}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {agent.automatedTasks?.map((task, j) => (
                                <span
                                  key={j}
                                  className="text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded-lg"
                                >
                                  {task}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-klarifai-blue font-medium">
                              <Clock className="w-3 h-3" />
                              {agent.timeToValue}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Success Stories */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Success Stories
                  </h2>
                  <p className="text-slate-500 mt-2">
                    Companies like yours that transformed with AI
                  </p>
                </div>
                <div className="space-y-6">
                  {stories.stories?.map((story, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.15 }}
                      className="glass-card p-8"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                        <span className="font-semibold text-slate-600">
                          {story.companyName}
                        </span>
                        <span>/</span>
                        <span>{story.industry}</span>
                        <span>/</span>
                        <span>{story.timeline}</span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">
                        <strong>Challenge:</strong> {story.challenge}
                      </p>
                      <p className="text-sm text-slate-600 mb-4">
                        <strong>Solution:</strong> {story.solution}
                      </p>

                      {/* Results */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {story.results?.map((result, j) => (
                          <div
                            key={j}
                            className="bg-slate-50 rounded-lg p-4 text-center"
                          >
                            <div className="text-xs text-slate-400 mb-1">
                              {result.metric}
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-slate-400 line-through">
                                {result.before}
                              </span>
                              <ArrowRight className="w-3 h-3 text-klarifai-emerald" />
                              <span className="text-sm font-bold text-klarifai-emerald">
                                {result.after}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quote */}
                      <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                        <Quote className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-500 italic">
                          {story.quote}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: AI Roadmap */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Your 90-Day AI Roadmap
                  </h2>
                  <p className="text-slate-500 mt-2">
                    From quick wins to strategic transformation
                  </p>
                </div>

                <div className="space-y-6">
                  {safeRoadmap.phases?.map((phase, i) => {
                    const Icon = getIcon(phase.icon);
                    return (
                      <motion.div
                        key={i}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.12 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-[#040026] flex items-center justify-center shadow-lg shadow-[#040026]/10">
                            <Icon className="w-5 h-5 text-[#EBCB4B]" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">
                              {phase.name}
                            </h3>
                            <span className="text-xs text-slate-400">
                              {phase.duration}
                            </span>
                          </div>
                        </div>
                        <div className="ml-5 border-l-2 border-slate-200 pl-8 space-y-3">
                          {phase.items?.map((item, j) => (
                            <div
                              key={j}
                              className="glass-card glass-card-hover p-4"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-medium text-sm text-slate-900">
                                  {item.title}
                                </h4>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                                    item.effort === 'LOW'
                                      ? 'bg-green-50 text-green-600'
                                      : item.effort === 'MEDIUM'
                                        ? 'bg-amber-50 text-amber-600'
                                        : 'bg-red-50 text-red-600'
                                  }`}
                                >
                                  {item.effort}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                {item.description}
                              </p>
                              <p className="text-xs text-klarifai-blue font-medium mt-2">
                                {item.expectedOutcome}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ROI callout */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="p-10 text-center bg-[#040026] text-white rounded-[2rem]"
                >
                  <p className="text-xs font-black uppercase tracking-widest text-[#EBCB4B] mb-2">
                    Estimated 12-Month Impact
                  </p>
                  <p className="text-3xl font-black tracking-tighter">
                    {safeRoadmap.estimatedROI}
                  </p>
                </motion.div>
              </div>
            )}

            {/* Step 5: CTA */}
            {currentStep === 5 && (
              <div className="space-y-8 text-center max-w-2xl mx-auto">
                <div>
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Klaar om te starten?
                  </h2>
                  <p className="text-slate-500 mt-2">{safeRoadmap.nextStep}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Download Report card */}
                  <button
                    onClick={handlePdfDownload}
                    disabled={!canDownloadReport}
                    className="glass-card glass-card-hover p-10 flex flex-col items-center gap-5 rounded-[2.5rem] border-slate-100 text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <FileDown className="w-8 h-8 text-red-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-[#040026] tracking-tight">
                        Download Rapport
                      </p>
                      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                        {canDownloadReport
                          ? 'Ontvang een compleet overzicht van alle kansen en aanbevelingen als PDF.'
                          : 'Rapport is nog niet beschikbaar.'}
                      </p>
                    </div>
                    {canDownloadReport && (
                      <span className="text-[10px] font-black text-[#040026] uppercase tracking-[0.2em] flex items-center gap-2 mt-auto">
                        Download PDF <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>

                  {/* Book Call card */}
                  <button
                    onClick={handleBookCall}
                    disabled={!canBookCall}
                    className="p-10 flex flex-col items-center gap-5 bg-[#040026] rounded-[2.5rem] hover:bg-[#1E1E4A] transition-all group shadow-2xl shadow-[#040026]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <Calendar className="w-8 h-8 text-[#EBCB4B]" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-white tracking-tight">
                        Plan een Gesprek
                      </p>
                      <p className="text-sm text-white/50 mt-2 leading-relaxed">
                        {canBookCall
                          ? 'Kies een moment dat jou uitkomt en bespreek de volgende stappen in een videocall.'
                          : 'Boeking is momenteel niet beschikbaar.'}
                      </p>
                    </div>
                    {canBookCall && (
                      <span className="text-[10px] font-black text-[#EBCB4B] uppercase tracking-[0.2em] flex items-center gap-2 mt-auto">
                        Open agenda <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-300">
                  <div className="w-6 h-6 rounded-lg bg-[#040026] flex items-center justify-center">
                    <span className="text-[#EBCB4B] font-black text-[8px]">
                      K
                    </span>
                  </div>
                  <span className="uppercase tracking-[0.2em]">
                    Powered by Klarifai Intelligence
                  </span>
                </div>
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
            Previous
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

          {currentStep < 5 ? (
            <button
              onClick={next}
              className="ui-tap flex items-center gap-3 px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-all shadow-xl shadow-[#040026]/10"
            >
              Continue
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
