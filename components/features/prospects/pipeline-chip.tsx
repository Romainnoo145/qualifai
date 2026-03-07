import { cn } from '@/lib/utils';
import type { PipelineStage } from '@/lib/pipeline-stage';

const STAGE_COLORS: Record<PipelineStage, string> = {
  Imported: 'admin-state-neutral',
  Researching: 'admin-state-info',
  Researched: 'admin-state-info',
  Reviewed: 'admin-state-accent',
  Ready: 'admin-state-success',
  Sending: 'admin-state-warning',
  Engaged: 'admin-state-accent',
  Booked: 'admin-state-warning',
};

export function PipelineChip({ stage }: { stage: PipelineStage }) {
  return (
    <span
      className={cn(
        'admin-state-pill h-[1.375rem] whitespace-nowrap leading-none',
        STAGE_COLORS[stage],
      )}
    >
      {stage}
    </span>
  );
}
