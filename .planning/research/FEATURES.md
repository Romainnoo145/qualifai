# Feature Research

**Domain:** Sales automation oversight console — admin UX for evidence-backed outbound prospecting
**Researched:** 2026-02-22
**Milestone:** v2.0 — Streamlined Oversight Console
**Confidence:** MEDIUM-HIGH (industry patterns HIGH; client-side hypothesis validation LOW — novel pattern with no direct comparators)

---

## Scope Boundary

This file covers only what is NEW in v2.0. The following already exist and are not re-researched:

- Dashboard with action queue (hypotheses to review, drafts to approve, calls due, replies) — Phase 15
- Prospect detail page with 4-section story flow (Evidence → Analysis → Outreach Preview → Results) — Phase 13
- Campaign management with funnel metrics — Phase 14
- Draft queue page at /admin/outreach — Phase 10–13
- Signals feed — Phase 9
- Use Cases catalog — Phase 6
- Client-facing prospect dashboard at /voor/[slug] — Phase 11
- Multi-touch cadence engine (Gmail, LinkedIn, WhatsApp, Call) — Phase 10
- Research pipeline (SerpAPI + Crawl4AI) — Phase 8
- Hypothesis generation + manual approval gate — Phase 7

The core insight for v2.0: **hypothesis approval moves from admin to the prospect's own /voor/ dashboard**. Admin's job narrows to: (1) verify research quality, (2) one-click send when ready, (3) track results. Remove the ~100-screen navigation maze.

---

## Industry Patterns Observed

Research across Outreach.io, Salesloft, HubSpot Breeze Prospecting Agent, Apollo.io, Instantly.ai, Clay.com, and Salesforce reveals consistent patterns for oversight-console UIs:

**Task queue "play mode":** Users expect a queue they can step through. Outreach.io's Universal Taskflow lets a rep hit "play" and process tasks one-by-one with a popup — never navigating to individual records. Salesloft's AI draft review works the same way: drafts land in an outbox, rep scans and hits send. The pattern is "process without navigation."

**Write-ahead drafting:** Salesloft generates AI email drafts the evening before they are due ("write-ahead"), so reps open to a pre-filled queue each morning. This is the pattern Qualifai's draft queue approximates but has not fully realized.

**Human-in-the-loop with escalation thresholds:** The Instantly.ai AI Reply Agent has two modes — HITL (draft shown for approval) and Autopilot (sends automatically). Teams are advised to start in HITL, approve 20–30 drafts to calibrate trust, then switch to Autopilot. This calibration-before-trust pattern is relevant to Qualifai's approval workflow.

**Confidence score gating:** Modern AI sales tools (HubSpot Breeze, Apollo, Clay) assign a score to each prospect and set a minimum threshold before the prospect enters an action queue. Below threshold = back to enrichment. Above threshold = ready to process. No tool I found calls this "sufficient research" explicitly, but the score-gate pattern is universal.

**Client-facing approval portals are novel:** No direct comparator found for the pattern of "prospect approves the messaging hypothesis on their own dashboard before outreach is sent." HubSpot's Breeze agent offers rep review, not prospect review. This is Qualifai's unique differentiator but has no established UX playbook to borrow from — treat as HIGH design risk.

---

## Table Stakes

Features the admin user (Romano) expects. Missing these = oversight console feels like a demo, not a tool.

