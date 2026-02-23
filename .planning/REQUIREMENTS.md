# Requirements: Qualifai

**Defined:** 2026-02-23
**Core Value:** Every outreach message is backed by real evidence, matched to a service Klarifai actually delivers.

## v2.1 Requirements

Requirements for Production Bootstrap milestone. Each maps to roadmap phases.

### Use Case Population

- [ ] **SEED-01**: Admin can import use cases from Obsidian vault — reads project markdown files, extracts service capabilities, creates UseCase records with dedup
- [ ] **SEED-02**: Admin can extract use cases from a project codebase — analyzes source files via AI, generates capability descriptions, creates UseCase records
- [ ] **SEED-03**: Klarifai service catalog is populated with all relevant offerings from vault + codebases

### Prospect Seeding

- [ ] **DISC-01**: Admin imports 5+ real target companies using existing import functionality
- [ ] **DISC-02**: Admin discovers and imports new prospects via Apollo sector/location search

### Pipeline Validation

- [ ] **PIPE-01**: Research pipeline runs successfully on real company websites
- [ ] **PIPE-02**: API failures (crawl timeouts, SerpAPI rate limits, KvK errors) surface user-visible error messages instead of silent failures
- [ ] **PIPE-03**: Evidence extraction produces relevant hypotheses for real marketing agencies

### Quality Calibration

- [ ] **QUAL-01**: Amber/green quality thresholds are calibrated using real research results
- [ ] **QUAL-02**: List-view traffic light accuracy improved (resolve hardcoded approximate values)

### End-to-End Cycle

- [ ] **E2E-01**: Admin sends real outreach email via the send queue to a real prospect
- [ ] **E2E-02**: Reply webhooks correctly receive and triage real email responses
- [ ] **E2E-03**: Cal.com booking triggers automatic meeting brief generation

## Future Requirements

### Scaling

- **SCALE-01**: Bulk research — kick off research on multiple prospects at once
- **SCALE-02**: Use case extractor as self-service feature (non-admin can suggest use cases)
- **SCALE-03**: Deployment to hosted environment (not just localhost)

## Out of Scope

| Feature                    | Reason                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| Bulk research runs         | One-at-a-time is fine at current volumes (5-10 prospects)           |
| Deployment/hosting         | User is fine with localhost for now                                 |
| New evidence sources       | Pipeline has 4 sources beyond homepage; validate before adding more |
| Auto-send without approval | Trust not yet calibrated; milestone is about proving the loop       |

## Traceability

| Requirement | Phase                          | Status  |
| ----------- | ------------------------------ | ------- |
| SEED-01     | Phase 23 — Use Case Extractors | Pending |
| SEED-02     | Phase 23 — Use Case Extractors | Pending |
| SEED-03     | Phase 24 — Data Population     | Pending |
| DISC-01     | Phase 24 — Data Population     | Pending |
| DISC-02     | Phase 24 — Data Population     | Pending |
| PIPE-01     | Phase 25 — Pipeline Hardening  | Pending |
| PIPE-02     | Phase 25 — Pipeline Hardening  | Pending |
| PIPE-03     | Phase 25 — Pipeline Hardening  | Pending |
| QUAL-01     | Phase 26 — Quality Calibration | Pending |
| QUAL-02     | Phase 26 — Quality Calibration | Pending |
| E2E-01      | Phase 27 — End-to-End Cycle    | Pending |
| E2E-02      | Phase 27 — End-to-End Cycle    | Pending |
| E2E-03      | Phase 27 — End-to-End Cycle    | Pending |

**Coverage:**

- v2.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---

_Requirements defined: 2026-02-23_
_Last updated: 2026-02-23 after roadmap creation — all 13 requirements mapped_
