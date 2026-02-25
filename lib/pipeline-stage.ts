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
  hasSession: boolean; // _count.sessions > 0
  hasBookedSession: boolean; // any session with callBooked === true
}

export function computePipelineStage(p: ProspectForStage): PipelineStage {
  // Priority order: most advanced stage first
  if (p.hasBookedSession || p.status === 'CONVERTED') return 'Booked';
  if (p.status === 'VIEWED' || p.status === 'ENGAGED' || p.hasSession)
    return 'Engaged';
  if (p.status === 'SENT') return 'Sending';
  if (p.status === 'READY') return 'Ready';
  if (
    p.researchRun?.qualityApproved === true &&
    p.status !== 'DRAFT' &&
    p.status !== 'GENERATING'
  )
    return 'Reviewed';
  if (p.researchRun?.status === 'COMPLETED') return 'Researched';
  if (
    p.status === 'GENERATING' ||
    (p.researchRun?.status &&
      ['PENDING', 'CRAWLING', 'EXTRACTING', 'HYPOTHESIS', 'BRIEFING'].includes(
        p.researchRun.status,
      ))
  )
    return 'Researching';
  return 'Imported';
}