| Feature                                                    | Why Expected                                                                                                                                                                                                                                                  | Complexity | Notes                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Research quality indicator per prospect**                | Admin needs to know at a glance whether research is sufficient before investing time in a prospect. Score-gating is universal in AI prospecting tools (Clay, HubSpot, Apollo all do this).                                                                    | MEDIUM     | Compute from: evidence count, evidence confidence scores, hypothesis count, evidence recency. Surface as a simple traffic-light (red/amber/green) or score (0–100). |
| **"Needs more research" action that re-triggers pipeline** | When research is insufficient, admin must have a one-click way to request re-research. Currently this is buried in prospect detail.                                                                                                                           | LOW        | Button triggers existing research pipeline endpoint. Sets prospect status to "research_pending".                                                                    |
| **One-click send from draft queue**                        | Send a draft without navigating to the prospect detail page. Outreach/Salesloft pattern: scan draft, approve, next. The current /admin/outreach page shows drafts but the click flow is unclear.                                                              | MEDIUM     | Requires: draft preview inline, channel badge, send button, skip/defer option. No full page load between items.                                                     |
| **Prospect pipeline stage as visible status**              | Admin needs to see where each prospect is in the flow: New → Research Running → Research Complete → Ready to Send → In Cadence → Responded → Closed. Currently scattered across DB fields with no UI representation.                                          | MEDIUM     | Map existing DB fields (researchStatus, cadenceState, replyStatus) to a unified stage enum. Stage chip shown on prospect list rows and prospect header.             |
| **Clear stage transition triggers**                        | Each stage transition must have an obvious cause (research finishes → auto-advance; draft approved → auto-advance; prospect replies → auto-advance). Admin should never wonder why something changed stages.                                                  | MEDIUM     | Activity log or status explanation text shown beneath stage chip ("Research completed 2h ago").                                                                     |
| **Bulk actions on draft queue**                            | When multiple drafts are ready, admin needs to approve all high-confidence ones in one action. Salesloft and Outreach both support batch approval.                                                                                                            | MEDIUM     | "Approve all above threshold X" button. Individual overrides still possible.                                                                                        |
| **Empty state that explains next action**                  | When the action queue is empty, admin should not see a blank screen. They should see "All caught up — add a new prospect or wait for research to complete." The current empty state (CheckCircle2 + "All caught up!") exists but gives no next-step guidance. | LOW        | Update empty state copy to include one CTA button.                                                                                                                  |
| **Research status surfaced on dashboard**                  | Currently the action queue shows hypotheses/drafts/tasks/replies but NOT research-in-progress. Admin has no visibility into background jobs running.                                                                                                          | LOW        | Add "Research Running" section to action queue dashboard with prospect name + progress indicator.                                                                   |

**Confidence: HIGH** — All of these are established patterns in Outreach.io, HubSpot, Salesloft, and Apollo. The specific implementations vary but the expected behaviors are consistent.

---

## Differentiators

Features that make Qualifai's oversight console meaningfully different from generic sales tools.

| Feature                                                                     | Value Proposition                                                                                                                                                                                                                                                                                      | Complexity | Notes                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prospect-side hypothesis validation (on /voor/)**                         | Prospect sees the pain hypotheses the system identified about their business and can mark which resonate. Admin uses this signal to decide which hypothesis to send outreach about. Removes the "cold" from cold outreach — prospect has already acknowledged the pain point before first email lands. | HIGH       | No direct comparator found. Novel UX pattern. Prospect dashboard already exists at /voor/[slug]. Needs: hypothesis display on /voor/, confirm/dismiss interaction, webhook back to admin system, admin visibility of confirmed hypotheses. Design risk: may feel intrusive to some prospects. |
| **Evidence quality breakdown per hypothesis**                               | Instead of a single research score, show admin which specific evidence items support each hypothesis. Admin can see "this hypothesis has 3 supporting evidence items with 0.8+ confidence" vs. "this hypothesis has 1 item at 0.3 confidence." Drives better approval decisions.                       | MEDIUM     | Depends on existing ProofMatch and EvidenceItem.confidenceScore data. Surfaced in Analysis section of prospect detail.                                                                                                                                                                        |
| **"Need more research" specifies what's missing**                           | When research is insufficient, the system explains WHY: "No review evidence found. No job postings found. Only 2 evidence items total." Admin can then decide whether to wait, manually add URLs, or proceed anyway.                                                                                   | MEDIUM     | Compute gap explanation from evidence types present vs. expected. Show inline in research quality indicator.                                                                                                                                                                                  |
| **Stage-aware draft queue (only show drafts for prospects in ready state)** | Draft queue today shows all pending drafts regardless of prospect stage. A prospect whose research is still running shouldn't have drafts in the queue yet. Filter by stage so admin only sees actionable items.                                                                                       | LOW        | Filter getActionQueue query by prospect stage.                                                                                                                                                                                                                                                |
| **Confidence-gated auto-advance**                                           | When research completes and the quality score exceeds a threshold, auto-move prospect to "Ready to Send" stage and surface in action queue. Admin doesn't need to check in — system surfaces the prospect when it's ready.                                                                             | MEDIUM     | Requires: quality score computation after research job completes, stage transition logic, queue refresh trigger.                                                                                                                                                                              |
| **Prospect activity as urgency signal**                                     | When a prospect visits their /voor/ dashboard or downloads the PDF, this should increase their urgency rank in the task queue. Currently wizard sessions exist but don't influence queue ordering.                                                                                                     | MEDIUM     | Read WizardSession signals (maxStepReached, pdfDownloaded, callBooked) into task priority score. Already identified in v1.1 FEATURES.md as a deferred differentiator — now is the time.                                                                                                       |

