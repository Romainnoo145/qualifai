# Technology Stack — v2.0 UX Redesign (Admin Oversight Console)

**Project:** Qualifai — v2.0 milestone additions
**Researched:** 2026-02-22
**Scope:** NEW capabilities only. Existing validated stack (Next.js 16, tRPC 11, Prisma 7, PostgreSQL, Anthropic Claude SDK, Apollo API, SerpAPI, Crawl4AI, Resend, Cal.com, Zod 4, Tailwind 4, Framer Motion 12, TanStack Query 5, Lucide React, Playwright in devDependencies) is NOT re-researched here.
**Confidence:** HIGH for areas verified with multiple sources, MEDIUM for version pinning.

---

## Capability Area 1: Prospect Pipeline Stage Management

### Decision: No State Machine Library — Use TypeScript Enums + useReducer

**Recommendation:** Skip XState entirely for pipeline stage management. Use the existing `ProspectStatus` Prisma enum directly.

**Rationale:**

The Prisma schema already defines the pipeline as an explicit state machine:

```
ProspectStatus: DRAFT → ENRICHED → GENERATING → READY → SENT → VIEWED → ENGAGED → CONVERTED → ARCHIVED
```

XState v5 (`xstate@5.28.0`, `@xstate/react@6.0.0`) is the right tool when you have:

- Guards (conditional transitions)
- Parallel states
- Machine-level side effects
- Visualisation requirements for complex flows

For Qualifai's pipeline, transitions are linear and server-authoritative — the DB is the source of truth, not client-side state. The admin console just needs to reflect current DB state and trigger mutations. XState would add ~60KB to the bundle and significant conceptual overhead for what is essentially a read-and-mutate pattern.

**What to use instead:**

```typescript
// ProspectStatus already defined in Prisma schema — re-export from there
// For UI-local state during transitions:
type PipelineAction =
  | { type: 'APPROVE'; prospectId: string }
  | { type: 'REJECT'; prospectId: string }
  | { type: 'SEND'; prospectId: string };

// useReducer for local multi-step UI states (e.g. confirm → sending → done)
// tRPC mutation for all actual state changes (server is authoritative)
```

**When to reconsider XState:** If v3.0 adds branching workflows (e.g. conditional paths based on prospect industry), multi-step approval flows with rollback, or a visual workflow editor — then XState is correct.

**Confidence:** HIGH — architectural decision based on codebase inspection + evidence that XState overhead is unjustified for linear server-driven pipelines.

---

## Capability Area 2: Optimistic UI for One-Click Queue Actions

### Decision: TanStack Query v5 Variables Approach (Already Installed)

**Recommendation:** No new packages. Use the `variables` approach from `useMutation` already available in `@tanstack/react-query@^5.59.15`.

**Two available approaches in TanStack Query v5:**

| Approach                                  | When to Use                                                         | Complexity                           |
| ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| `mutation.variables` + conditional render | Single location on screen shows optimistic state                    | Low — no rollback logic needed       |
| `onMutate` + cache manipulation           | Multiple components need to see the optimistic state simultaneously | Medium — requires `onError` rollback |

**For Qualifai's approval queue, use the variables approach:**

```typescript
// In the queue component:
const approveHypothesis = api.hypotheses.approve.useMutation()

// Optimistic: show "Approved" immediately while mutation is pending
const isOptimisticallyApproved =
  approveHypothesis.isPending &&
  approveHypothesis.variables?.id === hypothesis.id

return (
  <button
    onClick={() => approveHypothesis.mutate({ id: hypothesis.id })}
    disabled={approveHypothesis.isPending}
    className={isOptimisticallyApproved ? 'opacity-50' : ''}
  >
    {isOptimisticallyApproved ? 'Approving...' : 'Approve'}
  </button>
)
```

For the send queue where multiple components watch the same mutation state, use `useMutationState` with a `mutationKey`:

```typescript
// Sender component
api.outreach.send.useMutation({ mutationKey: ['send-outreach'] });

// Any component elsewhere in the tree:
const pendingSends = useMutationState({
  filters: { mutationKey: ['send-outreach'], status: 'pending' },
  select: (m) => m.state.variables,
});
```

**Integration with tRPC:** tRPC mutations are thin wrappers around React Query — `variables`, `isPending`, `isError`, `onMutate`, `onError` all work exactly as in vanilla React Query. No adapter layer needed.

**Confidence:** HIGH — TanStack Query v5 optimistic update docs verified via search, tRPC v11 + React Query v5 integration confirmed in existing codebase.

---

## Capability Area 3: Queue Update Freshness (Polling vs Real-Time)

### Decision: Polling with refetchInterval — No New Infrastructure

**Recommendation:** Use `refetchInterval` on existing tRPC `useQuery` calls. No WebSocket, no SSE, no additional packages.

**Rationale for polling over SSE/WebSocket:**

