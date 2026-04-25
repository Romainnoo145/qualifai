'use client';

import type { Prisma } from '@prisma/client';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  ArrowRight,
  RefreshCw,
  Play,
  PenLine,
  Send,
  ExternalLink,
  Check,
} from 'lucide-react';
import { api } from '@/components/providers';
import { PageLoader } from '@/components/ui/page-loader';
import { cn } from '@/lib/utils';
import { buildDiscoverPath } from '@/lib/prospect-url';
import { RerunLoadingScreen } from '@/components/features/research/rerun-loading-screen';
import {
  ProspectDetailLoadingB,
  ProspectDetailLoadingC,
} from '@/components/features/research/prospect-detail-loading';

// ─────────────────────────────────────────────────────────────────────
// Prospect Detail — Editorial layout (Fase A Step 3)
// Spec: docs/superpowers/specs/2026-04-16-admin-prospect-detail-redesign.md
// Handoff: .planning/handoffs/fase-a-admin-foundation-prospect-detail.md
// ─────────────────────────────────────────────────────────────────────

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

type EventType = 'ENRICH' | 'QUALITY' | 'RUN' | 'QUOTE' | 'OUTREACH';

type ActivityEvent = {
  id: string;
  type: EventType;
  occurredAt: Date;
  title: string;
  description: React.ReactNode;
};

const TAG_CLASS: Record<EventType, string> = {
  ENRICH:
    'bg-[var(--color-tag-enrich-bg)] text-[var(--color-tag-enrich-text)] border-[var(--color-tag-enrich-border)]',
  QUALITY:
    'bg-[var(--color-tag-quality-bg)] text-[var(--color-tag-quality-text)] border-[var(--color-tag-quality-border)]',
  RUN: 'bg-[var(--color-tag-run-bg)] text-[var(--color-tag-run-text)] border-[var(--color-tag-run-border)]',
  QUOTE:
    'bg-[var(--color-surface-2)] text-[var(--color-foreground)] border-[var(--color-border-strong)]',
  OUTREACH:
    'bg-[var(--color-tag-outreach-bg)] text-[var(--color-tag-outreach-text)] border-[var(--color-tag-outreach-border)]',
};

const DATE_TZ: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
};

