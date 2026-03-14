---
phase: 51-discover-page-redesign
verified: 2026-03-13T15:45:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: 'Open /discover/[atlantis-slug] for a prospect with analysis-v2 data and read the page'
    expected: 'Single scrollable document with no step navigation, wizard controls, or pagination — hero hook paragraph is specific to the prospect, executive summary is substantive, narrative sections read as flowing boardroom Dutch with citations below each section, SPV cards below, NDA gateway CTA at the bottom'
    why_human: 'Evidence weaving quality (DISC-03) — whether the body paragraphs contain specific numbers, dates, and project names from real evidence rather than generic filler cannot be verified by static analysis of the renderer alone. The renderer is correct; the content quality depends on Phase 50 master prompt output.'
  - test: 'Scroll to the CTA section on a prospect with bookingUrl set'
    expected: "'Vertrouwelijk dossier beschikbaar' heading visible, body paragraph references 'geheimhouding', primary button says 'Plan vertrouwelijk gesprek'"
    why_human: 'CTA conditional rendering (canBookCall vs quoteRequested) requires live state'
  - test: 'Navigate to /discover/[atlantis-slug] for a prospect with NO analysis-v2 data'
    expected: "'Uw partnership analyse wordt voorbereid' loading state renders — no blank screen or error"
    why_human: 'Fallback branch requires a prospect in that state in the database'
---

# Phase 51: Discover Page Redesign — Verification Report

**Phase Goal:** Discover page renders as a flowing boardroom document with prospect-specific hooks, natural evidence weaving, and NDA-driven CTA — not a rigid wizard template
**Verified:** 2026-03-13T15:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                  | Status                  | Evidence                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Discover page renders as a flowing document with no step navigation or wizard UI       | VERIFIED                | No STEPS, currentStep state, AnimatePresence, motion.div, step nav header, or bottom prev/next in component. Single `<main>` block with `space-y-16`.                                          |
| 2   | Opening section shows prospect-specific hook from analysis.openingHook                 | VERIFIED                | Line 201: `{analysis.openingHook}` rendered as `text-lg text-slate-600 leading-relaxed` paragraph in hero section                                                                              |
| 3   | Executive summary paragraph is displayed prominently                                   | VERIFIED                | Lines 210-217: white card with "Samenvatting" label and `{analysis.executiveSummary}`                                                                                                          |
| 4   | Narrative sections render with title + body + citations woven in                       | VERIFIED                | Lines 221-249: `analysis.sections.map(...)` — h2 heading, body split on `\n\n` into `<p>` tags, citations as italic footnotes below `border-t border-slate-100` divider                        |
| 5   | SPV recommendations render as clean cards below narrative                              | VERIFIED                | Lines 253-288: conditional on `analysis.spvRecommendations.length > 0`, white rounded-2xl cards with spvName h3, relevanceNarrative, strategicTags pills                                       |
| 6   | CTA positions NDA signing as gateway to confidential dossier                           | VERIFIED                | Lines 295-344: "Vertrouwelijk dossier beschikbaar" heading, body contains "geheimhouding" and "geheimhoudingsverklaring", ternary: Cal.com booking → quote confirmation → quote request button |
| 7   | CTA still provides Cal.com booking and direct contact options                          | VERIFIED                | handleBookCall wired to getCalApi, WhatsApp/phone/email secondary contact links at lines 353-383                                                                                               |
| 8   | Routing chain: v2 → flowing doc, no v2 → loading state, non-ATLANTIS → DashboardClient | VERIFIED                | page.tsx lines 371-454: explicit if/if/return chain; parseNarrativeAnalysis validates version==='analysis-v2'; no parseMasterAnalysis or MasterAnalysis import present                         |
| 9   | Evidence weaving quality: specific numbers, dates, project names from real evidence    | UNCERTAIN — needs human | The renderer correctly displays section body paragraphs and citations. Whether content is evidence-rich depends on Phase 50 master prompt output, not verifiable by static analysis.           |

**Score:** 9/9 structural truths verified (1 needs human for content quality)

### Required Artifacts

| Artifact                                         | Expected                                                                               | Status   | Details                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `components/public/atlantis-discover-client.tsx` | Flowing narrative document renderer for NarrativeAnalysis (analysis-v2)                | VERIFIED | 398 lines (exceeds 150 min), imports NarrativeAnalysis, no wizard code, no framer-motion |
| `app/discover/[slug]/page.tsx`                   | Clean routing: v2 → flowing doc, no v2 → loading state, non-ATLANTIS → DashboardClient | VERIFIED | parseNarrativeAnalysis present, routing chain explicit, no dead imports                  |

### Key Link Verification

