# Phase 28: Source Discovery with Provenance - Research

**Researched:** 2026-03-02
**Domain:** URL discovery pipeline, provenance tagging, cache management, collapsible UI
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Source list visibility**

- Collapsible section inside the existing research run detail view — no new pages or tabs
- Collapsed by default, showing a summary line: "23 source URLs (12 sitemap, 5 serp, 4 default) — Discovered 2h ago"
- When expanded, URLs grouped by provenance type under headers: Sitemap (12), SERP (5), Default (4)
- Each URL shows provenance label + URL only — no metadata, timestamps, or flags per URL
- Discovery timestamp shown in the collapsed summary line (relative time like "2h ago" or absolute date)

**Manual URL control**

- No manual URL add/remove — discovery is fully automatic
- Admin sees results but does not curate the source set
- No per-prospect URL blacklist or exclusion mechanism
- Admin overrides happen at the gate level (quality gate, pain gate), not source level

**Cap & dedup feedback**

- When a source type is capped, summary shows "X of Y" format (e.g., "Sitemap (20 of 147)")
- Collapsed summary includes dedup count: "23 source URLs (3 duplicates removed)"
- Duplicate URLs keep the first provenance type that discovered them — no multi-source badge
- No special indicator for thin source coverage — the quality gate handles that signal

**Re-discovery behavior**

- "Re-discover sources" button as a separate action in the source list section
- Independent from "Run Research" — admin can refresh sources without re-running the full pipeline
- 24h SerpAPI cache is the default; the button explicitly bypasses it (admin understands credit cost)
- Re-discovery never deletes existing evidence — old evidence stays, new discovery only affects the next extraction round
- Discovery timestamp updates when re-discovery completes

### Claude's Discretion

- jsHeavyHint detection heuristics
- URL deduplication algorithm and priority when collapsing
- Which URLs survive when caps are reached (prioritization strategy)
- Exact summary line formatting and relative time display
- Button placement and styling within the research run detail section

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                     | Research Support                                                                                                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISC-01 | System discovers source URLs from sitemap, SERP, and manual seeds with provenance labels (sitemap/serp/manual)  | Existing `discoverSitemapUrls` + `discoverSerpUrls` functions provide raw URLs; need to wrap them into a typed `DiscoveredUrl[]` structure with provenance tags                                         |
| DISC-02 | System detects JS-heavy pages and flags them with `jsHeavyHint` for downstream browser extraction routing       | URL-pattern heuristics (domain + path matching) are the correct approach — no network call needed; patterns identified in research                                                                      |
| DISC-03 | SERP discovery results are cached at prospect level (`serpDiscoveredAt`) via `inputSnapshot` — skip if <24h old | Pattern already exists in `research-executor.ts` for sitemap cache; SERP cache needs the same treatment (currently only in deepCrawl path); `serpDiscoveredAt` is a field name for the stored timestamp |
| DISC-04 | Per-source URL caps prevent URL explosion during the merge step                                                 | Sitemap already caps at 25; SERP already caps at 10 (5 review + 5 job); default list is fixed at 17; cap enforcement is in `buildSourceSet` merge function                                              |
| DISC-05 | Duplicate URLs are deduplicated during merge via normalized URL comparison                                      | `normalizedUrl()` function already exists in `evidence-section.tsx` — same pattern needed in `source-discovery.ts` for URL-level dedup                                                                  |

</phase_requirements>

## Summary

Phase 28 builds a structured source-discovery layer that currently exists implicitly inside `research-executor.ts`. The executor already discovers URLs from three sources (sitemap, SERP, default guesses) but mixes them together without provenance tracking, without persisting the merged set, and without admin visibility. The phase extracts and formalises this into a typed `DiscoveredUrl[]` structure with `provenance` and `jsHeavyHint` fields, persisted to `inputSnapshot.sourceSet` on the `ResearchRun` record.

The data model change is zero-schema: `sourceSet` is stored in the existing `inputSnapshot` JSON field alongside `sitemapCache` and `serpCache`. The UI change is a new collapsible `<details>` section injected into the existing `EvidenceSection` or directly in the prospect detail page — matching the existing pattern already used for evidence groups (which also use `<details open>`). A new tRPC mutation `research.rediscoverSources` handles the "Re-discover sources" button, which is the only new endpoint required.

