# Phase 21: Prospect Discovery + Cleanup — Research

**Researched:** 2026-02-23
**Domain:** Apollo company search UI, tRPC mutations, Next.js App Router dead-page removal
**Confidence:** HIGH — all findings verified against live codebase

---

## Summary

Phase 21 has two independent workstreams. The first (DISC-01) extends the existing company search UI to support sector+location as the primary search pattern and adds multi-select batch import. The second (CLEAN-01) removes three dead admin pages so their URLs become 404s.

**Most important finding:** The company search UI already exists at `/admin/prospects` with a "Search Companies" tab. The `search.companies` tRPC mutation, the `search.importCompany` mutation, and the Apollo `searchCompanies` call are all wired up and working. DISC-01 is UI and wiring work only — no new backend services required. The only backend gap is that `industries` and `cities` fields exist in `CompanySearchFilters` but are not forwarded to the Apollo API body in the provider. That is a one-line fix.

The dead pages (hypotheses, research, briefs) all exist as standalone `page.tsx` files. None of them appear in the nav. The simplest correct removal is to delete the directories or replace `page.tsx` with `notFound()`. The `notFound()` approach is recommended because it keeps the directory so git history is clear and Next.js returns a proper 404.

**Primary recommendation:** DISC-01 = extend existing CompanySearch component (add sector+city fields, wire industries/cities to Apollo, add checkbox multi-select + batch import button). CLEAN-01 = replace each dead `page.tsx` with a two-line `notFound()` server component.

---

## Standard Stack

### Core (already in project — no new installs)

| Library              | Version  | Purpose                                               | Notes                   |
| -------------------- | -------- | ----------------------------------------------------- | ----------------------- |
| tRPC                 | existing | `search.companies` + `search.importCompany` mutations | Already wired           |
| Apollo API           | v1       | `/mixed_companies/search` POST                        | Already integrated      |
| React `useState`     | existing | UI state for selected items                           | Standard pattern        |
| Next.js `notFound()` | existing | Return 404 from server component                      | Already used in project |

### Supporting

No new dependencies required. All patterns used in this phase already exist in the codebase.

**Installation:**

```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended Project Structure (no new dirs)

```
app/
├── admin/
│   ├── prospects/
│   │   └── page.tsx          ← Extend CompanySearch component here
│   ├── hypotheses/
│   │   └── page.tsx          ← Replace with notFound()
│   ├── research/
│   │   └── page.tsx          ← Replace with notFound()
│   └── briefs/
│       └── page.tsx          ← Replace with notFound()
lib/
└── enrichment/
    └── providers/
        └── apollo.ts         ← Add organization_keywords + cities to searchCompanies body
server/
└── routers/
    └── search.ts             ← Add batchImportCompanies mutation
```

### Pattern 1: Sector + City Search via Apollo

**What:** Apollo `/mixed_companies/search` accepts `organization_locations` as array of strings (city-state format like `"Amsterdam, NL"` or just `"Amsterdam"`) and `organization_keywords` as array of keyword strings for sector/industry matching.

**Current state:** The Apollo provider only sends `q_organization_name`, `organization_locations` (from `filters.countries`), and `organization_num_employees_ranges`. The `industries` and `cities` fields exist in `CompanySearchFilters` type but are never forwarded.

**What to add:**

```typescript
// In lib/enrichment/providers/apollo.ts — searchCompanies body
body: {
  page,
  per_page: pageSize,
  q_organization_name: filters.companyName,
  organization_locations: [
    ...(filters.countries ?? []),
    ...(filters.cities ?? []),   // ADD: cities treated same as locations
  ].filter(Boolean),
  organization_keywords: filters.industries,  // ADD: industries as keyword match
  organization_num_employees_ranges: ...,
  q_organization_technologies: filters.technologies,
},
```

**Why `organization_keywords` for industries:** Apollo's industry classification uses internal tag IDs. Free-text keyword search is more reliable for ad-hoc sector queries (e.g. "marketingbureaus", "marketing agencies") without needing to map to Apollo's canonical industry taxonomy first. Confidence: MEDIUM — verified via Apollo MCP docs; official Apollo REST API docs page was not fully machine-readable but the MCP tool docs showed the parameter clearly.

**Search router addition:**

```typescript
// In server/routers/search.ts
// Extend input schema to pass cities
cities: z.array(z.string()).optional(),

