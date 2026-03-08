'use client';

import type { MasterAnalysis } from '@/lib/analysis/types';

export type AtlantisDiscoverClientProps = {
  companyName: string;
  industry: string | null;
  prospectSlug: string;
  analysis: MasterAnalysis;
  projectBrandName: string;
  bookingUrl: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  analysisDate: string;
};

/**
 * Placeholder — replaced in Plan 02 with full three-section AI-rendered discover page.
 */
export function AtlantisDiscoverClient(props: AtlantisDiscoverClientProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
      <p className="text-sm text-gray-500">
        Analyse wordt geladen voor {props.companyName}...
      </p>
    </div>
  );
}
