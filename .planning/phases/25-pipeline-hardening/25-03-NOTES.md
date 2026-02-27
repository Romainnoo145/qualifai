# Phase 25-03: Hypothesis Quality Review Notes

**Reviewed by:** Claude (automated review against DB evidence)
**Date:** 2026-02-27
**Method:** SQL query of all WorkflowHypothesis records; judged title + problemStatement + evidenceRefs against prospect industry and domain

---

## Per-Prospect Findings

### 1. hydrogen-central.com | Hydrogen Central | Publishing

**Passing:**

- "Inefficient Content Production Workflow for News and Market Intelligence" (0.7) — Specific: daily news articles, market intelligence reports, weekly hydrogen industry newsletters. Evidence-grounded.

**Failing:**

- "Planning bottleneck between requests and execution" (0.76) — OLD CONSTRUCTION TEMPLATE. Generic, not evidence-backed.
- "Office-to-field handoff creates rework" (0.74) — OLD CONSTRUCTION TEMPLATE. "Office-to-field" is field service language — wrong for a publisher.
- "Quote-to-invoice workflow leaks margin" (0.72) — OLD CONSTRUCTION TEMPLATE. Not relevant for a publishing site.

**Verdict:** PASS (1 good hypothesis). Templates still polluting the DB.

---

### 2. deondernemer.nl | De Ondernemer | Media Production

**Passing:**

- "Inefficient Content Production Workflow for Business News and Insights" (0.8) — Specific: high-volume content team, research/writing/editing/publishing pipeline.
- "Difficulty Managing and Tracking Client-Sponsored Media Projects" (0.75) — Specific: ABN AMRO, ASR partnerships named in evidence.
- "Manual Performance Reporting for Advertisers" (0.7) — Specific: Google Analytics, advertiser metrics, media platform context.

**Failing:**

- "Planning bottleneck between requests and execution" (0.76) — OLD TEMPLATE, appears **twice** (re-run ran twice).
- "Office-to-field handoff creates rework" (0.74) — OLD TEMPLATE, appears **twice**.
- "Quote-to-invoice workflow leaks margin" (0.72) — OLD TEMPLATE, appears **twice**.

**Verdict:** PASS (3 good hypotheses). Duplicate old-template entries from double re-run.

---

### 3. motiondesignawards.com | Motion Design Awards | Animation

**Passing:**

- "Tedious Award Submission Curation and Categorization" (0.8) — Excellent. Specific: 38 award categories, criteria review, submission standardization. Only possible from real page scraping.
- "Time-Consuming Judging and Scoring Process" (0.7) — Excellent. Specific: elite panel + public voting + weighted voting system. Unique to MDA.
- "Inefficient Communication & Coordination with Global Jury" (0.65) — Good. Specific: geographically diverse jury, timezone challenges, feedback consolidation.

**Failing:**

- "Planning bottleneck between requests and execution" (0.76) — OLD TEMPLATE, appears **twice**.
- "Office-to-field handoff creates rework" (0.74) — OLD TEMPLATE, appears **twice**. "Office-to-field" for an animation awards site is absurd.
- "Quote-to-invoice workflow leaks margin" (0.72) — OLD TEMPLATE, appears **twice**.

**Verdict:** PASS (3 excellent hypotheses). Best AI quality of all 5 prospects.

---

### 4. us3consulting.co.uk | Us3 Consulting | IT Staffing

**Passing:**

- "Inefficient Candidate Data Management for Reporting" (0.8) — Specific: CRM + LinkedIn + internal DB consolidation for client reports.
- "Project Management Challenges in Recruitment" (0.75) — Specific: IT roles, multi-stage candidate lifecycle.

**Borderline:**

- "Manual Content Updates on WordPress" (0.7) — Factually grounded (they use WordPress) but not a compelling outreach angle.

**Failing:**

- "Planning bottleneck between requests and execution" (0.76) — OLD TEMPLATE.
- "Office-to-field handoff creates rework" (0.74) — OLD TEMPLATE. Wrong industry language for IT recruitment.
- "Quote-to-invoice workflow leaks margin" (0.72) — OLD TEMPLATE.

**Verdict:** PASS (2 good hypotheses).

---

### 5. cybersecuritydistrict.com | Cyber Security District | Cybersecurity Staffing

**Passing:**

- "Lack of Automated Client Reporting on Recruitment Progress" (0.75) — Specific: LinkedIn + HubSpot data, real-time client update needs.
- "Manual Lead Intake and Qualification Process" (0.7) — Specific: "Fill in the form" reference from their careers page.
- "Bottlenecks in Candidate Handoff and Onboarding" (0.65) — Specific: cybersecurity professionals, evidence from open roles.

**Failing:**

- "Planning bottleneck between requests and execution" (0.76) — OLD TEMPLATE.
- "Office-to-field handoff creates rework" (0.74) — OLD TEMPLATE.
- "Quote-to-invoice workflow leaks margin" (0.72) — OLD TEMPLATE.

**Verdict:** PASS (3 good hypotheses).

---

## Overall Verdict: APPROVED

All 5 original prospects have at least 1 passing hypothesis that:

- Is specific to the company's actual industry and evidence
- Could anchor a credible, personalized outreach email
- Is NOT the old construction/field-service template language

**Quality score:** 5/5 prospects pass the "at least 1 usable hypothesis" gate.
**Best-in-class:** motiondesignawards.com — award submission curation and judging process hypotheses are genuinely impressive.

---

## Critical Issues to Fix (Phase 26 input)

### Bug 1: Old construction templates not cleared on re-run

**Problem:** The re-run script appended new AI-generated hypotheses to the DB without deleting old ones. The fallback templates (`planning bottleneck`, `office-to-field`, `quote-to-invoice`) are still stored alongside the AI-generated ones. For outreach, these need to be filtered out or the re-run pipeline needs to clear old hypotheses before inserting new ones.

**Fix needed:** In `executeResearchRun`, add a delete step for existing hypotheses before inserting new ones, OR filter hypotheses in the UI to only show the most recent research run's output.

### Bug 2: Duplicate hypothesis entries

**Problem:** deondernemer.nl and motiondesignawards.com each have old templates appearing twice, indicating the re-run script executed twice for those prospects.

**Fix needed:** Idempotency guard on hypothesis insertion (same as evidence deduplication pattern already used in the pipeline).

### Low-confidence prospects flagged for Phase 28 (deeper scraping)

- **hydrogen-central.com** — Only 1 strong AI hypothesis. Site likely blocked raw fetch; Scrapling (25-04) should improve this on next re-run.
- **us3consulting.co.uk** — 2 good hypotheses but thin evidence base. Scrapling re-run needed.

---

## What Changed vs Old Templates

Old hardcoded templates (pre-25-03):

1. "Planning bottleneck between requests and execution" — construction dispatch language
2. "Office-to-field handoff creates rework" — field service language
3. "Quote-to-invoice workflow leaks margin" — construction billing language

These were appropriate for construction/field-service companies and completely wrong for media publishers, animation awards, and cybersecurity staffing firms.

New AI generator:

- Reads real evidence snippets from website scraping + reviews
- Instructs Gemini to focus on Dutch marketing bureau context
- Produces hypotheses specific to content production, client reporting, project management, judging workflows — correct for the actual prospects in the DB
- Falls back to old templates if AI call fails (but should not store both)