// Pass through to searchCompanies
cities: input.cities,
```

### Pattern 2: Multi-Select Batch Import

**What:** Users should be able to tick multiple result rows and import all in one click. The current UI imports one company at a time with a per-row "Import" button.

**Implementation pattern:** Add `selectedDomains: Set<string>` state to `CompanySearch`. Each result row gets a checkbox. A "Import Selected" button calls `search.importCompany` for each selected domain in parallel using `Promise.all`. The mutation is already idempotent (it skips duplicates and returns `alreadyExists: true`).

**Duplicate handling:** The existing `importCompany` mutation already handles this — it checks for existing prospects by domain and returns `{ alreadyExists: true }`. The batch UI can collect these and show a final summary: "5 imported, 2 already existed".

**No batch mutation needed:** Run N concurrent `importCompany.mutate()` calls client-side. At 20-50 prospects at a time this is fine. No need for a new `batchImportCompanies` endpoint.

```typescript
// Pattern for parallel import with duplicate count
const domains = Array.from(selectedDomains);
const results = await Promise.all(
  domains.map(domain => importCompany.mutateAsync({ domain, companyName: ... }))
);
const imported = results.filter(r => !r.alreadyExists).length;
const skipped = results.filter(r => r.alreadyExists).length;
// Show summary: "${imported} imported, ${skipped} already existed"
```

Note: `useMutation` in tRPC returns `mutateAsync` which is Promise-based. The existing `importCompany` mutation hook works per-call. For parallel calls, call the underlying procedure via `api.search.importCompany.mutateAsync` or use a ref to avoid hook-call limitations. Recommended: extract to a handler function that calls `mutateAsync` multiple times.

**Confidence:** HIGH — pattern is standard React tRPC usage.

### Pattern 3: Dead Page Removal via `notFound()`

**What:** Replace three page.tsx files with server components that call `notFound()`.

**Why not delete directories:** Deleting directories in Next.js App Router removes the route cleanly but leaves no trace. Replacing with `notFound()` keeps the file in git history (easier to review) and produces the same user-visible result: HTTP 404. Both approaches are correct — deletion is slightly cleaner.

**Recommended approach:** Delete the directories entirely. Cleaner than a stub file. Git history is preserved in git log regardless.

**The three files:**

- `/app/admin/hypotheses/page.tsx` — lists hypotheses with accept/reject UI. Functionality now lives in prospect detail page analysis section.
- `/app/admin/research/page.tsx` — lists research runs, allows starting runs. This page's operations are now admin-internal; research is triggered automatically.
- `/app/admin/briefs/page.tsx` — shows Loss Map/brief documents. These are now accessed through prospect detail page.

**None of these pages appear in the nav** (confirmed: admin layout nav has 6 items: Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals — none link to hypotheses/research/briefs).

**They are referenced from:**

- `app/admin/page.tsx` — dashboard uses `api.hypotheses.listAll` but via the action queue, NOT a link to `/admin/hypotheses`
- `components/features/prospects/analysis-section.tsx` — uses `api.hypotheses.listByProspect`, not the page
- `components/features/prospects/command-center.tsx` — uses `api.hypotheses.listByProspect`, not the page
- `app/api/internal/research/callback/route.ts` — server API, not a page link
- `app/api/webhooks/calcom/route.ts` — server webhook, not a page link
- `app/voor/[slug]/dashboard-client.tsx` and `page.tsx` — client-facing pages, not admin

**Conclusion:** None of the files that reference "hypotheses" or "research" link TO the dead pages. Safe to delete.

### Anti-Patterns to Avoid

- **Do not add a `batchImportCompanies` tRPC mutation:** The existing `importCompany` is idempotent and fast enough for 25 items client-side parallel calls.
- **Do not add `organization_industry_tag_ids`:** Requires mapping user text to Apollo internal tag IDs (not worth the complexity for sector-based free search). Use `organization_keywords` instead.
- **Do not redirect dead pages to a different admin page:** Return 404 (deletion or `notFound()`). Redirecting implies the content exists elsewhere.
- **Do not wire the `search.companies` tRPC call to a free-text "sector + location" single input:** Keep sector and city as separate fields. Apollo API needs them as separate arrays.

---

## Don't Hand-Roll

| Problem                             | Don't Build        | Use Instead                                                 | Why                                                           |
| ----------------------------------- | ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Duplicate detection on batch import | Custom dedup logic | Existing `importCompany` mutation (returns `alreadyExists`) | Already handles domain dedup at DB level                      |
| Apollo industry taxonomy lookup     | Tag ID resolver    | `organization_keywords` free-text                           | Avoids maintaining Apollo's tag ID list                       |
| Parallel async mutations            | Custom queue       | `Promise.all(domains.map(mutateAsync))`                     | Simple, well-understood, sufficient for N<=25                 |
| 404 stub pages                      | Redirect logic     | Delete directories                                          | Next.js App Router gives 404 automatically for missing routes |

---

## Common Pitfalls

### Pitfall 1: Apollo `organization_locations` format

**What goes wrong:** Passing just city names without country context (e.g. `"Amsterdam"`) may return fewer or no results if Apollo needs city+country format.

**Why it happens:** Apollo's location matching prefers formats like `"Amsterdam, Netherlands"` or `"Amsterdam, NL"`.

**How to avoid:** Accept free-text from the admin user and pass as-is. Document in the UI placeholder that "Amsterdam, Netherlands" format works better. Don't validate or transform — let Apollo handle it.

**Warning signs:** Search returns 0 results for a known city; retry with full country name added.

### Pitfall 2: `useMutation` called in a loop

**What goes wrong:** Calling `api.search.importCompany.useMutation()` inside a `.map()` breaks React's rules of hooks.

**Why it happens:** Hooks must be called unconditionally at the top level of a component.

**How to avoid:** Define one `importCompany` mutation at the top of `CompanySearch`. Use `importCompany.mutateAsync` in an async handler that calls it multiple times in sequence or parallel.

```typescript
// CORRECT
const importCompany = api.search.importCompany.useMutation();

