import type {
  EvidenceItem,
  Prisma,
  PrismaClient,
  SignalType,
} from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectSignalsInput {
  previousRunId: string;
  newRunId: string;
  prospectId: string;
  db: PrismaClient;
}

export interface DetectSignalsResult {
  signalsCreated: number;
  skippedByDedup: number;
  signalIds: string[];
}

interface SignalCandidate {
  signalType: SignalType;
  title: string;
  description: string | null;
  metadata: Prisma.InputJsonValue;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const LOOKBACK_DAYS: Record<string, number> = {
  NEW_JOB_LISTING: 30,
  HEADCOUNT_GROWTH: 60,
};

export const HEADCOUNT_GROWTH_MIN_DELTA = 5;
export const HEADCOUNT_GROWTH_MIN_PERCENT = 0.1;

// =============================================================================
// HELPERS
// =============================================================================

export function normTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extractHeadcount(items: EvidenceItem[]): number | null {
  // First: check REGISTRY items for metadata.werkzamePersonen
  const registryItems = items.filter((i) => i.sourceType === 'REGISTRY');

  for (const item of registryItems) {
    const meta = item.metadata as { werkzamePersonen?: number } | null;
    if (
      meta?.werkzamePersonen != null &&
      typeof meta.werkzamePersonen === 'number'
    ) {
      return meta.werkzamePersonen;
    }
  }

  // Fallback: parse REGISTRY or LINKEDIN snippet for "Werkzame personen: N"
  const fallbackItems = items.filter(
    (i) => i.sourceType === 'REGISTRY' || i.sourceType === 'LINKEDIN',
  );

  for (const item of fallbackItems) {
    const match = /Werkzame personen:\s*(\d+)/i.exec(item.snippet ?? '');
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export async function detectSignalsFromDiff(
  input: DetectSignalsInput,
): Promise<DetectSignalsResult> {
  const { previousRunId, newRunId, prospectId, db } = input;

  // 1. Fetch evidence for both runs
  const [prevItems, newItems] = await Promise.all([
    db.evidenceItem.findMany({ where: { researchRunId: previousRunId } }),
    db.evidenceItem.findMany({ where: { researchRunId: newRunId } }),
  ]);

  const candidates: SignalCandidate[] = [];

  // 2. NEW_JOB_LISTING detection
  const prevJobs = prevItems.filter(
    (i) => i.sourceType === 'CAREERS' || i.sourceType === 'JOB_BOARD',
  );
  const newJobs = newItems.filter(
    (i) => i.sourceType === 'CAREERS' || i.sourceType === 'JOB_BOARD',
  );

  const prevTitles = new Set(prevJobs.map((i) => normTitle(i.title ?? '')));
  const novelJobs = newJobs.filter(
    (i) => !prevTitles.has(normTitle(i.title ?? '')),
  );

  if (novelJobs.length > 0) {
    candidates.push({
      signalType: 'NEW_JOB_LISTING',
      title: `${novelJobs.length} nieuwe vacature${novelJobs.length > 1 ? 's' : ''} gedetecteerd`,
      description: novelJobs.map((j) => j.title).join(', '),
      metadata: {
        count: novelJobs.length,
        titles: novelJobs.map((j) => j.title ?? null),
        newRunId: input.newRunId,
      } as Prisma.InputJsonValue,
    });
  }

  // 3. HEADCOUNT_GROWTH detection
  const prevCount = extractHeadcount(prevItems);
  const newCount = extractHeadcount(newItems);

  if (prevCount !== null && newCount !== null && newCount > prevCount) {
    const delta = newCount - prevCount;
    const meetsAbsoluteThreshold = delta >= HEADCOUNT_GROWTH_MIN_DELTA;
    const meetsPercentThreshold =
      delta / prevCount >= HEADCOUNT_GROWTH_MIN_PERCENT;

    if (meetsAbsoluteThreshold || meetsPercentThreshold) {
      candidates.push({
        signalType: 'HEADCOUNT_GROWTH',
        title: `Personeelsgroei: ${prevCount} → ${newCount} (+${delta})`,
        description: null,
        metadata: {
          previousCount: prevCount,
          newCount,
          delta,
          newRunId: input.newRunId,
        } as Prisma.InputJsonValue,
      });
    }
  }

  // 4. Lookback dedup and signal creation
  let signalsCreated = 0;
  let skippedByDedup = 0;
  const signalIds: string[] = [];

  for (const candidate of candidates) {
    const lookbackMs = (LOOKBACK_DAYS[candidate.signalType] ?? 30) * 86400000;
    const lookbackDate = new Date(Date.now() - lookbackMs);

    const existing = await db.signal.findFirst({
      where: {
        prospectId,
        signalType: candidate.signalType,
        detectedAt: { gte: lookbackDate },
      },
    });

    if (existing) {
      skippedByDedup++;
      continue;
    }

    const created = await db.signal.create({
      data: {
        signalType: candidate.signalType,
        title: candidate.title,
        description: candidate.description,
        metadata: candidate.metadata,
        prospectId,
        isProcessed: false,
      },
    });

    signalsCreated++;
    signalIds.push(created.id);
  }

  return { signalsCreated, skippedByDedup, signalIds };
}