**Confidence:** Prospect-side hypothesis validation — LOW (novel, no comparators). All others — MEDIUM-HIGH (build on existing codebase patterns, industry evidence).

---

## Anti-Features

Features that seem like good ideas for the oversight console but create real problems.

| Feature                                                        | Why Requested                                             | Why Problematic                                                                                                                                                                                                                                                                                                  | Alternative                                                                                                                                                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fully automated send without approval gate**                 | Speed — remove the human step entirely                    | Core brand promise of Qualifai is evidence-backed, human-verified outreach. Auto-send also creates legal risk (GDPR, anti-spam) for the NL/BE market. Industry data: Instantly.ai advises starting in HITL mode and calibrating before moving to autopilot — this calibration has not happened yet for Qualifai. | Keep approval gate. Make it faster (one-click, inline preview). Remove it as an option only after trust is established through 50+ approved drafts.                                                              |
| **Kanban board as primary pipeline view**                      | Visual, familiar from project management tools            | For a single-user tool with ~20-50 active prospects, a Kanban board adds visual complexity without actionability. Drag-and-drop stage transitions create data integrity questions (what triggers actually fired?).                                                                                               | List view with stage chip filter. Kanban is appropriate at 100+ active prospects.                                                                                                                                |
| **Prospect approves all messaging before any email is sent**   | Maximize relevance — only send what prospect pre-approved | If every prospect must approve before first email, the outreach tool loses its outbound nature entirely. It becomes inbound-only. Also: how does the prospect find the /voor/ dashboard without being contacted first? Chicken-and-egg problem.                                                                  | Hypothesis validation on /voor/ is triggered AFTER first contact (prospect receives a warm email with a /voor/ link). Admin sends first email → prospect validates → subsequent emails use validated hypotheses. |
| **Global research quality threshold (same for all prospects)** | Simple, consistent                                        | Different industry verticals have different evidence availability. A Dutch bakery has no Glassdoor reviews, no G2 profile, no job board presence — but has rich website content. A SaaS company has the inverse. One threshold fails both.                                                                       | Threshold as a starting point with per-prospect override. Or: compute score relative to expected evidence for that industry type.                                                                                |
| **Prospect-facing "approve our email before we send it"**      | Maximum transparency                                      | Asking a prospect to approve the email text they'll receive defeats the purpose — they'd just not approve anything. Approval should be at the hypothesis level ("does this pain point resonate?") not the message level.                                                                                         | Prospect validates which pain points resonate on /voor/. Admin then drafts messages around validated hypotheses. Prospect never sees the draft.                                                                  |
| **Research completeness as a hard blocker**                    | Quality gate prevents low-quality outreach                | If research can never complete for certain prospect types (thin web presence, Dutch SMB), a hard blocker means those prospects never get contacted.                                                                                                                                                              | Research quality is a soft gate: warn admin with amber indicator, but allow proceeding with explicit confirmation ("proceed with limited research").                                                             |

**Confidence: HIGH** — These are derived from the project's own anti-feature list (v1.1 FEATURES.md), industry pattern research, and direct product context (NL/BE market with thin-presence SMBs).

