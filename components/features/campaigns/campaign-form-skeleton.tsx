import { Skeleton, SkelHeading, SkelLine } from '@/components/ui/skeleton';

export function CampaignFormSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
        <SkelHeading width="50%" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      {/* Stepper */}
      <div className="flex gap-2 pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 flex-1 rounded-md" />
        ))}
      </div>

      {/* Form fields */}
      <div className="space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkelLine width="25%" className="h-2.5" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
    </div>
  );
}
