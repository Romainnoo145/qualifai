'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
}

const STEPS = [
  { id: 0, label: 'Welcome', icon: Sparkles },
  { id: 1, label: 'Data', icon: Database },
  { id: 2, label: 'Automation', icon: Bot },
  { id: 3, label: 'Stories', icon: BookOpen },
  { id: 4, label: 'Roadmap', icon: Map },
  { id: 5, label: 'Next Steps', icon: Calendar },
];

export function WizardClient({
  slug,
  companyName,
  heroContent,
  dataOpportunities,
  automationAgents,
  successStories,
  aiRoadmap,
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const stepTimesRef = useRef<Record<string, number>>({});
  const stepStartRef = useRef<number>(Date.now());

  const startSession = api.wizard.startSession.useMutation();
  const trackProgress = api.wizard.trackProgress.useMutation();
  const trackPdf = api.wizard.trackPdfDownload.useMutation();
  const trackCall = api.wizard.trackCallBooked.useMutation();

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
    if (currentStep < 5) goToStep(currentStep + 1);
  };

  const prev = () => {
    if (currentStep > 0) goToStep(currentStep - 1);
  };

  const handlePdfDownload = () => {
    if (sessionId) trackPdf.mutate({ sessionId });
    // TODO: Phase 2 — actual PDF generation
    alert('PDF download coming soon!');
  };

  const handleBookCall = () => {
    if (sessionId) trackCall.mutate({ sessionId });
    // TODO: Phase 2 — Calendly embed
    window.open('https://calendly.com', '_blank');
  };

  const hero = heroContent as {
    headline: string;
    subheadline: string;
    stats: Array<{ label: string; value: string; icon: string }>;
    industryInsight: string;
  };

  const data = dataOpportunities as {
    opportunities: Array<{
      title: string;
      icon: string;
      description: string;
      impact: string;
      dataSource: string;
      exampleOutcome: string;
    }>;
  };

  const agents = automationAgents as {
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

  const stories = successStories as {
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

  const roadmap = aiRoadmap as {
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

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top progress bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-klarifai-midnight flex items-center justify-center">
              <span className="text-klarifai-yellow font-bold text-[10px]">
                K
              </span>
            </div>
            <span className="text-sm font-heading font-bold text-slate-900">
              {companyName}
            </span>
          </div>

          {/* Step indicators */}
          <nav className="hidden md:flex items-center gap-1">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => goToStep(step.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  currentStep === step.id
                    ? 'bg-klarifai-midnight text-white'
                    : currentStep > step.id
                      ? 'bg-klarifai-emerald/10 text-klarifai-emerald'
                      : 'text-slate-400 hover:text-slate-600'
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
              <div className="space-y-8 text-center max-w-3xl mx-auto">
                <div className="space-y-4">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-klarifai-yellow/10 border border-klarifai-yellow/20"
                  >
                    <Sparkles className="w-4 h-4 text-klarifai-yellow-dark" />
                    <span className="text-sm font-medium text-klarifai-midnight">
                      AI Discovery Report
                    </span>
                  </motion.div>
                  <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 leading-tight">
                    {hero.headline}
                  </h1>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    {hero.subheadline}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {hero.stats?.map((stat, i) => {
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
                    &ldquo;{hero.industryInsight}&rdquo;
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
                          <div className="w-12 h-12 rounded-xl bg-klarifai-midnight/5 flex items-center justify-center shrink-0">
                            <Icon className="w-6 h-6 text-klarifai-midnight" />
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
                  {roadmap.phases?.map((phase, i) => {
                    const Icon = getIcon(phase.icon);
                    return (
                      <motion.div
                        key={i}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.12 }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-klarifai-midnight flex items-center justify-center">
                            <Icon className="w-5 h-5 text-klarifai-yellow" />
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
                  className="glass-card p-6 text-center bg-gradient-to-br from-klarifai-midnight to-klarifai-indigo text-white"
                >
                  <p className="text-sm opacity-70 mb-1">
                    Estimated 12-Month ROI
                  </p>
                  <p className="text-2xl font-heading font-bold">
                    {roadmap.estimatedROI}
                  </p>
                </motion.div>
              </div>
            )}

            {/* Step 5: CTA */}
            {currentStep === 5 && (
              <div className="space-y-8 text-center max-w-2xl mx-auto">
                <div>
                  <h2 className="text-3xl font-heading font-bold text-slate-900">
                    Ready to Get Started?
                  </h2>
                  <p className="text-slate-500 mt-2">{roadmap.nextStep}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handlePdfDownload}
                    className="glass-card glass-card-hover p-8 flex flex-col items-center gap-3"
                  >
                    <FileDown className="w-8 h-8 text-klarifai-blue" />
                    <div>
                      <p className="font-semibold text-slate-900">
                        Download Report
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        PDF summary of your AI roadmap
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={handleBookCall}
                    className="glass-card p-8 flex flex-col items-center gap-3 bg-gradient-to-br from-klarifai-midnight to-klarifai-indigo text-white border-0 hover:opacity-90 transition-opacity"
                  >
                    <Calendar className="w-8 h-8 text-klarifai-yellow" />
                    <div>
                      <p className="font-semibold">Book a Discovery Call</p>
                      <p className="text-xs opacity-70 mt-1">
                        30 min with an AI strategist
                      </p>
                    </div>
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                  <div className="w-8 h-8 rounded-lg bg-klarifai-midnight flex items-center justify-center">
                    <span className="text-klarifai-yellow font-bold text-[10px]">
                      K
                    </span>
                  </div>
                  <span>Powered by Klarifai</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom navigation */}
      <footer className="sticky bottom-0 bg-white/80 backdrop-blur-xl border-t border-slate-200/60">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-0 disabled:cursor-default transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {/* Mobile step dots */}
          <div className="flex items-center gap-2 md:hidden">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentStep === step.id
                    ? 'bg-klarifai-midnight'
                    : currentStep > step.id
                      ? 'bg-klarifai-emerald'
                      : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {currentStep < 5 ? (
            <button
              onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-klarifai-midnight text-white hover:bg-klarifai-indigo transition-colors"
            >
              Next
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
