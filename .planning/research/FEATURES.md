# Feature Research

**Domain:** Unified outreach pipeline with signal detection — B2B sales engine add-on to Qualifai
**Researched:** 2026-03-16
**Confidence:** HIGH (first-party codebase analysis)

---

## Context: What Already Exists (v8.0 Starting Point)

Before mapping new features, this is the current split that v8.0 must unify:

| System                          | Location                                        | What it does                                                        | Gap                                                                                       |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `generateIntroEmail()`          | `outreach.ts` router, `automation/processor.ts` | AI email generation via Gemini Flash                                | Only appears in draft queue (OutreachLog), not in prospect detail Outreach Preview        |
| WorkflowLossMap template engine | `assets.ts` router, `workflow-engine.ts`        | Template-based email from loss map markdown                         | Prospect detail Outreach Preview shows this; draft queue does not                         |
| OutreachSequence + OutreachStep | `cadence/engine.ts`                             | Multi-touch cadence tracking                                        | Steps created with `bodyText: ''` placeholder — copy generation is deferred to cron sweep |
| Draft queue                     | `/admin/outreach` page                          | OutreachLog status=draft inbox                                      | Only shows AI-generated logs; template-based outreach is invisible here                   |
| Signal model                    | `prisma/schema.prisma`                          | 7 SignalTypes defined; `isProcessed` flag; FK to Prospect + Contact | Signal table is always empty — no code writes to it                                       |
| Research refresh cron           | `lib/research-refresh.ts`                       | Re-runs evidence collection every 14 days                           | No diff comparison between runs, no Signal creation                                       |
| Automation rules                | `lib/automation/rules.ts`                       | 3 rules: JOB_CHANGE, PROMOTION, HEADCOUNT_GROWTH                    | Rules fire on Signals that never exist                                                    |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the admin expects to exist in a unified pipeline. Missing these makes the system feel broken.

| Feature                                                | Why Expected                                                                           | Complexity | Notes                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Single draft queue showing all outreach types          | One place to review and send; currently two disconnected systems                       | MEDIUM     | After cleanup, all emails are OutreachLog records — `getDecisionInbox` stays as-is                                       |
| Prospect detail links to pending drafts                | Admin clicks a prospect, expects to see what drafts are waiting for that prospect      | LOW        | Add draft count badge + link from OutreachPreviewSection to `/admin/outreach?prospectId=X`                               |
| Draft queue links back to prospect                     | Admin sees a draft, knows which company/contact without navigating away                | LOW        | Already implemented — `draft.contact.prospect` is in `getDecisionInbox` query; confirm UI renders the link               |
| AI follow-up appears in queue automatically after send | After approving step 1, step 2 should appear in draft queue within the scheduled delay | MEDIUM     | `processDueCadenceSteps()` exists but defers copy generation; fix: generate copy at step creation in `evaluateCadence()` |
| Follow-up threads correctly                            | Re: subject line, brief reference to previous email                                    | LOW        | `buildFollowUpPrompt` already accepts `previousSubject` and threads — already implemented                                |
| Draft regenerate button                                | Admin wants to retry or switch language on a draft                                     | LOW        | Already exists in draft queue UI (`regenerateDraft` mutation + EN/NL toggle)                                             |

### Differentiators (Competitive Advantage)

Features that make this pipeline meaningfully smarter than manual follow-up.

