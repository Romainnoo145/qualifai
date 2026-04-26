import type { ResearchStatus } from '@prisma/client';

export const ACTIVE_RESEARCH_STATUSES = [
  'PENDING',
  'CRAWLING',
  'EXTRACTING',
  'HYPOTHESIS',
  'BRIEFING',
] as const satisfies readonly ResearchStatus[];

export type ActiveResearchStatus = (typeof ACTIVE_RESEARCH_STATUSES)[number];

const LABELS: Record<ResearchStatus, string> = {
  PENDING: 'Onderzoek gestart',
  CRAWLING: 'Bronnen verzamelen',
  EXTRACTING: 'Data-extractie',
  HYPOTHESIS: 'Hypotheses opstellen',
  BRIEFING: 'Briefing opstellen',
  COMPLETED: 'Onderzoek afgerond',
  FAILED: 'Onderzoek update nodig',
};

export function statusLabel(
  status: ResearchStatus | string | null | undefined,
): string | null {
  if (!status) return null;
  return LABELS[status as ResearchStatus] ?? null;
}

export function isActiveStatus(
  status: ResearchStatus | string | null | undefined,
): status is ActiveResearchStatus {
  if (!status) return false;
  return (ACTIVE_RESEARCH_STATUSES as readonly string[]).includes(status);
}

export function currentStepLabel(
  status: ResearchStatus | string | null | undefined,
): string | null {
  if (!isActiveStatus(status)) return null;
  return statusLabel(status);
}
