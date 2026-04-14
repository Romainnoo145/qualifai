'use client';

// PARITY-12: Amber pill displayed in the detail header when companyName / industry / description
// are null, giving Romano a visible signal that this prospect needs enrichment before outreach.

interface ProspectEnrichmentBadgeProps {
  companyName: string | null | undefined;
  industry: string | null | undefined;
  description: string | null | undefined;
}

const FIELD_LABELS: Record<string, string> = {
  companyName: 'bedrijfsnaam',
  industry: 'sector',
  description: 'omschrijving',
};

export function ProspectEnrichmentBadge({
  companyName,
  industry,
  description,
}: ProspectEnrichmentBadgeProps) {
  const missingFields: string[] = [];
  if (!companyName) missingFields.push(FIELD_LABELS.companyName!);
  if (!industry) missingFields.push(FIELD_LABELS.industry!);
  if (!description) missingFields.push(FIELD_LABELS.description!);

  if (missingFields.length === 0) return null;

  const tooltip = `Verrijking ontbreekt: ${missingFields.join(', ')}`;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-300 cursor-default"
      title={tooltip}
    >
      Verrijking onvolledig
    </span>
  );
}
