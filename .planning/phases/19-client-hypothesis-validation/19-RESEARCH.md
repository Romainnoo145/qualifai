# Phase 19: Client Hypothesis Validation — Research

**Researched:** 2026-02-22
**Domain:** /voor/ client dashboard + tRPC slug-scoped mutation + HypothesisStatus state transitions
**Confidence:** HIGH

---

## Summary

Phase 19 lets prospects confirm or decline each pain-point hypothesis directly on their `/voor/[slug]` dashboard after the first outreach email is sent. The admin sees the result in the Analysis section on the next page load — no admin action required.

The implementation is almost entirely additive: the schema already has `PENDING` and `DECLINED` enum values on `HypothesisStatus` (added in Phase 18). The `/voor/[slug]/page.tsx` already fetches hypotheses with `status: { in: ['ACCEPTED', 'PENDING'] }`. What is missing is: (1) a tRPC mutation that a prospect can call to set a hypothesis to `ACCEPTED` (confirmed) or `DECLINED`, (2) a UI section on Step 1 ("Pijnpunten") of the dashboard that presents each hypothesis and collects confirm/decline, and (3) the admin Analysis section already renders `DECLINED` status with the correct "Declined by prospect" pill from Phase 18 — it just needs data to arrive.

The largest risk is authorization: the mutation must be scoped to a specific prospect via slug, not publicly callable for any hypothesis ID. There is no `prospectProcedure` in the codebase — `publicProcedure` (used by wizard router) and `adminProcedure` are the only two middleware levels. A slug-scoped middleware pattern needs to be created for this mutation, or the mutation must validate the hypothesis belongs to the prospect identified by slug before writing. The Phase 18 research identified this risk explicitly: "Client-facing hypothesis validation endpoint must use slug-scoped `prospectProcedure`, not `publicProcedure`."

**Primary recommendation:** Add a `prospectProcedure` middleware to `server/trpc.ts` that validates a slug input matches a real, publicly-accessible prospect before allowing the mutation. Wire a new `hypotheses.validateByProspect` procedure using this middleware. Add a validation card UI inside Step 1 of `dashboard-client.tsx`. Use optimistic updates (standard tRPC + useState pattern) to show immediate visual feedback without a round-trip.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library       | Version    | Purpose          | Relevance                                                                         |
| ------------- | ---------- | ---------------- | --------------------------------------------------------------------------------- |
| tRPC          | `11.9.0`   | API layer        | New slug-scoped procedure for client validation                                   |
| zod           | `^4.3.6`   | Input validation | Validate `slug` + `hypothesisId` + `action` inputs                                |
| Prisma        | `^7.3.0`   | DB access        | `workflowHypothesis.update` to set ACCEPTED/DECLINED                              |
| framer-motion | `^12.29.2` | Animation        | Already used in dashboard-client.tsx — reuse for validation feedback              |
| lucide-react  | `^0.563.0` | Icons            | `CheckCircle2`, `XCircle`, `AlertCircle` already imported in dashboard-client.tsx |
| Tailwind CSS  | `^4`       | Styling          | Emerald/red chip tokens already in use on /voor/                                  |

### Supporting

| Library           | Version           | Purpose                | When to Use                                                             |
| ----------------- | ----------------- | ---------------------- | ----------------------------------------------------------------------- |
| `canvas-confetti` | already installed | Celebration on confirm | Optional — already used in `handleRequestQuote` in dashboard-client.tsx |

### Alternatives Considered

| Instead of                                   | Could Use                          | Tradeoff                                                                                                                                     |
| -------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Slug-scoped middleware (`prospectProcedure`) | Validate slug inside mutation body | Middleware is cleaner — DRY, reusable for future /voor/ mutations; inline validation is quicker but repeats logic per procedure              |
| Optimistic UI update                         | Refetch after mutation             | Optimistic is already the pattern in dashboard-client.tsx (see `setQuoteRequested(true)` before server response confirmed) — stay consistent |
| Showing validation UI on all steps           | Only Step 1 ("Pijnpunten")         | Step 1 is the natural place — it already shows hypotheses. No need for a separate step                                                       |

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Changes