| From                           | To                       | Via                        | Status | Details                                                                                                                                                       |
| ------------------------------ | ------------------------ | -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atlantis-discover-client.tsx` | `lib/analysis/types.ts`  | `NarrativeAnalysis` import | WIRED  | Line 14: `import type { NarrativeAnalysis } from '@/lib/analysis/types'`                                                                                      |
| `atlantis-discover-client.tsx` | `api.wizard`             | `requestQuote` mutation    | WIRED  | Lines 59, 154, 331, 334: imported via `api.wizard.requestQuote.useMutation()`, called in handleRequestQuote, bound to button disabled state and pending state |
| `app/discover/[slug]/page.tsx` | `AtlantisDiscoverClient` | `NarrativeAnalysis` prop   | WIRED  | Lines 1, 3, 279-284, 371-392: import present, parseNarrativeAnalysis validates content, `analysis={narrativeAnalysis}` passed at line 384                     |

**Note on Plan 03 key_link:** The plan documented the link as going from `page.tsx` to `prospect-dashboard-atlantis-client.tsx` via `NarrativeAnalysis`. The actual implementation correctly routes NarrativeAnalysis to `AtlantisDiscoverClient` instead — this was a plan documentation inaccuracy, not an implementation issue. The wiring is correct.

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                     | Status                            | Evidence                                                                                                                                        |
| ----------- | ------------ | ------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DISC-01     | 51-01, 51-03 | Discover page renders as flowing boardroom document, not rigid 3-section wizard | SATISFIED                         | Wizard code entirely removed; single scrollable page confirmed in component                                                                     |
| DISC-02     | 51-01        | Opening section has prospect-specific hook                                      | SATISFIED                         | `analysis.openingHook` rendered directly in hero — content depends on Phase 50 master prompt producing prospect-specific hooks                  |
| DISC-03     | 51-01        | Body content weaves evidence naturally — specific numbers, dates, project names | PARTIALLY SATISFIED — needs human | Renderer supports it: sections map body + citations. Quality of evidence content requires human check of a live page with real analysis-v2 data |
| DISC-04     | 51-02        | CTA drives NDA signing, not generic intake                                      | SATISFIED                         | "Vertrouwelijk dossier beschikbaar" card with "geheimhouding" language confirmed at lines 301-325                                               |
| DISC-05     | 51-01, 51-03 | Visual design: clean, confident, boardroom tone, no template feel               | PARTIALLY SATISFIED — needs human | CSS structure is correct (bg-[#F8F9FA], white cards, font-heading, consistent spacing). Actual visual impression requires human review          |

### Anti-Patterns Found

| File                           | Line | Pattern                                     | Severity | Impact                                                                                                                                                                                |
| ------------------------------ | ---- | ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atlantis-discover-client.tsx` | 56   | `api.wizard.*` mutations (wizard namespace) | Info     | The tRPC namespace is named `wizard` for historical reasons but the mutations (`startSession`, `trackProgress`, etc.) function correctly for scroll-tracking. Not a functional issue. |

No TODO/FIXME/placeholder comments found. No empty returns. No console.log-only implementations. No wizard step logic (STEPS array, currentStep state, AnimatePresence, framer-motion). No MasterAnalysis or parseMasterAnalysis references.

### Human Verification Required

#### 1. Evidence Weaving Quality (DISC-03)

**Test:** Open `/discover/[atlantis-slug]` for a prospect with analysis-v2 data (e.g., Nedri after Phase 50 rerun). Read the narrative section bodies.
**Expected:** Paragraphs reference specific numbers, dates, project names, or other concrete facts drawn from the 83+ evidence items and RAG passages — not generic statements. Citations below sections reference actual sources.
**Why human:** The `atlantis-discover-client.tsx` renderer is structurally correct and will display whatever text the master prompt produces. Whether Phase 50 produced evidence-rich body text for real prospects is a content quality question, not a structural one.

#### 2. Visual Boardroom Tone (DISC-05)

**Test:** Load the page and assess whether the visual design feels like a boardroom document — not a SaaS wizard, marketing page, or template.
**Expected:** Clean whitespace, confident typography, no step indicators, no card-grid "features" layout. Should feel like reading a prepared analysis document.
**Why human:** CSS correctness is verified; visual impression is subjective.

#### 3. CTA Conditional State Rendering

**Test:** Test with a prospect where `bookingUrl` is null to trigger the quote request path. Click "Verzoek toegang tot dossier".
**Expected:** Button transitions to "Versturen..." while pending, then the geheimhoudingsverklaring confirmation message appears with CheckCircle2 icon.
**Why human:** State transitions require a live session.

### Gaps Summary

No structural gaps. All artifacts exist, are substantive (398 lines), and are correctly wired. All wizard code removed. All DISC requirements have supporting implementation. The three human verification items are content/visual quality checks, not missing implementation.

The only notable deviation from plans: Plan 03's key_link documented the wrong target component (`prospect-dashboard-atlantis-client.tsx` vs `AtlantisDiscoverClient`). The actual implementation is correct — this is a plan documentation error that has no impact on goal achievement.

---

_Verified: 2026-03-13T15:45:00Z_
_Verifier: Claude (gsd-verifier)_