| Option                    | Setup Cost                                                            | Infra Change                    | Right For                               |
| ------------------------- | --------------------------------------------------------------------- | ------------------------------- | --------------------------------------- |
| `refetchInterval: 10_000` | Zero — one option in useQuery                                         | None                            | Admin oversight console, single user    |
| tRPC SSE subscriptions    | New httpSubscriptionLink in client config, new subscription procedure | Possibly a separate HTTP server | Multi-user realtime collaborative tools |
| WebSockets                | Separate WS server (or next-ws), ws upgrade handling                  | Significant                     | Chat, live cursors, gaming              |

Qualifai's admin console has one user checking queues. A 10-second poll is indistinguishable from real-time for this use case and adds zero infrastructure. tRPC does support SSE subscriptions natively (example repo: `trpc/examples-next-sse-chat`), but the operational overhead is not justified here.

**Implementation pattern:**

```typescript
// Dashboard queue query — refreshes every 10 seconds
const { data: pendingHypotheses } = api.hypotheses.listPending.useQuery(
  undefined,
  {
    refetchInterval: 10_000,
    // Stop polling when window is not focused (user not looking)
    refetchIntervalInBackground: false,
  },
);

// During active research jobs, poll more aggressively
const { data: researchStatus } = api.research.status.useQuery(
  { prospectId },
  {
    // Poll every 3s while GENERATING, stop when READY
    refetchInterval: (query) =>
      query.state.data?.status === 'GENERATING' ? 3_000 : false,
  },
);
```

**When to upgrade:** If v3.0 adds real-time collaboration (multiple admin users), or if webhook-triggered instant updates become a requirement, switch to tRPC SSE subscriptions. The architectural path is already documented in the tRPC v11 subscriptions docs.

**Confidence:** HIGH — refetchInterval is a first-class TanStack Query v5 feature, confirmed active in search results and official docs. Pattern is already used in this project for other queries.

---

## Capability Area 4: Drag-and-Drop / Queue Reordering

### Decision: framer-motion Reorder (Already Installed) for Simple Lists; dnd-kit for Cross-Column

**Recommendation:** Start with `framer-motion@^12.29.2` `Reorder` component (already installed). Add `@dnd-kit/core` + `@dnd-kit/sortable` only if cross-column drag (pipeline kanban) is required.

**framer-motion Reorder — what it handles well:**

- Single-column queue reordering (e.g. prioritising items in the Draft Queue)
- Built-in layout animation when items are added/removed
- Zero additional installation cost — already in `package.json`
- Scroll-aware (container scrolls when dragging to edges)

**framer-motion Reorder — hard limits:**

- No drag between columns (e.g. dragging a prospect from "Ready" to "Sent" column)
- No multi-row sortable grids
- No keyboard-accessible drag (WCAG non-compliant for complex interactions)

**When to add dnd-kit:**

If the prospect pipeline view becomes a kanban board where the admin drags prospects between stages, add:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

| Package              | Version   | Purpose                                   |
| -------------------- | --------- | ----------------------------------------- |
| `@dnd-kit/core`      | `^6.3.1`  | DnD context, sensors, collision detection |
| `@dnd-kit/sortable`  | `^10.0.0` | Sortable preset (list + grid)             |
| `@dnd-kit/utilities` | latest    | CSS transform helpers                     |

dnd-kit works alongside framer-motion without conflict — dnd-kit handles drag logic, framer-motion handles entry/exit animations on the items.

**Keyboard navigation for queue (without drag-drop):** Standard HTML `tabIndex`, `onKeyDown` handlers with arrow key navigation are sufficient for the approval queue use case. No additional library needed. The queue items already use Tailwind and Lucide icons — add `role="list"` / `role="listitem"` + `aria-label` to make it screen-reader-friendly.

**Confidence:** HIGH for framer-motion Reorder (official docs, already installed). MEDIUM for dnd-kit version pins (npm search confirmed `@dnd-kit/core@6.3.1` and `@dnd-kit/sortable@10.0.0` as latest as of research date — verify before installing).

---

## Capability Area 5: Pipeline / Funnel Visualization

### Decision: Tailwind CSS Column Layout — No Chart Library

**Recommendation:** Build the pipeline view as a custom Tailwind grid/flex layout with `ProspectStatus` counts. Do not add Chart.js, Recharts, or Nivo.

**Rationale:**

The v2.0 pipeline view is an oversight console — the admin needs to see "how many prospects are in each stage" and click into filtered lists. This is a count display with navigation, not data visualization requiring axes, tooltips, or animations.

A `grid-cols-8` (one column per ProspectStatus value) with a card per stage is:

- Zero new dependencies
- Fully styleable with existing Tailwind + `glass-card` design system
- Faster to build and easier to maintain
- Already consistent with the existing compact UI preference

**What a "chart library" would add for this use case:** nothing except a bar chart that looks like a Tailwind column layout anyway.

**If actual analytics are needed (v3.0+):** `recharts` is the standard choice for React — it is tree-shakeable, TypeScript-native, and integrates well with TanStack Query data. But do not add it now.

**Implementation pattern:**

