# Phase 38-02 Summary — Research Integration + Dual Evidence Opportunities

Date: 2026-03-05
Status: Completed

## Delivered

- Added dual-evidence opportunity generator:
  - `lib/rag/opportunity-generator.ts`
  - emits 2-4 Atlantis bridge cards
  - each card combines external evidence + `RAG_DOCUMENT` refs
  - citation context stays attached through linked evidence metadata
- Integrated Phase 38 flow in `lib/research-executor.ts`:
  - RAG branch only for `projectType=ATLANTIS`
  - retrieved passages persisted as `EvidenceItem` with `sourceType=RAG_DOCUMENT`
  - `rag_retrieval` diagnostics added to run summary
  - RAG failures degrade to warning path; research run continues
  - Atlantis opportunities switch to dual-evidence generator, fallback to baseline only if dual set is insufficient
- Updated regeneration flow in `server/routers/hypotheses.ts`:
  - Atlantis `regenerateForRun` now reuses dual-evidence opportunity generation from stored evidence

## Validation

- Unit tests:
  - `npm run test -- lib/rag/opportunity-generator.test.ts --run`
  - verifies 2-4 output and dual-source refs per card
- Regression tests:
  - `npm run test -- lib/rag/markdown-chunker.test.ts --run`
- Build + lint:
  - `npm run build` (pass)
  - `npm run lint` (warnings only; no new errors)
- Live integration validation run:
  - Atlantis test prospect run completed
  - evidence included `RAG_DOCUMENT`
  - generated opportunities all had both external and RAG refs
  - `rag_retrieval` diagnostic reported `ok`
  - temporary validation prospects removed after verification

## Requirement Coverage

- PIPE-01 through PIPE-07 implemented and validated.
