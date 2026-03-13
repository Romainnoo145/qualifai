import { Prisma } from '@prisma/client';
import type { RagRetrievedPassage, RagProspectProfile } from './retriever';

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractMetadataTags(metadata: Prisma.JsonValue | null): string[] {
  const record = asRecord(metadata);
  if (!record) return [];
  const tags = record.tags;
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function inferIndustryLens(industry: string | null): {
  focus: string[];
  avoid: string[];
} {
  const haystack = (industry ?? '').toLowerCase();
  if (
    /(construction|bouw|infra|civil|real estate|housing|property|contractor)/.test(
      haystack,
    )
  ) {
    return {
      focus: [
        'woningbouw',
        'housing',
        'bouw',
        'construction',
        'infrastructure',
        'infrastructuur',
        'grond',
        'land',
        'stikstof',
        'vergunning',
        'permit',
        'capex',
      ],
      avoid: ['seaweed', 'zeewier', 'aquaculture', 'algae', 'fishery'],
    };
  }
  if (
    /(steel|metals|manufacturing|industrial|chemic|refining|shipbuilding)/.test(
      haystack,
    )
  ) {
    return {
      focus: [
        'steel',
        'dri',
        'hydrogen',
        'h2',
        'industrial',
        'co2',
        'cbam',
        'ets',
      ],
      avoid: ['consumer retail', 'tourism', 'hospitality'],
    };
  }
  if (
    /(data|datacenter|cloud|hosting|it|software|saas|telecom)/.test(haystack)
  ) {
    return {
      focus: ['datacenter', 'it-load', 'pue', 'latency', 'grid', 'cooling'],
      avoid: ['aquaculture', 'fisheries'],
    };
  }
  return {
    focus: [],
    avoid: [],
  };
}

export type EvidenceSignal = {
  snippet: string;
  workflowTag: string;
  confidenceScore: number;
};

/**
 * Rank RAG passages for a specific prospect using profile overlap, industry
 * lens, SPV matching, and optional evidence-aware scoring.
 *
 * evidenceSignals: non-RAG evidence items from the current research run. When
 * provided, passages whose content overlaps with high-confidence evidence
 * snippets receive up to +25 score boost, making steel-specific passages rank
 * above generic hydrogen/wind results for steel manufacturer prospects.
 */
export function rankRagPassagesForProspect(
  passages: RagRetrievedPassage[],
  profile: RagProspectProfile,
  maxResults = 12,
  evidenceSignals?: EvidenceSignal[],
): RagRetrievedPassage[] {
  if (passages.length === 0) return [];

  const lens = inferIndustryLens(profile.industry);
  const profileTokens = new Set(
    tokenize(
      [
        profile.companyName,
        profile.industry ?? '',
        profile.description ?? '',
        profile.country ?? '',
        profile.campaignNiche ?? '',
        profile.spvName ?? '',
        profile.specialties.join(' '),
        profile.technologies.join(' '),
      ].join(' '),
    ),
  );
  const focusTokens = new Set(tokenize(lens.focus.join(' ')));
  const avoidTokens = tokenize(lens.avoid.join(' '));

  // Build evidence token set from top evidence signals (sorted by confidence)
  let evidenceTokens: Set<string> | null = null;
  if (evidenceSignals && evidenceSignals.length > 0) {
    const topSnippets = evidenceSignals
      .slice()
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 10)
      .map((s) => s.snippet.slice(0, 80));
    const allTokens = tokenize(topSnippets.join(' ')).filter(
      (t) => t.length >= 4,
    );
    evidenceTokens = new Set(allTokens);
  }

  const scored = passages.map((passage) => {
    const tags = extractMetadataTags(passage.documentMetadata);
    const corpus = [
      passage.documentId,
      passage.documentTitle,
      passage.sourcePath,
      passage.sectionHeader ?? '',
      tags.join(' '),
      passage.content.slice(0, 1000),
    ].join(' ');
    const passageTokens = new Set(tokenize(corpus));

    let score = passage.similarity * 100;

    // Profile token overlap — up to +20
    let overlap = 0;
    for (const token of profileTokens) {
      if (passageTokens.has(token)) overlap += 1;
    }
    score += Math.min(20, overlap * 1.8);

    // Industry focus tokens — up to +18
    let focusHit = 0;
    for (const token of focusTokens) {
      if (passageTokens.has(token)) focusHit += 1;
    }
    score += Math.min(18, focusHit * 2.4);

    // SPV match — +14
    if (
      profile.spvName &&
      passage.spvName &&
      passage.spvName.toLowerCase() === profile.spvName.toLowerCase()
    ) {
      score += 14;
    }

    // Avoid tokens — up to -36
    const haystack = corpus.toLowerCase();
    let avoidHit = 0;
    for (const token of avoidTokens) {
      if (haystack.includes(token)) avoidHit += 1;
    }
    score -= Math.min(36, avoidHit * 12);

    // Vendor/supplier list penalty
    if (
      /(partners?\s+en\s+leveranciers|betrokken bedrijven|supplier|leverancier|bedrijvenlijst|vendor list)/i.test(
        haystack,
      )
    ) {
      score -= 18;
    }

    // Business-relevant keyword boost
    if (
      /(capex|irr|roi|co2|cbam|ets|csrd|natura|vergunning|stikstof|woning|housing|land|km2|km²|m2|m²|mt|gw|pue|miljoen|miljard|trillion|billion)/i.test(
        haystack,
      )
    ) {
      score += 12;
    }

    // Evidence-aware scoring — up to +25
    if (evidenceTokens && evidenceTokens.size > 0) {
      let evidenceOverlap = 0;
      for (const token of evidenceTokens) {
        if (passageTokens.has(token)) evidenceOverlap += 1;
      }
      score += Math.min(25, evidenceOverlap * 2.5);
    }

    return { passage, score };
  });

  scored.sort(
    (a, b) => b.score - a.score || b.passage.similarity - a.passage.similarity,
  );

  const selected: RagRetrievedPassage[] = [];
  const usedChunkIds = new Set<string>();
  const usedDocumentIds = new Set<string>();

  // First pass: one passage per document
  for (const item of scored) {
    if (selected.length >= maxResults) break;
    if (usedChunkIds.has(item.passage.chunkId)) continue;
    if (usedDocumentIds.has(item.passage.documentId)) continue;
    selected.push(item.passage);
    usedChunkIds.add(item.passage.chunkId);
    usedDocumentIds.add(item.passage.documentId);
  }

  // Second pass: fill remaining slots with best remaining chunks
  for (const item of scored) {
    if (selected.length >= maxResults) break;
    if (usedChunkIds.has(item.passage.chunkId)) continue;
    selected.push(item.passage);
    usedChunkIds.add(item.passage.chunkId);
  }

  return selected;
}
