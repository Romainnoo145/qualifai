import { PageLoader } from '@/components/ui/page-loader';

export default function AdminLoading() {
  return (
    <PageLoader
      label="Loading admin"
      description="Preparing your workspace."
      className="min-h-[calc(100vh-8rem)]"
    />
  );
}