---

## Feature Dependencies

```
Research Quality Indicator
    └──requires──> Evidence items with confidenceScore (EXISTS in schema)
    └──requires──> Hypothesis count per prospect (EXISTS via api.hypotheses.listByProspect)
    └──computes──> Quality Score (NEW: scoring function in server)
    └──surfaces──> Prospect list row chip (NEW: UI)
    └──surfaces──> Prospect detail header (NEW: UI)

Research Quality Indicator
    └──gates──> Draft queue visibility (NEW: filter in getActionQueue)
    └──triggers──> Auto-advance to "Ready to Send" stage (NEW: post-research hook)

Prospect Pipeline Stage
    └──requires──> Unified stage enum (NEW: maps existing fields)
    └──surfaces──> Prospect list stage chip (NEW: UI)
    └──surfaces──> Prospect detail header stage chip (NEW: UI, extends existing status badge)
    └──enables──> Stage-aware draft queue filter (NEW: query predicate)

"Need More Research" flow
    └──requires──> Research quality indicator (shows WHY insufficient)
    └──triggers──> Existing research pipeline startResearch mutation (EXISTS)
    └──sets──> Prospect stage back to "Research Running" (NEW: stage transition)

One-Click Send from Draft Queue
    └──requires──> Inline draft preview (NEW: modal or expand-in-place)
    └──requires──> Existing sendDraft mutation (EXISTS in outreach router)
    └──advances──> Prospect stage to "In Cadence" (NEW: post-send hook)

Prospect-Side Hypothesis Validation (/voor/)
    └──requires──> Hypothesis display on /voor/ page (NEW: component)
    └──requires──> Confirm/dismiss interaction on /voor/ (NEW: API + UI)
    └──requires──> First-contact email already sent (DEPENDENCY: outreach must precede validation)
    └──signals──> Admin dashboard: "prospect confirmed pain points" (NEW: action queue item type)
    └──feeds──> Draft generation: use validated hypotheses as primary angle (NEW: generation param)

Prospect Activity Urgency Signal
    └──requires──> WizardSession.maxStepReached, pdfDownloaded, callBooked (EXISTS in schema)
    └──requires──> Task priority scoring update (NEW: sort key in getActionQueue)
    └──surfaces──> Higher position in task queue (NEW: ordering change)
```

### Dependency Notes

- **Research Quality Indicator must precede Draft Queue changes:** The draft queue filter (show only ready-stage prospects) depends on quality scores existing. Build scoring first.
- **Prospect Pipeline Stage is foundational:** Almost every other feature references it. Map the stage enum and add it to the prospect list before building anything else.
- **Prospect-Side Hypothesis Validation conflicts with "first email not yet sent":** Do not show hypothesis validation UI on /voor/ until admin has sent at least one outreach. Gate the /voor/ hypothesis section by `sequences.length > 0`.
- **One-Click Send enhances but does not block Draft Queue:** Draft queue is already built. One-click send is an improvement layer. Build after stage and quality indicator work is done.

---

## What "Sufficient Research" Looks Like

Based on industry patterns (Clay.com waterfall enrichment, HubSpot Breeze research quality, general AI prospecting scoring approaches) and Qualifai's specific evidence model:

**Definition of sufficient research (recommended thresholds):**

| Signal                                           | Minimum for Amber | Minimum for Green |
| ------------------------------------------------ | ----------------- | ----------------- |
| Evidence items total                             | 3+ items          | 8+ items          |
| Evidence items with confidenceScore >= 0.6       | 1+ items          | 4+ items          |
| Evidence source diversity (distinct sourceTypes) | 1 type            | 2+ types          |
| Hypotheses generated                             | 1+ hypotheses     | 2+ hypotheses     |
| Evidence age (most recent item)                  | < 30 days         | < 14 days         |

**Red (insufficient):** Any of — zero hypotheses, OR zero evidence items, OR all evidence items have confidenceScore < 0.4.

**Amber (limited):** Meets minimums but not green thresholds. Admin can proceed with warning.