No new files required except potentially the middleware extension. Changes are additive to existing files:

```
server/
  trpc.ts                      <- Add prospectProcedure middleware
  routers/
    hypotheses.ts              <- Add validateByProspect procedure
    _app.ts                    <- No change (hypothesesRouter already registered)
app/voor/[slug]/
  page.tsx                     <- Pass prospect's internal id and slug to DashboardClient; include hypothesis `status` field in fetch
  dashboard-client.tsx         <- Add validation card to Step 1; add tRPC mutation call
```

### Pattern 1: Slug-Scoped Middleware (`prospectProcedure`)

**What:** A tRPC middleware that reads `slug` from input and verifies it maps to a publicly-visible prospect. The middleware resolves the prospect and injects `prospectId` into context — the procedure body then only needs to verify the hypothesis belongs to that prospect.

**When to use:** Any /voor/ mutation that must be restricted to actions on behalf of a single identified prospect.

**Example:**

```typescript
// Source: server/trpc.ts — additive to existing file
export const prospectProcedure = t.procedure.use(
  async ({ ctx, rawInput, next }) => {
    // rawInput is unknown — safe to cast via zod parse in procedure
    const slug = (rawInput as Record<string, unknown>)?.slug;
    if (typeof slug !== 'string') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'slug required' });
    }
    const prospect = await ctx.db.prospect.findUnique({
      where: { readableSlug: slug },
      select: { id: true, status: true },
    });
    if (
      !prospect ||
      !['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
        prospect.status,
      )
    ) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Prospect not found' });
    }
    return next({ ctx: { ...ctx, prospectId: prospect.id } });
  },
);
```

**Key insight:** The middleware mirrors the `page.tsx` status guard. Both enforce the same visibility rule: only prospects whose status is READY or beyond can have their dashboard visible and their hypotheses validated.

**Alternative (simpler):** Skip the middleware and validate inside the mutation body. This is viable since there is currently only one /voor/ mutation. Use middleware if you anticipate more /voor/ procedures in Phase 20+.

### Pattern 2: `hypotheses.validateByProspect` Procedure

**What:** A tRPC mutation that sets a hypothesis status to `ACCEPTED` (prospect confirmed) or `DECLINED` (prospect declined), after verifying the hypothesis belongs to the slug-identified prospect.

```typescript
// Source: server/routers/hypotheses.ts — additive procedure
validateByProspect: prospectProcedure
  .input(
    z.object({
      slug: z.string(),        // consumed by prospectProcedure middleware
      hypothesisId: z.string(),
      action: z.enum(['confirm', 'decline']),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // ctx.prospectId is resolved by prospectProcedure
    const hypothesis = await ctx.db.workflowHypothesis.findFirst({
      where: { id: input.hypothesisId, prospectId: ctx.prospectId },
      select: { id: true, status: true },
    });
    if (!hypothesis) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Hypothesis not found for this prospect' });
    }
    // Only allow action on PENDING or ACCEPTED (legacy) hypotheses
    // DECLINED hypotheses are final — no re-validation
    const newStatus = input.action === 'confirm' ? 'ACCEPTED' : 'DECLINED';
    return ctx.db.workflowHypothesis.update({
      where: { id: input.hypothesisId },
      data: { status: newStatus },
    });
  }),
```

**Status mapping decision:** Confirmed = `ACCEPTED` (reuses the existing value, which already has the correct admin display label "Pending validation" — the label was set to be neutral in Phase 18). Declined = `DECLINED`. This means no new DB enum values are needed.

**Idempotency:** The mutation is naturally idempotent — updating `ACCEPTED` to `ACCEPTED` again is a no-op write. The UI should disable already-validated buttons, but a duplicate submit is safe.

### Pattern 3: /voor/ Page Data — Pass Status to Client

