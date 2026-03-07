# Phase 43: AI Master Analysis - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

AI generates complete discover page content (context section, trigger cards, partnership tracks) from intent variables and RAG passages. Output is persisted to DB so the discover page can render without further AI calls. This phase builds the generation engine — rendering is Phase 44.

</domain>

<decisions>
## Implementation Decisions

### Boardroom voice & tone

- Register: zakelijk-visionair Dutch — clean business language, no anglicisms, confident but not stiff
- Adaptive tone: data-first when RAG yields strong prospect-relevant evidence, visionary framing when extraction is sparse
- Prospect name used in hooks/headers for personal impact, "uw" in body text for professional distance
- Numbers must be prospect-relevant (steel capacity they'd use, waste reduction in their sector) — NOT project-grandeur marketing (corridor billions, total hectares)

### Content depth & density

- Context hook: short paragraph, 2-3 sentences (setup + insight + relevance)
- KPI blocks: prospect-relevant scale metrics — numbers that connect to their operations, not Europe's Gate marketing stats
- Trigger card length: Claude's discretion per card based on evidence strength
- Partnership track format (structured vs prose): Claude's discretion based on track count and distinctness

### Number handling & fallbacks

- Contextualize numbers for the prospect rather than citing raw RAG figures — frame in terms of their operations
- When RAG lacks hard numbers for a trigger category: write qualitative trigger using directional evidence (no skipping cards, no fabricating)
- Industry benchmarks/extrapolation: Claude's discretion on whether defensible case-by-case
- When prospect data and RAG data conflict: show both perspectives — "Uw huidige capaciteit van X past bij een corridor die Y faciliteert"

### SPV track matching

- Show top 2-3 most relevant SPVs per prospect, not all 8
- Combined matching: intent extraction suggests candidate SPVs, RAG passage quality confirms or eliminates
- Each track includes scope + why it's relevant to this specific prospect
- No CTA in partnership section — contact toggle already exists at the end of the discover page

### Claude's Discretion

- Trigger card narrative length (adapt per card based on evidence richness)
- Partnership track format (structured tags vs short prose)
- Whether to use industry benchmark data when prospect-specific data is unavailable
- Exact KPI selection per prospect (which 3 metrics are most relevant)

</decisions>

<specifics>
## Specific Ideas

- "Die grootpraat nummers hebben we niets aan. Data wat van de klant zelf komt, dat is interessant." — Numbers must feel relevant to the prospect's world, not impressive about the project
- The discover page already has a contact page at the last toggle — partnership section is informational only, no additional CTA needed
- Think McKinsey board presentation in Dutch, not startup pitch deck

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 43-ai-master-analysis_
_Context gathered: 2026-03-07_