| Feature                                | Value Proposition                                                                                                                                   | Complexity | Notes                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signal detection from evidence diffs   | After each research refresh, detect new job listings / headcount changes / tech adoptions from EvidenceItem deltas — without third-party data feeds | HIGH       | New `lib/signal-detector.ts`: compare latest two ResearchRuns per prospect; classify EvidenceItem delta by workflowTag + sourceType; write Signal records |
| Signals automatically create drafts    | Detected signal immediately triggers AI draft via `processSignal()` — admin only reviews                                                            | MEDIUM     | `processSignal()` already works end-to-end; gap is upstream Signal creation. Fix detection, drafts flow automatically                                     |
| Evidence-backed follow-up emails       | Follow-ups reference actual research findings ("uw vacature voor Operations Manager…") not generic check-ins                                        | HIGH       | `OutreachContext` only has company/contact basics today; needs ProspectAnalysis narrative or top EvidenceItems injected into `buildFollowUpPrompt()`      |
| Signal-to-draft traceability           | Each draft shows what signal triggered it — admin understands why the email exists                                                                  | LOW        | `metadata.signalId` already stored on OutreachLog in `processSignal()`; add signal type badge in draft queue UI                                           |
| Unified outreach timeline per prospect | Prospect detail shows all sent emails (intro + follow-ups + signal-triggered) in one chronological view                                             | MEDIUM     | Extend sequences.list or add separate OutreachLog history query; show with sentAt timestamps                                                              |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature                                  | Why Requested                                         | Why Problematic                                                                                                                                       | Alternative                                                                                                                        |
| ---------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Auto-send without approval               | Maximum automation, remove bottleneck                 | GDPR / anti-spam risk for NL/BE; one bad draft damages brand; already ruled out in PROJECT.md "Out of Scope"                                          | Bulk approve button already exists for batch review of low-risk drafts                                                             |
| Signal detection from third-party APIs   | More signals = more coverage                          | Apollo plan limits already hit; data freshness complexity; duplicates what the evidence pipeline already collects for free                            | Use EvidenceItem diffs from existing 8-source pipeline — already paid for, runs every 14 days                                      |
| Real-time signal detection               | Instant reaction to company changes                   | Infrastructure complexity; no NL/BE webhook providers for headcount/job data                                                                          | 14-day cron is sufficient for B2B sales cycle; signal age is not critical at 7–50 prospects                                        |
| Separate signal management UI            | Dedicated page for signal rules and detection history | Signals page exists but Signal table is empty and admin never visits it; another nav item increases surface area                                      | Signal type label on each draft in the unified queue provides sufficient context                                                   |
| Keep WorkflowLossMap email template path | "Why delete what works?"                              | Two parallel email systems create confusion; the template path is not evidence-backed; it produces lower-quality outreach than `generateIntroEmail()` | Replace with `generateIntroEmail()` everywhere; loss map PDF stays (valuable asset), email fields on WorkflowLossMap model go away |

---

## Feature Dependencies

```
[Signal Detection from Evidence Diffs]
    └──requires──> [Research Refresh Cron] (exists, runs every 14 days)
    └──requires──> [EvidenceItem with researchRunId FK] (exists in schema)
    └──writes──> [Signal records] (model exists, table empty)
        └──triggers via cron or callback──> [processSignal()] (exists in automation/processor.ts)
            └──writes──> [OutreachLog status=draft]
                └──appears in──> [Unified Draft Queue]

[AI Follow-Up Cadence]
    └──requires──> [OutreachSequence with SENT step] (exists)
    └──triggered by──> [evaluateCadence() after send] (exists — called in approveDraft mutation)
    └──generates copy via──> [generateFollowUp()] (exists)
    └──writes──> [OutreachLog status=draft with FOLLOW_UP type]
        └──appears in──> [Unified Draft Queue]

[Unified Draft Queue]
    └──currently shows──> INTRO_EMAIL + FOLLOW_UP + SIGNAL_TRIGGERED OutreachLog records
    └──currently missing──> WorkflowLossMap email path (resolved by cleanup removing template path)
    └──enhanced by──> Signal type badge on triggered drafts
    └──enhanced by──> Prospect link on each draft row (already present, confirm rendering)

[Prospect Detail Outreach Status]
    └──requires──> [OutreachSequence.status] (exists)
    └──requires──> [OutreachLog count query for pending drafts] (new query needed)
    └──enhances via──> link to /admin/outreach?prospectId=X
    └──currently broken by──> OutreachPreviewSection showing WorkflowLossMap template, not AI drafts

[Evidence-Backed Follow-Ups]
    └──requires──> [AI Follow-Up Cadence working] (P1)
    └──requires──> [ProspectAnalysis narrative or top EvidenceItems available at cadence time]
    └──requires──> [buildFollowUpPrompt() updated to accept evidence block]
```