The current `page.tsx` fetches `workflowHypotheses` but does **not** pass `status` to `DashboardClient`. The validation UI needs to know the current status of each hypothesis to show the right button state.

**Current `DashboardClientProps.hypotheses` type** (from `dashboard-client.tsx`):

```typescript
interface HypothesisData {
  id: string;
  title: string;
  problemStatement: string;
  confidenceScore: number;
  // ... metrics ...
  proofMatches: ProofMatchData[];
  // MISSING: status
}
```

**Required change:** Add `status` to the Prisma select in `page.tsx` and to the `HypothesisData` interface in `dashboard-client.tsx`.

```typescript
// page.tsx — add to workflowHypotheses select:
status: true,

// dashboard-client.tsx — add to HypothesisData interface:
status: 'ACCEPTED' | 'PENDING' | 'DECLINED';
```

### Pattern 4: Validation Card UI — Step 1 ("Pijnpunten")

**What:** Inside Step 1, after the existing hypothesis grid, add a validation prompt: "Herkent u deze pijnpunten? Laat het ons weten." with per-hypothesis confirm/decline buttons.

**Design constraints from user preferences:**

- Dutch (NL) user-facing text
- Compact UI (p-6, not p-10)
- No re-showing of declined hypotheses — once declined, show an "acknowledged" state
- Confirmed shows a green check state; declined shows a dimmed acknowledged state
- Single click per hypothesis — no modal confirmation

**UX flow for each hypothesis card:**

1. Default (PENDING): card shows hypothesis + two small buttons: "Ja, herkenbaar" (confirm) and "Nee, niet van toepassing" (decline)
2. After confirm: card gets green border/background, checkmark icon, button disabled with "Bevestigd" label
3. After decline: card gets slate/dimmed styling, acknowledged message, no re-show option

**State management:** Use local React state to track optimistic updates, mirroring `quoteRequested` pattern in dashboard-client.tsx:

```typescript
// In dashboard-client.tsx
const [validationState, setValidationState] = useState<
  Record<string, 'confirmed' | 'declined' | null>
>({});

// Pre-populate from server-provided status
useEffect(() => {
  const initial: Record<string, 'confirmed' | 'declined' | null> = {};
  for (const h of hypotheses) {
    if (h.status === 'ACCEPTED') initial[h.id] = 'confirmed';
    if (h.status === 'DECLINED') initial[h.id] = 'declined';
  }
  setValidationState(initial);
}, [hypotheses]);
```

**Mutation call:**

```typescript
const validateHypothesis = api.hypotheses.validateByProspect.useMutation();

const handleValidate = (
  hypothesisId: string,
  action: 'confirm' | 'decline',
) => {
  // Optimistic update first
  setValidationState((prev) => ({
    ...prev,
    [hypothesisId]: action === 'confirm' ? 'confirmed' : 'declined',
  }));
  validateHypothesis.mutate({ slug: prospectSlug, hypothesisId, action });
};
```

**Note:** `prospectSlug` is already passed to `DashboardClient` as a prop — it is the nanoid slug (not readableSlug). The middleware must therefore look up by either `slug` OR `readableSlug`. Since the page is mounted via `readableSlug`, but passes `prospect.slug` (nanoid) to the client — the procedure input must accept the **nanoid slug** and the middleware must look up by `{ slug: input.slug }` (not `readableSlug`).

**CRITICAL:** Verify which slug is passed to DashboardClient. In `page.tsx` line 105: `prospectSlug={prospect.slug}` — this is the nanoid slug. The middleware must use `{ slug: input.slug }` not `{ readableSlug: input.slug }`.

### Pattern 5: Admin Analysis Section — No Changes Needed

The `AnalysisSection` component in `analysis-section.tsx` already:

- Renders the `DECLINED` status pill as "Declined by prospect" in red
- Renders `ACCEPTED` status pill as "Pending validation" in blue (correct — confirmed by prospect, awaiting admin)
- Sorts findings with DECLINED at position 2 (after PENDING/ACCEPTED at 0)
- Fetches via `api.hypotheses.listByProspect` which queries all statuses for a prospectId

