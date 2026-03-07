# Phase 37-02 Summary — Embeddings + Idempotent Ingestion CLI

Date: 2026-03-05
Status: Completed

## Delivered

- Added Prisma RAG ingestion foundation:
  - `ProjectDocument`
  - `ProjectDocumentChunk` (`vector(1536)` embedding column)
  - `RagIngestionRun`
  - `EvidenceSourceType.RAG_DOCUMENT`
- Added migration:
  - `prisma/migrations/20260305182000_add_rag_ingestion_models/migration.sql`
  - includes `CREATE EXTENSION IF NOT EXISTS vector;`
  - includes ANN HNSW index on chunk embedding
- Added env support:
  - `OPENAI_API_KEY`
  - `OPENAI_EMBEDDING_MODEL`
  - `OPENAI_EMBEDDING_PRICE_PER_1K`
- Added ingestion CLI:
  - `scripts/ingest-atlantis-rag.ts`
  - idempotent upsert by `(projectId, sourcePath)` + hash skip
  - chunk delete/reinsert on change
  - embedding batching + token/cost logging
  - run status tracking (`RUNNING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`)
- Added npm script:
  - `rag:ingest:atlantis`

## Validation

- `npx prisma generate`
- `npx prisma db push --accept-data-loss`
- `npm run build`
- `npm run lint` (warnings only, no errors)
- `npm run rag:ingest:atlantis -- --dry-run`
  - files scanned: 35
  - documents upserted (simulated): 35
  - chunks upserted (simulated): 2326
  - estimated embedding tokens: 552047
  - estimated embedding cost: $0.011041
- `npm run rag:ingest:atlantis` (live run)
  - files scanned: 35
  - documents upserted: 35
  - chunks upserted: 2326
  - embedding tokens: 552047
  - run status persisted: `COMPLETED`
- idempotency re-run:
  - files unchanged skipped: 35
  - documents upserted: 0
  - chunks upserted: 0

## Next Step

- Start Phase 38 retrieval integration (`RAG_DOCUMENT` evidence linking + SPV/project scoped similarity retrieval).
