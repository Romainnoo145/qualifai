import { PageLoader } from '@/components/ui/page-loader';

export default function Loading() {
  return (
    <div className="relative min-h-screen bg-[#FCFCFD] text-[#040026]">
      <PageLoader
        fullscreen
        label="Loading Qualifai"
        description="Preparing the next view."
      />
    </div>
  );
}
