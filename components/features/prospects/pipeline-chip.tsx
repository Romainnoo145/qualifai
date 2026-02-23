import { cn } from '@/lib/utils';
import type { PipelineStage } from '@/lib/pipeline-stage';

const STAGE_COLORS: Record<PipelineStage, string> = {
  Imported: 'bg-slate-50 text-slate-500 border-slate-100',
  Researching: 'bg-blue-50 text-blue-600 border-blue-100',
  Reviewed: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  Ready: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  Sending: 'bg-amber-50 text-amber-600 border-amber-100',
  Engaged: 'bg-purple-50 text-purple-600 border-purple-100',
  Booked: 'bg-yellow-50 text-yellow-700 border-yellow-100',
};

export function PipelineChip({ stage }: { stage: PipelineStage }) {
  return (
    <span
      className={cn(
        'text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
        STAGE_COLORS[stage],
      )}
    >
      {stage}
    </span>
  );
}
