import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type PageLoaderProps = {
  label?: string;
  description?: string;
  fullscreen?: boolean;
  className?: string;
};

export function PageLoader({
  label = 'Loading',
  description,
  fullscreen = false,
  className,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center',
        fullscreen ? 'min-h-screen px-6 py-10' : 'min-h-[240px] py-16',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(4,0,38,0.06)]">
          <Loader2 className="h-7 w-7 animate-spin text-[#040026]" />
          <span className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-[#EBCB4B]" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black tracking-tight text-[#040026]">
            {label}
          </p>
          {description ? (
            <p className="text-xs font-medium text-slate-400">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
