-- v4 Phase 37 foundation: Atlantis RAG ingestion models + pgvector

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TYPE "EvidenceSourceType" ADD VALUE IF NOT EXISTS 'RAG_DOCUMENT';

CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "spvId" TEXT,
    "sourcePath" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'RAG_VOLUME',
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "volume" TEXT,
    "metadata" JSONB,
    "sectionCount" INTEGER NOT NULL DEFAULT 0,
    "lastIngestedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectDocumentChunk" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectDocumentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkType" TEXT NOT NULL DEFAULT 'TEXT',
    "sectionHeader" TEXT,
    "content" TEXT NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "metadata" JSONB,
    "embeddingModel" TEXT NOT NULL,
    "embeddingDimensions" INTEGER NOT NULL DEFAULT 1536,
    "embedding" vector(1536) NOT NULL,

    CONSTRAINT "ProjectDocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RagIngestionRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourcePath" TEXT,
    "model" TEXT NOT NULL,
    "filesScanned" INTEGER NOT NULL DEFAULT 0,
    "documentsUpserted" INTEGER NOT NULL DEFAULT 0,
    "chunksUpserted" INTEGER NOT NULL DEFAULT 0,
    "embeddingTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errors" JSONB,

    CONSTRAINT "RagIngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectDocument_projectId_sourcePath_key" ON "ProjectDocument"("projectId", "sourcePath");
CREATE INDEX "ProjectDocument_projectId_volume_idx" ON "ProjectDocument"("projectId", "volume");
CREATE INDEX "ProjectDocument_spvId_idx" ON "ProjectDocument"("spvId");
CREATE INDEX "ProjectDocument_documentId_idx" ON "ProjectDocument"("documentId");

CREATE UNIQUE INDEX "ProjectDocumentChunk_projectDocumentId_chunkIndex_key" ON "ProjectDocumentChunk"("projectDocumentId", "chunkIndex");
CREATE INDEX "ProjectDocumentChunk_projectDocumentId_idx" ON "ProjectDocumentChunk"("projectDocumentId");
CREATE INDEX "ProjectDocumentChunk_embeddingModel_idx" ON "ProjectDocumentChunk"("embeddingModel");

-- Cosine ANN index (requires pgvector extension)
CREATE INDEX "ProjectDocumentChunk_embedding_hnsw_idx"
  ON "ProjectDocumentChunk"
  USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX "RagIngestionRun_projectId_createdAt_idx" ON "RagIngestionRun"("projectId", "createdAt");

ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_spvId_fkey" FOREIGN KEY ("spvId") REFERENCES "SPV"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocumentChunk" ADD CONSTRAINT "ProjectDocumentChunk_projectDocumentId_fkey" FOREIGN KEY ("projectDocumentId") REFERENCES "ProjectDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagIngestionRun" ADD CONSTRAINT "RagIngestionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
