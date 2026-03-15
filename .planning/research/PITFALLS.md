# Pitfalls Research

**Domain:** Unified AI outreach pipeline — merging template-based and AI-driven email systems with signal detection and multi-step cadence in an existing sales engine
**Researched:** 2026-03-16
**Confidence:** HIGH (derived from direct codebase inspection, not training-data guesses)

---

## Critical Pitfalls

### Pitfall 1: Stale `classifyDraftRisk` Blocks Signal-Triggered Drafts From Bulk Approve

**What goes wrong:**
`classifyDraftRisk()` in `server/routers/outreach.ts` marks a draft as `riskLevel: 'low'` only when `evidenceBacked && hasLossMap && hasCta`. Signal-triggered drafts written by the new AI engine (via `processSignal`) set `evidenceBacked: true` in metadata but leave `workflowLossMapId` absent — they have no loss map. Result: every signal draft shows `riskLevel: 'review'` and is excluded from "Verstuur alle" bulk approve, forcing manual review of every AI-generated draft even when the email is good.

**Why it happens:**
The `classifyDraftRisk` function was written for the v1.0 WorkflowLossMap-based flow where an attached loss map was mandatory. The new AI-only path doesn't produce a loss map. The function's logic was never updated.

**How to avoid:**
Update `classifyDraftRisk` to recognize the new draft kinds: `cadence_draft`, signal-triggered drafts, and intro-email drafts that come without a loss map. The `low` tier should be achievable based on AI generation flag + CTA presence alone. Add a `kind` field to the risk classification output so the queue can display the origin of each draft.

**Warning signs:**
All drafts from signal processing or cadence engine show `riskLevel: 'review'`. Zero drafts qualify for bulk approve despite containing valid CTA and body.

**Phase to address:**
Phase that merges the two email systems (AI engine unification). Fix before exposing the bulk-approve button to the new draft types.

---

### Pitfall 2: Double-Unsubscribe Footer — Template Body + `sendOutreachEmail` Footer

**What goes wrong:**
`sendOutreachEmail()` in `lib/outreach/send-email.ts` always appends the Dutch unsubscribe footer via `withComplianceFooter()`. The WorkflowLossMap template-based emails stored in `emailBodyHtml` already contain a footer baked in at generation time. When those drafts are sent through `sendOutreachEmail`, the footer is doubled. The new AI-generated emails from `generateIntroEmail()` / `generateFollowUp()` do NOT bake in a footer, so they get the correct single footer. During the merge transition you will have both draft types in the queue simultaneously.

**Why it happens:**
Two independent paths were built at different times. The compliance layer was added to `sendOutreachEmail` after the template system was established, but the template already had its own footer.

**How to avoid:**
During dead code removal of template email fields (`emailBodyHtml`, `emailBodyText` on `WorkflowLossMap`), audit every `sendOutreachEmail` call site to confirm none are passing pre-footer content. Add a test: send a draft through the queue, verify the unsubscribe link appears exactly once in the resulting bodyHtml.

**Warning signs:**
Sent emails in Resend activity log show two "Geen verdere emails ontvangen" lines. The second is usually visually odd (different styling from the compliance-added one).

**Phase to address:**
Dead code cleanup phase (WorkflowLossMap email fields). Add assertion to send-email.test.ts that checks footer count.

---

### Pitfall 3: Evidence-Rich Context Stripped Before AI Prompt — Follow-Ups Become Generic

**What goes wrong:**
`generateFollowUp()` in `lib/ai/generate-outreach.ts` accepts `OutreachContext`, which contains only contact/company fields from the Prospect record (industry, technologies, description). It does NOT receive the hypothesis text, evidence items, or analysis narrative from `ProspectAnalysis`. Follow-up emails therefore default to generic sales language ("Ik heb begrepen dat u werkt in de…") instead of referencing the specific pain points from the research.