When a prospect validates on /voor/, the next page load of the admin detail view will show the updated status automatically — no admin action, no polling, no change to `analysis-section.tsx`.

**One exception:** The `listAll` procedure in `hypotheses.ts` uses `z.enum(['DRAFT', 'ACCEPTED', 'REJECTED'])` for filtering — PENDING and DECLINED are missing from this enum. This is not critical for Phase 19 (the procedure is admin-only and just for listing), but should be updated to include all valid statuses to avoid confusion.

### Pattern 6: Visibility Gate — When to Show the Validation Card

**Requirement:** "After the first outreach email is sent, their /voor/ dashboard shows a section..."

**Current prospect status flow:** `DRAFT → ENRICHED → GENERATING → READY → SENT → VIEWED → ENGAGED → CONVERTED`

**"SENT" is manually set** by admin via `admin.updateProspect` mutation. The /voor/ page is visible for statuses `['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED']`. The `READY` status appears _before_ first outreach — so showing the validation card for READY prospects would be premature.

**Options:**

1. Show validation card only when `prospect.status` is `'SENT'` or beyond (VIEWED, ENGAGED, CONVERTED)
2. Show validation card always when hypotheses exist (simpler, but violates the "after first email sent" requirement)

**Recommendation:** Pass `prospect.status` to `DashboardClient` and show the validation section only when `['SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(prospectStatus)`. This matches the requirement exactly. This requires adding `status` to what `page.tsx` passes down.

**Alternative:** Since the /voor/ page is already only accessible to READY+ prospects, and READY is typically a very short transient state before being manually set to SENT — showing the card for READY as well is a pragmatic simplification. The product distinction between READY and SENT is thin in practice.

### Anti-Patterns to Avoid

- **Using `publicProcedure` for the validation mutation:** Any hypothesisId would be writable by anyone who can guess it. Always validate the hypothesis belongs to the slug's prospect.
- **Filtering /voor/ page to only `status: 'PENDING'` and removing `'ACCEPTED'`:** Some existing prospects have `ACCEPTED` hypotheses from before Phase 18. The filter `{ in: ['ACCEPTED', 'PENDING'] }` was set in Phase 18 for backward compatibility. Do not break this.
- **Re-showing declined hypotheses:** Once a prospect declines, the card should transition to a dimmed "acknowledged" state — not hidden (user might wonder where it went) but not re-soliciting confirmation.
- **Blocking navigation on un-validated hypotheses:** Never hard-block. The prospect should always be able to proceed to Steps 2 and 3 regardless of validation state.

---

## Don't Hand-Roll

| Problem                                  | Don't Build               | Use Instead                                                | Why                                                                         |
| ---------------------------------------- | ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------- | --------------------------------------- |
| Authorization scope for /voor/ mutations | Custom token system       | Slug-scoped middleware that validates slug = real prospect | Slugs are already the auth token for /voor/ — they are unguessable (nanoid) |
| Client-side validation state             | Complex state machine     | Simple `Record<hypothesisId, 'confirmed'                   | 'declined'                                                                  | null>` with useState | This is 6 items max — no library needed |
| Optimistic updates                       | Manual cache invalidation | `useState` pre-set before mutation, mutation updates DB    | Already the pattern in dashboard-client.tsx (`setQuoteRequested(true)`)     |
| Declining = hiding                       | Remove from list          | Show dimmed "acknowledged" state                           | Better UX — user knows what happened                                        |

**Key insight:** The slug (`prospect.slug`, the nanoid) is the prospect's access token. It is unguessable and scoped to exactly one prospect. The middleware using it to authorize a mutation is the correct security model for public-facing /voor/ pages.

---

## Common Pitfalls

### Pitfall 1: Wrong Slug Type in Middleware

