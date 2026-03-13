import { env } from '@/env.mjs';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { IntentVariables, IntentCategory } from '@/lib/extraction/types';
export { rankRagPassagesForProspect } from './ranker';
export type { EvidenceSignal } from './ranker';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
const MAX_QUERY_TEXT_LENGTH = 900;
const MAX_INTENT_QUERY_LENGTH = 200;

type RagQueryInput = {
  query: string;
  workflowTag: string;
};

type SectorQueryPack = {
  marketTerms: string;
  complianceTerms: string;
  capitalTerms: string;
  volumeHints: string;
  valueHints: string;
  painHints: string;
  docHints: string;
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
  documentMetadata: Prisma.JsonValue | null;
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
  documentMetadata: Prisma.JsonValue | null;
  spvId: string | null;
  spvSlug: string | null;
  spvName: string | null;
  chunkMetadata: Prisma.JsonValue | null;
  /** Ready-to-use label for downstream rendering, e.g. "EG-III-3.0 Groenstaal (SPV: Groenstaal BV)" */
  sourceLabel: string;
};

export type RagProspectProfile = {
  companyName: string;
  industry: string | null;
  description: string | null;
  specialties: string[];
  technologies: string[];
  country: string | null;
  campaignNiche: string | null;
  spvName: string | null;
};

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function inferSectorQueryPack(industry: string | null): SectorQueryPack {
  const haystack = (industry ?? '').toLowerCase();

  if (
    /(construction|bouw|infra|civil|real estate|housing|property|contractor)/.test(
      haystack,
    )
  ) {
    return {
      marketTerms:
        'housing growth land development infrastructure capacity permits',
      complianceTerms:
        'stikstof natura2000 csrd esg circularity permitting emissions',
      capitalTerms:
        'capex project finance eib subsidy grants irr roi land value',
      volumeHints:
        '8.03 miljoen woningen 304 km2 landcreatie wooncapaciteit gebiedsontwikkeling',
      valueHints:
        '4673.5 miljard capex 11.3 biljoen vastgoedwaarde project irr equity irr',
      painHints:
        'stikstof vergunning ruimtebeperking natura 2000 fast-track vergunningen pci net-zero strategic project',
      docHints: 'EG-IV-1.0 EG-IV-4.0 EG-1.0 EG-2.0 EG-4.0 EG-5.0',
    };
  }

  if (
    /(data|datacenter|cloud|hosting|it|software|saas|telecom)/.test(haystack)
  ) {
    return {
      marketTerms: 'datacenter capacity expansion latency availability growth',
      complianceTerms:
        'energy efficiency pue csrd esg grid compliance emissions',
      capitalTerms:
        'capex power contracts financing subsidy infrastructure roi',
      volumeHints:
        '42 miljoen m2 serverruimte 75 gw it-load datacentercapaciteit',
      valueHints: 'pue lower tco capex roi financing eu subsidy',
      painHints:
        'netcongestie koeling energiezekerheid ppa grid toegang compliance',
      docHints: 'EG-V-1.0 EG-V-2.0 EG-4.0 EG-5.0 EG-1.6',
    };
  }

  if (
    /(steel|metals|manufacturing|industrial|chemic|refining|shipbuilding)/.test(
      haystack,
    )
  ) {
    return {
      marketTerms: 'industrial capacity supply chain throughput expansion',
      complianceTerms: 'cbam ets co2 decarbonization hydrogen circularity',
      capitalTerms: 'h2 dri capex subsidy eib finance returns investment risk',
      volumeHints: 'h2 dri capaciteit groenstaal productie mt per jaar',
      valueHints: 'equity irr project irr subsidy financing capex',
      painHints: 'ets cbam co2-prijs compliance decarbonisatie',
      docHints: 'EG-III-3.0 EG-III-4.0 EG-4.0 EG-5.0',
    };
  }

  if (/(logistics|port|shipping|maritime|transport|warehouse)/.test(haystack)) {
    return {
      marketTerms: 'port throughput logistics corridor multimodal expansion',
      complianceTerms: 'emissions compliance csrd esg permit safety',
      capitalTerms: 'terminal capex finance eib subsidy contracts returns',
      volumeHints: 'corridor capaciteit haven throughput goederenvervoer',
      valueHints: 'terminal capex contractwaarde rendement',
      painHints: 'doorlooptijd emissie compliance congestie',
      docHints: 'EG-II-1.0 EG-VI-4.0 EG-VII-2.0 EG-4.0 EG-5.0',
    };
  }

  if (/(energy|power|utility|renewable|wind|solar|grid)/.test(haystack)) {
    return {
      marketTerms: 'generation capacity grid expansion power demand growth',
      complianceTerms: 'ets co2 csrd esg net-zero permits',
      capitalTerms: 'ppa capex eib subsidy infra finance irr roi',
      volumeHints: 'opwekcapaciteit wind waterstof grid balancing',
      valueHints: 'ppa opbrengst capex project irr equity irr',
      painHints: 'netcongestie vergunningsrisico co2 compliance',
      docHints: 'EG-III-1.0 EG-III-2.0 EG-III-5.0 EG-4.0 EG-5.0',
    };
  }

  return {
    marketTerms: 'capacity growth expansion operational bottlenecks',
    complianceTerms: 'csrd esg emissions compliance regulation',
    capitalTerms: 'capex financing subsidy returns risk',
    volumeHints: 'capacity infrastructure scale',
    valueHints: 'financial value capex irr',
    painHints: 'regulatory constraints de-risking',
    docHints: 'EG-1.0 EG-2.0 EG-4.0 EG-5.0 EG-1.6',
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
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
    description?: string | null;
    specialties?: string[];
    technologies?: string[];
    country?: string | null;
    campaignNiche?: string | null;
    spvName?: string | null;
    evidence: Array<{
      workflowTag: string;
      snippet: string;
      confidenceScore: number;
      sourceType: string;
    }>;
  },
  limit = 4,
): RagQueryInput[] {
  const sectorPack = inferSectorQueryPack(params.industry);
  const profileFragments = uniqueStrings([
    params.industry ?? '',
    params.country ?? '',
    params.campaignNiche ?? '',
    params.spvName ?? '',
    ...(params.specialties ?? []).slice(0, 4),
    ...(params.technologies ?? []).slice(0, 4),
  ])
    .slice(0, 8)
    .join(' ');
  const conciseDescription = (params.description ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const company = params.companyName.trim();
  const baseContext = compactQuery([
    company,
    'Atlantis',
    "Europe's Gate",
    profileFragments,
    conciseDescription,
  ]);
  const docHints = sectorPack.docHints;

  const queryInputs: RagQueryInput[] = [];
  const seen = new Set<string>();
  const pushQuery = (query: string, workflowTag: string) => {
    const compacted = compactQuery([query]);
    const normalized = compacted.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    queryInputs.push({
      query: compacted.slice(0, MAX_QUERY_TEXT_LENGTH),
      workflowTag,
    });
  };

  pushQuery(
    `${baseContext} executive business case quantified partnership triggers ${docHints}`,
    'workflow-context',
  );
  pushQuery(
    `${baseContext} physical scale capacity volume ${sectorPack.marketTerms} ${sectorPack.volumeHints} ${docHints}`,
    'planning',
  );
  pushQuery(
    `${baseContext} financial portfolio value capex returns ${sectorPack.capitalTerms} ${sectorPack.valueHints} ${docHints}`,
    'billing',
  );
  pushQuery(
    `${baseContext} strategic advantage pain-point relief regulatory de-risking ${sectorPack.complianceTerms} ${sectorPack.painHints} ${docHints}`,
    'reporting',
  );
  pushQuery(
    `${baseContext} market timing and partnership de-risking eu funding eib pci net-zero ${docHints}`,
    'lead-intake',
  );

  return queryInputs.slice(0, limit);
}

/** Human-readable labels for intent categories */
const CATEGORY_LABELS: Record<IntentCategory, string> = {
  sector_fit: 'sector capabilities',
  operational_pains: 'operational solutions',
  esg_csrd: 'ESG compliance sustainability',
  investment_growth: 'financing investment returns',
  workforce: 'workforce development training',
};

/**
 * Build targeted RAG queries from intent variable categories.
 * Produces one concise semantic query per populated category instead of
 * keyword-stuffed profile blobs. Falls back to extras if present.
 */
export function buildRagQueryInputsFromIntent(
  intentVars: IntentVariables,
  profile: {
    companyName: string;
    industry: string | null;
    spvName: string | null;
  },
): RagQueryInput[] {
  const queryInputs: RagQueryInput[] = [];
  const seen = new Set<string>();
  const company = profile.companyName.trim();
  const base = `${company} Europe's Gate`;

  const push = (query: string, tag: string) => {
    const compacted = compactQuery([query]).slice(0, MAX_INTENT_QUERY_LENGTH);
    const key = compacted.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    queryInputs.push({ query: compacted, workflowTag: tag });
  };

  // Core categories
  for (const cat of Object.keys(intentVars.categories) as IntentCategory[]) {
    const signals = intentVars.categories[cat];
    if (signals.length === 0) continue;

    // Pick top 2-3 signal descriptions by confidence
    const topSignals = signals
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((s) => s.signal.split(/[.!?]/)[0]?.trim() ?? s.signal.trim())
      .filter(Boolean);

    const signalText = topSignals
      .map((s) => s.slice(0, 60))
      .join(' ')
      .trim();
    const label = CATEGORY_LABELS[cat] ?? cat;
    const query = `${base} ${signalText} ${label} Atlantis partnership`;
    push(query, `intent-${cat}`);
  }

  // Extra categories
  for (const extra of intentVars.extras) {
    if (extra.signals.length === 0) continue;
    const topSignals = extra.signals
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2)
      .map((s) => s.signal.split(/[.!?]/)[0]?.trim() ?? s.signal.trim())
      .filter(Boolean);

    const signalText = topSignals
      .map((s) => s.slice(0, 60))
      .join(' ')
      .trim();
    const query = `${base} ${signalText} ${extra.category} Atlantis`;
    push(query, `intent-${extra.category}`);
  }

  return queryInputs;
}

function compactQuery(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
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
          doc."metadata" AS "documentMetadata",
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

      // Build a ready-to-use source label for downstream consumers
      const baseLabel = row.volume
        ? `${row.volume} — ${row.documentTitle}`
        : row.documentTitle;
      const sourceLabel = row.spvName
        ? `${baseLabel} (SPV: ${row.spvName})`
        : baseLabel;

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
        documentMetadata: row.documentMetadata,
        spvId: row.spvId,
        spvSlug: row.spvSlug,
        spvName: row.spvName,
        chunkMetadata: row.chunkMetadata,
        sourceLabel,
      });
    }
  }

  return Array.from(byChunkId.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}
