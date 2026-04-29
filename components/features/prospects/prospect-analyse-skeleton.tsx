import { SkelHeading, SkelLine } from '@/components/ui/skeleton';

export function ProspectAnalyseSkeleton() {
  return (
    <div className="max-w-4xl space-y-12">
      {/* Title block */}
      <div className="space-y-4">
        <SkelLine width="20%" className="h-2.5" />
        <SkelHeading width="70%" />
        <SkelLine width="100%" className="h-3" />
        <SkelLine width="85%" className="h-3" />
      </div>

      {/* 4 narrative sections */}
      {Array.from({ length: 4 }).map((_, i) => (
        <section key={i} className="space-y-4">
          <SkelLine width="35%" className="h-3" />
          <div className="space-y-2">
            <SkelLine width="100%" className="h-2.5" />
            <SkelLine width="95%" className="h-2.5" />
            <SkelLine width="90%" className="h-2.5" />
            <SkelLine width="60%" className="h-2.5" />
          </div>
        </section>
      ))}
    </div>
  );
}