**What goes wrong:** Middleware looks up prospect by `readableSlug` but client sends the nanoid `slug` (or vice versa).
**Why it happens:** `page.tsx` passes `prospect.slug` (nanoid) to `DashboardClient` as `prospectSlug`. The mutation receives this. But the URL is the `readableSlug`. If the middleware queries `{ readableSlug: input.slug }`, it will always fail.
**How to avoid:** Verify in `page.tsx` line 105: `prospectSlug={prospect.slug}` — this is confirmed as the nanoid slug. Middleware must use `db.prospect.findUnique({ where: { slug: input.slug } })`.
**Warning signs:** Middleware always throws NOT_FOUND; logs show the slug value being a readable-looking string vs. a 12-char nanoid.

### Pitfall 2: `listAll` Status Enum Mismatch

**What goes wrong:** `hypotheses.listAll` accepts `status: z.enum(['DRAFT', 'ACCEPTED', 'REJECTED'])` — after Phase 18/19, hypotheses can also be `PENDING` or `DECLINED`. Admin trying to filter by DECLINED gets a zod error.
**Why it happens:** The Phase 18 work added enum values to the DB schema but did not update the `listAll` input validator.
**How to avoid:** Update the zod enum in `listAll` to include `'PENDING'` and `'DECLINED'`.
**Warning signs:** `ZodError: Invalid enum value` when filtering by PENDING/DECLINED in admin UI.

### Pitfall 3: `wizard.requestQuote` Fetches `status: 'ACCEPTED'` Hypotheses

**What goes wrong:** `wizard.ts` `requestQuote` procedure at line 211 filters `workflowHypotheses: { where: { status: 'ACCEPTED' } }`. After Phase 19, confirmed hypotheses stay at `ACCEPTED` — so this actually still works. But hypotheses that were `PENDING` at the time of quote request are missed.
**Why it happens:** The status mapping decision (confirmed = `ACCEPTED`) means this accidentally continues to work for confirmed, but pending-unvalidated hypotheses are excluded from the notification.
**How to avoid:** Update the `requestQuote` filter to `{ status: { in: ['ACCEPTED', 'PENDING'] } }` to capture all visible hypotheses. This is low priority but should be done for completeness.

### Pitfall 4: `assets.ts` Hypothesis Approval Gate Uses Only `ACCEPTED`

**What goes wrong:** `server/routers/assets.ts` at line 278 gates outreach on `status: 'ACCEPTED'` hypotheses. After Phase 18 + 19, hypotheses that are `PENDING` (quality-approved but not yet prospect-validated) should also satisfy this gate for outreach purposes.
**Why it happens:** The gate was written before PENDING existed. PENDING hypotheses are research-quality-approved and fully valid for outreach — they haven't been validated by client yet, but that's not a prerequisite for sending the initial email.
**How to avoid:** Update the gate in `assets.ts` to `{ status: { in: ['ACCEPTED', 'PENDING'] } }`. This is the same backward-compat pattern used in `/voor/page.tsx`.
**Impact:** If not fixed, outreach for new pipeline prospects (who have PENDING hypotheses, not ACCEPTED) will be blocked at this gate.

### Pitfall 5: Double-Validate Race Condition

**What goes wrong:** Prospect clicks "Confirm" twice rapidly, sending two mutations. The second arrives after the first has already written `ACCEPTED` — idempotent in the DB, but could cause a visual flicker if the UI is not guarded.
**Why it happens:** No debounce or loading state guard on the validation buttons.
**How to avoid:** Disable the buttons immediately on first click using `validateHypothesis.isPending` or by setting `validationState` optimistically (which removes the buttons). Since optimistic state is set before the mutation fires, the second click finds the buttons already disabled/gone.
**Warning signs:** Console shows duplicate mutation calls; admin sees hypothesis status flip-flopping.

### Pitfall 6: DECLINED Hypotheses Still Showing in /voor/ Fetch