**Green (sufficient):** Meets all green thresholds. Auto-advance to "Ready to Send" stage.

**Important caveat:** Dutch SMBs with thin web presence may never reach green thresholds through automated research alone. The system must make amber + manual proceed the comfortable fallback, not an error state.

**Confidence: MEDIUM** — Thresholds derived from industry patterns and Qualifai's existing evidence model. Should be validated against actual prospect data after launch. These are starting hypotheses, not proven values.

---

## What "Need More Research" Flows Look Like

Based on how HubSpot Breeze, Clay.com, and Outreach.io handle insufficient data:

**Expected flow:**

1. Admin sees amber or red quality indicator on a prospect row or in prospect detail header
2. Admin clicks indicator → tooltip or popover explains what's missing: "Found 2 evidence items. No review evidence. No job postings. 0 hypotheses generated."
3. Admin sees two options:
   - "Re-run Research" — triggers the existing research pipeline, sets stage to "Research Running"
   - "Add URLs Manually" — opens the existing manual URL input (already in evidence section) to supplement
4. If admin chooses to proceed anyway (amber state): "Proceed with limited research" explicit confirmation button. This bypasses the quality gate and moves to "Ready to Send" with a flag on the record.

**What NOT to do:** Do not block the admin completely (hard gate). The Dutch SMB market has thin evidence and the product must still be usable for those prospects.

**Confidence: MEDIUM** — Pattern derived from Clay.com's waterfall-then-warn approach and HubSpot Breeze's "review before send" model. No single tool implements exactly this flow but the components are established patterns.

---

## MVP Definition

### Launch With (v2.0)

Minimum set to achieve "admin navigates Qualifai in under 5 screens, not 100."

- [ ] **Prospect pipeline stage chip** — visible on list view and prospect detail header; maps existing DB fields to a unified 7-stage enum — _blocks everything else_
- [ ] **Research quality indicator** — traffic-light (red/amber/green) per prospect, shown on list row and prospect detail header — _unlocks quality-gated flows_
- [ ] **"Need more research" popover** — explains what's missing + one-click re-run trigger — _closes the gap identification loop_
- [ ] **Stage-aware action queue** — dashboard only surfaces prospects that are in actionable stages (removes noise from in-research prospects) — _makes dashboard usable daily_
- [ ] **Inline draft preview + one-click send** — draft expands in place in queue, send without full page navigation — _reduces clicks from 6 to 2_

### Add After Validation (v2.x)