**Why it happens:**
`OutreachContext` was designed for intro emails where evidence is implicit (the prospect hasn't been reached yet). The same context shape was reused for follow-ups without extending it to carry the evidence context. The cadence engine in `processDueCadenceSteps` loads prospect fields but never loads `ProspectAnalysis` or `WorkflowHypothesis` records.

**How to avoid:**
Extend `OutreachContext` with an optional `evidence` field that carries the top 3-5 hypothesis titles and the analysis narrative. In `processDueCadenceSteps`, query `ProspectAnalysis.content` from the latest research run. Pass this into `buildFollowUpPrompt`. Limit evidence context to ~300 tokens to avoid prompt bloat.

**Warning signs:**
Review follow-up drafts and compare openings: if they don't mention any specific pain point from the research, evidence threading is broken. Compare intro draft vs follow-up for same prospect — intro is specific, follow-up is generic.

**Phase to address:**
Multi-step cadence / AI follow-up generation phase. Required before cadence follow-ups are considered production-quality.

---

### Pitfall 4: Signal Diff-Detection Fires Repeatedly on Stale Evidence

**What goes wrong:**
The research refresh cron runs every 14 days and produces new `EvidenceItem` rows for each prospect. If "HEADCOUNT_GROWTH" evidence appears in both the previous run and the new run, but the signal-detection logic only checks whether a signal type is new in the latest `ResearchRun`, it will create a new `Signal` record and trigger a new draft on every refresh — even when the headcount hasn't changed. Result: a prospect who was growing 6 months ago continuously receives headcount-triggered emails.

**Why it happens:**
The `Signal` model stores `isProcessed: false` on creation and gets marked `isProcessed: true` after `processSignal` runs. However, if signal detection creates a new `Signal` on every research run without deduplicating against recent signals of the same type, the flag is ineffective as a true idempotency guard.

**How to avoid:**
Before creating a new `Signal` record during diff-detection, check whether an unprocessed or recently processed signal of the same type exists for this prospect within a configurable lookback window (e.g., 30 days). Use `db.signal.findFirst({ where: { prospectId, signalType, createdAt: { gte: lookbackDate } } })` and skip creation if found. Make the lookback window configurable per signal type (job changes: 90 days; headcount growth: 30 days).

**Warning signs:**
Multiple `Signal` records with identical `signalType` and `prospectId` created within days of each other. Prospect receives the same "your company is growing" email twice or more.

**Phase to address:**
Signal detection implementation phase. The dedup guard must be part of the detection function, not a retrospective cleanup.

---

### Pitfall 5: `OutreachLog.metadata` Shape Inconsistency Breaks Queue Rendering

**What goes wrong:**
`OutreachLog.metadata` is an untyped `Json?` field used to carry different shapes depending on origin: WorkflowLossMap drafts store `{ workflowLossMapId }`, cadence drafts store `{ kind: 'cadence_draft', outreachSequenceId, outreachStepId, evidenceBacked }`, signal drafts store `{ ruleId, signalId, personalizedOpener, callToAction }`. The queue page (`app/admin/outreach/page.tsx`) casts with `as any` and accesses fields like `metadata.language` directly. Adding new draft kinds without updating the queue UI causes silent undefined reads (no type error, wrong rendering).

**Why it happens:**
`Json?` fields in Prisma are untyped at the application layer. The project has a known pattern of `as any` casts for metadata (flagged in MEMORY.md as tech debt). Each new draft source adds a new shape without a discriminated union.

**How to avoid:**
Define a typed `OutreachLogMetadata` discriminated union with at least these variants: `{ kind: 'wlm_draft', workflowLossMapId: string }`, `{ kind: 'cadence_draft', outreachSequenceId: string, outreachStepId: string }`, `{ kind: 'signal_draft', ruleId: string, signalId: string }`, `{ kind: 'intro_draft' }`. Provide a `parseOutreachLogMetadata(raw: unknown): OutreachLogMetadata` function used at every read site. The queue UI should branch on `kind` for source badges.

**Warning signs:**
Queue shows blank source badges for new draft types. `metadata.workflowLossMapId` is undefined for cadence drafts causing the loss-map CTA check to always fail. TypeScript compiler does not catch this because of `as any` casts.

**Phase to address:**
Queue unification phase (making all draft types visible in one queue). The typed metadata parser should be created before writing any new queue rendering code.

---

### Pitfall 6: Dead Code Removal Deletes WorkflowLossMap Email Fields Still Referenced in Asset Router

**What goes wrong:**
`WorkflowLossMap.emailBodyHtml`, `.emailBodyText`, and `.emailSubject` are generated by `workflow-engine.ts` and consumed in `server/routers/assets.ts` (line 173: `emailBodyHtml: draft.emailBodyHtml`) and `server/routers/campaigns.ts` (line 759: `emailBodyHtml: draft.emailBodyHtml`). If dead code cleanup removes the generation path but the asset/campaign routers still reference these fields, approved sends through those routers break silently (empty body email sent) or loudly (Prisma field error).

**Why it happens:**
The two code paths (old WorkflowLossMap-based send and new AI-based send) share `sendOutreachEmail()` but differ in how they populate the body. Removing the generation doesn't automatically remove the consumption.

**How to avoid:**
Before removing any WorkflowLossMap email generation code, run a full grep for `emailBodyHtml`, `emailBodyText`, `emailSubject` across the entire codebase and list all references. Deprecate those fields in the schema at the same time (mark with `@deprecated` comment). Confirm the asset router and campaign router are updated to use `OutreachLog.bodyHtml` from the new AI-generated draft path before deleting.

**Warning signs:**
TypeScript does NOT catch this because `WorkflowLossMap` fields are queried via Prisma includes that return typed objects — but if the fields still exist in the schema, they just return empty string or null after the generation code is removed, not a compile error.

**Phase to address:**
Dead code cleanup phase. Do a reference audit as the very first step before touching workflow-engine.ts.

---

### Pitfall 7: Cadence Step Created But Evidence Evidence-Context Missing — Empty Placeholder Body Shipped

**What goes wrong:**
In `evaluateCadence()`, a new `OutreachStep` is created with `bodyText: ''` and `bodyHtml: undefined` as a placeholder. The cron `processDueCadenceSteps` is supposed to fill in the AI content when the step is due. If the cron fails (AI API timeout, Gemini quota) the error is caught with `console.error` and the step is promoted to `QUEUED` status with empty body anyway (line 512: `await db.outreachStep.update({ status: 'QUEUED' })`). The draft queue then shows a blank email.

**Why it happens:**
The error handling in `processDueCadenceSteps` uses "fall back to empty-body draft — admin can write copy manually" as the safety valve. This was reasonable in early cadence development but becomes a reliability issue when email generation is the primary path.

**How to avoid:**
When AI generation fails, keep the step in `DRAFTED` status (do not promote to `QUEUED`). Increment a retry counter in metadata. After 3 failures, create a `QUEUED` step with a body that explicitly says "AI generation failed — please write manually." Add a separate admin notification or visual indicator in the queue for generation failures.

**Warning signs:**
Draft queue shows emails with blank body and no subject. Queue count increases but send rate drops. Check logs for `[cadence-engine] generateFollowUp failed` entries.

**Phase to address:**
Multi-step cadence phase. Fix error handling before enabling cadence in production.

---

### Pitfall 8: Bidirectional Link Breaks When Prospect Page Looks Up Drafts by `prospectId` But OutreachLog Has No `prospectId`

**What goes wrong:**
`OutreachLog` does not have a `prospectId` field. It has `contactId → Contact → prospectId`. Any query for "all drafts for prospect X" requires a JOIN through Contact. The prospect detail page currently shows outreach status only through `Contact.outreachStatus` and `OutreachSequence`. If the bidirectional link feature queries `OutreachLog` directly by prospectId (a natural mistake), it returns nothing.

**Why it happens:**
The `OutreachLog` schema was designed contact-first. Adding prospect-level outreach visibility requires traversing the relation graph — this is non-obvious and easily forgotten when writing new tRPC procedures.

**How to avoid:**
Write the prospect → outreach query once, in a shared utility function: `getOutreachLogsForProspect(db, prospectId)` that does `db.outreachLog.findMany({ where: { contact: { prospectId } } })`. Use this function in both the prospect detail page and the queue. Never write inline `where: { prospectId }` on OutreachLog — it will silently return empty results (no Prisma error because `prospectId` isn't a field).

**Warning signs:**
Prospect detail outreach tab shows no drafts even when drafts exist in the queue for that prospect's contacts. Check Prisma query: if it uses `OutreachLog.findMany({ where: { prospectId } })` directly, that's the bug.

**Phase to address:**
Bidirectional linking phase. Write the utility function before building the prospect detail outreach tab.

---

### Pitfall 9: `processSignal` Creates Duplicate Drafts If Called Multiple Times Before `isProcessed` Is Set

**What goes wrong:**
`processUnprocessedSignals()` queries signals where `isProcessed: false`, processes them in a loop, and marks `isProcessed: true` at the end of `processSignal`. If "Process Signals" is clicked twice quickly (the button does not disable immediately on the second click), or if the cron and the manual button run concurrently, the same signal is processed twice, creating two drafts for the same contact.

**Why it happens:**
There is no atomic claim on the signal before processing begins. The `isProcessed` flag is set at the end of processing, not at the start. The button handler in the UI does disable the button while `isPending`, but concurrent processes (cron + button) have no coordination.

**How to avoid:**
Add an atomic claim at the start of `processSignal`: `await db.signal.updateMany({ where: { id: signal.id, isProcessed: false }, data: { isProcessed: true } })` and check `count === 1`. If count is 0, another process claimed it — skip. This is the same idempotency pattern already established elsewhere in the codebase (`Idempotency: atomic updateMany with status guard` from MEMORY.md).

**Warning signs:**
Multiple drafts with identical subject line exist in the queue for the same contact. `Signal` records have `isProcessed: true` but two `OutreachLog` records link to the same `signalId` in metadata.

**Phase to address:**
Signal processing phase. Add the atomic claim before wiring the manual trigger button.

---

## Technical Debt Patterns

| Shortcut                                                                                                   | Immediate Benefit                       | Long-term Cost                                                                                | When Acceptable                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `as any` on `OutreachLog.metadata`                                                                         | Avoids defining discriminated union now | Silent undefined reads when new draft kinds added; queue rendering breaks without type errors | Never in new code — create `parseOutreachLogMetadata()` utility                                   |
| Empty placeholder body in cadence steps                                                                    | Cadence step created even if AI is down | Admin sees blank drafts; sends empty emails if bulk-approved without reading                  | Only if admin is forced to review (remove from bulk-approve pool when body is empty)              |
| `loadProjectSender` duplicated in three files (`processor.ts`, `cadence/engine.ts`, `routers/outreach.ts`) | Each file is self-contained             | Sender config changes must be applied three times; drift inevitable                           | Extract to `lib/outreach/sender.ts` before adding a fourth call site                              |
| `buildOutreachContext` duplicated in `routers/outreach.ts` and `cadence/engine.ts`                         | Fast to write                           | Two diverging context builders; evidence fields added to one, not the other                   | Extract to `lib/outreach/context.ts` in unification phase                                         |
| Signal rules hard-coded in `lib/automation/rules.ts`                                                       | Simple, no DB reads                     | Adding a new rule requires a deploy; rules can't be tuned per project                         | Acceptable at current scale; add DB-backed rules only when multiple projects need different rules |

---

## Integration Gotchas

| Integration                | Common Mistake                                                                                                                                                                                  | Correct Approach                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resend email send          | Sending with `from` address not matching DKIM domain — Resend silently degrades deliverability                                                                                                  | Always use `info@klarifai.nl` from address; the `OUTREACH_FROM_EMAIL` env var must match the verified Resend domain                              |
| Resend email send          | No idempotency key on send — retry on timeout creates duplicate sends                                                                                                                           | Resend's `idempotencyKey` parameter is available but not currently used. For now rely on DB `status: 'sent'` check on OutreachLog before sending |
| Gemini Flash AI generation | Parsing error on JSON output swallowed silently — fallback returns empty body                                                                                                                   | Add structured logging on `JSON.parse` failures with the raw response text; don't silently fall back to empty                                    |
| Gemini Flash AI generation | Model responds with markdown fences even with explicit "No markdown code fences" instruction — already handled in `generateJSON`                                                                | The strip logic is correct; do not remove it when cleaning up                                                                                    |
| Research refresh cron      | Runs `executeResearchRun` sequentially for all stale prospects in one cron tick — if 10 prospects are stale, all 10 run in the same invocation, each taking 60-90 seconds                       | Add a `limit: 3` cap to `runResearchRefreshSweep` options and schedule cron more frequently rather than processing more per tick                 |
| Cadence cron               | `processDueCadenceSteps` queries `nextStepReadyAt: { lte: now }` — if cron misses a tick (deploy, downtime), many steps become due simultaneously and all trigger AI generation in a tight loop | Add a processing cap (`take: 10` is already present) and verify the AI generation calls are not all awaited in series for the entire batch       |

---

## Performance Traps

| Trap                                                                                        | Symptoms                                                                                   | Prevention                                                                                                                  | When It Breaks                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Loading full `ProspectAnalysis.content` JSON for every draft in the queue                   | Queue page slow at 50+ drafts; each row triggers a nested query loading the full narrative | Use a summary/excerpt field or load analysis content only when draft is expanded                                            | At 20+ prospects with drafts in queue |
| Signal detection scanning all evidence items on every research run                          | Research run completion handler slow; timeout on large evidence sets (83 items for Nedri)  | Diff-detect only on evidence items where `researchRunId` matches the latest two runs for that prospect                      | At 50+ evidence items per prospect    |
| `processUnprocessedSignals` processes up to 50 signals sequentially including AI generation | Manual "Process Signals" button appears stuck for 30+ seconds if many signals pending      | Add progress feedback to the UI; process in parallel batches of 5 with `Promise.allSettled`                                 | At 10+ unprocessed signals            |
| `getDecisionInbox` query used by the queue loads full `bodyHtml` for all 150 drafts         | Queue initial load slow; large HTML strings serialized over tRPC                           | Load only `subject`, `bodyText` preview, and metadata in the list query; load full `bodyHtml` only when a draft is expanded | At 30+ drafts in queue                |

---

## Security Mistakes

| Mistake                                                                  | Risk                                                                                                                    | Prevention                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signal processing triggered via tRPC mutation without rate limiting      | Adversarial admin clicks "Process Signals" in rapid succession, exhausting Gemini quota and creating hundreds of drafts | Add a per-minute rate limit on `processSignals` mutation; return 429 if called within 60 seconds of last call                                                                     |
| `OutreachLog.metadata` includes `unsubscribeUrl` with HMAC token         | Token leaks if metadata is exported or logged                                                                           | Token is per-contact+email combination; it's HMAC-signed and non-reversible. Accept as design: the URL already exists in the email body                                           |
| Bulk approve sends emails to contacts with `outreachStatus: 'OPTED_OUT'` | GDPR violation, anti-spam complaint                                                                                     | `sendOutreachEmail` already checks `outreachStatus === 'OPTED_OUT'` and throws. Bulk approve must surface this error per-draft, not fail the entire batch silently                |
| Dead code cleanup removes GDPR compliance footer by accident             | Every sent email lacks unsubscribe link — illegal in NL/BE                                                              | The footer is in `sendOutreachEmail` (`withComplianceFooter`), not in the draft body. As long as `sendOutreachEmail` is the only send path, footer cannot be accidentally removed |

---

## UX Pitfalls

| Pitfall                                                                                                        | User Impact                                                                    | Better Approach                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Draft queue shows intro, follow-up, and signal drafts with no visual distinction                               | Admin cannot tell why a draft was generated; misjudges relevance               | Add a source badge to each row: "Intro", "Follow-up (day 3)", "Signal: Headcount Growth" using `metadata.kind`            |
| "Process Signals" button on outreach page processes old signals for prospects the admin has already moved past | Stale signal drafts pollute the queue                                          | Add a staleness cutoff: only process signals where `detectedAt > (now - 30 days)`                                         |
| Prospect detail page shows no outreach history                                                                 | Admin must go to outreach page to check status; context switching breaks focus | Prospect detail should show last 3 outreach logs and current draft status inline in the Outreach tab                      |
| Bidirectional link from draft queue to prospect opens in a new context                                         | Admin loses queue position                                                     | Link to prospect in a slide-over or modal, not full navigation                                                            |
| Bulk approve sends immediately without per-draft preview                                                       | Admin approves drafts they haven't read                                        | Require at least one draft to be expanded before bulk approve is enabled; or show a confirmation modal with preview count |

---

## "Looks Done But Isn't" Checklist

- [ ] **Unified draft queue:** All three draft kinds (intro, cadence follow-up, signal-triggered) appear in `getDecisionInbox` — verify by creating one of each type and checking the queue.
- [ ] **Cadence follow-up evidence threading:** Check that a generated follow-up email references at least one specific pain point from the prospect's `ProspectAnalysis` — not just the company name.
- [ ] **Signal dedup guard:** Manually trigger two research refreshes in quick succession; verify only one set of signal drafts is created, not two.
- [ ] **Dead code removal complete:** Run `grep -r 'emailBodyHtml\|emailBodyText\|emailSubject' --include='*.ts'` after cleanup; should return zero results except schema definition and this checklist.
- [ ] **GDPR footer present exactly once:** Send a test email from the new AI path; view raw HTML in Resend activity log; count occurrences of "uitschrijven".
- [ ] **Prospect detail bidirectional link works:** Open any prospect that has a draft in the queue; the outreach tab on the detail page must show that draft.
- [ ] **Bulk approve excludes empty-body drafts:** Filter `bulkApproveLowRisk` to skip any draft where `bodyHtml` and `bodyText` are both empty/null.
- [ ] **`OutreachSequence.status` updated on send:** After approving a draft from the queue, verify the linked `OutreachSequence.status` transitions from `DRAFTED` to `SENT`. Cadence depends on this for `buildCadenceState`.

---

## Recovery Strategies

| Pitfall                                               | Recovery Cost | Recovery Steps                                                                                                                                           |
| ----------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate drafts from signal double-processing        | LOW           | Delete duplicate `OutreachLog` records; reset duplicate `Signal.isProcessed` to false and re-mark; add dedup guard before re-running                     |
| Double unsubscribe footer in sent emails              | LOW-MEDIUM    | Cosmetic issue; no regulatory violation if link is present twice. Patch the template stripping in next deploy. No re-send required                       |
| Cadence empty-body drafts in queue                    | LOW           | Filter queue to hide `bodyHtml IS NULL AND bodyText = ''`; add admin button "Regenerate" that re-runs AI generation for a specific draft                 |
| Dead code removal broke asset router send path        | HIGH          | Revert WorkflowLossMap email field deletion; the fields still exist in DB (not a migration), so restoring the query is enough. Deploy hotfix immediately |
| Signal diff-detection floods queue with stale signals | MEDIUM        | Add `detectedAt > (now - 30 days)` filter to `processUnprocessedSignals`; run a DB update to mark all signals older than 30 days as processed            |

---

## Pitfall-to-Phase Mapping

| Pitfall                                          | Prevention Phase                      | Verification                                                                          |
| ------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------- |
| stale `classifyDraftRisk` blocks new draft types | AI engine unification phase           | Run all draft types through queue; verify bulk-approve count is non-zero              |
| Double compliance footer                         | Dead code cleanup phase               | Unit test in send-email.test.ts: count "uitschrijven" occurrences                     |
| Follow-up drafts lack evidence context           | AI follow-up generation phase         | Manual review: follow-up references at least one specific pain point                  |
| Signal diff-detection fires on every refresh     | Signal detection implementation phase | Trigger two research refreshes; assert signal count incremented by 1 not 2            |
| Metadata shape inconsistency breaks queue        | Queue unification phase               | TypeScript: create discriminated union, remove `as any` from metadata reads           |
| Dead code removal breaks asset router            | Dead code cleanup phase               | Grep audit before deletion; run all E2E send paths after removal                      |
| Empty cadence placeholder body promoted to queue | Cadence phase                         | Check `processDueCadenceSteps`: failed AI calls leave step as `DRAFTED`, not `QUEUED` |
| Bidirectional link finds no drafts (wrong query) | Bidirectional linking phase           | Open prospect with known draft; verify detail page shows it                           |
| Signal double-processing from concurrent runs    | Signal processing phase               | Atomic claim test: call processSignals twice in parallel; assert one draft created    |

---

## Sources

- Direct codebase inspection: `lib/cadence/engine.ts`, `lib/automation/processor.ts`, `lib/ai/generate-outreach.ts`, `lib/outreach/send-email.ts`, `server/routers/outreach.ts`, `prisma/schema.prisma`, `app/admin/outreach/page.tsx`
- Project memory: MEMORY.md (known tRPC v11 inference gaps, idempotency pattern, metadata shape tech debt)
- PROJECT.md (v8.0 milestone goal, current architecture decisions)

---

_Pitfalls research for: v8.0 Unified Outreach Pipeline — Qualifai_
_Researched: 2026-03-16_