### Dependency Notes

- **Signal detection is the unblocking feature**: Everything downstream (automation rules, signal drafts) already works. The Signal table being empty is the single failure point for the entire automation layer.
- **Dead code cleanup is a prerequisite for clarity**: `createWorkflowLossMapDraft()` in `workflow-engine.ts`, `emailSubject/emailBodyHtml/emailBodyText` on `WorkflowLossMap`, and `assets.queueOutreachDraft` mutation all represent the template path. Remove before building new email features in the same files to avoid confusion and regression risk.
- **Follow-up copy generation must move earlier**: Current flow is `evaluateCadence()` creates step with empty body → cron sweeps → `processDueCadenceSteps()` generates copy. Risk: cron delay, reply between creation and sweep. Fix: generate copy inline in `evaluateCadence()`.
- **Evidence-backed follow-ups depend on P1 follow-up fix**: Must confirm follow-up cadence works end-to-end with real data before adding evidence enrichment to prompts.

---

## MVP Definition

### Launch With (v8.0)

Minimum set to make the unified pipeline real. All six items are required; none can be deferred.

- [ ] **Dead code cleanup** — Remove WorkflowLossMap email fields + template path. ~300–500 LOC deleted. This is the first phase: clears the path for everything else.
- [ ] **Signal detection from evidence diffs** — `lib/signal-detector.ts`: compare latest two ResearchRuns per prospect, classify EvidenceItem deltas by sourceType/workflowTag into SignalTypes (NEW_JOB_LISTING, HEADCOUNT_GROWTH, TECHNOLOGY_ADOPTION, FUNDING_EVENT). Write Signal records with idempotency guard. Called from research refresh completion.
- [ ] **Signal-to-draft pipeline closes** — After signal written, `processSignal()` fires (via cron or callback). Drafts appear in queue. "Process Signals" button on outreach page tests this manually.
- [ ] **Unified draft queue (all types visible)** — Confirm `getDecisionInbox` returns all three types: INTRO_EMAIL, FOLLOW_UP, SIGNAL_TRIGGERED. Add type badge on each draft row. After template cleanup, this should work without query changes.
- [ ] **Prospect detail outreach status** — Replace WorkflowLossMap-centric OutreachPreviewSection content with AI-centric view: current sequence status chip, pending draft count, link to outreach queue.
- [ ] **AI follow-up copy generated at sequence step creation** — Move `generateFollowUp()` call from `processDueCadenceSteps()` into `evaluateCadence()`. Follow-up body is ready when step is created, not deferred.

### Add After Validation (v8.1)

Add once v8.0 pipeline is verified with real signals and real follow-ups in production.

- [ ] **Evidence-backed follow-up prompts** — Pass ProspectAnalysis narrative (or top 5 EvidenceItems) into `buildFollowUpPrompt()`. Follow-ups reference real findings instead of generic "following up."
- [ ] **Signal detail badge on draft row** — Show triggering signal type and title on SIGNAL_TRIGGERED drafts in the queue.
- [ ] **Per-prospect outreach timeline** — In prospect detail, show sent emails chronologically with sent dates and reply status.

### Future Consideration (v9+)

Defer until v8.0 pipeline has processed real signals and the admin has validated the oversight model.

- [ ] **Configurable automation rules in UI** — Currently hardcoded in `lib/automation/rules.ts`. DB-backed rules make sense at 3+ users or when rules need frequent adjustment.
- [ ] **Signal confidence scoring** — Not all EvidenceItem deltas are equal. Scoring signals at detection time (e.g., using aiRelevance from EvidenceItem) gives the admin prioritized signal feed.
- [ ] **Multi-prospect signal batching** — Useful at 50+ prospects when multiple companies trigger the same signal type in one refresh cycle.