```typescript
// Pipeline counts from existing tRPC query
const { data: counts } = api.prospects.statusCounts.useQuery();

const stages: { status: ProspectStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Ingevoerd' },
  { status: 'ENRICHED', label: 'Verrijkt' },
  { status: 'READY', label: 'Klaar' },
  { status: 'SENT', label: 'Verstuurd' },
  { status: 'VIEWED', label: 'Bekeken' },
  { status: 'ENGAGED', label: 'Betrokken' },
  { status: 'CONVERTED', label: 'Gewonnen' },
];

// Render as overflow-x-auto scrollable row of stage cards
// Each card: stage label + count badge + click → filtered company list
```

**Confidence:** HIGH — this is a deliberate "less is more" recommendation based on requirements analysis. No library needed.

---

## Summary: What to Install vs. What to Skip

### Install Only If Building Kanban (Cross-Column Drag)

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Do NOT Install

| Package                                     | Why Not                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `xstate` + `@xstate/react`                  | Pipeline transitions are server-authoritative; useReducer + tRPC mutations is sufficient |
| `recharts` / `chart.js` / `nivo`            | Pipeline view is a count display, not data visualization                                 |
| Any WebSocket library (`ws`, `socket.io`)   | Polling with `refetchInterval` is sufficient for single-user admin console               |
| `@hello-pangea/dnd` / `react-beautiful-dnd` | dnd-kit is the current standard; framer-motion Reorder handles simple cases              |
| `react-flow` / `reactflow`                  | Flow diagram visualization is not needed; pipeline is linear                             |

### Everything Else: Already Installed

| Capability             | Existing Dependency              | What to Use                                             |
| ---------------------- | -------------------------------- | ------------------------------------------------------- |
| Optimistic UI          | `@tanstack/react-query@^5.59.15` | `mutation.variables` + `isPending`                      |
| Polling                | `@tanstack/react-query@^5.59.15` | `refetchInterval` option                                |
| Simple list reordering | `framer-motion@^12.29.2`         | `Reorder.Group` + `Reorder.Item`                        |
| UI animations          | `framer-motion@^12.29.2`         | `AnimatePresence` + `motion.div`                        |
| State typing           | `prisma@^7.3.0`                  | `ProspectStatus` enum re-exported from `@prisma/client` |
| Keyboard navigation    | HTML + React                     | `tabIndex`, `onKeyDown`, ARIA roles                     |

---

## Version Compatibility

| Package                          | Compatible With    | Notes                                          |
| -------------------------------- | ------------------ | ---------------------------------------------- |
| `framer-motion@^12.29.2`         | React 19.2.3       | React 19 compatible confirmed                  |
| `@tanstack/react-query@^5.59.15` | tRPC 11.9.0        | This is exactly what tRPC 11 requires          |
| `@dnd-kit/core@^6.3.1`           | React 19           | Works alongside framer-motion without conflict |
| `@dnd-kit/sortable@^10.0.0`      | `@dnd-kit/core@^6` | Peer dependency satisfied                      |

---

## Alternatives Considered

| Category         | Recommended                   | Alternative              | Why Not                                                                             |
| ---------------- | ----------------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| Pipeline state   | TypeScript enums + useReducer | XState v5                | XState overhead unjustified for server-driven linear pipeline                       |
| Queue updates    | `refetchInterval` polling     | tRPC SSE subscriptions   | SSE requires new transport config; no multi-user need                               |
| Queue reordering | framer-motion `Reorder`       | dnd-kit                  | framer-motion already installed; Reorder handles single-column use case             |
| Pipeline view    | Tailwind custom layout        | recharts bar chart       | Visual requirement is counts + navigation, not charting                             |
| Optimistic UI    | TanStack Query `variables`    | React 19 `useOptimistic` | TanStack Query already integrated with tRPC; mixing `useOptimistic` adds complexity |

---

## Sources

- Codebase inspection: `/home/klarifai/Documents/klarifai/projects/qualifai/package.json` — HIGH confidence (current installed versions)
- Codebase inspection: `prisma/schema.prisma` — HIGH confidence (ProspectStatus enum, OutreachStatus enum)
- TanStack Query v5 optimistic updates: `tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates` — HIGH confidence
- TanStack Query v5 `refetchInterval`: `tanstack.com/query/v5/docs/framework/react/examples/auto-refetching` — HIGH confidence
- framer-motion Reorder docs: `motion.dev/docs/react-reorder` — HIGH confidence (confirmed single-column limitation)
- dnd-kit npm versions: npm search confirmed `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0` — MEDIUM confidence (verify before installing)
- XState v5 npm version `5.28.0`, `@xstate/react@6.0.0`: npm search — MEDIUM confidence
- State management comparison (XState vs Zustand vs useReducer): `makersden.io/blog/react-state-management-in-2025` — MEDIUM confidence (matches training knowledge)
- tRPC subscriptions (SSE): `trpc.io/docs/server/subscriptions` — HIGH confidence (official docs)
- Top 5 DnD libraries 2026: `puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react` — MEDIUM confidence

---

_Stack research for: Qualifai v2.0 UX Redesign — Admin Oversight Console_
_Researched: 2026-02-22_