The primary implementation risk is the SERP cache interaction: the current deepCrawl path reads `serpCache` from `inputSnapshot` but the `inputSnapshot` is overwritten at run create/update time before the cache is checked. Phase 28 must apply the same "pre-read before overwrite" pattern that was already introduced for `sitemapCache` in the current executor.

**Primary recommendation:** Extract URL discovery into `lib/enrichment/source-discovery.ts`, expose a `rediscoverSources` tRPC mutation, persist `sourceSet` to `inputSnapshot`, and add a collapsible `SourceSetSection` component matching the `<details>` pattern already used in `evidence-section.tsx`.

## Standard Stack

### Core

| Library                  | Version           | Purpose                                 | Why Standard                                              |
| ------------------------ | ----------------- | --------------------------------------- | --------------------------------------------------------- |
| Prisma (existing)        | ^7.3.0            | Read/update `ResearchRun.inputSnapshot` | Already the project ORM; `toJson()` helper already exists |
| tRPC (existing)          | 11.9.0            | New `rediscoverSources` mutation        | All API endpoints use tRPC in this codebase               |
| Zod (existing, via tRPC) | bundled           | Input validation for the new mutation   | Already used for all tRPC inputs                          |
| `sitemapper` (existing)  | already installed | Sitemap fetching                        | Already used in `lib/enrichment/sitemap.ts`               |
| `serpapi` (existing)     | already installed | SERP URL discovery                      | Already used in `lib/enrichment/serp.ts`                  |
| lucide-react (existing)  | ^0.563.0          | UI icons (Link, ChevronDown, RefreshCw) | Project icon library                                      |

### Supporting

| Library                            | Version | Purpose          | When to Use                                                                                         |
| ---------------------------------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `date-fns` or manual relative time | n/a     | "2h ago" display | Use a simple inline helper — `date-fns` not in project, avoid adding; manual calculation is 5 lines |

### Alternatives Considered

| Instead of                         | Could Use                 | Tradeoff                                                                                                                    |
| ---------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `inputSnapshot` JSON for sourceSet | New DB column / table     | Zero schema change vs. more queryable; at current volumes (20-50 prospects) JSON is fine and avoids migrations on live data |
| URL-pattern jsHeavyHint            | Network preflight request | Zero latency vs. accurate; patterns are sufficient for Phase 29 routing                                                     |

**Installation:**
No new packages needed — this phase uses only existing dependencies.

## Architecture Patterns

### Recommended Project Structure

```
lib/enrichment/
├── source-discovery.ts     # NEW: buildSourceSet(), discoverSourceSet(), DiscoveredUrl type
├── sitemap.ts              # EXISTS: discoverSitemapUrls()
├── serp.ts                 # EXISTS: discoverSerpUrls()
server/routers/
└── research.ts             # ADD: rediscoverSources mutation
components/features/prospects/
└── source-set-section.tsx  # NEW: collapsible source URL viewer
```

### Pattern 1: DiscoveredUrl Type (source-discovery.ts)

**What:** Typed structure for a discovered URL with provenance and jsHeavyHint.
**When to use:** All points where URLs enter the pipeline.

```typescript
// lib/enrichment/source-discovery.ts

export type UrlProvenance = 'sitemap' | 'serp' | 'default';

export interface DiscoveredUrl {
  url: string;
  provenance: UrlProvenance;
  jsHeavyHint: boolean;
}

export interface SourceSet {
  urls: DiscoveredUrl[];
  discoveredAt: string; // ISO timestamp
  dedupRemovedCount: number;
  rawCounts: {
    sitemap: { discovered: number; capped: number };
    serp: { discovered: number; capped: number };
    default: { discovered: number; capped: number };
  };
  serpDiscoveredAt?: string; // ISO timestamp — used for 24h cache guard
}
```

### Pattern 2: buildSourceSet() — Merge with Provenance + Cap + Dedup

