# Features — v4.0 Atlantis Partnership Outreach

**Project:** Qualifai — v4.0 milestone additions
**Researched:** 2026-03-03
**Scope:** Features for multi-project outreach with RAG-backed partnership opportunities

## Feature Categories

### 1. Multi-Project Data Model

**Table Stakes:**

- Project entity with name, slug, projectType, branding
- Prospect belongs to a Project (foreign key)
- Admin can filter prospects by project
- Seed script creates Klarifai + Europe's Gate projects

**Differentiators:**

- SPV entity within Project — each with name, description, linked documents, metric template
- Target Group → SPV routing based on prospect industry
- Automatic SPV suggestion on prospect creation

**Anti-features:**

- Don't build project creation wizard — hardcode 2 projects initially, seed via script
- Don't build per-project user roles — single admin manages all
- Don't build per-project billing/analytics — overkill for 2 projects

### 2. RAG Document Ingestion

**Table Stakes:**

- Ingest 34 markdown files with frontmatter metadata preservation
- Chunk documents into searchable passages (500-1000 tokens, header-aware)
- Generate embeddings via OpenAI, store in pgvector
- Link chunks to Project and optionally to SPV
- CLI script for ingestion (`node scripts/ingest-rag-documents.mjs`)

**Differentiators:**

- Tables kept as atomic chunks (financial metrics stay together)
- Metadata filtering on retrieval (SPV, volume, target_audience, keywords)
- Chunk quality annotation (has_metrics, has_table flags for prioritized retrieval)

**Anti-features:**

- No document upload UI — documents come from Obsidian vault, ingested via CLI
- No real-time sync — re-run script when documents change
- No RAG chatbot — structured retrieval for outreach, not conversational Q&A
- No embedding dashboard — just log chunk count and similarity stats

### 3. Dual Evidence Pipeline

**Table Stakes:**

- External research runs as-is for all prospect types (existing 8+ source pipeline untouched)
- After external research: if projectType=atlantis, run RAG matching
- RAG passages stored as EvidenceItem with sourceType=RAG_DOCUMENT
- Both evidence types available for opportunity generation

**Differentiators:**

- Evidence bridging: AI identifies connections between external findings and RAG documents
- Dual source attribution on opportunity cards (external source + document citation)
- Confidence scoring adapted for RAG (semantic similarity + document relevance to prospect industry)

**Anti-features:**

- Don't modify existing pipeline for Klarifai prospects — projectType guard
- Don't auto-generate opportunities without external research — external evidence validates RAG relevance
- RAG failure should NOT fail the research run — graceful degradation

### 4. Partnership /discover/ Template

**Table Stakes:**

- Project-type branching on /discover/[slug] — different template for Atlantis
- Opportunity cards showing: value proposition, key metrics, supporting document passages
- SPV branding per card
- CTA buttons (Download Partnership Brief, Book Strategy Call)
- Document citations with section references

**Differentiators:**

- Dual evidence display: "We found [prospect's need from external research] → Here's how [SPV] addresses this [RAG passage with metrics]"
- Partnership Brief PDF generation (parallel to existing Workflow Loss Map)
- SPV-specific metric display (DataCo: PUE, capacity, heat recovery; SteelCo: production, CO2, slag)

**Anti-features:**

- No full proposal editor — automated, not manual
- No per-prospect document customization — RAG retrieval handles personalization
- No video/animation — evidence-backed text/data, consistent with Klarifai style

**Complexity note:** Highest-complexity feature. Must feel premium for institutional prospects.

### 5. SPV-Specific Metrics

**Table Stakes:**

- New metric fields on opportunity model: co2ReductionMt, capacityDescription, investmentSizeEur, paybackYears
- Metrics extracted from RAG content (not AI-hallucinated)
- Source attribution per metric ("Source: EG-III-3.0, Section 4.2")

**Differentiators:**

- Per-SPV metric templates (which metrics to show per card)
- Project-level aggregate metrics on landing page

**Anti-features:**

- No metric calculation engine — metrics come from documents
- No custom formulas per prospect — RAG personalization is sufficient

### 6. Admin Project Management

**Table Stakes:**

- Project selector in admin sidebar
- Prospect list filtered by current project
- Prospect create/edit with project + SPV assignment
- Research run respects project type

**Differentiators:**

- SPV breakdown view (prospects per SPV, conversion per SPV)

**Anti-features:**

- No project CRUD in admin UI — seed via script
- No per-project email template editor — configure in code

## User Flow: Atlantis Prospect

```
Admin creates prospect → selects "Europe's Gate" → enters "ArcelorMittal"
  → System suggests SPV: SteelCo (based on industry: steel)
  → Admin confirms, triggers research
  → External pipeline: finds ArcelorMittal's green steel investments, CBAM concerns, HYBRIT timeline
  → RAG matching: retrieves EG-III-3.0 passages (100Mt/year H2-DRI, CO2 reduction, slag recycling)
  → Opportunity generation: AI bridges external + RAG → 3 opportunity cards
  → Admin reviews quality gate → approves
  → Sends partnership outreach email
  → ArcelorMittal visits /discover/ → sees partnership dashboard with dual evidence
```

## Dependencies on Existing Features

| New Feature            | Depends On                          | Modification Type       |
| ---------------------- | ----------------------------------- | ----------------------- |
| Multi-project model    | Prospect, organization_id pattern   | Extends schema          |
| RAG ingestion          | PostgreSQL + new pgvector extension | New infrastructure      |
| Dual evidence pipeline | research-executor.ts                | Adds branch (no modify) |
| Opportunity generation | generateHypothesisDraftsAI pattern  | New parallel function   |
| Partnership /discover/ | /discover/[slug] page structure     | Conditional branching   |
| Admin project filter   | Admin routes + sidebar              | UI extension            |

---

_Researched: 2026-03-03 for v4.0 Atlantis Partnership Outreach_