const handleBatchImport = async (domains: string[]) => {
  const results = await Promise.allSettled(
    domains.map((d) => importCompany.mutateAsync({ domain: d })),
  );
  // count successes vs alreadyExists
};
```

### Pitfall 3: `isPending` state during batch import

**What goes wrong:** `importCompany.isPending` only tracks the last call, so the button may re-enable mid-batch.

**Why it happens:** tRPC `useMutation` tracks one in-flight mutation at a time.

**How to avoid:** Add local `const [batchPending, setBatchPending] = useState(false)` state, set to true at start of batch, false on completion.

### Pitfall 4: Dead pages have client components — deletion vs `notFound()`

**What goes wrong:** All three dead pages are `'use client'` components. `notFound()` must be called from a server component.

**Why it happens:** `notFound()` is a Next.js server-side function that throws a special error; it doesn't work in client components.

**How to avoid:** If stubbing with `notFound()`, create a simple server component wrapper that calls `notFound()` immediately. OR simply delete the directory — preferred.

```typescript
// Server component stub (if not deleting)
import { notFound } from 'next/navigation';
export default function RemovedPage() {
  notFound();
}
```

### Pitfall 5: `industries` passed but not forwarded to Apollo

**What goes wrong:** The search router accepts `industries: z.array(z.string())` and passes it to `searchCompanies(filters)`, but the Apollo provider ignores it (not in the POST body).

**Why it happens:** The parameter was added to the type and service layer but the Apollo implementation was never updated.

**How to avoid:** Add `organization_keywords: filters.industries` to the Apollo `searchCompanies` POST body. This is a single line change.

---

## Code Examples

### Extend Apollo searchCompanies to use industries as keywords

```typescript
// Source: lib/enrichment/providers/apollo.ts — searchCompanies method body
const payload = await apolloFetch<Record<string, unknown>>(
  '/mixed_companies/search',
  {
    method: 'POST',
    operation: 'apollo.searchCompanies',
    body: {
      page,
      per_page: pageSize,
      q_organization_name: filters.companyName,
      organization_locations:
        [...(filters.countries ?? []), ...(filters.cities ?? [])].filter(
          Boolean,
        ).length > 0
          ? [...(filters.countries ?? []), ...(filters.cities ?? [])]
          : undefined,
      organization_keywords: filters.industries?.length
        ? filters.industries
        : undefined,
      organization_num_employees_ranges:
        filters.employeesRange &&
        (filters.employeesRange.min || filters.employeesRange.max)
          ? [
              `${filters.employeesRange.min ?? ''},${filters.employeesRange.max ?? ''}`,
            ]
          : undefined,
      q_organization_technologies: filters.technologies,
    },
  },
);
```

### Add cities to search.ts router input

```typescript
// Source: server/routers/search.ts — companies mutation input
z.object({
  companyName: z.string().optional(),
  domain: z.string().optional(),
  industries: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),  // ADD THIS
  employeesMin: z.number().optional(),
  employeesMax: z.number().optional(),
  technologies: z.array(z.string()).optional(),
  intentTopics: z.array(z.string()).optional(),
  page: z.number().default(1),
  pageSize: z.number().min(1).max(100).default(25),
}),
```

### Dead page notFound stub (server component)

```typescript
// app/admin/hypotheses/page.tsx — if not deleting directory
import { notFound } from 'next/navigation';