**What goes wrong:** The `/voor/page.tsx` filter `{ status: { in: ['ACCEPTED', 'PENDING'] } }` does not include `DECLINED`. So once a prospect declines a hypothesis, it disappears from the server-side fetch on next page load.
**Why it happens:** This is correct behavior for the server-side static props — declined hypotheses should not be re-shown on next visit. But the optimistic state in the client shows "Declined" styling for the current session. On page refresh, declined cards will disappear.
**Decision required:** Is this the desired UX? On refresh, user sees fewer cards — they may wonder where their declined items went. Options:

- Fetch DECLINED status too and render them in a dimmed "already responded" state
- Accept disappearance (simpler)
  **Recommendation:** Keep the filter as-is (no DECLINED in server fetch) to keep the page clean on return visits. The current-session optimistic state handles the immediate UX. Document this as a design choice.

---

## Code Examples

Verified patterns from codebase:

### Current `prospectSlug` Passing Pattern (page.tsx lines 103-112)

```typescript
// Source: app/voor/[slug]/page.tsx lines 103-112 — confirmed nanoid slug is passed
return (
  <DashboardClient
    prospectSlug={prospect.slug}          // nanoid slug (12 chars), NOT readableSlug
    companyName={prospect.companyName ?? prospect.domain}
    // ...
    hypotheses={prospect.workflowHypotheses}
    // ...
  />
);
```

**Implication:** `hypotheses.validateByProspect` input `slug` will be the nanoid slug. Middleware must use `db.prospect.findUnique({ where: { slug: input.slug } })`.

### Current Optimistic Pattern in dashboard-client.tsx (lines 205-225)

```typescript
// Source: app/voor/[slug]/dashboard-client.tsx — existing optimistic pattern to mirror
const handleRequestQuote = () => {
  if (!sessionId || quoteRequested) return;
  requestQuote.mutate(
    { sessionId },
    {
      onSuccess: () => {
        setQuoteRequested(true); // State set in onSuccess, not pre-emptively
        // confetti...
      },
    },
  );
};
```

**Note:** This sets state on `onSuccess`, not optimistically before the server responds. For hypothesis validation, setting state optimistically (before server responds) is better UX — avoids the button staying active during the round-trip.

### Current `DashboardClientProps` (dashboard-client.tsx lines 42-71)

```typescript
// Source: app/voor/[slug]/dashboard-client.tsx lines 42-71
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
  // Phase 19: add status: 'ACCEPTED' | 'PENDING' | 'DECLINED';
}

interface DashboardClientProps {
  prospectSlug: string;
  // ... other props ...
  hypotheses: HypothesisData[];
  // Phase 19: add prospectStatus: string; (for visibility gate)
}
```

### Existing adminProcedure Pattern (server/trpc.ts lines 10-18)

```typescript
// Source: server/trpc.ts — mirror this pattern for prospectProcedure
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (ctx.adminToken !== env.ADMIN_SECRET) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid admin token',
    });
  }
  return next({ ctx });
});
```

**Adapt to:** `prospectProcedure` that validates `rawInput.slug` maps to a publicly-accessible prospect, then injects `prospectId` into context.

### assets.ts Hypothesis Gate (line 278 — needs updating)

```typescript
// Source: server/routers/assets.ts line 276-281 — NEEDS updating in Phase 19
const approvedHypothesisCount = await ctx.db.workflowHypothesis.count({
  where: { prospectId: map.prospect.id, status: 'ACCEPTED' },  // Change to { in: ['ACCEPTED', 'PENDING'] }
});
if (approvedHypothesisCount === 0) {
  throw new TRPCError({ ... });
}
```

### wizard.ts requestQuote Filter (line 211 — needs updating)

```typescript
// Source: server/routers/wizard.ts line 209-214 — NEEDS updating in Phase 19
workflowHypotheses: {
  where: { status: 'ACCEPTED' },  // Change to { status: { in: ['ACCEPTED', 'PENDING'] } }
  take: 3,
  // ...
},
```

---

