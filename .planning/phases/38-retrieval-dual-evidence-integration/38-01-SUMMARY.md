# Phase 38-01 Summary — Retriever + Scoped Citation Payload

Date: 2026-03-05
Status: Completed

## Delivered

- Added `lib/rag/retriever.ts` with:
  - OpenAI embedding generation for retrieval queries
  - pgvector cosine search on `ProjectDocumentChunk.embedding`
  - strict project filter (`projectId`) before ranking
  - SPV scope filter (`spvId` or project-wide docs with `spvId IS NULL`)
  - similarity threshold enforcement (`RAG_SIMILARITY_THRESHOLD`, default `0.50`)
  - source-path suppression for aggregate dump file (`Atlantis bestand full`) to reduce noisy matches
- Added retrieval query builder:
  - `buildRagQueryInputs(...)` derives Atlantis query prompts from top external evidence
- Added env config support:
  - `RAG_SIMILARITY_THRESHOLD` in `env.mjs` + `.env.example`

## Validation

- `npm run build`
- Manual retrieval calibration script against live Atlantis corpus:
  - steel query returned high-quality matches (`EG-III-3.0`, `EG-1.6`, `EG-5.0`, `EG-3.0`)
  - threshold calibrated to observed similarity range (~0.46–0.56)

## Notes

- Retriever now provides citation-ready metadata per hit (documentId, sectionHeader, sourcePath, similarity, SPV context).
