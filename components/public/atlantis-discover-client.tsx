'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getCalApi } from '@calcom/embed-react';
import {
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/components/providers';
import type { NarrativeAnalysis } from '@/lib/analysis/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AtlantisDiscoverClientProps = {
  companyName: string;
  industry: string | null;
  prospectSlug: string;
  analysis: NarrativeAnalysis;
  projectBrandName: string;
  bookingUrl: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  analysisDate: string | null;
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quoteRequested, setQuoteRequested] = useState(false);
  const sectionTimesRef = useRef<Record<string, number>>({});
  const sessionStartRef = useRef<number>(Date.now());

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

  // Track scroll depth via IntersectionObserver on section headings
  useEffect(() => {
    if (!sessionId) return;

    const headings = document.querySelectorAll('[data-section-index]');
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexStr = (entry.target as HTMLElement).dataset.sectionIndex;
            const sectionIndex = indexStr ? parseInt(indexStr, 10) : 0;
            const elapsed = Math.floor(
              (Date.now() - sessionStartRef.current) / 1000,
            );
            sectionTimesRef.current[String(sectionIndex)] = elapsed;

            trackProgress.mutate({
              sessionId,
              currentStep: sectionIndex,
              stepTimes: sectionTimesRef.current,
            });
          }
        });
      },
      { threshold: 0.5 },
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
        },
      },
    );
  };

  // WhatsApp message
  const whatsappClean = whatsappNumber?.replace(/[^0-9]/g, '') ?? '';
  const whatsappText = encodeURIComponent(
    `Hallo ${brandName}, ik heb de partnership analyse voor ${companyName} bekeken en wil graag meer informatie.`,
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#F8F9FA]/80 backdrop-blur-3xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-2xl bg-[#040026] flex items-center justify-center shadow-lg shadow-[#040026]/10">
            <span className="text-[#EBCB4B] font-black text-xs">
              {brandMark}
            </span>
          </div>
          <span className="text-md font-black text-[#040026] tracking-tighter">
            {companyName}
          </span>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-16 space-y-16">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#EBCB4B]/10 border border-[#EBCB4B]/20 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#040026]">
              Vertrouwelijk voorstel
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-heading font-black text-[#040026] tracking-tight leading-tight">
            Partnership analyse — {companyName}
          </h1>

          <p className="text-lg text-slate-600 leading-relaxed max-w-prose mx-auto">
            {analysis.openingHook}
          </p>

          {analysisDate && (
            <p className="text-xs text-slate-400">Opgesteld {analysisDate}</p>
          )}
        </div>

        {/* ── Executive summary ─────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
            Samenvatting
          </p>
          <p className="text-base text-slate-700 leading-relaxed">
            {analysis.executiveSummary}
          </p>
        </div>

        {/* ── Narrative sections ────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto space-y-12">
          {analysis.sections.map((section, i) => (
            <section key={section.id} className="space-y-4">
              <h2
                data-section-index={i}
                className="text-2xl font-heading font-bold text-[#040026]"
              >
                {section.title}
              </h2>

              <div className="space-y-4">
                {section.body.split('\n\n').map((paragraph, j) => (
                  <p
                    key={j}
                    className="text-base text-slate-700 leading-relaxed"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {section.citations && section.citations.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 italic">
                    {section.citations.join(' · ')}
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* ── SPV recommendations ───────────────────────────────────────── */}
        {analysis.spvRecommendations &&
          analysis.spvRecommendations.length > 0 && (
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-2xl font-heading font-bold text-[#040026]">
                Samenwerkingsroutes
              </h2>

              <div className="space-y-4">
                {analysis.spvRecommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-6 shadow-sm space-y-3"
                  >
                    <h3 className="font-semibold text-slate-900">
                      {rec.spvName}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {rec.relevanceNarrative}
                    </p>
                    {rec.strategicTags && rec.strategicTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {rec.strategicTags.map((tag, j) => (
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
                ))}
              </div>
            </div>
          )}

        {/* ── CTA section ───────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-heading font-bold text-[#040026]">
              Geinteresseerd in een vertrouwelijk gesprek?
            </h2>

            {canBookCall && (
              <button
                onClick={handleBookCall}
                className="inline-flex items-center gap-3 px-10 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#1E1E4A] transition-colors shadow-xl shadow-[#040026]/10"
              >
                <Calendar className="w-4 h-4" />
                Plan een gesprek
              </button>
            )}
          </div>

          {/* Contact channels */}
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
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition-colors border border-[#25D366]/20"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </a>
                )}
                {phoneNumber && (
                  <a
                    href={`tel:${phoneNumber}`}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors border border-slate-100"
                  >
                    <Phone className="w-4 h-4" />
                    Bel ons
                  </a>
                )}
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Partnership intake - ${companyName}`)}`}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors border border-slate-100"
                  >
                    <Mail className="w-4 h-4" />
                    E-mail
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Quote request */}
          <div className="bg-white rounded-2xl p-8 text-center space-y-4 shadow-sm">
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
                className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-[#EBCB4B] text-[#040026] hover:bg-[#D4B83E] transition-colors shadow-xl shadow-[#EBCB4B]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-6 text-center">
        <span className="text-[10px] text-slate-400 tracking-wide">
          {brandName}
          {analysisDate ? ` · Analyse van ${analysisDate}` : ''}
        </span>
      </footer>
    </div>
  );
}