- [ ] **Prospect-side hypothesis validation on /voor/** — depends on first-email flow being established; ship after 5+ prospects have received first emails
- [ ] **Confidence-gated auto-advance** — auto-move to "Ready to Send" when score hits green; requires quality scoring to be stable for 2+ weeks first
- [ ] **Bulk approve all drafts above threshold** — add after single-approve flow is working smoothly
- [ ] **Prospect activity urgency signal in task queue** — depends on WizardSession data being non-empty (needs active /voor/ users)

### Future Consideration (v3+)

- [ ] **Kanban board view** — only warranted at 100+ active prospects
- [ ] **Autopilot mode (auto-send without approval)** — only after 50+ manually approved drafts establish trust baseline; requires explicit opt-in

---

## Feature Prioritization Matrix

| Feature                                      | User Value | Implementation Cost | Priority |
| -------------------------------------------- | ---------- | ------------------- | -------- |
| Prospect pipeline stage chip                 | HIGH       | MEDIUM              | P1       |
| Research quality indicator                   | HIGH       | MEDIUM              | P1       |
| Stage-aware action queue                     | HIGH       | LOW                 | P1       |
| "Need more research" flow                    | HIGH       | LOW                 | P1       |
| Inline draft preview + one-click send        | HIGH       | MEDIUM              | P1       |
| Prospect-side hypothesis validation (/voor/) | HIGH       | HIGH                | P2       |
| Confidence-gated auto-advance                | MEDIUM     | MEDIUM              | P2       |
| Bulk approve above threshold                 | MEDIUM     | LOW                 | P2       |
| Prospect activity urgency ranking            | MEDIUM     | LOW                 | P2       |
| Research running visibility in dashboard     | LOW        | LOW                 | P2       |
| Kanban board                                 | LOW        | HIGH                | P3       |
| Autopilot auto-send                          | MEDIUM     | HIGH                | P3       |

---

## Competitor Feature Analysis

| Feature                        | Outreach.io                                   | Salesloft                                   | HubSpot Breeze                                                            | Qualifai v2.0 Approach                                                |
| ------------------------------ | --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Queue-first daily processing   | Play button, step through tasks one-by-one    | AI drafts ready in outbox each morning      | Prospecting agent queue with review-before-send                           | Dashboard action queue (exists); add inline send to remove navigation |
| Research quality gating        | Score threshold blocks sequence enrollment    | Not documented in public sources            | Breeze assigns research score; prospects below threshold stay in research | Traffic-light quality indicator; amber = warn, red = block            |
| Draft review workflow          | Popup on task row — no page nav required      | Write-ahead: draft ready before step is due | Full explanation of why draft was crafted + edit/approve                  | Currently full page nav required; v2.0 adds inline expand             |
| Prospect pipeline stage        | Configurable stages synced to Salesforce      | Pipeline dashboard per rep                  | Deal stage with automation triggers                                       | Unified stage enum mapped from existing DB fields                     |
| Client-side content validation | Not found                                     | Not found                                   | Not found                                                                 | Novel: prospect confirms hypotheses on /voor/ — no comparator exists  |
| "Need more research" flow      | Validation rules block enrollment, show error | Not documented                              | Breeze shows research gaps in agent interface                             | Popover with gap explanation + re-run button                          |
| Urgency/priority ranking       | Urgent tasks get alerts + auto-queue          | Not documented                              | Not documented                                                            | WizardSession signals feed task priority score                        |

---

## Sources

- Outreach.io task queue patterns: [How To Manage Outreach Tasks](https://support.outreach.io/hc/en-us/articles/235250348-How-To-Manage-Outreach-Tasks), [Universal Task Flow Overview](https://support.outreach.io/hc/en-us/articles/115001689133-Outreach-Everywhere-Universal-Task-Flow-Overview) — MEDIUM confidence (search summary, not direct page read)
- Salesloft AI draft step: [Draft an Email Step with AI](https://help.salesloft.com/s/article/Draft-an-Email-Step-with-AI?language=en_US), write-ahead pattern described in search results — MEDIUM confidence
- HubSpot Breeze Prospecting Agent: [Set up and use the prospecting agent](https://knowledge.hubspot.com/prospecting/use-the-prospecting-agent), [eesel.ai deep dive](https://www.eesel.ai/blog/breeze-prospecting-agent) — MEDIUM confidence
- Instantly.ai HITL mode: [AI Reply Agent for sales teams](https://instantly.ai/blog/ai-reply-agent-for-sales-teams/) — MEDIUM confidence
- Clay.com enrichment quality: [Clay data enrichment overview](https://www.smarte.pro/blog/clay-data-enrichment), waterfall match rate data — MEDIUM confidence
- Human-in-the-loop AI patterns: [Zapier HITL workflow guide](https://zapier.com/blog/human-in-the-loop/), [Permit.io HITL best practices](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) — HIGH confidence (consistent across multiple authoritative sources)
- Salesforce approval process patterns: [Salesforce Spring '26 Flow Approvals](https://automationchampion.com/2025/12/22/salesforce-spring26-release-quick-summary-2/) — MEDIUM confidence
- Qualifai existing system: Phase 13–15 plan files, v1.1 FEATURES.md, project memory — HIGH confidence (direct source)
- Client-side hypothesis validation: No comparator found. Treated as novel design pattern with LOW confidence on UX approach.

---

_Feature research for: Qualifai v2.0 Streamlined Oversight Console_
_Researched: 2026-02-22_
_Supersedes: v1.1 FEATURES.md (which covered evidence pipeline and cadence features, not oversight UX)_