**What:** Pure function that merges three URL lists into a `SourceSet`, respecting caps and deduplicating.
**When to use:** Called inside both `executeResearchRun` and `rediscoverSources`.

```typescript
// lib/enrichment/source-discovery.ts

const CAPS = {
  sitemap: 25, // matches existing sitemap.ts cap
  serp: 15, // review (5) + job (5) + google-search mentions (5)
  default: 20, // current defaultResearchUrls list length
} as const;

export function buildSourceSet(input: {
  sitemapUrls: string[];
  serpUrls: string[];
  defaultUrls: string[];
  serpDiscoveredAt?: string;
}): SourceSet {
  // 1. Cap each source before merge
  const cappedSitemap = input.sitemapUrls.slice(0, CAPS.sitemap);
  const cappedSerp = input.serpUrls.slice(0, CAPS.serp);
  const cappedDefault = input.defaultUrls.slice(0, CAPS.default);

  // 2. Merge with provenance, first-wins on dedup
  const seen = new Set<string>();
  const urls: DiscoveredUrl[] = [];
  let dedupRemovedCount = 0;

  for (const [list, provenance] of [
    [cappedSitemap, 'sitemap'],
    [cappedSerp, 'serp'],
    [cappedDefault, 'default'],
  ] as const) {
    for (const raw of list) {
      const key = normalizeUrlForDedup(raw);
      if (seen.has(key)) {
        dedupRemovedCount++;
        continue;
      }
      seen.add(key);
      urls.push({ url: raw, provenance, jsHeavyHint: detectJsHeavy(raw) });
    }
  }

  return {
    urls,
    discoveredAt: new Date().toISOString(),
    dedupRemovedCount,
    rawCounts: {
      sitemap: {
        discovered: input.sitemapUrls.length,
        capped: cappedSitemap.length,
      },
      serp: { discovered: input.serpUrls.length, capped: cappedSerp.length },
      default: {
        discovered: input.defaultUrls.length,
        capped: cappedDefault.length,
      },
    },
    ...(input.serpDiscoveredAt
      ? { serpDiscoveredAt: input.serpDiscoveredAt }
      : {}),
  };
}
```

### Pattern 3: URL Normalization for Dedup

**What:** Strip scheme, www prefix, trailing slash, and query string for comparison.

```typescript
// lib/enrichment/source-discovery.ts

function normalizeUrlForDedup(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return raw.toLowerCase().trim().replace(/\/$/, '');
  }
}
```

This matches the `normalizedUrl()` function already in `evidence-section.tsx` — same approach, extracted to the backend.

### Pattern 4: jsHeavyHint Detection (Claude's Discretion)

**What:** URL-pattern heuristics identifying pages likely to require browser rendering.

```typescript
// lib/enrichment/source-discovery.ts

const JS_HEAVY_PATTERNS = [
  // SPA-style hash routes
  /#\//,
  // React/Angular/Vue app shells
  /\/__next\/|\/static\/js\//,
  // Trustpilot, Indeed, Glassdoor (already use Crawl4AI)
  /trustpilot\.com|indeed\.com|glassdoor\./,
  // LinkedIn (auth wall, JS-rendered)
  /linkedin\.com/,
  // Google Maps reviews
  /google\.com\/maps|maps\.app\.goo/,
  // Job boards known to be JS-heavy
  /werkzoeken\.|jobbird\.|monsterboard\./,
  // Webflow/Framer sites with heavy client hydration
  /\.webflow\.io|framer\.website|framer\.com/,
] as const;

function detectJsHeavy(url: string): boolean {
  return JS_HEAVY_PATTERNS.some((pattern) => pattern.test(url));
}
```

