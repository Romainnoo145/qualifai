interface DiscoverProspectRef {
  slug: string;
  readableSlug?: string | null;
  companyName?: string | null;
  domain?: string | null;
}

// Internal prospect slugs are generated via nanoid(8), so we always extract
// the final 8-char token from pretty discover URLs like `name-0hk4SrGj`.
const TRAILING_CODE_REGEX = /([A-Za-z0-9_-]{8})$/;

function slugifyLabel(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function discoverLookupCandidates(param: string): string[] {
  const decoded = decodeURIComponent(param).trim();
  if (!decoded) return [];

  const set = new Set<string>([decoded]);
  const match = decoded.match(TRAILING_CODE_REGEX);
  if (match?.[1]) set.add(match[1]);

  return [...set];
}

export function buildDiscoverSlug(ref: DiscoverProspectRef): string {
  const fallback = ref.companyName ?? ref.domain ?? '';
  const baseLabel = (ref.readableSlug ?? slugifyLabel(fallback)).trim();
  const label = baseLabel.slice(0, 60).replace(/^-|-$/g, '');

  if (!label) return ref.slug;

  const lowerSlug = ref.slug.toLowerCase();
  if (label.toLowerCase().endsWith(`-${lowerSlug}`)) return label;
  // Avoid doubling when slug is already the slugified company name (manual inserts)
  if (label.toLowerCase() === lowerSlug) return label;
  return `${label}-${ref.slug}`;
}

export function buildDiscoverPath(ref: DiscoverProspectRef): string {
  return `/discover/${buildDiscoverSlug(ref)}`;
}

export function buildDiscoverUrl(
  appUrl: string,
  ref: DiscoverProspectRef,
): string {
  return `${appUrl.replace(/\/+$/, '')}${buildDiscoverPath(ref)}`;
}