## State of the Art

| Old Approach                              | Current Approach                                                   | Changed     | Impact                                      |
| ----------------------------------------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------- |
| Admin approves/rejects hypotheses         | Phase 18: admin reviews quality only; Phase 19: prospect validates | Phase 18+19 | HYPO-05, HYPO-06, HYPO-07                   |
| HypothesisStatus: DRAFT/ACCEPTED/REJECTED | + PENDING (quality-approved) + DECLINED (prospect declined)        | Phase 18    | Schema already ready for Phase 19           |
| /voor/ filter: `{ status: 'ACCEPTED' }`   | `{ status: { in: ['ACCEPTED', 'PENDING'] } }`                      | Phase 18    | Already done — no change needed             |
| AnalysisSection: approve/reject buttons   | Read-only status badges                                            | Phase 18    | Already done — DECLINED pill already styled |
| No slug-scoped tRPC middleware            | `prospectProcedure` needed                                         | Phase 19    | Must be created                             |

**Deprecated/outdated patterns that need cleanup in this phase:**

- `assets.ts` line 278: `status: 'ACCEPTED'` gate → must become `{ in: ['ACCEPTED', 'PENDING'] }`
- `assets.ts` lines 69, 74, 418, 426: Same `status: 'ACCEPTED'` pattern in loss map generation
- `wizard.ts` line 211: `status: 'ACCEPTED'` in requestQuote → `{ in: ['ACCEPTED', 'PENDING'] }`
- `hypotheses.ts` `listAll` input enum: missing `'PENDING'` and `'DECLINED'`

---

## Open Questions

1. **Middleware approach vs. inline slug validation?**
   - What we know: Only one /voor/ mutation exists currently (validateByProspect). A middleware adds ~15 lines of infrastructure for a single caller today.
   - What's unclear: Will Phase 20 add more /voor/ mutations? If yes, middleware pays off immediately.
   - Recommendation: Build the middleware. Phase 20 (One-Click Send Queue) is explicitly next, and /voor/ interactions may expand. Middleware is the right investment.

2. **Confirmed = `ACCEPTED` or a new `CONFIRMED` status?**
   - What we know: Phase 18 added `DECLINED` but not a separate `CONFIRMED`. The STATUS_LABELS in `analysis-section.tsx` maps `ACCEPTED` to "Pending validation" — so if confirmed = ACCEPTED, the admin sees "Pending validation" which is misleading (validated IS the final state).
   - What's unclear: Whether the admin should see "Confirmed by prospect" vs "Pending validation" for a prospect-confirmed hypothesis.
   - Recommendation: Use `ACCEPTED` for "confirmed by prospect" (no new schema migration). Update `STATUS_LABELS` in `analysis-section.tsx` to distinguish: `ACCEPTED: 'Confirmed by prospect'`. The current "Pending validation" label was a placeholder for the Phase 18 cleanup — Phase 19 is the phase where validation actually happens, so the label should now be accurate.

3. **Show validation card on READY status or only SENT+?**
   - What we know: READY prospects have not received the outreach email yet. The requirement says "after first outreach email is sent." The admin manually marks a prospect SENT.
   - What's unclear: In practice, READY is a transient state — admins often go READY → SENT within minutes of generating assets. A READY prospect is unlikely to be on their /voor/ URL before the email is sent.
   - Recommendation: For safety, show the validation card only for `['SENT', 'VIEWED', 'ENGAGED', 'CONVERTED']` to honor the requirement precisely. READY should show the hypotheses but without the validation prompt. This requires passing `prospect.status` as a prop to `DashboardClient`.

