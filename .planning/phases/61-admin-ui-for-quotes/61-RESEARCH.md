# Phase 61: Admin UI for Quotes — Research

**Researched:** 2026-04-13
**Domain:** Next.js 16 App Router admin UI / tRPC React Query client / form composition / iframe-based preview
**Confidence:** HIGH

## Summary

Phase 61 is NOT a library-hunting phase — every moving part already exists in the repo. It is a UI-composition phase on top of the shipped Phase 60 schema + `quotes` tRPC router + state-machine. The research discipline here is to (a) document the exact existing Qualifai admin conventions that Phase 61 must follow, (b) lock in the preview-template strategy so the planner doesn't re-open the design debate, (c) name the architectural decisions that fall to Claude's discretion (routing, grouping, dynamic-list implementation), and (d) raise the product questions that need Romano's input before tasks can be written.

Critical finding that corrects the prompt: **the admin UI does NOT need to send a `snapshotData` payload on the "Verstuur" click.** The `transitionQuote` state machine (lib/state-machines/quote.ts, shipped in 60-04) rebuilds the snapshot from the current DB state inside its own `$transaction`. The UI's job is (1) save DRAFT edits via `quotes.update`, (2) call `quotes.transition({ id, newStatus: 'SENT' })` — nothing more. The Q9 snapshot freeze is entirely owned by the state machine. Planner tasks must not add snapshot construction to the UI layer.

Second critical finding: **the Qualifai admin stack has no form library, no shadcn/ui, no Radix, no react-hook-form, no zodResolver.** Forms are plain `'use client'` components with `useState` + controlled inputs + `api.*.useMutation()`. Phase 61 MUST follow this pattern — introducing react-hook-form now would be out of character and out of scope.

Third critical finding: **the canonical `proposal-template.html` in klarifai-core has Marfa-specific content hardcoded.** Only 4 real `{{placeholders}}` exist (`client_name`, `project_title`, `tagline` on the cover; table rows + totals are static HTML). The 15 `{{token}}` matches counted via grep are mostly in HTML comments documenting what each section contains. The Phase 61 iframe preview cannot use "find and replace placeholder tokens" — it will need to do structural injection (cloning the template and swapping entire `<p class="text-body">`, `<ol class="numbered-list">`, and `<tbody>` node groups with data-driven HTML). This is planner territory and the decision goes into the Preview Template Strategy section below.

**Primary recommendation:** Build Phase 61 as 4-5 vertical slices (list page → create flow → update/autosave → preview iframe → send/version). Each slice is a thin composition layer over the shipped 60-04 tRPC endpoints, with plain controlled React forms, no new dependencies, and a server route `/admin/quotes/[id]/preview` that serves the interpolated klarifai-core HTML verbatim inside an iframe `src` (not `srcDoc`, for CSP + Google Fonts reasons).

<user_constraints>

## User Constraints (from the orchestrator prompt)

This phase was spawned by `/gsd:research-phase` directly (no separate CONTEXT.md file). The constraints below are copied verbatim from the `<additional_context>` and `<specific_questions_to_answer>` blocks of the invoking prompt.

### Locked Decisions

**Q5 — PDF strategy:**

- PDF rendering lives in a separate Railway worker, not in-process (Phase 62).
- **Phase 61 does NOT render PDFs.** The admin preview is HTML-only.
- `Quote.snapshotPdfUrl` stays null through Phase 61 — no UI affordances around PDF downloads in this phase.

**Q9 — Snapshot freeze:**

- Snapshot is frozen at DRAFT→SENT inside `transitionQuote` (lib/state-machines/quote.ts).
- Phase 61's "Verstuur" button calls `api.quotes.transition.useMutation()` with `{ id, newStatus: 'SENT' }`.
- **Correction to the prompt:** the tRPC input of `quotes.transition` is `{ id, newStatus }` only — NO `snapshotData` field. The state machine builds the snapshot from the current DB row. The prompt sentence "The admin UI MUST send snapshotData — the state machine will throw BAD_REQUEST if missing" is incorrect and must not drive the plan.
- The admin UI MUST NOT attempt to mutate Quote after SENT (the router enforces this — `quotes.update` throws PRECONDITION_FAILED on non-DRAFT quotes).

**Q12 — Versioning:**

- No counter column, no `version: Int`.
- For "Nieuwe versie" flow: create a NEW Quote row with `replacesId = <original.id>` + status DRAFT, and transition the original Quote to ARCHIVED.
- NOT a revision on the existing row.
- Two writes (new Quote create + original Quote transition to ARCHIVED) — these must be transactional. **Gap:** `quotes.create` does not currently accept `replacesId` (Zod input omits it). Planner must either extend `quotes.create` input, add a dedicated `quotes.createVersion` endpoint, or wrap the two calls in a single new router mutation. See Open Question O6 below.

**Q13 — Prospect sync:**

- Sending transitions Prospect → QUOTE_SENT via the state machine (already wired in 60-04).
- Phase 61 does NOT implement sync — it consumes the endpoint.

**Q14 — Design:**

- The NEW design (scroll-driven, motion-based, responsive) is Phase 62's problem.
- Phase 61 is a **functional admin shell** using existing Qualifai admin UI patterns (Tailwind utilities, existing `admin-btn-primary` / `glass-card` / `admin-toggle-*` classes, Lucide icons).
- Do NOT make design decisions that will be overwritten by Phase 62's UI-SPEC.
- **The admin preview iframe in Phase 61 reuses `klarifai-core/docs/design/proposal-template.html` verbatim** as a temporary reference render. Phase 62 replaces the iframe template with the new web voorstel, at which point this temporary reference use is retired.

