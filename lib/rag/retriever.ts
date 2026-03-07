import { env } from '@/env.mjs';
import { Prisma, type PrismaClient } from '@prisma/client';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
const MAX_QUERY_TEXT_LENGTH = 900;

type RagQueryInput = {
  query: string;
  workflowTag: string;
};

type EmbeddingResponse = {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
};

type RagChunkRow = {
  chunkId: string;
  chunkIndex: number;
  content: string;
  sectionHeader: string | null;
  chunkMetadata: Prisma.JsonValue | null;
  projectDocumentId: string;
  documentId: string;
  documentTitle: string;
  sourcePath: string;
  volume: string | null;
  spvId: string | null;
  spvSlug: string | null;
  spvName: string | null;
  similarity: number;
};

export type RagRetrievedPassage = {
  chunkId: string;
  chunkIndex: number;
  content: string;
  sectionHeader: string | null;
  workflowTag: string;
  query: string;
  similarity: number;
  projectDocumentId: string;
  documentId: string;
  documentTitle: string;
  sourcePath: string;
  volume: string | null;
  spvId: string | null;
  spvSlug: string | null;
  spvName: string | null;
  chunkMetadata: Prisma.JsonValue | null;
};

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function createEmbeddings(
  input: string[],
  apiKey: string,
  model: string,
): Promise<number[][]> {
  if (input.length === 0) return [];

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as EmbeddingResponse;
  return payload.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.embedding);
}

export function buildRagQueryInputs(
  params: {
    companyName: string;
    industry: string | null;
    evidence: Array<{
      workflowTag: string;
      snippet: string;
      confidenceScore: number;
      sourceType: string;
    }>;
  },
  limit = 4,
): RagQueryInput[] {
  const sortedEvidence = params.evidence
    .slice()
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 10);

  const queryInputs: RagQueryInput[] = [];
  const seen = new Set<string>();
  const pushQuery = (query: string, workflowTag: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    queryInputs.push({
      query: query.slice(0, MAX_QUERY_TEXT_LENGTH),
      workflowTag,
    });
  };

  pushQuery(
    `${params.companyName} ${params.industry ?? ''} infrastructure partnership bottlenecks and opportunities`,
    'workflow-context',
  );

  for (const item of sortedEvidence) {
    pushQuery(
      `${params.companyName} ${item.workflowTag} ${item.snippet.slice(0, 220)}`,
      item.workflowTag,
    );
    if (queryInputs.length >= limit) break;
  }

  return queryInputs.slice(0, limit);
}

export async function retrieveRagPassages(
  db: PrismaClient,
  input: {
    projectId: string;
    spvId: string | null;
    queryInputs: RagQueryInput[];
    limitPerQuery?: number;
    maxResults?: number;
    similarityThreshold?: number;
  },
): Promise<RagRetrievedPassage[]> {
  const openAiApiKey = env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required for RAG retrieval');
  }

  const embeddingModel = env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const limitPerQuery = input.limitPerQuery ?? 8;
  const maxResults = input.maxResults ?? 10;
  const similarityThreshold =
    input.similarityThreshold ??
    env.RAG_SIMILARITY_THRESHOLD ??
    DEFAULT_SIMILARITY_THRESHOLD;

  const queryInputs = input.queryInputs
    .map((item) => ({
      query: item.query.trim(),
      workflowTag: item.workflowTag.trim() || 'workflow-context',
    }))
    .filter((item) => item.query.length > 0);

  if (queryInputs.length === 0) return [];

  const embeddings = await createEmbeddings(
    queryInputs.map((item) => item.query),
    openAiApiKey,
    embeddingModel,
  );

  const byChunkId = new Map<string, RagRetrievedPassage>();

  for (let i = 0; i < queryInputs.length; i++) {
    const queryInput = queryInputs[i]!;
    const embedding = embeddings[i];
    if (!embedding) continue;
    if (embedding.length !== 1536) {
      throw new Error(
        `Expected 1536-dim embedding, received ${embedding.length}`,
      );
    }

    const vectorLiteral = toVectorLiteral(embedding);
    const rows = await db.$queryRaw<RagChunkRow[]>(
      Prisma.sql`
        SELECT
          chunk."id" AS "chunkId",
          chunk."chunkIndex" AS "chunkIndex",
          chunk."content" AS "content",
          chunk."sectionHeader" AS "sectionHeader",
          chunk."metadata" AS "chunkMetadata",
          doc."id" AS "projectDocumentId",
          doc."documentId" AS "documentId",
          doc."title" AS "documentTitle",
          doc."sourcePath" AS "sourcePath",
          doc."volume" AS "volume",
          doc."spvId" AS "spvId",
          spv."slug" AS "spvSlug",
          spv."name" AS "spvName",
          (1 - (chunk."embedding" <=> ${vectorLiteral}::vector)) AS "similarity"
        FROM "ProjectDocumentChunk" chunk
        INNER JOIN "ProjectDocument" doc
          ON doc."id" = chunk."projectDocumentId"
        LEFT JOIN "SPV" spv
          ON spv."id" = doc."spvId"
        WHERE doc."projectId" = ${input.projectId}
          AND (
            ${input.spvId}::text IS NULL
            OR doc."spvId" = ${input.spvId}
            OR doc."spvId" IS NULL
          )
        ORDER BY chunk."embedding" <=> ${vectorLiteral}::vector ASC
        LIMIT ${limitPerQuery}
      `,
    );

    for (const row of rows) {
      if (row.sourcePath.toLowerCase().includes('atlantis bestand full')) {
        continue;
      }
      const similarity = Number(row.similarity);
      if (!Number.isFinite(similarity) || similarity < similarityThreshold)
        continue;

      const existing = byChunkId.get(row.chunkId);
      if (existing && existing.similarity >= similarity) {
        continue;
      }

      byChunkId.set(row.chunkId, {
        chunkId: row.chunkId,
        chunkIndex: row.chunkIndex,
        content: row.content,
        sectionHeader: row.sectionHeader,
        workflowTag: queryInput.workflowTag,
        query: queryInput.query,
        similarity: round4(similarity),
        projectDocumentId: row.projectDocumentId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        sourcePath: row.sourcePath,
        volume: row.volume,
        spvId: row.spvId,
        spvSlug: row.spvSlug,
        spvName: row.spvName,
        chunkMetadata: row.chunkMetadata,
      });
    }
  }

  return Array.from(byChunkId.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}
