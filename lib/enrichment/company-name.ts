/**
 * company-name.ts — Derive a readable company name from a raw domain.
 *
 * Used as a safety-net when `Prospect.companyName` is empty (e.g. manual
 * prospects created via /admin/prospects/new where Romano only enters the
 * domain, since domain is the scraping primary key).
 *
 * Rules:
 * - Strip protocol, www, path
 * - Take the second-level domain label (handles .co.uk / .com.au etc.)
 * - Split on hyphen / underscore / dot
 * - UPPER-case short all-consonant words as acronyms (STB, BV, NV, etc.)
 * - Title-case the rest
 *
 * Examples:
 *   marfa.nl                → Marfa
 *   stb-kozijnen.nl         → STB Kozijnen
 *   www.van-der-berg.nl     → Van Der Berg
 *   abc-consulting.com      → ABC Consulting
 *   deondernemer.nl         → Deondernemer
 *   heijmans.nl             → Heijmans
 *   sub.example.co.uk       → Example
 */

const KNOWN_SECONDARY_TLDS = new Set([
  'co',
  'com',
  'net',
  'org',
  'gov',
  'ac',
  'edu',
]);

const KNOWN_ACRONYMS = new Set([
  'bv',
  'nv',
  'cv',
  'ag',
  'gmbh',
  'llc',
  'ltd',
  'inc',
  'sa',
  'spa',
  'oy',
  'ab',
]);

function normalizeSegment(segment: string): string {
  const lower = segment.toLowerCase();

  // Known business suffix → uppercase (B.V., N.V., GmbH, etc.)
  if (KNOWN_ACRONYMS.has(lower)) {
    return lower === 'gmbh'
      ? 'GmbH'
      : lower === 'spa'
        ? 'SpA'
        : lower.toUpperCase();
  }

  // Acronym heuristic: 2–3 chars, no vowels (allow y) → UPPERCASE
  if (lower.length >= 2 && lower.length <= 3 && !/[aeiou]/.test(lower)) {
    return lower.toUpperCase();
  }

  // Title case
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function prettifyDomainToName(
  rawDomain: string | null | undefined,
): string | null {
  if (!rawDomain) return null;

  const cleaned = rawDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  if (!cleaned) return null;

  const parts = cleaned.split('.').filter(Boolean);
  if (parts.length === 0) return null;

  // Single-label fallback (unlikely for real domains)
  if (parts.length === 1) {
    return normalizeSegment(parts[0]!);
  }

  // Pick the second-level label, accounting for .co.uk / .com.au style
  let labelIndex = parts.length - 2;
  if (parts.length >= 3 && KNOWN_SECONDARY_TLDS.has(parts[parts.length - 2]!)) {
    labelIndex = parts.length - 3;
  }

  const label = parts[labelIndex];
  if (!label) return null;

  // Split on hyphen or underscore
  const words = label.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return null;

  return words.map(normalizeSegment).join(' ');
}