export default function RemovedPage() {
  notFound();
}
```

### Batch import handler pattern

```typescript
// Inside CompanySearch component
const [batchPending, setBatchPending] = useState(false);
const [importSummary, setImportSummary] = useState<string | null>(null);
const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());

const importCompany = api.search.importCompany.useMutation();

const handleBatchImport = async () => {
  setBatchPending(true);
  setImportSummary(null);
  try {
    const domains = Array.from(selectedDomains);
    const results = await Promise.allSettled(
      domains.map((domain) => importCompany.mutateAsync({ domain })),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const imported = fulfilled.filter(
      (r) =>
        !(r as PromiseFulfilledResult<{ alreadyExists: boolean }>).value
          .alreadyExists,
    ).length;
    const skipped = fulfilled.length - imported;
    setImportSummary(`${imported} geïmporteerd, ${skipped} al aanwezig`);
    setSelectedDomains(new Set());
    utils.admin.listProspects.invalidate();
  } finally {
    setBatchPending(false);
  }
};
```

---

## What Already Exists (Critical Context for Planner)

The planner must understand the current state to avoid building what already exists:

| Feature                                                  | Status  | Location                                                   |
| -------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| Search Companies tab in /admin/prospects                 | EXISTS  | `app/admin/prospects/page.tsx` — `CompanySearch` component |
| `search.companies` tRPC mutation                         | EXISTS  | `server/routers/search.ts`                                 |
| `search.importCompany` tRPC mutation (single)            | EXISTS  | `server/routers/search.ts`                                 |
| Apollo `searchCompanies` implementation                  | EXISTS  | `lib/enrichment/providers/apollo.ts`                       |
| Guardrail for Apollo plan limits                         | EXISTS  | `server/routers/search.ts`                                 |
| Result cards with company name/domain/industry/employees | EXISTS  | `CompanySearch` component                                  |
| Per-row "Import" button                                  | EXISTS  | `CompanySearch` component                                  |
| `industries` field in `CompanySearchFilters` type        | EXISTS  | `lib/enrichment/types.ts`                                  |
| `cities` field in `CompanySearchFilters` type            | EXISTS  | `lib/enrichment/types.ts`                                  |
| `industries` forwarded to Apollo body                    | MISSING | Apollo provider ignores it                                 |
| `cities` forwarded to Apollo body                        | MISSING | Apollo provider ignores it                                 |
| Sector input field in CompanySearch UI                   | MISSING | UI has industry as free-text; not wired to Apollo          |
| City input field in CompanySearch UI                     | MISSING | Country input exists; city does not                        |
| Multi-select checkboxes on results                       | MISSING | Each row imports independently                             |
| Batch import button                                      | MISSING |                                                            |
| Import summary (N imported, M skipped)                   | MISSING |                                                            |

---

## Open Questions

1. **Apollo `organization_keywords` vs `organization_industry_tag_ids`**
   - What we know: `organization_keywords` accepts free-text array and matches against organization data. MCP docs show it exists.
   - What's unclear: Whether Apollo returns meaningfully different results for `organization_keywords: ["marketingbureaus"]` vs a Dutch localization of "marketing agencies". Apollo's NL company coverage may be thin.
   - Recommendation: Accept free-text, pass as-is. If results are poor, user can adjust their search terms. Do not build tag ID mapping.

2. **Whether to keep `cities` separate from `countries` in the search router input**
   - What we know: Apollo's `organization_locations` accepts both city and country strings in the same array.
   - What's unclear: Whether having separate UI fields for city vs country creates confusion.
   - Recommendation: Add a single "Locatie" field that maps to `cities` (which gets merged with `countries` in the Apollo provider). Country defaults can remain. This matches the user's stated workflow ("Amsterdam" not "Netherlands").

3. **Whether the `search.companies` mutation should expose `cities` or combine city+country into a single `locations` field**
   - Recommendation: Add `cities: z.array(z.string()).optional()` to match existing `countries`. Clean and backwards-compatible.

---

## Sources

### Primary (HIGH confidence — verified against codebase)

- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/providers/apollo.ts` — Apollo provider implementation, `searchCompanies` body parameters
- `/home/klarifai/Documents/klarifai/projects/qualifai/lib/enrichment/types.ts` — `CompanySearchFilters` interface (confirmed `industries` and `cities` exist but unused)
- `/home/klarifai/Documents/klarifai/projects/qualifai/server/routers/search.ts` — tRPC search router: `companies`, `importCompany`, `contacts` mutations
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/prospects/page.tsx` — Existing `CompanySearch` component (sector/city missing; per-row import exists)
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/layout.tsx` — Nav items (confirmed: hypotheses/research/briefs NOT linked)
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/hypotheses/page.tsx` — Dead page content
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/research/page.tsx` — Dead page content
- `/home/klarifai/Documents/klarifai/projects/qualifai/app/admin/briefs/page.tsx` — Dead page content

### Secondary (MEDIUM confidence)

- [Apollo MCP Server docs via Glama](https://glama.ai/mcp/servers/@masridigital/apollo.io-mcp/tools/search_organizations) — Confirmed `organization_keywords` and `organization_locations` parameters with city-state format examples

### Tertiary (LOW confidence — for validation)

- Apollo official docs (`docs.apollo.io/reference/organization-search`) — page not fully machine-readable; parameter list not confirmed from this source directly

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; all patterns from codebase
- Architecture: HIGH — directly verified against live code
- Apollo `organization_keywords` param: MEDIUM — verified via MCP docs, not official REST docs
- Apollo location format: MEDIUM — city-state format shown in MCP docs; NL format untested
- Pitfalls: HIGH — derived directly from reading the code

**Research date:** 2026-02-23
**Valid until:** 2026-03-25 (stable — Apollo API, Next.js App Router both stable)