const TIME_TZ: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('nl-NL').format(n);
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toString().padStart(2, '0')}s`;
}

// Derive activity events from existing queries — full unified feed
// will move to admin.getProspectActivity in a later step.
function buildActivityFromRuns(
  runs: ResearchRunRow[] | undefined,
  prospect: ProspectShape,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  if (prospect.lastEnrichedAt) {
    events.push({
      id: 'enrich-last',
      type: 'ENRICH',
      occurredAt: new Date(prospect.lastEnrichedAt),
      title: 'Enrichment voltooid',
      description: (
        <>
          Firmographics verrijkt.
          {prospect.industry ? (
            <>
              {' '}
              Industry <b>{prospect.industry}</b>.
            </>
          ) : null}
          {prospect.employeeCount ? (
            <>
              {' '}
              <b>{prospect.employeeCount}</b> medewerkers.
            </>
          ) : null}
        </>
      ),
    });
  }

  (runs ?? []).forEach((run) => {
    const isDone = run.status === 'COMPLETED';
    const ended = run.completedAt ?? run.createdAt;
    const dur =
      run.completedAt && run.createdAt
        ? new Date(run.completedAt).getTime() -
          new Date(run.createdAt).getTime()
        : null;

    events.push({
      id: `run-${run.id}`,
      type: 'RUN',
      occurredAt: new Date(ended),
      title: isDone ? 'Research run voltooid' : `Research run · ${run.status}`,
      description: (
        <>
          {run._count.evidenceItems > 0 ? (
            <>
              <b>{run._count.evidenceItems}</b> evidence items ·{' '}
            </>
          ) : null}
          {run._count.workflowHypotheses > 0 ? (
            <>
              <b>{run._count.workflowHypotheses}</b> hypotheses ·{' '}
            </>
          ) : null}
          {dur ? (
            <>
              duur <span className="mono">{formatDuration(dur)}</span>
            </>
          ) : null}
        </>
      ),
    });

    if (run.qualityApproved === true) {
      const summaryText =
        typeof run.summary === 'string'
          ? run.summary
          : run.summary && typeof run.summary === 'object'
            ? JSON.stringify(run.summary).slice(0, 160)
            : null;
      events.push({
        id: `quality-${run.id}`,
        type: 'QUALITY',
        occurredAt: new Date(run.qualityReviewedAt ?? ended),
        title: 'Kwaliteit goedgekeurd',
        description: (
          <>
            Quality gate gepasseerd op <b>{run._count.evidenceItems}</b>{' '}
            evidence items.
            {summaryText ? (
              <>
                {' '}
                <span className="italic text-[var(--color-muted-dark)]">
                  {summaryText.slice(0, 140)}
                  {summaryText.length > 140 ? '…' : ''}
                </span>
              </>
            ) : null}
          </>
        ),
      });
    }
  });

  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

// ─────────────────────────────────────────────────────────────────────
// Inline sub-components
// ─────────────────────────────────────────────────────────────────────

type ProspectShape = Record<string, unknown> & {
  companyName: string | null;
  domain: string | null;
  industry: string | null;
  subIndustry: string | null;
  city: string | null;
  country: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  linkedinUrl: string | null;
  foundedYear: number | null;
  logoUrl: string | null;
  description: string | null;
  status: string | null;
  slug: string;
  readableSlug: string | null;
  lastEnrichedAt: Date | null;
  voorstelMode: 'STANDARD' | 'BESPOKE';
  bespokeUrl: string | null;
  _count?: { evidenceItems: number };
  contacts?: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    primaryEmail: string | null;
  }>;
};

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-muted)] whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

function HeroName({ name }: { name: string }) {
  return (
    <h1 className="font-['Sora'] text-[clamp(42px,6vw,72px)] font-bold leading-[1.05] tracking-[-0.025em] text-[var(--color-ink)]">
      {name}
      <span className="text-[var(--color-gold-hi)]">.</span>
    </h1>
  );
}

function HeroBtn({
  children,
  variant = 'paper',
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  variant?: 'paper' | 'ink' | 'gold';
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  const base =
    'inline-flex items-center gap-2 rounded-[6px] border px-4 py-2.5 text-[13px] font-medium leading-none transition-colors cursor-pointer';
  const variants = {
    paper:
      'bg-[var(--color-surface)] border-[var(--color-border-strong)] text-[var(--color-ink)] hover:border-[var(--color-ink)]',
    ink: 'bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-background)] hover:bg-[#1c1c44]',
    gold: 'bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] border-[#e4c33c] text-[var(--color-ink)] hover:from-[#d4b43b] hover:to-[#f4e96e] font-medium rounded-full!',
  };
  return (
    <button
      type="button"
      className={cn(
        base,
        variants[variant],
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function MegaStat({
  label,
  value,
  sub,
  goldDot,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  goldDot?: boolean;
}) {
  return (
    <div className="py-3 border-r border-[var(--color-border)] last:border-r-0 first:pl-0 pl-5 pr-5">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {label}
      </span>
      <div className="mt-1.5 font-['Sora'] text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--color-ink)]">
        {value}
        {goldDot ? (
          <span className="text-[var(--color-gold-hi)]">.</span>
        ) : null}
      </div>
      <div className="mt-2 text-[12px] font-normal text-[var(--color-muted)]">
        {sub}
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  kbd,
  variant = 'paper',
  onClick,
}: {
  icon: typeof RefreshCw;
  label: string;
  kbd?: string;
  variant?: 'paper' | 'gold';
  onClick?: () => void;
}) {
  const base =
    'flex w-full items-center gap-2 px-4 py-2.5 rounded-[6px] border text-[11px] font-medium uppercase tracking-[0.06em] transition-all cursor-pointer text-left';
  const variants = {
    paper:
      'bg-transparent border-[var(--color-border)] text-[var(--color-ink)] hover:border-[var(--color-ink)]',
    gold: 'bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] border-[#e4c33c] text-[var(--color-ink)] hover:from-[#d4b43b] hover:to-[#f4e96e]',
  };
  return (
    <button
      type="button"
      className={cn(base, variants[variant])}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-2.5">
        <Icon
          className="h-[14px] w-[14px] text-[var(--color-muted)]"
          strokeWidth={1.75}
          style={variant === 'gold' ? { color: 'var(--color-ink)' } : undefined}
        />
        {label}
      </span>
      {kbd ? (
        <span className="text-[10px] font-medium text-[var(--color-muted)] px-1.5 py-0.5 rounded-[3px] border border-[var(--color-border-strong)] bg-[var(--color-background)]">
          {kbd}
        </span>
      ) : null}
    </button>
  );
}

function ContactRow({
  initials,
  name,
  role,
  isPrimary,
  accent,
}: {
  initials: string;
  name: string;
  role: string;
  isPrimary?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2 rounded-[6px] hover:bg-[var(--color-surface-hover)] transition-colors">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{
          background: accent ?? 'var(--color-ink)',
          color: accent ? '#ffffff' : 'var(--color-gold-hi)',
        }}
      >
        <span className="font-['Sora'] text-[10px] font-bold">{initials}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[var(--color-ink)] truncate">
          {name}
        </div>
        <div className="text-[10px] text-[var(--color-muted)] truncate">
          {role}
        </div>
      </div>
      {isPrimary ? (
        <span className="text-[9px] text-[var(--color-tag-quality-text)] tracking-wider">
          primair
        </span>
      ) : null}
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const date = event.occurredAt.toLocaleDateString('nl-NL', DATE_TZ);
  const time = event.occurredAt.toLocaleTimeString('nl-NL', TIME_TZ);
  return (
    <article className="grid grid-cols-[64px_1fr_auto] gap-5 py-4 border-b border-[var(--color-border)] last:border-b-0">
      <div className="text-[10px] font-medium tracking-[0.04em] text-[var(--color-muted)] pt-0.5">
        <span className="block font-semibold text-[var(--color-gold-hi)]">
          {date}
        </span>
        {time}
      </div>
      <div>
        <div className="text-[14px] font-semibold text-[var(--color-ink)] leading-snug">
          {event.title}
        </div>
        <div className="mt-1 text-[13px] font-light text-[var(--color-muted-dark)] leading-relaxed max-w-[620px]">
          {event.description}
        </div>
      </div>
      <span
        className={cn(
          'self-start inline-flex items-center h-[20px] px-2 rounded-[4px] border text-[9px] font-medium tracking-[0.14em] uppercase whitespace-nowrap',
          TAG_CLASS[event.type],
        )}
      >
        {event.type}
      </span>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────

const ALL_FEED_TABS: { id: 'ALL' | EventType; label: string }[] = [
  { id: 'ALL', label: 'Alles' },
  { id: 'RUN', label: 'Runs' },
  { id: 'ENRICH', label: 'Enrichment' },
  { id: 'QUALITY', label: 'Kwaliteit' },
  { id: 'OUTREACH', label: 'Outreach' },
  { id: 'QUOTE', label: 'Offertes' },
];

export default function ProspectDetail() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewVariant = searchParams.get('preview');
  const isPreviewMode = previewVariant === 'B' || previewVariant === 'C';

  const utils = api.useUtils();

  const prospectQuery = api.admin.getProspect.useQuery({ id });
  const runsQuery = api.research.listRuns.useQuery({ prospectId: id });

  const activeRun = api.research.getActiveStatusByProspectId.useQuery(
    { prospectId: id },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      refetchInterval: (q: any) => (q.state.data?.isActive ? 5000 : false),
      refetchOnWindowFocus: true,
    },
  );

  const refetchProspect = prospectQuery.refetch;
  const refetchRuns = runsQuery.refetch;
  const wasActiveRef = useRef(false);
  useEffect(() => {
    const isActive = activeRun.data?.isActive ?? false;
    if (isActive) {
      wasActiveRef.current = true;
      return;
    }
    if (wasActiveRef.current) {
      wasActiveRef.current = false;
      void refetchProspect();
      void refetchRuns();
    }
  }, [activeRun.data?.isActive, refetchProspect, refetchRuns]);

  const enrichMut = api.admin.enrichProspect.useMutation({
    onSuccess: () => {
      void prospectQuery.refetch();
    },
  });
  const runResearchMut = api.admin.runResearchRun.useMutation({
    onSuccess: () => {
      void runsQuery.refetch();
      void utils.research.getActiveStatusByProspectId.invalidate({
        prospectId: id,
      });
    },
  });
  const runAnalysisMut = api.admin.runMasterAnalysis.useMutation({
    onSuccess: () => {
      void prospectQuery.refetch();
      void utils.research.getActiveStatusByProspectId.invalidate({
        prospectId: id,
      });
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateProspectMut = (api.admin.updateProspect as any).useMutation({
    onSuccess: () => {
      void prospectQuery.refetch();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestNumQuery = (api.quotes.suggestNextQuoteNumber as any).useQuery(
    undefined,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createQuoteMut = (api.quotes.create as any).useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      router.push(`/admin/quotes/${data.id}`);
    },
  });
  const [copied, setCopied] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'ALL' | EventType>('ALL');

  // TODO: tRPC v11 inference — getProspect return type too deep for TS to infer.
  // Cast through unknown to avoid TS2589 excessively deep instantiation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prospectQuery.data as any as ProspectShape | null;

  // Local state for voorstel routing — initialised from prospect data once loaded
  const [voorstelMode, setVoorstelMode] = useState<'STANDARD' | 'BESPOKE'>(
    'STANDARD',
  );
  const [bespokeUrl, setBespokeUrl] = useState<string | null>(null);
  // Sync local state when prospect data arrives (handles initial load + refetch)
  useEffect(() => {
    if (!p) return;
    setVoorstelMode(p.voorstelMode ?? 'STANDARD');
    setBespokeUrl(p.bespokeUrl ?? null);
  }, [p?.voorstelMode, p?.bespokeUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const runs = runsQuery.data as ResearchRunRow[] | undefined;
  const latestRun = runs?.[0] ?? null;

  const events = useMemo(
    () => (p ? buildActivityFromRuns(runs, p) : []),
    [runs, p],
  );

  const visibleEvents = useMemo(
    () =>
      feedFilter === 'ALL'
        ? events
        : events.filter((e) => e.type === feedFilter),
    [events, feedFilter],
  );

  // Only show tabs that have at least one event (ALL always visible)
  const eventTypes = useMemo(
    () => new Set(events.map((e) => e.type)),
    [events],
  );
  const feedTabs = useMemo(
    () =>
      ALL_FEED_TABS.filter(
        (tab) => tab.id === 'ALL' || eventTypes.has(tab.id as EventType),
      ),
    [eventTypes],
  );

  // Capture "now" once at mount — stable across renders.
  const [mountTime] = useState(() => Date.now());
  const runLabel = useMemo(() => {
    if (!latestRun) return '—';
    const runDate = new Date(
      latestRun.completedAt ?? latestRun.createdAt,
    ).getTime();
    const dayDelta = Math.ceil((runDate - mountTime) / (1000 * 60 * 60 * 24));
    return new Intl.RelativeTimeFormat('nl-NL', { numeric: 'auto' }).format(
      dayDelta,
      'day',
    );
  }, [latestRun, mountTime]);

  const onCopyLink = () => {
    if (!p) return;
    const url =
      voorstelMode === 'BESPOKE' && p.readableSlug
        ? `${window.location.origin}/voorstel/${p.readableSlug}`
        : `${window.location.origin}${buildDiscoverPath({
            slug: p.slug,
            readableSlug: p.readableSlug ?? null,
            companyName: p.companyName ?? null,
            domain: p.domain ?? null,
          })}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pitchHref =
    voorstelMode === 'BESPOKE' && p
      ? `/voorstel/${p.readableSlug ?? p.slug}`
      : p
        ? buildDiscoverPath({
            slug: p.slug,
            readableSlug: p.readableSlug ?? null,
            companyName: p.companyName ?? null,
            domain: p.domain ?? null,
          })
        : '#';

  if (prospectQuery.isLoading) {
    return (
      <PageLoader
        label="Company laden"
        description="Gegevens en activiteit ophalen."
      />
    );
  }

  if (!p) {
    return (
      <div className="py-24 text-center">
        <Eyebrow>Not found</Eyebrow>
        <p className="mt-4 text-[var(--color-muted-dark)]">
          Deze prospect bestaat niet of is niet zichtbaar voor jouw account.
        </p>
        <Link
          href="/admin/prospects"
          className="inline-block mt-6 admin-btn-secondary"
        >
          Terug naar Companies
        </Link>
      </div>
    );
  }

  // Quality score isn't a ResearchRun column — approval + evidence count is
  // the signal surfaced on this page. Score itself comes from evidence items
  // (aggregated in a future admin.getProspectActivity procedure).
  const qualityApproved = latestRun?.qualityApproved === true;
  // Single source of truth: DB count on prospect, not derived from runs
  const evidenceCount = p._count?.evidenceItems ?? 0;

  const displayName = p.companyName ?? p.domain ?? 'Prospect';
  const location = [p.city, p.country].filter(Boolean).join(', ') || null;
  const employees =
    p.employeeCount != null
      ? `${formatNumber(p.employeeCount)} medewerkers`
      : p.employeeRange
        ? `${p.employeeRange} medewerkers`
        : null;

  return (
    <div className="max-w-[1400px] space-y-0 pb-20">
      {/* Back line */}
      <div className="flex items-center gap-2 pb-3.5 mb-5 border-b border-[var(--color-border)]">
        <Link
          href="/admin/prospects"
          className="inline-flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-[5px] text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Companies
        </Link>
        <span className="text-[10px] font-medium tracking-[0.14em] text-[var(--color-muted)]">
          /
        </span>
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--color-ink)]">
          {displayName}
        </span>
      </div>

      {/* Hero */}
      <header className="grid grid-cols-[1fr_auto] gap-10 items-end pb-5 mb-5">
        <div>
          <HeroName name={displayName} />
          <div className="mt-3">
            <span
              className={
                voorstelMode === 'BESPOKE'
                  ? 'inline-flex items-center gap-1 rounded-full border border-[var(--color-gold-hi)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-gold-hi)]'
                  : 'inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]'
              }
            >
              {voorstelMode === 'BESPOKE'
                ? 'Warm · Bespoke'
                : 'Koud · Standaard'}
            </span>
          </div>
          {p.description ? (
            <p className="mt-5 text-[15px] font-light leading-[1.55] text-[var(--color-muted-dark)]">
              {p.description}
            </p>
          ) : (
            <p className="mt-5 text-[15px] font-light leading-[1.55] text-[var(--color-muted)]">
              Geen beschrijving beschikbaar.{' '}
              <button
                type="button"
                className="underline underline-offset-2 decoration-[var(--color-border-strong)] hover:decoration-[var(--color-ink)] text-[var(--color-ink)]"
              >
                Voeg er een toe
              </button>{' '}
              om deze prospect context te geven in alle briefings en outreach.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <HeroBtn
              variant="paper"
              onClick={onCopyLink}
              title="Kopieer pitch-link"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Gekopieerd
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Kopieer pitch-link
                </>
              )}
            </HeroBtn>
            <a
              href={pitchHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[6px] border px-4 py-2.5 text-[13px] font-medium leading-none transition-colors cursor-pointer bg-[var(--color-surface)] border-[var(--color-border-strong)] text-[var(--color-ink)] hover:border-[var(--color-ink)]"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
              Bekijk pitch
            </a>
          </div>
          <HeroBtn
            variant="gold"
            onClick={() => {
              const today = new Date();
              const plus30 = new Date(
                today.getTime() + 30 * 24 * 60 * 60 * 1000,
              );
              createQuoteMut.mutate({
                prospectId: id,
                nummer:
                  suggestNumQuery.data?.nummer ??
                  `${today.getFullYear()}-OFF???`,
                datum: today.toISOString().slice(0, 10),
                geldigTot: plus30.toISOString().slice(0, 10),
                onderwerp: `Klarifai x ${displayName}`,
                btwPercentage: 21,
                lines: [],
              });
            }}
            disabled={createQuoteMut.isPending}
          >
            {createQuoteMut.isPending ? 'Aanmaken...' : 'Nieuwe offerte'}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </HeroBtn>
        </div>
      </header>

      {/* Mega-stat bar */}
      <section className="grid grid-cols-[repeat(4,minmax(0,1fr))] border-t border-b border-[var(--color-ink)] mb-10">
        <MegaStat
          label="Stage"
          value={
            <span className="inline-flex items-baseline gap-2">
              {qualityApproved ? 'Ready' : (p.status ?? '—')}
              {qualityApproved ? (
                <span className="text-[var(--color-gold-hi)]">.</span>
              ) : null}
            </span>
          }
          sub={
            qualityApproved
              ? 'klaar voor outreach'
              : latestRun
                ? `run · ${latestRun.status.toLowerCase()}`
                : 'nog geen research run'
          }
        />
        <MegaStat
          label="Kwaliteit"
          value={qualityApproved ? 'Approved' : latestRun ? 'In review' : '—'}
          sub={
            latestRun ? (
              <>
                <b className="text-[var(--color-ink)]">{evidenceCount}</b>{' '}
                evidence items
              </>
            ) : (
              'geen run'
            )
          }
        />
        <MegaStat
          label="Laatste run"
          value={<span className="capitalize">{runLabel}</span>}
          sub={
            latestRun
              ? `${latestRun.status.toLowerCase()} · gemini-2.5-pro`
              : '—'
          }
        />
        <MegaStat
          label="Staat"
          value={latestRun ? (latestRun.error ? 'Error' : 'Gezond') : '—'}
          sub={
            latestRun?.error ? (
              <span className="text-[var(--color-brand-danger)]">
                {latestRun.error.slice(0, 60)}
              </span>
            ) : latestRun ? (
              '0 errors · enriched recent'
            ) : (
              'nog geen data'
            )
          }
        />
      </section>

      {/* Main grid: facts · activity · actions — replaced by loading state during active run */}
      {isPreviewMode ? (
        <div className="py-12">
          {previewVariant === 'B' ? (
            <ProspectDetailLoadingB currentStatus="CRAWLING" />
          ) : (
            <ProspectDetailLoadingC currentStatus="CRAWLING" />
          )}
        </div>
      ) : activeRun.data?.isActive ? (
        <div className="py-12">
          <RerunLoadingScreen
            variant="inline"
            currentStep={activeRun.data.currentStep}
            currentStatus={activeRun.data.status}
          />
        </div>
      ) : (
        <div className="grid grid-cols-[260px_minmax(0,1fr)_240px] gap-10">
          {/* Left: facts */}
          <aside className="space-y-2">
            <Eyebrow>Bedrijf</Eyebrow>
            <dl className="space-y-2 pt-1">
              {p.domain ? (
                <FactsRow k="Domein">
                  <a
                    href={`https://${p.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 border-b border-[var(--color-border-strong)] hover:border-[var(--color-ink)]"
                  >
                    {p.domain}
                    <ExternalLink className="h-2.5 w-2.5" strokeWidth={2} />
                  </a>
                </FactsRow>
              ) : null}
              {p.industry ? (
                <FactsRow k="Industrie">
                  {p.industry}
                  {p.subIndustry ? ` / ${p.subIndustry}` : ''}
                </FactsRow>
              ) : null}
              {location ? <FactsRow k="Locatie">{location}</FactsRow> : null}
              {employees ? <FactsRow k="Team">{employees}</FactsRow> : null}
              {p.foundedYear ? (
                <FactsRow k="Opgericht">{p.foundedYear}</FactsRow>
              ) : null}
              {p.linkedinUrl ? (
                <FactsRow k="LinkedIn">
                  <a
                    href={p.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 border-b border-[var(--color-border-strong)] hover:border-[var(--color-ink)]"
                  >
                    Bekijk
                    <ExternalLink className="h-2.5 w-2.5" strokeWidth={2} />
                  </a>
                </FactsRow>
              ) : null}
              {p.lastEnrichedAt ? (
                <FactsRow k="Verrijkt">
                  {new Date(p.lastEnrichedAt).toLocaleDateString('nl-NL')}
                </FactsRow>
              ) : null}
            </dl>

            {/* Dossier quick links — stand-in for sub-routes */}
            <div className="pt-8">
              <Eyebrow>Dossier</Eyebrow>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <DossierLink
                  href={`/admin/prospects/${id}/evidence`}
                  label="Evidence"
                  count={evidenceCount}
                />
                <DossierLink
                  href={`/admin/prospects/${id}/analyse`}
                  label="Analyse"
                />
                <DossierLink
                  href={`/admin/prospects/${id}/outreach`}
                  label="Outreach"
                  disabled
                />
                <DossierLink
                  href={`/admin/prospects/${id}/resultaten`}
                  label="Resultaten"
                  disabled
                />
              </div>
            </div>
          </aside>

          {/* Center: activity */}
          <main>
            <Eyebrow className="mb-4">Activiteit</Eyebrow>
            <div className="flex gap-1.5 mb-5">
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedFilter(tab.id)}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded border transition-all',
                    feedFilter === tab.id
                      ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]'
                      : 'bg-transparent text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {visibleEvents.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-[var(--color-muted)]">
                Geen events{' '}
                {feedFilter !== 'ALL' ? `in filter "${feedFilter}"` : 'nog'}.
              </p>
            ) : (
              <div>
                {visibleEvents.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </main>

          {/* Right: actions + contacts */}
          <aside className="space-y-8">
            {/* Voorstel routing */}
            <div className="space-y-2.5">
              <Eyebrow>Voorstel routing</Eyebrow>
              <div className="space-y-3 pt-1">
                {/* Mode rectangle toggle — full width */}
                <div>
                  <div className="grid grid-cols-2 border border-[var(--color-border)] rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        if (voorstelMode !== 'STANDARD') {
                          setVoorstelMode('STANDARD');
                          updateProspectMut.mutate({
                            id,
                            voorstelMode: 'STANDARD',
                          });
                        }
                      }}
                      disabled={updateProspectMut.isPending}
                      className={
                        voorstelMode === 'STANDARD'
                          ? 'bg-[var(--color-ink)] text-white py-2.5 px-3 text-[13px] font-medium transition-colors'
                          : 'bg-transparent text-[var(--color-muted)] py-2.5 px-3 text-[13px] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors'
                      }
                    >
                      Standaard
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (voorstelMode !== 'BESPOKE') {
                          setVoorstelMode('BESPOKE');
                          updateProspectMut.mutate({
                            id,
                            voorstelMode: 'BESPOKE',
                          });
                        }
                      }}
                      disabled={updateProspectMut.isPending}
                      className={
                        voorstelMode === 'BESPOKE'
                          ? 'bg-[var(--color-ink)] text-white py-2.5 px-3 text-[13px] font-medium transition-colors'
                          : 'bg-transparent text-[var(--color-muted)] py-2.5 px-3 text-[13px] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors'
                      }
                    >
                      Bespoke
                    </button>
                  </div>
                </div>

                {/* bespokeUrl — only when BESPOKE */}
                {voorstelMode === 'BESPOKE' && (
                  <div>
                    <input
                      type="url"
                      value={bespokeUrl ?? ''}
                      onChange={(e) => setBespokeUrl(e.target.value || null)}
                      onBlur={() => {
                        if (bespokeUrl !== p.bespokeUrl) {
                          updateProspectMut.mutate({
                            id,
                            bespokeUrl: bespokeUrl || null,
                          });
                        }
                      }}
                      placeholder="https://maintix-design.vercel.app"
                      className="input-minimal w-full text-[13px]"
                      disabled={updateProspectMut.isPending}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <Eyebrow>Acties</Eyebrow>
              <div className="space-y-1.5 pt-1">
                <ActionRow
                  icon={RefreshCw}
                  label="Re-enrich"
                  onClick={() => enrichMut.mutate({ id })}
                />
                <ActionRow
                  icon={Play}
                  label="Nieuwe run"
                  kbd="⌘R"
                  onClick={() => runResearchMut.mutate({ id })}
                />
                <ActionRow
                  icon={PenLine}
                  label="Genereer analyse"
                  onClick={() => runAnalysisMut.mutate({ id })}
                />
                <ActionRow
                  icon={Send}
                  label="Start outreach"
                  kbd="⌘↵"
                  variant="gold"
                  onClick={() => router.push(`/admin/prospects/${id}/outreach`)}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Eyebrow>Contacts · {p.contacts?.length ?? 0}</Eyebrow>
              <div className="space-y-0.5 pt-1">
                {(p.contacts ?? []).slice(0, 5).map((c, i) => {
                  const name = [c.firstName, c.lastName]
                    .filter(Boolean)
                    .join(' ');
                  const initials = name
                    .split(/\s+/)
                    .map((s) => s[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const accents = [
                    undefined,
                    '#3d5f82',
                    '#4a7a52',
                    '#6e4780',
                    '#b45a3b',
                  ];
                  return (
                    <ContactRow
                      key={c.id}
                      initials={initials || '??'}
                      name={name || c.primaryEmail || 'Onbekend'}
                      role={c.jobTitle ?? '—'}
                      isPrimary={i === 0}
                      accent={accents[i % accents.length]}
                    />
                  );
                })}
                {(p.contacts?.length ?? 0) === 0 ? (
                  <p className="text-[12px] text-[var(--color-muted)] px-2.5 py-2">
                    Nog geen contacts.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Smaller inline primitives
// ─────────────────────────────────────────────────────────────────────

function FactsRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 items-baseline">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
        {k}
      </dt>
      <dd className="text-[12px] font-medium text-[var(--color-ink)] min-w-0 tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function DossierLink({
  href,
  label,
  count,
  disabled,
}: {
  href: string;
  label: string;
  count?: number;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex flex-col gap-1 p-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] opacity-40 cursor-not-allowed">
        <span className="text-[12px] font-semibold text-[var(--color-muted)]">
          {label}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">
          binnenkort
        </span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 p-3 rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-ink)]"
    >
      <span className="text-[12px] font-semibold text-[var(--color-ink)]">
        {label}
      </span>
      {count != null ? (
        <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
          {count} items
        </span>
      ) : (
        <span className="text-[10px] text-[var(--color-muted)]">open →</span>
      )}
    </Link>
  );
}