**Reasoning (Claude's Discretion):** Known review/job platforms already routed through Crawl4AI in Phase 29 are the highest-value targets. LinkedIn always requires auth. The hash-route and static/js patterns catch SPAs. This is a best-effort hint, not a guarantee — Phase 29 will also have a content-length fallback (`<500 chars → escalate`).

### Pattern 5: 24h SERP Cache Guard in rediscoverSources

**What:** Pre-read `inputSnapshot` before calling `discoverSerpUrls`, skip if `serpDiscoveredAt` is <24h old (unless force=true).

```typescript
// server/routers/research.ts

rediscoverSources: adminProcedure
  .input(z.object({
    runId: z.string(),
    force: z.boolean().default(false),  // bypass 24h SERP cache
  }))
  .mutation(async ({ ctx, input }) => {
    const run = await ctx.db.researchRun.findUniqueOrThrow({
      where: { id: input.runId },
      select: { id: true, prospectId: true, inputSnapshot: true },
    });

    const prospect = await ctx.db.prospect.findUniqueOrThrow({
      where: { id: run.prospectId },
      select: { domain: true, companyName: true },
    });

    // SERP cache guard
    const existing = extractSourceSet(run.inputSnapshot);
    const serpAge = existing?.serpDiscoveredAt
      ? Date.now() - new Date(existing.serpDiscoveredAt).getTime()
      : Infinity;
    const useSerpCache = !input.force && serpAge < 24 * 60 * 60 * 1000;

    // Discover sources
    const sitemapUrls = await discoverSitemapUrls(prospect.domain);
    const serpResult = useSerpCache && existing
      ? { reviewUrls: [], jobUrls: [] }  // skip — cached
      : await discoverSerpUrls({ companyName: prospect.companyName, domain: prospect.domain });

    const sourceSet = buildSourceSet({
      sitemapUrls,
      serpUrls: [...serpResult.reviewUrls, ...serpResult.jobUrls],
      defaultUrls: defaultResearchUrls(prospect.domain),
      serpDiscoveredAt: useSerpCache ? existing?.serpDiscoveredAt : new Date().toISOString(),
    });

    // Persist to inputSnapshot (merge, don't overwrite other snapshot fields)
    const current = (run.inputSnapshot as Record<string, unknown>) ?? {};
    await ctx.db.researchRun.update({
      where: { id: run.id },
      data: {
        inputSnapshot: toJson({ ...current, sourceSet }),
      },
    });

    return { sourceSet };
  }),
```

### Pattern 6: SourceSetSection UI — collapsible `<details>` (matches existing pattern)

**What:** Collapsible section in the prospect detail view showing the source set, grouped by provenance.

The existing `evidence-section.tsx` already uses `<details open>` for grouping evidence. Match that pattern exactly:

```tsx
// components/features/prospects/source-set-section.tsx

'use client';
import { ChevronDown, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/components/providers';

// Collapsed default (matches CONTEXT.md decision)
export function SourceSetSection({
  runId,
  inputSnapshot,
}: {
  runId: string;
  inputSnapshot: unknown;
}) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const rediscover = api.research.rediscoverSources.useMutation({
    onSuccess: () => utils.research.listRuns.invalidate(),
  });

  const sourceSet = extractSourceSetFromSnapshot(inputSnapshot);

  if (!sourceSet) return null; // no sourceSet yet — run research first

  const totalUrls = sourceSet.urls.length;
  const byProvenance = groupByProvenance(sourceSet.urls);
  const summaryParts = [
    byProvenance.sitemap.length > 0
      ? `${byProvenance.sitemap.length}${sourceSet.rawCounts.sitemap.discovered > CAPS.sitemap ? ` of ${sourceSet.rawCounts.sitemap.discovered}` : ''} sitemap`
      : null,
    // ... serp, default
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="glass-card rounded-[2rem] border border-slate-100 overflow-hidden"
    >
      <summary className="cursor-pointer list-none px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
            {totalUrls} source URLs ({summaryParts})
            {sourceSet.dedupRemovedCount > 0 &&
              ` · ${sourceSet.dedupRemovedCount} duplicates removed`}
            {' · '}
            {relativeTime(sourceSet.discoveredAt)}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </summary>

      <div className="px-5 pb-5 border-t border-slate-100/80 space-y-4">
        {/* Grouped URL lists */}
        {/* Re-discover button */}
        <button
          onClick={() => rediscover.mutate({ runId })}
          disabled={rediscover.isPending}
          className="..."
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Re-discover sources
        </button>
      </div>
    </details>
  );
}
```

### Pattern 7: Integrating sourceSet into executeResearchRun

The executor must call `buildSourceSet()` after discovering URLs and before choosing `researchUrls`. The resulting `sourceSet` is stored in `inputSnapshot` at run create/update time.

Key change: replace the current flat `researchUrls` assembly with `sourceSet.urls.map(u => u.url)`. The existing evidence pipeline consumes the same URL strings — only the discovery bookkeeping layer changes.

### Anti-Patterns to Avoid

- **Overwriting `inputSnapshot` without spreading existing fields:** The current executor already demonstrates the risk — when `serpCache` is persisted, it must spread `manualUrls`, `campaignId`, `deepCrawl`, and `sitemapCache`. The same discipline applies to `sourceSet`. Always do `{ ...existing, sourceSet }`.
- **Reading serpCache after the run create/update:** The executor already documents this bug (the "pre-read before overwrite" fix for sitemapCache in Phase 8). Apply the same fix for `sourceSet` — pre-read the existing snapshot before the DB write.
- **Running SERP discovery unconditionally on every research run:** SerpAPI costs real money. The 24h cache guard must be checked before calling `discoverSerpUrls`. The guard is already present for the deep-crawl path; Phase 28 centralises it.
- **Adding jsHeavyHint per-URL in the UI:** The context decision is clear — each URL shows provenance label + URL only. No per-URL flags in the UI. jsHeavyHint is backend metadata consumed by Phase 29, not displayed to admin.

## Don't Hand-Roll

| Problem               | Don't Build                | Use Instead                                             | Why                                                   |
| --------------------- | -------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Sitemap parsing       | Custom XML parser          | Existing `sitemapper` in `sitemap.ts`                   | Already handles retries, concurrency, malformed XML   |
| SERP URL discovery    | Direct HTTP to Google      | Existing `serpapi` in `serp.ts`                         | Rate limiting, auth, result parsing all handled       |
| URL normalization     | Ad hoc string ops          | The `normalizeUrlForDedup()` pattern (5 lines, URL API) | `new URL()` handles edge cases (encoded chars, ports) |
| Relative time display | `date-fns` (not installed) | 3-line inline function                                  | Avoid adding dependency for a one-liner               |

**Key insight:** All URL discovery logic already exists — Phase 28 is a restructuring phase, not a new-capability phase. The work is wrapping, typing, and persisting what already runs.

## Common Pitfalls

### Pitfall 1: serpCache vs sourceSet double-caching

**What goes wrong:** After Phase 28, `inputSnapshot` will contain both the old `serpCache` field (used by the existing deep-crawl path) and the new `sourceSet.serpDiscoveredAt`. If both are read, they may give different ages and create confusion.
**Why it happens:** The executor currently reads `serpCache` in the deepCrawl branch; Phase 28 introduces `sourceSet.serpDiscoveredAt` as the canonical timestamp.
**How to avoid:** Phase 28 should write `serpDiscoveredAt` into `sourceSet` and the existing executor code should be updated to read from `sourceSet.serpDiscoveredAt` instead of `serpCache.discoveredAt`. Deprecate `serpCache` in this phase.
**Warning signs:** Two separate 24h TTL checks for the same SERP call.

### Pitfall 2: Snapshot field loss on update

**What goes wrong:** A DB update writes `{ sourceSet }` to `inputSnapshot`, losing `manualUrls`, `campaignId`, `deepCrawl`, and `sitemapCache`.
**Why it happens:** Prisma's `inputSnapshot: toJson({...})` replaces the entire JSON field.
**How to avoid:** Always spread the existing snapshot before writing: `toJson({ ...(current ?? {}), sourceSet })`.
**Warning signs:** Re-running research after a re-discover loses deepCrawl=true and runs shallow.

### Pitfall 3: URL cap applied after dedup (wrong order)

**What goes wrong:** 147 sitemap URLs are deduped against SERP/default, then capped to 25 — the count shown in "Sitemap (25 of 147)" is misleading because dedup removed some before the cap.
**Why it happens:** Cap-then-dedup is the correct order; dedup-then-cap produces wrong `rawCounts`.
**How to avoid:** Apply caps to each source list independently before merging, then run dedup across the merged list. This is the order shown in `buildSourceSet()` above.
**Warning signs:** `rawCounts.sitemap.capped` does not match `CAPS.sitemap` for large sitemaps.

### Pitfall 4: Re-discovery mutates existing evidence run

**What goes wrong:** Admin clicks "Re-discover sources", the mutation also triggers evidence re-extraction, wiping existing evidence items.
**Why it happens:** `rediscoverSources` might be confused with `retryRun`.
**How to avoid:** `rediscoverSources` ONLY updates `inputSnapshot.sourceSet`. It does NOT clear evidence items, hypotheses, or opportunities. It does NOT change run `status`. Evidence re-extraction only happens if admin explicitly triggers "Re-run Research".
**Warning signs:** `EvidenceItem` count drops after a re-discover.

### Pitfall 5: `<details>` toggle state fighting React state

**What goes wrong:** Using both `open={open}` controlled prop and `onToggle` causes double-fire in some browsers.
**Why it happens:** Native `<details>` has its own toggle behaviour; controlling it with React `open` prop requires uncontrolled usage with a ref, or accepting the pattern already used in `evidence-section.tsx` (`open` without controlling the prop).
**How to avoid:** Match the existing `evidence-section.tsx` pattern exactly — `<details open>` with no controlled state, since collapsed-by-default can use `<details>` without `open`. The summary/toggle is handled natively.

## Code Examples

Verified patterns from codebase inspection:

### Existing: pre-read before overwrite pattern (sitemap cache)

```typescript
// lib/research-executor.ts (lines 154-167)
// Pre-read existing snapshot for sitemap cache BEFORE run create/update overwrites it
const priorSnapshot = input.existingRunId
  ? (
      await db.researchRun.findUnique({
        where: { id: input.existingRunId },
        select: { inputSnapshot: true },
      })
    )?.inputSnapshot
  : null;
const sitemapCache = extractSitemapCache(priorSnapshot);
const isSitemapCacheValid =
  sitemapCache &&
  Date.now() - new Date(sitemapCache.discoveredAt).getTime() <
    24 * 60 * 60 * 1000;
```

Phase 28 must extend this pattern to also extract and validate the SERP portion of the existing `sourceSet`.

### Existing: toJson() helper for inputSnapshot writes

```typescript
// lib/research-executor.ts (line 35-37)
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
```

Use this same helper in `rediscoverSources` mutation and in `source-discovery.ts`.

### Existing: `<details open>` collapsible pattern

```tsx
// components/features/prospects/evidence-section.tsx (lines 534-548)
<details
  key={group.key}
  open
  className="glass-card rounded-[2rem] border border-slate-100 overflow-hidden"
>
  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-6 py-5 flex items-center justify-between gap-4">
    <div className="flex items-center gap-2.5 min-w-0">
      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
        {group.label} ({group.rawCount})
      </p>
    </div>
    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
  </summary>
  ...
</details>
```

For the `SourceSetSection`, omit `open` (collapsed by default), everything else matches.

### Existing: defaultResearchUrls function (to extract, not duplicate)

```typescript
// lib/research-executor.ts (lines 51-77)
function defaultResearchUrls(domain: string): string[] {
  const base = `https://${domain}`;
  return [
    `${base}`,
    `${base}/over-ons`,
    // ...17 paths total
  ];
}
```

Move this to `source-discovery.ts` and export it. The executor imports from there.

### Inline relative time helper (no dependency)

```typescript
function relativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(isoString).toLocaleDateString('nl-NL');
}
```

## State of the Art

| Old Approach                                    | Current Approach                                    | When Changed | Impact                                               |
| ----------------------------------------------- | --------------------------------------------------- | ------------ | ---------------------------------------------------- |
| Flat URL list, no provenance                    | `DiscoveredUrl[]` with provenance + jsHeavyHint     | Phase 28     | Enables Phase 29 browser-routing decisions           |
| `serpCache` + `sitemapCache` as separate fields | Unified `sourceSet` with embedded timestamps        | Phase 28     | Single read point, eliminates double-cache confusion |
| URLs chosen inside executor imperatively        | `buildSourceSet()` pure function called by executor | Phase 28     | Testable, reusable in `rediscoverSources` mutation   |

**Deprecated/outdated:**

- `serpCache` field in `inputSnapshot`: superseded by `sourceSet.serpDiscoveredAt` — stop writing/reading `serpCache` after Phase 28 ships
- `sitemapCache` field: superseded by `sourceSet.rawCounts.sitemap` and `sourceSet.discoveredAt` — stop writing/reading `sitemapCache` after Phase 28 ships

## Open Questions

1. **Where in the prospect detail view does SourceSetSection appear?**
   - What we know: Locked decision says "collapsible section inside the existing research run detail view"
   - What's unclear: The prospect detail page (`/admin/prospects/[id]/page.tsx`) has tabs (Evidence, Analysis, Outreach Preview, Results). `EvidenceSection` is in the Evidence tab. The source set is conceptually a sub-section of Evidence — above or below the evidence diagnostics?
   - Recommendation: Place `SourceSetSection` at the top of the Evidence tab, above the diagnostics banner and evidence groups. It is the "input" to the evidence pipeline, so showing it first is logical.

2. **Should `buildSourceSet` also replace `defaultResearchUrls` as the source for `researchUrls` in `executeResearchRun`?**
   - What we know: Currently `researchUrls = uniqueUrls(sitemapUrls.length > 0 ? [...sitemapUrls, ...nonReviewManualUrls] : [...defaultResearchUrls(prospect.domain), ...nonReviewManualUrls])`
   - What's unclear: Does `sourceSet.urls` fully replace `researchUrls` in the executor, or is `researchUrls` computed independently?
   - Recommendation: After building `sourceSet`, derive `researchUrls` from it: `sourceSet.urls.map(u => u.url)`. This ensures the persisted `sourceSet` matches what the pipeline actually processes.

3. **What is the tRPC query to read `sourceSet` in the UI?**
   - What we know: `research.listRuns` returns `inputSnapshot` (it's on the `ResearchRun` model). `research.getRun` also returns it.
   - What's unclear: The prospect detail page uses `research.listRuns({ prospectId })` and reads `researchRuns.data[0]`. The `SourceSetSection` can receive `inputSnapshot` as a prop from that query result — no new query needed.
   - Recommendation: Pass `latestRun.inputSnapshot` as a prop to `SourceSetSection`. No new tRPC query is required.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `lib/research-executor.ts` (all 964 lines) — URL discovery flow, cache patterns, snapshot write patterns
- Direct codebase inspection: `lib/enrichment/sitemap.ts` — existing `discoverSitemapUrls()`, cap at 25
- Direct codebase inspection: `lib/enrichment/serp.ts` — existing `discoverSerpUrls()`, caps at 5 review + 5 job
- Direct codebase inspection: `components/features/prospects/evidence-section.tsx` — `<details>` pattern, `normalizedUrl()` function, CSS classes
- Direct codebase inspection: `prisma/schema.prisma` — `ResearchRun.inputSnapshot Json?` field confirmed
- Direct codebase inspection: `server/routers/research.ts` — existing mutation patterns, `adminProcedure` usage
- Direct codebase inspection: `app/admin/prospects/[id]/page.tsx` — Evidence tab structure, how `latestRun` is threaded through
- Direct codebase inspection: `package.json` — confirms no `date-fns`, confirms existing `sitemapper` and `serpapi`

### Secondary (MEDIUM confidence)

- CONTEXT.md decisions — user confirmed exact UI format (summary line, grouping by provenance, collapsed by default)
- STATE.md architectural decisions — SERP cache at prospect level, sourceSet in inputSnapshot, no schema change for Phases 28-29

### Tertiary (LOW confidence)

- jsHeavyHint pattern list — derived from known platform behaviour; actual accuracy depends on runtime verification in Phase 29

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — patterns copied directly from existing codebase (toJson, details, pre-read-before-overwrite, tRPC adminProcedure)
- Pitfalls: HIGH — most pitfalls identified directly from existing code comments and tech debt notes in STATE.md
- jsHeavyHint heuristics: MEDIUM — patterns are reasonable but not verified against actual prospect URLs

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack — 30-day window)