---

## Feature Prioritization Matrix

| Feature                              | User Value                     | Implementation Cost        | Priority                                      |
| ------------------------------------ | ------------------------------ | -------------------------- | --------------------------------------------- |
| Dead code cleanup                    | MEDIUM (clarity, reduces risk) | LOW (delete)               | P1 — do first                                 |
| Signal detection from evidence diffs | HIGH                           | HIGH                       | P1 — unblocks all automation                  |
| AI follow-up copy fix                | HIGH                           | LOW                        | P1 — current cadence has placeholder body bug |
| Unified draft queue (all types)      | HIGH                           | LOW (after cleanup)        | P1                                            |
| Signal-to-draft automation closes    | HIGH                           | LOW (depends on detection) | P1                                            |
| Prospect detail outreach status      | MEDIUM                         | LOW                        | P1                                            |
| Evidence-backed follow-up prompts    | HIGH                           | MEDIUM                     | P2                                            |
| Signal badge on draft                | LOW                            | LOW                        | P2                                            |
| Per-prospect outreach history        | MEDIUM                         | MEDIUM                     | P2                                            |
| Configurable automation rules        | LOW                            | HIGH                       | P3                                            |

---

## Complexity Notes by Feature

### Signal Detection (HIGH)

The diff algorithm must handle non-deduplicated evidence items:

- EvidenceItems are fresh extractions per run — cannot diff by item ID.
- Diff by: `sourceType` count changes + `workflowTag` content patterns between run N and run N-1.
- NEW_JOB_LISTING: CAREERS source items count increased, or snippets contain hiring keywords ("vacatur", "wij zoeken", "hiring").
- HEADCOUNT_GROWTH: LINKEDIN items mention employee count growth, or NEWS items mention expansion.
- TECHNOLOGY_ADOPTION: WEBSITE/NEWS items mention new tool/platform adoption not in prior run.
- FUNDING_EVENT: NEWS items mention funding round keywords.
- Idempotency: check `Signal` table for `(prospectId, signalType)` before inserting, scoped to the same run pair. Or add unique constraint on `(prospectId, signalType, metadata.runId)`.

### Unified Draft Queue (MEDIUM then LOW after cleanup)

- Before cleanup: two separate email systems; merging them requires routing or query union.
- After cleanup: all emails are OutreachLog records with status=draft — queue requires no changes to the data layer.
- The complexity is in the cleanup phase, not the queue phase.

### AI Follow-Up Copy Fix (LOW)

- Move `generateFollowUp()` call from `processDueCadenceSteps()` into `evaluateCadence()`.
- `evaluateCadence()` already loads `sequence.contact` and `sequence.prospect` — all context needed is available.
- `processDueCadenceSteps()` becomes a simpler "find due steps, promote to QUEUED" sweep without copy generation.
- Net result: no more empty `bodyText` in draft queue for follow-ups.

---

## Sources

- First-party codebase: `lib/automation/processor.ts`, `lib/cadence/engine.ts`, `lib/research-refresh.ts`, `lib/ai/generate-outreach.ts`, `lib/ai/outreach-prompts.ts`, `lib/automation/rules.ts`, `server/routers/assets.ts`, `server/routers/outreach.ts`
- Schema: `prisma/schema.prisma` — Signal, OutreachLog, OutreachStep, EvidenceItem, ResearchRun, WorkflowLossMap models
- UI: `app/admin/outreach/page.tsx`, `components/features/prospects/outreach-preview-section.tsx`, `app/admin/signals/page.tsx`
- Project context: `.planning/PROJECT.md` v8.0 milestone definition

---

_Feature research for: Qualifai v8.0 Unified Outreach Pipeline_
_Researched: 2026-03-16_