4. **What happens when a PENDING hypothesis is prospect-declined, then re-researched?**
   - What we know: A new research run generates new hypotheses with `DRAFT` status. The admin quality-approves them to `PENDING`. The old `DECLINED` hypothesis stays in the DB.
   - What's unclear: If the same pain point re-appears in a new research run as a new hypothesis, the prospect may see it again and be confused.
   - Recommendation: Out of scope for Phase 19. Document as a known edge case. The query filters by `status: { in: ['ACCEPTED', 'PENDING'] }` so old DECLINED rows never resurface.

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `app/voor/[slug]/page.tsx` — confirmed nanoid slug is passed as `prospectSlug`, current hypothesis filter `{ status: { in: ['ACCEPTED', 'PENDING'] } }`, visibility gate statuses
- Codebase inspection: `app/voor/[slug]/dashboard-client.tsx` — confirmed full component structure, HypothesisData interface (missing `status`), optimistic pattern via `setQuoteRequested`, framer-motion and lucide-react already imported
- Codebase inspection: `server/trpc.ts` — confirmed only `publicProcedure` and `adminProcedure` exist; no `prospectProcedure`; confirmed context shape (`db`, `adminToken`)
- Codebase inspection: `server/context.ts` — confirmed context has no slug field; middleware must resolve slug from rawInput
- Codebase inspection: `server/routers/hypotheses.ts` — confirmed `setStatus` mutation accepts `DRAFT/ACCEPTED/REJECTED` only; `listAll` input enum missing `PENDING`/`DECLINED`; `validateByProspect` does not exist yet
- Codebase inspection: `server/routers/wizard.ts` — confirmed `requestQuote` at line 211 uses `status: 'ACCEPTED'`; must become `{ in: ['ACCEPTED', 'PENDING'] }`
- Codebase inspection: `server/routers/assets.ts` — confirmed 5 locations using `status: 'ACCEPTED'` that must become `{ in: ['ACCEPTED', 'PENDING'] }`
- Codebase inspection: `components/features/prospects/analysis-section.tsx` — confirmed Phase 18 work complete: `DECLINED` pill styled "Declined by prospect", sort order includes DECLINED, `STATUS_LABELS` maps ACCEPTED to "Pending validation"
- Codebase inspection: `prisma/schema.prisma` — confirmed `HypothesisStatus` enum has `PENDING` and `DECLINED` (added Phase 18), `Prospect.slug` is nanoid 12-char, `Prospect.readableSlug` is the URL slug

### Secondary (MEDIUM confidence)

- Phase 18 RESEARCH.md — prior research identifying `/voor/` filter change from `ACCEPTED` to `{ in: ['ACCEPTED', 'PENDING'] }`, backward compat pattern, DECLINED added to schema
- Phase 18 SUMMARY.md (inferred from Phase 18 plan files being marked complete) — Phase 18 schema and UI changes are shipped and ready

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all existing libraries confirmed in package.json
- Architecture (prospectProcedure): HIGH — pattern confirmed from existing `adminProcedure`; slug lookup verified from `page.tsx` and schema
- Authorization model (slug = access token): HIGH — nanoid slug is already used as access token in wizard procedures (`publicProcedure` + slug input); pattern is established
- `assets.ts` / `wizard.ts` cleanup: HIGH — exact line numbers confirmed via codebase inspection
- Open question 2 (ACCEPTED vs new CONFIRMED status): MEDIUM — design decision, no blocking technical constraint

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable stack, 30-day window)

---

## Task Map for Planner

| Task                                                                                                                             | Files Affected                                                                         | Est. Complexity |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------- |
| 19-01: Add `prospectProcedure` middleware + `hypotheses.validateByProspect` mutation                                             | `server/trpc.ts`, `server/routers/hypotheses.ts`                                       | Low             |
| 19-02: Update `assets.ts` + `wizard.ts` ACCEPTED → `{ in: ['ACCEPTED', 'PENDING'] }` status references; fix `listAll` input enum | `server/routers/assets.ts`, `server/routers/wizard.ts`, `server/routers/hypotheses.ts` | Low             |
| 19-03: Add hypothesis validation card to /voor/ Step 1 + wire mutation                                                           | `app/voor/[slug]/page.tsx`, `app/voor/[slug]/dashboard-client.tsx`                     | Medium          |