**Project rules (from global CLAUDE.md + repo CLAUDE.md — which doesn't exist):**

- Tailwind utilities for layout/spacing.
- CSS variables for colors/branding — NEVER hardcode brand colors.
- Every DB query filters by `projectId` (already enforced by `projectAdminProcedure` — Phase 61 just consumes).
- 300-line file limit — split forms into sub-components.
- TypeScript types everywhere.
- Dutch (NL) is primary language for all user-facing content.
- No emojis unless explicitly asked.

### Claude's Discretion

The prompt explicitly leaves these for the researcher/planner to decide:

1. **Exact preview injection mechanism** — srcDoc vs `src=/admin/quotes/[id]/preview` route; placeholder replacement vs DOM injection on the server; how the hardcoded Marfa `<ol class="numbered-list">` pillar blocks become dynamic. This research section makes a recommendation (server route + structural injection) but the planner finalises it.
2. **Quote detail page URL shape** — `/admin/quotes/[id]` vs `/admin/prospects/[id]/quotes/[quoteId]`. Recommendation below; Romano's final call is Open Question O4.
3. **Status grouping on `/admin/quotes`** — tabs vs sections vs chip filters. Recommendation below; Romano's final call is Open Question O3.
4. **Dynamic line-item list implementation** — controlled component vs uncontrolled; reorder via up/down buttons vs drag-drop; how to store the in-progress array in state. Recommendation below (no drag-drop in Phase 61).
5. **Confirmation modal before "Verstuur"** — required or skippable. Recommendation: required (irreversible action). Final call is Open Question O6.
6. **Auto-save vs manual save** on the DRAFT edit form. Recommendation: manual save with a dirty indicator (matches the rest of the admin).

### Deferred Ideas (OUT OF SCOPE for Phase 61)

- **PDF preview or download** — Phase 62 (PDF Worker).
- **Client-facing `/discover/[slug]/voorstel` page** — Phase 62.
- **VIEWED / ACCEPTED / REJECTED tracking** — Phase 62 (requires client-side page).
- **Drag-and-drop line item reorder** — nice-to-have, not an ADMIN requirement. Up/down buttons are sufficient.
- **Quote templates / preset line items / save-as-template** — not in ADMIN-\* requirements.
- **Multi-language quotes (NL + EN)** — explicitly out of scope per REQUIREMENTS.md.
- **Search / full-text filter on the quote list** — at current volume (3 imported + a handful of new), grouping by status is enough.
- **Bulk actions on the list** — not in ADMIN requirements.
- **Email preview / email send from the admin** — quote is delivered via the public `/discover/[slug]/voorstel` URL in Phase 62; Phase 61 has no email send flow.
- **Snapshot diff viewer** — listed in CONCERNS.md as a missing feature, but not in ADMIN-\* scope.
- **Audit log for admin edits** — not in ADMIN scope.
- **Any design decision that will collide with Phase 62's `UI-SPEC.md`** — keep the iframe temporary and the admin shell plain.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID           | Description (from REQUIREMENTS.md)                                                                 | Research Support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADMIN-01** | Admin can view all quotes grouped by status at `/admin/quotes`                                     | `quotes.list` already exists with optional `status` filter (server/routers/quotes.ts:80). Include shape returns `lines[]` + `prospect{id,slug,readableSlug,companyName}` — enough for list row rendering. Planner decides tabs vs sections (Open Q O3).                                                                                                                                                                                                                                                                                                       |
| **ADMIN-02** | Admin can create a new quote for a prospect at `/admin/prospects/[id]/quotes/new`                  | `quotes.create` already exists (server/routers/quotes.ts:128). Input shape = `{prospectId, nummer, datum (ISO), geldigTot (ISO), onderwerp, tagline?, introductie?, uitdaging?, aanpak?, btwPercentage (int), scope?, buitenScope?, lines[]}`. Form can be a single controlled component.                                                                                                                                                                                                                                                                     |
| **ADMIN-03** | Admin can add, reorder, edit, and remove line items (fase, omschrijving, oplevering, uren, tarief) | Line items stored in `useState<QuoteLineDraft[]>`. Tarief MUST allow signed int (discount lines — Pitfall 5 from Phase 60). `position` defaults to array index inside `quotes.create` / `quotes.update`. Up/down buttons for reorder (not drag-drop).                                                                                                                                                                                                                                                                                                         |
| **ADMIN-04** | Admin can preview the quote as rendered HTML in an iframe before sending                           | Server route `/admin/quotes/[id]/preview.html` returns the interpolated klarifai-core HTML. Admin detail page renders `<iframe src="/admin/quotes/[id]/preview.html" />`. See "Preview Template Strategy" section.                                                                                                                                                                                                                                                                                                                                            |
| **ADMIN-05** | Admin can transition `DRAFT → SENT` via a button that triggers snapshot creation                   | `quotes.transition` with `{id, newStatus: 'SENT'}`. The state machine freezes the snapshot + syncs prospect to QUOTE_SENT inside `$transaction`. UI shows loading state + success toast. Confirm modal recommended.                                                                                                                                                                                                                                                                                                                                           |
| **ADMIN-06** | Admin can see quote status timeline (Created, Sent at, Viewed at, Accepted at)                     | Phase 61 only has `createdAt` + `snapshotAt` (the latter is populated by the state machine on DRAFT→SENT). `viewedAt`/`acceptedAt` don't exist as dedicated columns — per REQUIREMENTS.md they show as "nog niet" / "awaiting" for now. Planner should build the component with all 4 slots + 2 known data sources so Phase 62 can fill the other 2 without refactor.                                                                                                                                                                                         |
| **ADMIN-07** | Admin can edit DRAFT quotes freely; SENT+ quotes are read-only                                     | Already enforced at the router layer — `quotes.update` throws PRECONDITION_FAILED if status != 'DRAFT'. UI must mirror this: show form-as-readonly when status != 'DRAFT', disable save button, show "immutable snapshot" badge. No additional backend work.                                                                                                                                                                                                                                                                                                  |
| **ADMIN-08** | Admin can archive an existing quote and create a new version with `replacesId` reference           | `Quote.replacesId` column exists (Phase 60-02 pre-emptive). `quotes.create` Zod input does NOT currently accept `replacesId` — **this is a gap** and the planner must close it (extend create input OR add `quotes.createVersion`). Both writes (new DRAFT + original to ARCHIVED) must be in a single `$transaction`. Recommended: new `quotes.createVersion({fromId})` mutation on the router that loads the original, clones field-by-field into a new Quote with `replacesId = fromId`, and transitions the original to ARCHIVED. Atomic by construction. |

</phase_requirements>

## Existing Qualifai Admin Shell — What Phase 61 Builds On

### Layout and navigation

- **Entry point:** `app/admin/layout.tsx` wraps all `/admin/*` pages with `<AdminAuth>` → `<AdminShell>`.
- **Auth model:** `x-admin-token` stored in localStorage (key `ADMIN_TOKEN_STORAGE_KEY`). Injected into all tRPC requests via `httpBatchLink.headers()` in `components/providers.tsx`. No session cookies, no server-side auth.
- **Nav sidebar:** Hardcoded `NavItem[]` array in `AdminShell` (layout.tsx:244). Current items: Dashboard, Companies, Campaigns, Draft Queue, Use Cases, Signals. **Phase 61 planner decision:** whether to add "Quotes" to the sidebar. Recommendation: YES — quote list is a top-level entity per ADMIN-01, nesting it inside Prospects would break the pattern set by Campaigns/Outreach/Use-Cases.
- **Layout classes (existing Tailwind + custom):** sidebar is `sticky top-0 hidden h-screen w-72 flex-col border-r border-[#E9ECEF] bg-[#F8F9FA] lg:flex`. Navy brand color is `#040026`, accent is `#EBCB4B` (gold). Background is `#F9F9FB`. These are hardcoded hex literals in the shell — CLAUDE.md says use CSS variables, but the existing admin does NOT — Phase 61 should match existing admin style for consistency, not retrofit tokens.

### Existing UI primitives and patterns

**What exists** (from `components/ui/` + `app/globals.css`):

- `Button` (components/ui/button.tsx) — `variant: 'primary' | 'secondary' | 'ghost' | 'outline' | 'yellow'`. `React.forwardRef`-based. Use this for all action buttons.
- `glass-card` — CSS class from globals.css, includes `border-radius: var(--radius-xl)`. Used for section containers everywhere (see memory in CLAUDE.md: "don't add per-instance border radius"). Use `<div className="glass-card p-8">...</div>` for form sections.
- `input-minimal` — CSS class with `font-family: inherit`. Used for text inputs.
- `admin-btn-primary`, `admin-toggle-group`, `admin-toggle-btn`, `admin-toggle-btn-active`, `admin-state-pill`, `admin-state-warning`, `admin-state-danger`, `btn-pill-primary`, `btn-pill-secondary`, `btn-pill-yellow` — all defined in globals.css (as per usage in `app/admin/prospects/page.tsx`).
- `PageLoader` (components/ui/page-loader.tsx) — full-page loading skeleton with label + description.
- `PipelineChip`, `QualityChip` — domain-specific status chips in `components/features/prospects/`.
- `StatusBadge` (components/ui/status-badge.tsx).
- Icons: Lucide React — import individually, not as wildcard.

**What does NOT exist and must NOT be introduced:**

- shadcn/ui (no `@/components/ui/form`, no `@/components/ui/dialog`, no `@/components/ui/sheet`, no `@/components/ui/tabs`).
- Radix primitives (`@radix-ui/react-*`) — zero usage in package.json.
- react-hook-form + `@hookform/resolvers/zod` — not installed.
- cmdk, sonner, vaul, zustand — not installed.
- MUI, Chakra, Mantine — not installed.
- Framer Motion IS installed but rarely used on admin pages — not needed for Phase 61.

### Data fetching pattern (admin side)

Every admin page is `'use client'`. Data flows through `api.*.useQuery()` + `api.*.useMutation()` from `@/components/providers` (tRPC React Query hooks). Example from `app/admin/prospects/[id]/page.tsx`:

```typescript
'use client';
import { api } from '@/components/providers';
import { useParams } from 'next/navigation';

const prospect = api.admin.getProspect.useQuery({ id });
const researchRuns = api.research.listRuns.useQuery({ prospectId: id });
const utils = api.useUtils();

// Mutations
const rediscover = api.research.rediscoverSources.useMutation({
  onSuccess: () => utils.research.listRuns.invalidate(),
});
```

**No server components use tRPC in this codebase.** There is no `createCaller` helper (grep confirms: only present in `.test.ts` files). Phase 61 pages are client components with `useQuery`/`useMutation`. The preview server route (`app/admin/quotes/[id]/preview.html/route.ts`) is the ONE exception — it uses Prisma directly via `import prisma from '@/lib/prisma'` because it needs to return `Response` with `text/html` content-type.

### Existing form patterns (the controlled-state convention)

`app/admin/prospects/new/page.tsx` is the reference form. Key patterns:

```typescript
'use client';
import { useState } from 'react';
import { api } from '@/components/providers';
import { useRouter } from 'next/navigation';

export default function NewProspect() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createAndProcess = (api.admin.createAndProcess as any).useMutation({
    // NOTE: the `as any` cast is a tRPC v11 inference gap — recurring tech debt
    onSuccess: (data: any) => { ... router.push(`/admin/prospects/${data.id}`) },
    onError: (err: any) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAndProcess.mutate({ domain: domain.trim(), internalNotes: notes.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="glass-card p-10 space-y-8 rounded-[2.5rem]">
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
          Corporate Domain
        </label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-[#040026] focus:outline-none focus:ring-4 focus:ring-[#EBCB4B]/10 focus:border-[#EBCB4B] transition-all"
        />
      </div>
      <button type="submit" className="w-full py-5 btn-pill-primary">Submit</button>
    </form>
  );
}
```

**This is the template for all Phase 61 forms.** No hooks library, no Zod resolver on the client, no react-hook-form. Validation happens on the server (the `quotes.create` Zod input) — the client shows the TRPCError message in an error banner.

**tRPC v11 inference gap:** note the `as any` cast on `api.admin.createAndProcess` — this is the same "TS2589 too deep" issue called out in CONCERNS.md. It will recur on Phase 61's `api.quotes.*.useMutation()` calls whenever includes get deep (the `list` query returns `lines[] + prospect{...}`). Follow the existing convention: either use `Prisma.QuoteGetPayload<{include:{lines:true, prospect: {select: {...}}}}>` to extract types from Prisma directly, OR use `as any` with a `// TODO: tRPC v11 inference` comment. Document the choice in each PLAN.

### Dynamic-list pattern (line items)

Phase 61 is the FIRST admin page to need a dynamic list of form rows. There is no existing pattern in `app/admin/*` to copy — grep for `useFieldArray`, `addLine`, `setContacts` returns zero matches in admin pages. The planner establishes the convention:

```typescript
type LineDraft = {
  fase: string;
  omschrijving: string;
  oplevering: string;
  uren: number;
  tarief: number; // SIGNED — negative allowed (Pitfall 5)
};

const [lines, setLines] = useState<LineDraft[]>([
  {
    fase: '',
    omschrijving: '',
    oplevering: '',
    uren: 0,
    tarief: 9500 /* cents */,
  },
]);

const updateLine = (idx: number, patch: Partial<LineDraft>) =>
  setLines((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

const addLine = () =>
  setLines((xs) => [
    ...xs,
    { fase: '', omschrijving: '', oplevering: '', uren: 0, tarief: 9500 },
  ]);

const removeLine = (idx: number) =>
  setLines((xs) => xs.filter((_, i) => i !== idx));

const moveUp = (idx: number) =>
  setLines((xs) =>
    idx <= 0
      ? xs
      : [...xs.slice(0, idx - 1), xs[idx]!, xs[idx - 1]!, ...xs.slice(idx + 1)],
  );

const moveDown = (idx: number) =>
  setLines((xs) =>
    idx >= xs.length - 1
      ? xs
      : [...xs.slice(0, idx), xs[idx + 1]!, xs[idx]!, ...xs.slice(idx + 2)],
  );
```

Each row is a sub-component (`<LineItemRow line={l} onChange={patch => updateLine(idx, patch)} onDelete={() => removeLine(idx)} onUp={} onDown={} disabled={isReadOnly} />`) to keep the parent component under the 300-line limit.

**Unit conventions (verified against klarifai-core YAMLs and the Phase 60-03 schema):**

- `uren` is a nonnegative integer (hours).
- `tarief` is a signed integer. The klarifai-core Marfa quotes store it in **euro units** (e.g. 95 means €95/hr) in YAML, but the Prisma model says `Int` and the Phase 60-03 test fixture `VALID_SNAPSHOT` uses a signed int. The planner must confirm the unit (euro vs cent) by reading the imported data once Romano runs `--apply`. Tarief also supports negative values (OFF003 Pakketkorting line = `-800`). Do NOT add client-side `min={0}` on the tarief input.
- `btwPercentage` is stored as a plain integer (21 for 21%).

### Existing prospect detail page — structure to mirror on quote detail

`app/admin/prospects/[id]/page.tsx` already has a tabbed section pattern using `BASE_TABS` + `useState<TabId>`. For a quote detail page with {form | preview | history/timeline}, mirror this pattern:

```typescript
const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'preview', label: 'Voorbeeld' },
  { id: 'timeline', label: 'Status & historie' },
] as const;
```

Keep all tabs mounted (hidden via `className={activeTab === 'preview' ? '' : 'hidden'}`) — per the `CLAUDE.md` memory note, this is the existing Qualifai convention to avoid refetch/loading flash on switch.

## Standard Stack

### Core (already installed — USE THESE)

| Library               | Version             | Purpose                      | Why Standard                             |
| --------------------- | ------------------- | ---------------------------- | ---------------------------------------- |
| Next.js               | 16.1.6 (App Router) | Pages + server routes        | Already the framework                    |
| React                 | 19.2.3              | UI rendering                 | Already installed                        |
| tRPC React Query      | 11.9.0              | Client data layer            | Only data layer in admin                 |
| Zod                   | 4.3.6               | Server-side input validation | Already used by `quotes.*` router        |
| Tailwind CSS          | 4                   | Styling                      | Only styling convention                  |
| Lucide React          | 0.563.0             | Icons                        | Only icon library in use                 |
| clsx + tailwind-merge | 2.1.1 / 3.4.0       | Conditional classes          | Used via `cn()` helper in `lib/utils.ts` |

### Supporting (already installed)

| Library                    | Version | Purpose                                          | When to Use                          |
| -------------------------- | ------- | ------------------------------------------------ | ------------------------------------ |
| `next/navigation`          | bundled | useParams, useRouter, usePathname                | Route params + redirect after create |
| `@tanstack/react-query`    | 5.59.15 | `utils.quotes.list.invalidate()` after mutations | After every mutation                 |
| `class-variance-authority` | 0.7.1   | Typed Tailwind variants (Button)                 | Only for component primitives        |

### Alternatives Explicitly Considered and REJECTED

| Instead of                               | Could Use                        | Why rejected for Phase 61                                                                                                  |
| ---------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Plain controlled state                   | react-hook-form + zodResolver    | Not installed; adding it breaks the convention of every other admin form; makes Phase 61 larger than necessary             |
| Server components + createCaller         | Client `useQuery`                | Zero existing examples in the repo; server-side caller not wired; admin auth is client-token based                         |
| shadcn/ui Dialog / Tabs                  | Plain divs + `hidden` + Tailwind | Not installed; Framer Motion already available if animation is needed later                                                |
| react-dnd for line reorder               | Up/down buttons                  | Not in ADMIN-03 text; adds a dependency; Romano's quote shape is 3-6 lines typical                                         |
| Monaco or rich-text editor for narrative | `<textarea>` + plain text        | Narrative fields are stored as strings; the template renders them as `<p class="text-body">` — no inline formatting needed |

**Installation:** No new dependencies. `npm install` not required for Phase 61.

## Architecture Patterns

### Recommended directory structure

```
app/admin/quotes/
├── page.tsx                                # ADMIN-01 — list grouped by status
├── [id]/
│   ├── page.tsx                            # Quote detail: tabs (details/preview/timeline)
│   └── preview.html/
│       └── route.ts                        # Server route — returns interpolated klarifai-core HTML
├── new/
│   └── page.tsx                            # Edge case: create without prospect context (optional)
app/admin/prospects/[id]/quotes/
└── new/
    └── page.tsx                            # ADMIN-02 — prospect-scoped create form

components/features/quotes/                 # NEW directory
├── quote-form.tsx                          # Shared create/edit form (DRAFT only)
├── quote-line-row.tsx                      # Single line item row (controlled)
├── quote-line-list.tsx                     # Dynamic list + add/reorder/remove
├── quote-status-badge.tsx                  # QuoteStatus → color chip
├── quote-status-timeline.tsx               # ADMIN-06 — created/sent/viewed/accepted slots
├── quote-preview-iframe.tsx                # ADMIN-04 — iframe wrapper + loading state
├── quote-send-confirm.tsx                  # Confirm modal before transition(SENT)
├── quote-version-confirm.tsx               # Confirm modal before archive + createVersion

lib/quotes/                                 # NEW directory
├── preview-template.ts                     # Read klarifai-core HTML + interpolate snapshot data
├── preview-template.test.ts                # Vitest coverage on token substitution
├── format-currency.ts                      # €-formatter, nl-NL locale
├── quote-totals.ts                         # Client-side recompute for preview (mirrors state machine's buildSnapshotFromQuote totals math)

app/admin/quotes/[id]/preview.html/
└── route.ts                                # GET handler: prisma.quote.findUnique → interpolateTemplate → new Response(html)
```

Each file stays under 300 lines.

### Pattern 1: Server route for iframe-safe HTML

**What:** A Next.js App Router route handler returns the rendered HTML as `text/html` so the iframe loads it via a normal URL, which allows Google Fonts (`@import` in the klarifai-core template), lets the browser honor `<base>`, and avoids `srcDoc` escaping hell.

**When to use:** All Phase 61 preview renders. Do NOT use `srcDoc` — it blocks same-origin-relative asset loading and CSP rules get messy.

**Example:**

```typescript
// app/admin/quotes/[id]/preview.html/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveAdminProjectScope } from '@/server/admin-auth';
import { renderQuotePreview } from '@/lib/quotes/preview-template';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('x-admin-token') ?? req.nextUrl.searchParams.get('token');
  const scope = resolveAdminProjectScope(token);
  if (!scope) return new Response('Unauthorized', { status: 401 });

  const quote = await prisma.quote.findFirst({
    where: { id: params.id, prospect: { projectId: /* resolve via scope.allowedProjectSlug */ } },
    include: { lines: { orderBy: { position: 'asc' } }, prospect: { select: { slug: true, companyName: true } } },
  });
  if (!quote) return new Response('Not Found', { status: 404 });

  const html = await renderQuotePreview(quote);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
}
```

**Authorization caveat:** iframes don't forward localStorage tokens automatically. Options:

1. Pass the admin token via query string (`?token=...`) — acceptable for admin-only, non-shareable preview. Simplest.
2. Use an httpOnly cookie set on admin login — requires rework of auth.
3. Serve from a short-lived signed preview URL.

**Recommendation:** option 1 for Phase 61 (cheap, reversible), with `x-robots-tag: noindex` header and a project-scoped `prisma.quote.findFirst({where: {id, prospect: {projectId}}})` guard to keep multi-tenancy intact. Phase 62 will replace the preview with a public `/discover/[slug]/voorstel` anyway.

### Pattern 2: Optimistic mutation + invalidation

```typescript
const utils = api.useUtils();
const updateQuote = api.quotes.update.useMutation({
  onSuccess: () => {
    utils.quotes.get.invalidate({ id });
    utils.quotes.list.invalidate();
  },
  onError: (err) => setError(err.message),
});
```

This matches `source-set-section.tsx:53-55` — the codebase convention.

### Pattern 3: Read-only form when status != DRAFT

```typescript
const isReadOnly = quote.status !== 'DRAFT';
<input ... disabled={isReadOnly} className={cn('...', isReadOnly && 'cursor-not-allowed opacity-75')} />
{isReadOnly && <p className="text-xs font-bold text-slate-500">Deze offerte is verstuurd en kan niet meer bewerkt worden. Maak een nieuwe versie om aanpassingen door te voeren.</p>}
```

### Anti-Patterns to Avoid

- **Hand-rolling a form library.** If controlled state becomes unwieldy, split into sub-components, do NOT install react-hook-form mid-phase.
- **Building the snapshot on the client.** Absolutely forbidden — the state machine owns this. Client just calls `transition({id, newStatus:'SENT'})`.
- **Calling `quotes.update` after SENT.** Will throw PRECONDITION_FAILED. UI must not offer a save button when `status !== 'DRAFT'`.
- **Using `srcDoc` for the preview iframe.** Blocks `@import url('https://fonts.googleapis.com/...')` which the klarifai-core template uses.
- **Adding `replacesId` to `quotes.update`.** The router input deliberately omits it (and snapshot\* + status). Wrong path.
- **Hardcoding brand colors with hex strings in new components** when the existing admin already uses `#040026` / `#EBCB4B` inline — follow existing admin convention despite CLAUDE.md's CSS-variable rule, and log a tech-debt ticket if token extraction is desired later.
- **Treating nummer as auto-generated.** There's no generator function in the codebase. Planner must decide: accept-as-input OR generate on the server (see Open Q O1).
- **Placing sensitive data in query string tokens beyond Phase 61.** The preview-token trick is acceptable for admin-only short-term use; Phase 62 must replace it with project-scoped auth.

## Don't Hand-Roll

| Problem                             | Don't Build          | Use Instead                                                          | Why                                                                          |
| ----------------------------------- | -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Quote CRUD endpoint                 | Phase 61 tRPC router | `server/routers/quotes.ts` (shipped 60-04)                           | Already has 5 procedures with multi-tenant scope                             |
| Status transition + snapshot freeze | Client-side compose  | `quotes.transition` + `transitionQuote`                              | State machine owns atomicity                                                 |
| Quote totals computation            | Client-only calc     | `buildSnapshotFromQuote` logic from `lib/state-machines/quote.ts:67` | Mirror for preview display; server recomputes on snapshot freeze             |
| Snapshot schema                     | New validator        | `QuoteSnapshotSchema` (shipped 60-03)                                | Single source of truth                                                       |
| Multi-tenant scope                  | Filter in queries    | `projectAdminProcedure`                                              | Already on every `quotes.*` procedure                                        |
| Form validation                     | Client-side Zod      | Server-side Zod on `quotes.create/update`                            | Surface TRPCError.message in UI                                              |
| Form library                        | react-hook-form      | Plain `useState` + controlled inputs                                 | Matches existing admin                                                       |
| Modal library                       | Radix Dialog         | `fixed inset-0 z-50` + backdrop div                                  | `app/admin/layout.tsx:353` already has a mobile-nav modal using this pattern |
| Toast/notification                  | sonner               | Inline error banner + `setError` state                               | Existing admin pages do this                                                 |
| Date picker                         | react-datepicker     | `<input type="date">`                                                | Browser native is enough for admin                                           |
| Currency formatting                 | Hand-roll            | `new Intl.NumberFormat('nl-NL', {style:'currency', currency:'EUR'})` | Standard library                                                             |

**Key insight:** Every "complex" problem in this phase has already been solved server-side in Phase 60. Phase 61 is composition only.

## Common Pitfalls

### Pitfall 1: Assuming the UI must build snapshotData

**What goes wrong:** Planner reads the prompt statement "the state machine will throw BAD_REQUEST if missing" and writes tasks that build a `QuoteSnapshot` object on the client and send it in the transition call.
**Why it happens:** Misreading the Phase 60-04 state machine contract.
**How to avoid:** The actual `transitionQuote` signature is `(db, quoteId, newStatus)` — no snapshot input. The UI mutation input is `{ id, newStatus }` only. Plan accordingly.
**Warning signs:** Tasks that mention `QuoteSnapshotSchema.parse` on the client; `snapshotData` in the mutation call.

### Pitfall 2: Signed tarief gets clamped

**What goes wrong:** Planner writes `<input type="number" min={0}>` on the tarief input, or adds `.nonnegative()` to a client-side Zod schema, breaking OFF003's `-800` discount line.
**Why it happens:** Instinct to guard inputs; Zod's default for prices is often nonneg.
**How to avoid:** Phase 60-03 explicitly removed `.nonnegative()` from `QuoteSnapshotLineSchema.tarief` (Pitfall 5 in that plan). Phase 61 MUST mirror this. Add an inline comment on the input: `{/* SIGNED — negative allowed for discount lines */}`. Unit test: save a DRAFT with `tarief: -800` and assert it round-trips.
**Warning signs:** `min={0}` on the tarief input; `.nonnegative()` anywhere near line items.

### Pitfall 3: `replacesId` gap on quotes.create

**What goes wrong:** Planner writes a task "call `quotes.create` with `replacesId: originalId`" and it silently fails — the field is omitted from the Zod input.
**Why it happens:** `Quote.replacesId` exists as a Prisma column (added pre-emptively in 60-02), but Phase 60-04's `create` mutation does not accept it.
**How to avoid:** Extend the router. Recommended: add a dedicated `quotes.createVersion({fromId})` mutation that loads the original, validates it's in scope, clones all editable fields, sets `replacesId`, creates the new DRAFT, and transitions the original to ARCHIVED — all inside `prisma.$transaction`. The router change is tiny (≈30 lines) and keeps the UI dumb.
**Warning signs:** Plan tasks that reference `replacesId` in `quotes.create`.

### Pitfall 4: Iframe + token leaks in logs

**What goes wrong:** `?token=...` in preview URL gets logged in server access logs / browser history / referrer headers sent to Google Fonts.
**Why it happens:** Query string tokens always get logged.
**How to avoid:** Set `Referrer-Policy: no-referrer` on the preview route response, add `x-robots-tag: noindex`, use `cache-control: no-store`. Document the limitation — this is the "Phase 61 = temporary" trade-off. Phase 62 replaces with public slug URLs.
**Warning signs:** Preview route copied to a public context without re-auth.

### Pitfall 5: tRPC v11 inference blowup on `quotes.list` + deep includes

**What goes wrong:** `const quote = data?.[0]` on `api.quotes.list.useQuery()` result hits TS2589 "too deep" and the `quote.lines[0].fase` access compiles as `any`.
**Why it happens:** Known tRPC v11 bug — `server/routers/quotes.ts:80` uses `include: {lines: {orderBy}, prospect: {select: {...}}}`.
**How to avoid:** Extract the payload type via `Prisma.QuoteGetPayload<{include: {lines: true, prospect: {select: {id:true, slug:true, readableSlug:true, companyName:true}}}}>` and cast. Prior art: `app/admin/prospects/[id]/page.tsx:42-57` does exactly this for `ResearchRunRow`. Document in each file with a `// TODO: tRPC v11 inference gap` comment per CONCERNS.md convention.
**Warning signs:** `as any` without a comment; red squigglies in the IDE the planner ignores.

### Pitfall 6: Klarifai-core template is not parameterised

**What goes wrong:** Planner writes "find and replace `{{placeholder}}` tokens" and discovers that 80% of the template is hardcoded Marfa prose (pillar blocks, phase blocks, table rows, scope lists).
**Why it happens:** The template comments say `{{placeholders}}` but they're mostly documentation, not actual tokens. Grep shows only ~4 real tokens: `client_name`, `project_title`, `tagline` (cover page only) and totals strings.
**How to avoid:** Treat the template as a structural clone target. `lib/quotes/preview-template.ts` reads the file, parses with a simple string-replace for the cover tokens, then does structural injection into 3 sections: the pillar list (uitdaging page), the phase list (aanpak page), and the pricing table (investering page). The scope/buiten-scope lists on page 5 also need injection. See Preview Template Strategy below for the detailed substitution map.
**Warning signs:** A "just replace tokens" task without a substitution map.

### Pitfall 7: Auto-sync Prospect status fails for prospects not in ENGAGED

**What goes wrong:** Admin sends a DRAFT quote for a prospect in `DRAFT` or `READY` status, the state machine tries `ENGAGED → QUOTE_SENT`, and `assertValidProspectTransition` throws because the prospect was never in ENGAGED first.
**Why it happens:** `QUOTE_TO_PROSPECT_SYNC` maps `SENT → QUOTE_SENT`, and `assertValidProspectTransition` enforces the full state machine. If the prospect hasn't been through ENGAGED, the cascade fails and the whole transition rolls back.
**How to avoid:** Research the `lib/state-machines/prospect.ts` transition map to verify whether `READY → QUOTE_SENT`, `SENT → QUOTE_SENT`, `VIEWED → QUOTE_SENT`, `ENGAGED → QUOTE_SENT` are all valid. If any are invalid, either (a) ensure the UI enforces a status-precondition before the Verstuur button is enabled, (b) show a clear error message when it does fail, or (c) extend the prospect state machine to accept QUOTE_SENT from more source states. Testing task: run `quotes.transition` on a prospect in each starting status and document which succeed. **This is a Phase 61 planner + tester concern** — if it blows up, the "Verstuur" button looks broken without explanation.
**Warning signs:** No test covering the prospect status pre-condition before SEND.

### Pitfall 8: File-based template read at request time (cold start cost)

**What goes wrong:** `lib/quotes/preview-template.ts` calls `fs.readFile('/home/klarifai/Documents/klarifai/klarifai-core/docs/design/proposal-template.html')` on every request, which (a) doesn't exist on Vercel in production, (b) adds I/O on every preview render.
**Why it happens:** The template lives in a SIBLING repo (klarifai-core), not inside Qualifai's source tree. Vercel bundles `projects/qualifai` only.
**How to avoid:** Copy the template file into Qualifai at build time (or as a one-shot `scripts/sync-template.ts`) and commit it to `lib/quotes/proposal-template.html`. Then `import templateHtml from './proposal-template.html?raw'` (if the bundler supports raw imports) OR read via `fs.readFile(path.join(process.cwd(), 'lib/quotes/proposal-template.html'))` which DOES work on Vercel. **Recommendation:** copy the file into the Qualifai repo as part of Phase 61, set up a script or doc note that re-syncs it if klarifai-core changes (Phase 62 retires this anyway).
**Warning signs:** A task that reads directly from `../../klarifai-core/docs/design/proposal-template.html`.

## Code Examples

### `lib/quotes/preview-template.ts` — structural substitution

```typescript
// Source: adapted from klarifai-core/docs/design/proposal-template.html (658 lines)
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Quote, QuoteLine, Prospect } from '@prisma/client';

type QuoteWithRelations = Quote & {
  lines: QuoteLine[];
  prospect: Pick<Prospect, 'slug' | 'companyName'>;
};

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'lib/quotes/proposal-template.html',
);

export async function renderQuotePreview(
  quote: QuoteWithRelations,
): Promise<string> {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const data = computeRenderData(quote);

  return (
    template
      .replace(/\{\{client_name\}\}/g, escapeHtml(data.clientName))
      .replace(/\{\{project_title\}\}/g, escapeHtml(data.projectTitle))
      .replace(/\{\{tagline\}\}/g, escapeHtml(data.tagline))
      // DOM-level injection: swap the hardcoded Marfa sections for data-driven HTML
      .replace(UITDAGING_PATTERN, buildUitdagingHtml(data))
      .replace(AANPAK_PATTERN, buildAanpakHtml(data))
      .replace(PRICING_TABLE_PATTERN, buildPricingTableHtml(data))
      .replace(SCOPE_PATTERN, buildScopeHtml(data))
  );
}

function computeRenderData(quote: QuoteWithRelations) {
  const netto = quote.lines.reduce((sum, l) => sum + l.uren * l.tarief, 0);
  const btw = netto * (quote.btwPercentage / 100);
  const bruto = netto + btw;
  return {
    clientName: quote.prospect.companyName ?? quote.prospect.slug,
    projectTitle: quote.onderwerp,
    tagline: quote.tagline ?? '',
    introductie: quote.introductie ?? '',
    uitdaging: quote.uitdaging ?? '',
    aanpak: quote.aanpak ?? '',
    lines: quote.lines,
    totals: { netto, btw, bruto },
    scope: quote.scope ?? '',
    buitenScope: quote.buitenScope ?? '',
    nummer: quote.nummer,
    geldigTot: quote.geldigTot,
    btwPercentage: quote.btwPercentage,
  };
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

// Patterns capture the entire Marfa-hardcoded block between marker comments,
// so the substitution is resilient to whitespace changes.
const UITDAGING_PATTERN = /<!-- PAGINA 2[\s\S]*?(?=<!-- PAGINA 3)/;
const AANPAK_PATTERN = /<!-- PAGINA 3[\s\S]*?(?=<!-- PAGINA 4)/;
const PRICING_TABLE_PATTERN = /<!-- PAGINA 4[\s\S]*?(?=<!-- PAGINA 5)/;
const SCOPE_PATTERN = /<!-- PAGINA 5[\s\S]*?<\/div>\s*$/;

function buildUitdagingHtml(
  data: ReturnType<typeof computeRenderData>,
): string {
  return `<!-- PAGINA 2 (data-driven) -->
  <div class="a4-page a4-inner">
    <div class="section-label"><span class="num">[ 01 ]</span> DE UITDAGING</div>
    <p class="intro-lead">${escapeHtml(data.introductie)}</p>
    <p class="text-body">${escapeHtml(data.uitdaging).replace(/\n\n/g, '</p><p class="text-body">')}</p>
    <div class="inner-footer">
      <span>Klarifai x ${escapeHtml(data.clientName)}</span>
      <span>Pagina 2</span>
    </div>
  </div>`;
}

// ... (analogous builders for aanpak, pricing table, scope)
```

### `components/features/quotes/quote-line-row.tsx` — single row sub-component

```typescript
'use client';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type { LineDraft } from '@/components/features/quotes/quote-form';

interface Props {
  line: LineDraft;
  onChange: (patch: Partial<LineDraft>) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export function QuoteLineRow({ line, onChange, onUp, onDown, onRemove, disabled, isFirst, isLast }: Props) {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <button type="button" onClick={onUp} disabled={disabled || isFirst} className="p-1 disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDown} disabled={disabled || isLast} className="p-1 disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <input
            className="input-minimal col-span-2"
            placeholder="Fase (bv. Discovery & architectuur)"
            value={line.fase}
            onChange={(e) => onChange({ fase: e.target.value })}
            disabled={disabled}
          />
          <input
            type="number"
            className="input-minimal"
            placeholder="Uren"
            value={line.uren}
            onChange={(e) => onChange({ uren: Number(e.target.value) || 0 })}
            disabled={disabled}
          />
          <input
            type="number"
            // SIGNED — negative allowed for discount lines (Pitfall 5 from Phase 60)
            className="input-minimal"
            placeholder="Tarief per uur (€)"
            value={line.tarief}
            onChange={(e) => onChange({ tarief: Number(e.target.value) || 0 })}
            disabled={disabled}
          />
          <textarea
            className="input-minimal col-span-2"
            rows={2}
            placeholder="Omschrijving"
            value={line.omschrijving}
            onChange={(e) => onChange({ omschrijving: e.target.value })}
            disabled={disabled}
          />
          <input
            className="input-minimal col-span-2"
            placeholder="Oplevering (wat krijgt de klant aan het einde?)"
            value={line.oplevering}
            onChange={(e) => onChange({ oplevering: e.target.value })}
            disabled={disabled}
          />
        </div>
        <button type="button" onClick={onRemove} disabled={disabled} className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-30">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach (elsewhere in ecosystem) | Current Approach in Qualifai admin            | Impact                                           |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| react-hook-form for every form        | Plain controlled `useState` + server-side Zod | Smaller bundle, faster to ship; Phase 61 matches |
| shadcn/ui Dialog + Radix primitives   | Plain Tailwind divs + z-index layer           | No dependency introduction mid-project           |
| Server Components + `createCaller`    | Client Components + `useQuery` hooks          | Only pattern in the repo; no refactor needed     |
| useFieldArray for dynamic lists       | `useState<Item[]>` + immutable update helpers | Enough for 3-10 items; no library                |

## Preview Template Strategy

**Decision (locked by the prompt):** Phase 61's admin preview iframe reuses `klarifai-core/docs/design/proposal-template.html` verbatim as reference material. Phase 62 replaces it with the new web voorstel per Q14, at which point this temporary use retires.

**Substitution implementation:** Hybrid — simple token replace for the cover page, structural block replace for the inner pages.

### Step 1: Copy the template into Qualifai

- Source: `klarifai-core/docs/design/proposal-template.html` (658 lines, committed 2026-04-12).
- Destination: `lib/quotes/proposal-template.html` (committed into Qualifai for Vercel bundling).
- One-shot copy; add a note to CLAUDE.md memory that this is temporary Phase 61 reference and will be deleted in Phase 62.

### Step 2: Token substitution map

The template has three categories of dynamic content:

**Category A — Real `{{placeholder}}` tokens (4 total):**

| Token               | Location   | Source (from Quote + relations)                     |
| ------------------- | ---------- | --------------------------------------------------- |
| `{{client_name}}`   | cover page | `quote.prospect.companyName ?? quote.prospect.slug` |
| `{{project_title}}` | cover page | `quote.onderwerp`                                   |
| `{{tagline}}`       | cover page | `quote.tagline ?? ''`                               |

Simple `.replace(/\{\{client_name\}\}/g, escapeHtml(data.clientName))`.

**Category B — Hardcoded Marfa content that must be structurally replaced:**

| Section                                                                                                     | Lines in template | Phase 61 behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page 2 (DE UITDAGING) — the `h2`, `intro-lead`, `text-body`, and `<ol class="numbered-list">` pillar blocks | ~402-451          | Swap the entire page 2 div with a data-driven version. Use `quote.introductie` as the lead paragraph, `quote.uitdaging` as the body (split on `\n\n` into `<p class="text-body">` blocks). Drop the pillar list — narrative fields replace it.                                                                                                                                                                                                                                                                                         |
| Page 3 (ONZE AANPAK) — phase list `<ol class="numbered-list">`                                              | ~453-526          | Swap the phase blocks with one `<li>` per QuoteLine, showing `fase`, `omschrijving`, `oplevering`, and `uren` in the existing markup. Use `quote.aanpak` as the lead-in narrative above the list.                                                                                                                                                                                                                                                                                                                                      |
| Page 4 (INVESTERING) — the hardcoded pricing `<tbody>` + totals block                                       | ~528-610          | Build a fresh `<tbody>` from `quote.lines` (fase, uren, tarief, uren*tarief). Format currency with `Intl.NumberFormat('nl-NL', {style:'currency', currency: 'EUR'})`. Totals block: `netto = sum(uren*tarief)`, `btw = netto \* btwPercentage/100`, `bruto = netto + btw`— same formula as`buildSnapshotFromQuote`in the state machine (do NOT drift; extract to`lib/quotes/quote-totals.ts`and share if possible). Also swap`2026-OFF003`hardcoded ref for`quote.nummer`and "10 mei 2026" hardcoded valid-until for`quote.geldigTot`. |
| Page 5 (SCOPE & AFSLUITING) — in-scope and buiten-scope `<ul>` lists                                        | ~612-650          | Parse `quote.scope` and `quote.buitenScope` by splitting on `\n` → one `<li>` per line. If either is empty, show a grayed-out "Nog niet ingevuld" placeholder so the preview is obviously DRAFT.                                                                                                                                                                                                                                                                                                                                       |

**Category C — Brand-fixed content that stays verbatim:**

- Klarifai logo SVG (cover page, baked into the template).
- Font import `@import url('https://fonts.googleapis.com/css2?family=Sora:...')` — keep as-is; the iframe src route means the browser fetches it normally.
- Footer line `Klarifai · Le Mairekade 77, 1013CB Amsterdam · KvK 95189335 · BTW NL005136262B35` — hardcoded, stays.
- Inner-footer "Klarifai x {clientname}" text — substitute `clientname` alongside the cover tokens.

### Step 3: Iframe wiring

```typescript
// components/features/quotes/quote-preview-iframe.tsx
'use client';
import { useMemo } from 'react';
import { ADMIN_TOKEN_STORAGE_KEY } from '@/lib/admin-token';

export function QuotePreviewIframe({ quoteId }: { quoteId: string }) {
  const src = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '';
    return `/admin/quotes/${quoteId}/preview.html?token=${encodeURIComponent(token)}`;
  }, [quoteId]);

  if (!src) return <div className="glass-card p-8 text-center">Laden...</div>;
  return (
    <div className="glass-card p-4">
      <iframe
        src={src}
        className="w-full h-[80vh] rounded-xl border border-slate-100"
        sandbox="allow-same-origin allow-scripts allow-popups"
        title="Offerte voorbeeld"
      />
      <p className="mt-2 text-xs text-slate-400">
        Tijdelijke voorbeeldrenderer (Phase 61). De nieuwe web-voorstel ervaring komt in Phase 62.
      </p>
    </div>
  );
}
```

### Step 4: Testing the preview

- Unit test `renderQuotePreview(quoteFixture)` with a known quote → assert specific substrings appear/disappear (`{{client_name}}` must be gone, the computed `bruto` must match the YAML-verified totals €7816.60 / €11495.00 / €13285.80 for the three Marfa quotes).
- Manual Playwright test: navigate to `/admin/quotes/<marfa-off003>` → click preview tab → assert iframe is present → assert iframe contentDocument contains "€ 13.285,80" text somewhere.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Framework          | Vitest 4.0.18 (unit/integration) + Playwright (e2e, `e2e/` directory is empty but configured) |
| Config file        | `vitest.config.ts` + `playwright.config.ts`                                                   |
| Quick run command  | `npm run test -- <pattern> --run`                                                             |
| Full suite command | `npm run test -- --run`                                                                       |
| Type check         | `npx tsc --noEmit`                                                                            |

**Existing Phase 60 test baseline:** 46 tests across 6 files (prospect state machine 7, quote state machine 12, quote-snapshot schema 8, quotes router 7, import script 7, prospect-statuses 5). Phase 61 adds roughly 10-15 new tests on top.

### Phase Requirements → Test Map

| Req ID   | Behavior                                                                                   | Test Type               | Automated Command                                                                 | File Exists?                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ADMIN-01 | list endpoint returns quotes grouped by status for active project                          | unit (existing)         | `npm run test -- server/routers/quotes.test.ts --run`                             | ✅ (existing coverage from 60-04 — TEST-03 already covers this. Phase 61 adds NO backend test unless the router changes)                                                                               |
| ADMIN-01 | list page renders all quotes grouped                                                       | e2e/manual (Playwright) | `npm run test:e2e -- e2e/admin-quotes-list.spec.ts`                               | ❌ Wave 0 — create `e2e/admin-quotes-list.spec.ts`                                                                                                                                                     |
| ADMIN-02 | create page calls `quotes.create` with correct input                                       | unit                    | `npm run test -- components/features/quotes/quote-form.test.tsx --run`            | ❌ Wave 0 — create the test file. Render the `<QuoteForm>` component, fire change events, click submit, assert tRPC mutation was called with the right payload (mock `api.quotes.create.useMutation`). |
| ADMIN-02 | end-to-end create + redirect to detail                                                     | e2e (Playwright)        | `npm run test:e2e -- e2e/admin-quote-create.spec.ts`                              | ❌ Wave 0                                                                                                                                                                                              |
| ADMIN-03 | add/reorder/remove line items produces correct state                                       | unit                    | `npm run test -- components/features/quotes/quote-line-list.test.tsx --run`       | ❌ Wave 0 — pure state manipulation, no tRPC; easiest test to write                                                                                                                                    |
| ADMIN-03 | negative tarief survives round-trip                                                        | integration             | `npm run test -- components/features/quotes/quote-form.test.tsx --run`            | ❌ Wave 0 — include a test case that sets tarief to -800 and asserts mutation payload                                                                                                                  |
| ADMIN-04 | `renderQuotePreview(quote)` produces expected substring + correct totals                   | unit                    | `npm run test -- lib/quotes/preview-template.test.ts --run`                       | ❌ Wave 0 — pure function, no React; highest-value test; must assert all 3 Marfa quote totals (€7.816,60 / €11.495,00 / €13.285,80)                                                                    |
| ADMIN-04 | iframe loads from `/admin/quotes/[id]/preview.html` route and contains expected content    | e2e                     | `npm run test:e2e -- e2e/admin-quote-preview.spec.ts`                             | ❌ Wave 0                                                                                                                                                                                              |
| ADMIN-05 | clicking Verstuur calls `quotes.transition({id, newStatus: 'SENT'})`                       | unit                    | `npm run test -- components/features/quotes/quote-send-confirm.test.tsx --run`    | ❌ Wave 0 — mock the tRPC mutation, assert call args, assert no snapshotData in the payload                                                                                                            |
| ADMIN-05 | state machine DRAFT→SENT freezes snapshot + syncs prospect                                 | unit (existing)         | `npm run test -- lib/state-machines/quote.test.ts --run`                          | ✅ (shipped 60-04)                                                                                                                                                                                     |
| ADMIN-05 | prospect in non-ENGAGED status blocks transition gracefully                                | unit (new)              | `npm run test -- lib/state-machines/quote.send-from-draft.test.ts --run`          | ❌ Wave 0 — covers Pitfall 7; must document which prospect source-statuses are compatible with QUOTE_SENT                                                                                              |
| ADMIN-06 | status timeline component renders 4 slots from a Quote with known timestamps               | unit                    | `npm run test -- components/features/quotes/quote-status-timeline.test.tsx --run` | ❌ Wave 0                                                                                                                                                                                              |
| ADMIN-07 | form disables all inputs and hides save when status != DRAFT                               | unit                    | `npm run test -- components/features/quotes/quote-form.test.tsx --run`            | ❌ Wave 0 — fold into the main form test                                                                                                                                                               |
| ADMIN-07 | router rejects update on SENT (existing)                                                   | unit (existing)         | `npm run test -- server/routers/quotes.test.ts --run`                             | ✅                                                                                                                                                                                                     |
| ADMIN-08 | `quotes.createVersion` (NEW router mutation) clones + archives original in one transaction | unit (new)              | `npm run test -- server/routers/quotes.test.ts --run`                             | ❌ Wave 0 — extend existing file with a new describe block                                                                                                                                             |
| ADMIN-08 | UI "Nieuwe versie" flow hits the new mutation                                              | unit                    | `npm run test -- components/features/quotes/quote-version-confirm.test.tsx --run` | ❌ Wave 0                                                                                                                                                                                              |

**Manual-only validation (Playwright optional, else manual by Romano):**

- Visual parity of the preview iframe with the klarifai-core template (pixel-accurate check is a human job).
- End-to-end "create a quote from scratch, preview, send, see it flip to SENT" smoke test — Romano runs this once at the phase gate.

### Sampling Rate

- **Per task commit:** `npm run test -- <files touched> --run` + `npx tsc --noEmit` (scoped)
- **Per wave merge:** `npm run test -- lib/quotes lib/state-machines server/routers/quotes components/features/quotes --run` (the "Phase 61 scoped suite")
- **Phase gate:** `npm run test -- --run` (full suite, 46 Phase 60 tests + ~12 new Phase 61 tests) + `npm run lint` + `npx tsc --noEmit` + 1 manual Playwright run

### Wave 0 Gaps

- [ ] `lib/quotes/proposal-template.html` — copy from klarifai-core (structural file, not a test)
- [ ] `lib/quotes/preview-template.ts` — renderQuotePreview + helpers
- [ ] `lib/quotes/preview-template.test.ts` — unit tests covering all 3 Marfa quote totals + token substitution
- [ ] `lib/quotes/quote-totals.ts` — shared totals math (extract from state machine if possible to avoid drift)
- [ ] `components/features/quotes/quote-form.tsx` — shared create/update form
- [ ] `components/features/quotes/quote-form.test.tsx` — render, fire events, assert mutation payload
- [ ] `components/features/quotes/quote-line-row.tsx` — single row sub-component
- [ ] `components/features/quotes/quote-line-list.tsx` — dynamic list with add/reorder/remove
- [ ] `components/features/quotes/quote-line-list.test.tsx` — state manipulation tests
- [ ] `components/features/quotes/quote-status-badge.tsx`
- [ ] `components/features/quotes/quote-status-timeline.tsx`
- [ ] `components/features/quotes/quote-status-timeline.test.tsx`
- [ ] `components/features/quotes/quote-preview-iframe.tsx`
- [ ] `components/features/quotes/quote-send-confirm.tsx`
- [ ] `components/features/quotes/quote-send-confirm.test.tsx`
- [ ] `components/features/quotes/quote-version-confirm.tsx`
- [ ] `components/features/quotes/quote-version-confirm.test.tsx`
- [ ] `app/admin/quotes/page.tsx`
- [ ] `app/admin/quotes/[id]/page.tsx`
- [ ] `app/admin/quotes/[id]/preview.html/route.ts`
- [ ] `app/admin/prospects/[id]/quotes/new/page.tsx`
- [ ] `server/routers/quotes.ts` — **extend** with `createVersion` mutation (Pitfall 3 gap)
- [ ] `server/routers/quotes.test.ts` — extend the describe with createVersion coverage
- [ ] `lib/state-machines/quote.send-from-draft.test.ts` — additional coverage for prospect-status compatibility (Pitfall 7)
- [ ] Sidebar update in `app/admin/layout.tsx` — add "Quotes" nav item between "Campaigns" and "Draft Queue"
- [ ] `e2e/admin-quote-create.spec.ts`, `e2e/admin-quotes-list.spec.ts`, `e2e/admin-quote-preview.spec.ts` — optional Playwright specs; the `e2e/` directory is empty so any e2e test is net-new infrastructure. If Romano wants to skip e2e for speed, document in plan that ADMIN-01/04 have manual-only validation, OK for Phase 61.

**Framework install:** None needed — Vitest + Playwright already configured.

## Open Questions (Romano's input needed before planning)

### O1 — `nummer` auto-generation format

**What we know:** klarifai-core uses `2026-OFF001`, `2026-OFF002`, `2026-OFF003` (year + prefix + 3-digit sequence). The Qualifai `quotes.create` Zod input accepts `nummer: z.string().min(1)` — not auto-generated.
**What's unclear:** Should Phase 61 (a) ask the admin to type the number, (b) auto-suggest the next one in series (e.g. query `prisma.quote.findFirst({orderBy: {nummer: 'desc'}})` and increment), or (c) generate invisibly on submit?
**Recommendation:** Option (b) — server-side `suggestNextQuoteNumber()` helper queries the current max and returns e.g. `2026-OFF004`, the form prefills it, the admin can override. Auto-suggestion is the sane default; Romano's control is preserved via editability.

### O2 — Default `btw_percentage`

**What we know:** All 3 Marfa quotes in klarifai-core YAML use `btw_percentage: 21`. The Prisma column is `Int` (so 21, not 0.21).
**What's unclear:** Hardcode 21 as the form default, or read from Project settings?
**Recommendation:** Hardcode `21` as the form default constant `DEFAULT_BTW_PERCENTAGE = 21` in `lib/quotes/constants.ts`. Dutch BTW standard rate is 21%. Add a TODO comment "move to Project.defaultBtwPercentage when multi-brand ships".

### O3 — Status grouping on `/admin/quotes`

**What we know:** ADMIN-01 says "grouped by status". `quotes.list` returns all quotes with `status` on each row.
**What's unclear:** Tab bar (DRAFT | SENT | ARCHIVED)? Sections stacked vertically (DRAFT first, then SENT, then ARCHIVED)? Chip filters at the top with a single unified list below?
**Recommendation:** Stacked sections — mirror the prospect pipeline stage filter pattern from `app/admin/prospects/page.tsx:43-61`. Each status group is a `<section>` with a heading + count + collapsible content. DRAFT on top (needs attention), SENT in the middle (waiting), ARCHIVED at the bottom (collapsed by default). Reusing the existing `admin-toggle-group` pattern is also acceptable if Romano prefers tabs.

### O4 — Quote detail page URL shape

**What we know:** Quotes are always scoped to a Prospect. ADMIN-04 and ADMIN-05 target "a DRAFT quote" without specifying URL.
**What's unclear:** `/admin/quotes/[id]` (flat) or `/admin/prospects/[id]/quotes/[quoteId]` (nested)?
**Recommendation:** **Hybrid.** Creation is nested at `/admin/prospects/[id]/quotes/new` (ADMIN-02 mandates this URL). Detail + edit is flat at `/admin/quotes/[id]` for shareability and brevity. The detail page shows a breadcrumb back to the parent prospect. List lives at `/admin/quotes`. This mirrors how `/admin/outreach` + `/admin/prospects/[id]` currently share draft views.

### O5 — "Nieuwe versie" button location

**What we know:** ADMIN-08 says archive + create new version.
**What's unclear:** Button only on SENT quote detail? Also on list row? Inside a `...` more menu?
**Recommendation:** On the detail page only, inside a "Acties" group near the status badge, visible when `status in ['SENT', 'VIEWED']` (the most common cases where a revision is needed; REJECTED probably means dead prospect, EXPIRED means start over). A confirm modal must appear before the transaction fires.

### O6 — Confirm modal before "Verstuur"

**What we know:** ADMIN-05 says "Admin can transition quote from DRAFT → SENT via a button that triggers snapshot creation".
**What's unclear:** Single-click or confirm-modal?
**Recommendation:** Required confirm modal. Content: "Je staat op het punt deze offerte te versturen. Na versturen kun je de offerte niet meer aanpassen. Totaal: €13.285,80. Weet je het zeker?" with primary "Verstuur definitief" + secondary "Annuleren". The action is irreversible (no UNSEND, Q9 is explicit — only path back is archive + new version), so the friction is justified.

### O7 — Auto-save vs manual save

**What we know:** ADMIN-02 and ADMIN-07 say "Admin can create" / "Admin can edit DRAFT freely".
**What's unclear:** Auto-save on blur / debounced / explicit save button?
**Recommendation:** Explicit "Opslaan" button + dirty indicator. The rest of the admin is explicit-save — staying consistent. Add an unsaved-changes warning on navigation away (beforeunload) if the dirty state is non-trivial.

### O8 — Sidebar nav item placement

**What we know:** `NavItem[]` in `app/admin/layout.tsx:244` has 6 items. Quotes must show up somewhere.
**What's unclear:** Placement + icon?
**Recommendation:** Insert between "Campaigns" (FolderKanban) and "Draft Queue" (Mail), label "Voorstellen" (Dutch matches the rest), icon `FileText` from Lucide. Phase 61 updates the shell file directly.

### O9 — Prospect status pre-condition (Pitfall 7)

**What we know:** `transitionQuote(SENT)` cascades to `Prospect.status = QUOTE_SENT` via `assertValidProspectTransition`. The prospect state machine may or may not accept `READY → QUOTE_SENT`, `DRAFT → QUOTE_SENT`, etc.
**What's unclear:** Which prospect source-statuses are compatible? The planner needs to read `lib/state-machines/prospect.ts` and enumerate, then decide if Phase 61 must either (a) disable the Verstuur button for incompatible statuses, (b) extend the state machine to widen allowed sources, or (c) swallow the error with a friendly message.
**Recommendation:** Read the prospect state machine during planning; if multiple source-statuses are blocked, extend it (low risk — Phase 60 owner) rather than adding UI guards per-case. Document the final decision in the Phase 61 plan.

### O10 — Unit for `tarief`

**What we know:** Prisma says `Int`; klarifai-core YAML uses euro units (e.g. `95` = €95/hour); OFF003 Pakketkorting is `-800` (euro).
**What's unclear:** Does the form store cents or euros? The prompt says "fill in tarief" (unspecified). The snapshot builder in `buildSnapshotFromQuote` treats `uren * tarief` as currency with no unit conversion — whatever unit tarief has, totals are in the same unit.
**Recommendation:** Store in **euros as integer** (matching klarifai-core YAML and the existing Marfa fixtures). Document this decision in the Phase 61 plan. Currency formatter divides/multiplies by nothing; the integer is the euro amount. If cent precision becomes needed later, migrate to cents as a breaking change — not in Phase 61.

## Sources

### Primary (HIGH confidence)

- `app/admin/layout.tsx` (396 lines) — full admin shell, auth, sidebar, NavItem pattern
- `app/admin/prospects/new/page.tsx` (258 lines) — canonical new-entity form pattern
- `app/admin/prospects/[id]/page.tsx` (1-180 read) — tabs + Prisma type extraction + tRPC v11 cast pattern
- `app/admin/prospects/page.tsx` (1-120 read) — list with toggle/filter
- `components/providers.tsx` (81 lines) — tRPC client wiring, admin-token header injection
- `components/features/prospects/source-set-section.tsx` (1-80 read) — `utils.useUtils().invalidate()` mutation pattern
- `server/routers/quotes.ts` (248 lines) — the router Phase 61 consumes. CRITICAL: `update` input omits status/snapshot/replacesId; `create` input omits `replacesId` (gap for ADMIN-08)
- `server/trpc.ts` (83 lines) — `projectAdminProcedure` enforces multi-tenant scope
- `lib/schemas/quote-snapshot.ts` (89 lines) — `QuoteSnapshotSchema`, `parseSnapshot`, `getSnapshotField`
- `lib/state-machines/quote.ts` (179 lines) — `transitionQuote`, `buildSnapshotFromQuote`, `VALID_QUOTE_TRANSITIONS`, `QUOTE_TO_PROSPECT_SYNC`. CRITICAL: state machine owns the snapshot; UI does not touch it
- `klarifai-core/docs/design/proposal-template.html` (658 lines) — the iframe target. Only 4 real `{{tokens}}`; the rest is hardcoded Marfa content that must be structurally replaced
- `klarifai-core/docs/strategy/decisions.md` — Q5/Q9/Q12/Q13/Q14 verbatim (read lines 15-96, 102-250)
- `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/CONVENTIONS.md` (codebase audit, 2026-04-13)
- `.planning/REQUIREMENTS.md` (ADMIN-01..08 block)
- `.planning/ROADMAP.md` (Phase 61 section)
- `.planning/STATE.md` (Phase 60 status)
- `.planning/phases/60-quote-schema-foundation/60-02-SUMMARY.md`, `60-03-SUMMARY.md`, `60-04-SUMMARY.md`, `60-05-SUMMARY.md`

### Secondary (MEDIUM confidence)

- `klarifai-core/docs/design/writing-style.md` (existence confirmed, content not loaded — planner should peek when writing form placeholder copy)
- `package.json` grepped for `react-hook-form|shadcn|radix|cmdk|sonner` — zero matches, confirming the stack minimalism

### Tertiary (LOW confidence — flag for validation)

- None. All claims in this document are traceable to files in the two repos read during research, or to the prompt itself.

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — all packages verified in package.json, patterns verified in existing admin source
- **Architecture:** HIGH — matches existing admin convention verbatim
- **Pitfalls:** HIGH for Pitfalls 1, 2, 3, 5, 6 (all traceable to source files); MEDIUM for Pitfall 7 (needs `lib/state-machines/prospect.ts` deep-read during planning); MEDIUM for Pitfall 8 (Vercel behaviour assumed from standard Next.js semantics)
- **Preview template strategy:** HIGH — direct read of the 658-line template; the only open dimension is whether the planner wants regex-based structural substitution (recommended here) or a cheerio/HTML parser (acceptable alternative, adds no dependency since cheerio would be new)
- **Validation architecture:** HIGH — Vitest + Playwright already configured; test targets are concrete
- **Open questions:** HIGH — each question has a concrete recommendation and a reason; Romano can answer them during `/gsd:plan-phase` kickoff

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stack is stable; only risk is if tRPC v11 gets a minor patch that changes inference behavior, in which case Pitfall 5 guidance may become unnecessary)
