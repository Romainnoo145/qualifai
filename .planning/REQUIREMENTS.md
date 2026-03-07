# Requirements: Qualifai v4.0 Atlantis Partnership Outreach

**Defined:** 2026-03-05
**Core Value:** Every outreach narrative must bridge real prospect evidence with cited project capabilities, so claims are verifiable and not generic pitch language.

## v4.0 Requirements

Requirements for the Atlantis multi-project milestone. Each maps to phases 36-41.

### Multi-Project Foundation

- [x] **MPROJ-01**: System has a `Project` entity with `projectType`, slug, branding, and booking configuration.
- [x] **MPROJ-02**: System has an `SPV` entity linked to `Project`, with metric template metadata.
- [x] **MPROJ-03**: `Prospect` records are linked to `projectId` and optional `spvId`.
- [x] **MPROJ-04**: Existing legacy prospects are backfilled to the seeded Klarifai project before `projectId` becomes required.
- [x] **MPROJ-05**: Project seed includes at least two projects (`klarifai`, `europes-gate`) and eight Atlantis SPVs.

### RAG Ingestion

- [x] **RAG-01**: pgvector is enabled in PostgreSQL and schema supports 1536-dim chunk embeddings.
- [x] **RAG-02**: Markdown chunker is header-aware and preserves tables as atomic chunks.
- [x] **RAG-03**: Chunk metadata captures document id, section header, volume, and SPV linkage.
- [x] **RAG-04**: Ingestion CLI script is rerunnable/idempotent for document updates.
- [x] **RAG-05**: Embeddings are generated with OpenAI `text-embedding-3-small`.
- [x] **RAG-06**: Ingestion run logs chunk count and estimated embedding token cost.

### Dual Evidence Pipeline

- [x] **PIPE-01**: RAG retrieval runs only when `projectType=atlantis`; Klarifai pipeline path remains unchanged.
- [x] **PIPE-02**: Retrieved passages are persisted as `EvidenceItem` with `sourceType=RAG_DOCUMENT`.
- [x] **PIPE-03**: Retrieval filters by project/SPV scope before similarity ranking.
- [x] **PIPE-04**: Retrieval enforces a minimum similarity threshold to reduce topically-wrong passages.
- [x] **PIPE-05**: Opportunity generation combines external evidence and RAG passages into 2-4 cards.
- [x] **PIPE-06**: Each opportunity card carries document citation metadata (document id + section).
- [x] **PIPE-07**: RAG step failure degrades gracefully (warning + continue), not full run failure.

### Partnership Discover Experience

- [x] **DISC-01**: `/discover/[slug]` branches by project type (existing Klarifai template vs Atlantis partnership template).
- [x] **DISC-02**: Atlantis cards show dual-evidence bridge format with external + RAG citation context.
- [ ] **DISC-03**: SPV-specific metric template controls which metrics are shown on each card.
- [x] **DISC-04**: Partnership template reuses shared shell/session tracking components to avoid route divergence.
- [x] **DISC-05**: CTA flow supports partnership brief download and strategy call booking with tracking.

### Admin Project Operations

- [x] **ADMIN-01**: Admin scope is derived from login token (account-scoped auth), not client-side project switching.
- [ ] **ADMIN-02**: Prospect list and prospect create/edit flows support SPV assignment and filtering in scoped project. (deferred)
- [x] **ADMIN-03**: Use cases can be filtered/scoped per project in admin.
- [x] **ADMIN-04**: v4 ships with seeded project/SPV data only (no project CRUD UI).

### Validation and Safety

- [ ] **VALID-01**: End-to-end run passes for Atlantis path: prospect create -> research -> dual evidence -> `/discover/`.
- [ ] **VALID-02**: Regression checks confirm existing Klarifai outputs are not changed by Atlantis additions.
- [ ] **VALID-03**: First real Atlantis target prospect is validated with manually reviewed citations.
- [ ] **VALID-04**: Quality calibration report is produced for Atlantis opportunity confidence thresholds.
- [ ] **VALID-05**: Sensitive Atlantis docs are app-scoped by project so non-Atlantis prospects do not access Atlantis citations.

## Future Requirements

### Governance

- **GOV-01**: Per-project RBAC (different admin roles per project).
- **GOV-02**: Audit policy for document-level access and citation exposure.

### RAG Productization

- **RAG-UX-01**: Document management UI (upload/version/retire) instead of CLI-only ingestion.
- **RAG-UX-02**: Automated SPV classifier feedback loop from won/lost outcomes.

## Out of Scope

| Feature                       | Reason                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Separate Atlantis app         | Same-app multi-project architecture reuses existing infrastructure and keeps operations simple |
| Project CRUD admin panel      | Two known projects are enough for v4; seed scripts are faster and safer                        |
| Document upload UI            | Corpus is curated and maintained outside app; CLI ingestion is sufficient                      |
| RAG chatbot                   | Objective is evidence-backed outreach cards, not conversational search                         |
| Per-project billing/analytics | Not needed at current scale and would delay core delivery                                      |
| Per-user permissions          | Single-admin model remains acceptable for v4                                                   |

## Traceability

| Requirement | Phase | Status    |
| ----------- | ----- | --------- |
| MPROJ-01    | 36    | Completed |
| MPROJ-02    | 36    | Completed |
| MPROJ-03    | 36    | Completed |
| MPROJ-04    | 36    | Completed |
| MPROJ-05    | 36    | Completed |
| RAG-01      | 37    | Completed |
| RAG-02      | 37    | Completed |
| RAG-03      | 37    | Completed |
| RAG-04      | 37    | Completed |
| RAG-05      | 37    | Completed |
| RAG-06      | 37    | Completed |
| PIPE-01     | 38    | Completed |
| PIPE-02     | 38    | Completed |
| PIPE-03     | 38    | Completed |
| PIPE-04     | 38    | Completed |
| PIPE-05     | 38    | Completed |
| PIPE-06     | 38    | Completed |
| PIPE-07     | 38    | Completed |
| DISC-01     | 39    | Completed |
| DISC-02     | 39    | Completed |
| DISC-03     | 39    | Pending   |
| DISC-04     | 39    | Completed |
| DISC-05     | 39    | Completed |
| ADMIN-01    | 40    | Completed |
| ADMIN-02    | 40    | Deferred  |
| ADMIN-03    | 40    | Completed |
| ADMIN-04    | 40    | Completed |
| VALID-01    | 41    | Pending   |
| VALID-02    | 41    | Pending   |
| VALID-03    | 41    | Pending   |
| VALID-04    | 41    | Pending   |
| VALID-05    | 41    | Pending   |

**Coverage:**

- v4.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---

_Requirements defined: 2026-03-05_
_Last updated: 2026-03-07 after Phase 40-01 rollback/defer decision_
