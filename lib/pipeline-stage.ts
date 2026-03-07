export type PipelineStage =
  | 'Imported'
  | 'Researching'
  | 'Researched'
  | 'Reviewed'
  | 'Ready'
  | 'Sending'
  | 'Engaged'
  | 'Booked';

interface ProspectForStage {
  status: string; // ProspectStatus enum value
  researchRun?: {
    status: string; // ResearchStatus enum value
    qualityApproved: boolean | null;
  } | null;
  hasCompletedResearch?: boolean;
  hasActiveResearch?: boolean;
  hasSession: boolean; // _count.sessions > 0
  hasBookedSession: boolean; // any session with callBooked === true
}

export function computePipelineStage(p: ProspectForStage): PipelineStage {
  // Priority order: most advanced stage first
  if (p.hasBookedSession || p.status === 'CONVERTED') return 'Booked';
  if (p.status === 'ENGAGED') return 'Engaged';
  if (p.status === 'SENT') return 'Sending';
  const hasActiveResearch =
    p.hasActiveResearch === true ||
    (p.researchRun?.status
      ? ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'].includes(
          p.researchRun.status,
        )
      : false);
  if (p.status === 'GENERATING' || hasActiveResearch) return 'Researching';
  if (
    p.researchRun?.qualityApproved === true &&
    p.status !== 'DRAFT' &&
    p.status !== 'GENERATING'
  )
    return 'Reviewed';
  const hasCompletedResearch =
    p.hasCompletedResearch === true || p.researchRun?.status === 'COMPLETED';
  if (hasCompletedResearch) return 'Researched';
  if (p.status === 'READY') return 'Ready';
  return 'Imported';
}
