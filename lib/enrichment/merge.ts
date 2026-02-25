import { fetchKvkData, type KvkEnrichmentData } from '@/lib/enrichment/kvk';
import type { EnrichedCompanyData } from '@/lib/enrichment/types';

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function employeeRangeFromCount(count: number | null): string | null {
  if (count === null || !Number.isFinite(count)) return null;
  if (count < 11) return '1-10';
  if (count < 51) return '11-50';
  if (count < 201) return '51-200';
  if (count < 501) return '201-500';
  if (count < 1001) return '501-1000';
  if (count < 5001) return '1001-5000';
  return '5001+';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

function isLikelyDutchProspect(
  enriched: EnrichedCompanyData,
  domainHint?: string,
): boolean {
  const domain = normalizeText(enriched.domain || domainHint || '');
  if (domain.endsWith('.nl')) return true;

  const country = normalizeText(enriched.country);
  return country.includes('netherlands') || country.includes('nederland');
}

function apolloSignalScore(enriched: EnrichedCompanyData): number {
  const signals = [
    Boolean(enriched.companyName),
    Boolean(enriched.industry),
    Boolean(enriched.employeeCount),
    Boolean(enriched.linkedinUrl),
    Boolean(enriched.description),
    Boolean(enriched.city || enriched.country),
    enriched.technologies.length > 0,
  ].filter(Boolean).length;

  return Math.min(1, signals / 7);
}

function kvkSignalScore(kvk: KvkEnrichmentData | null): number {
  if (!kvk) return 0;
  const signals = [
    Boolean(kvk.kvkNummer),
    Boolean(kvk.naam),
    Boolean(kvk.sbiCode || kvk.sbiOmschrijving),
    kvk.werkzamePersonen !== undefined,
    Boolean(kvk.rechtsvorm),
    Boolean(kvk.plaats),
  ].filter(Boolean).length;

  return Math.min(1, signals / 6);
}

export interface CombinedEnrichmentResult {
  merged: EnrichedCompanyData;
  kvk: KvkEnrichmentData | null;
  confidence: {
    apollo: number;
    kvk: number;
    combined: number;
    strategy: 'apollo_only' | 'apollo_plus_kvk' | 'apollo_plus_kvk_unmatched';
  };
}

export async function mergeApolloWithKvk(
  enriched: EnrichedCompanyData,
  options?: {
    domainHint?: string;
    companyNameHint?: string | null;
  },
): Promise<CombinedEnrichmentResult> {
  const apolloScore = apolloSignalScore(enriched);

  // KvK is only queried for NL prospects and when we have a company name candidate.
  if (!isLikelyDutchProspect(enriched, options?.domainHint)) {
    return {
      merged: enriched,
      kvk: null,
      confidence: {
        apollo: apolloScore,
        kvk: 0,
        combined: apolloScore,
        strategy: 'apollo_only',
      },
    };
  }

  const companyName = enriched.companyName ?? options?.companyNameHint ?? null;
  if (!companyName) {
    return {
      merged: enriched,
      kvk: null,
      confidence: {
        apollo: apolloScore,
        kvk: 0,
        combined: apolloScore,
        strategy: 'apollo_only',
      },
    };
  }

  const kvk = await fetchKvkData(companyName);
  if (!kvk) {
    return {
      merged: enriched,
      kvk: null,
      confidence: {
        apollo: apolloScore,
        kvk: 0,
        combined: Math.max(apolloScore, 0.5),
        strategy: 'apollo_plus_kvk_unmatched',
      },
    };
  }

  const merged: EnrichedCompanyData = {
    ...enriched,
    companyName: enriched.companyName ?? kvk.naam,
    industry: enriched.industry ?? kvk.sbiOmschrijving ?? null,
    employeeCount:
      enriched.employeeCount ?? kvk.werkzamePersonen ?? enriched.employeeCount,
    employeeRange:
      enriched.employeeRange ??
      employeeRangeFromCount(kvk.werkzamePersonen ?? null),
    city: enriched.city ?? kvk.plaats ?? null,
    specialties: uniqueStrings([
      ...enriched.specialties,
      ...(kvk.sbiCode ? [`SBI ${kvk.sbiCode}`] : []),
      ...(kvk.rechtsvorm ? [kvk.rechtsvorm] : []),
    ]),
  };

  const kvkScore = kvkSignalScore(kvk);
  const combined = Math.min(
    1,
    Math.max(apolloScore, 0.55) * 0.7 + kvkScore * 0.3,
  );

  return {
    merged,
    kvk,
    confidence: {
      apollo: apolloScore,
      kvk: kvkScore,
      combined,
      strategy: 'apollo_plus_kvk',
    },
  };
}
