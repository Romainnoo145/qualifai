import type { EvidenceDraft } from '@/lib/workflow-engine';

const KVK_BASE_URL =
  process.env.KVK_TEST_MODE === 'true'
    ? 'https://api.kvk.nl/test/api'
    : 'https://api.kvk.nl/api';

interface KvkZoekenResult {
  resultaten?: Array<{
    kvkNummer?: string;
    naam?: string;
    straatnaam?: string;
    postcode?: string;
    plaats?: string;
    actief?: string;
  }>;
  totaal?: number;
}

interface KvkBasisprofiel {
  kvkNummer?: string;
  naam?: string;
  formeleRegistratiedatum?: string;
  sbiActiviteiten?: Array<{
    sbiCode?: string;
    sbiOmschrijving?: string;
    indHoofdactiviteit?: string;
  }>;
  totaalWerkzamePersonen?: number;
  rechtsvorm?: string;
  uitgebreideRechtsvorm?: string;
}

export interface KvkEnrichmentData {
  kvkNummer: string;
  naam: string;
  sbiCode?: string;
  sbiOmschrijving?: string;
  werkzamePersonen?: number;
  rechtsvorm?: string;
  registratiedatum?: string;
  plaats?: string;
  postcode?: string;
}

export async function fetchKvkData(
  companyName: string,
): Promise<KvkEnrichmentData | null> {
  if (!process.env.KVK_API_KEY) {
    return null;
  }

  const headers = { apikey: process.env.KVK_API_KEY };

  try {
    // Step 1: Zoeken — find company by name
    const searchUrl = `${KVK_BASE_URL}/v2/zoeken?naam=${encodeURIComponent(companyName)}&resultatenPerPagina=3`;
    const searchResponse = await fetch(searchUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = (await searchResponse.json()) as KvkZoekenResult;

    // Prefer active companies; fall back to first result
    const first =
      searchData.resultaten?.find((r) => r.actief === 'Ja') ??
      searchData.resultaten?.[0];

    if (!first?.kvkNummer) {
      return null;
    }

    // Step 2: Basisprofiel — fetch detailed company profile
    const profileUrl = `${KVK_BASE_URL}/v1/basisprofielen/${first.kvkNummer}`;
    const profileResponse = await fetch(profileUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!profileResponse.ok) {
      return null;
    }

    const profile = (await profileResponse.json()) as KvkBasisprofiel;

    // Find primary SBI activity; fall back to first
    const hoofdSbi =
      profile.sbiActiviteiten?.find((s) => s.indHoofdactiviteit === 'Ja') ??
      profile.sbiActiviteiten?.[0];

    return {
      kvkNummer: first.kvkNummer,
      naam: profile.naam ?? first.naam ?? companyName,
      sbiCode: hoofdSbi?.sbiCode,
      sbiOmschrijving: hoofdSbi?.sbiOmschrijving,
      werkzamePersonen: profile.totaalWerkzamePersonen,
      rechtsvorm: profile.rechtsvorm ?? profile.uitgebreideRechtsvorm,
      registratiedatum: profile.formeleRegistratiedatum,
      plaats: first.plaats,
      postcode: first.postcode,
    };
  } catch (err) {
    console.error('[KvK] enrichment failed:', err);
    return null;
  }
}

export function kvkDataToEvidenceDraft(data: KvkEnrichmentData): EvidenceDraft {
  const parts: string[] = [];

  if (data.rechtsvorm) parts.push(`Rechtsvorm: ${data.rechtsvorm}`);
  if (data.sbiOmschrijving) parts.push(`Sector: ${data.sbiOmschrijving}`);
  if (data.werkzamePersonen !== undefined)
    parts.push(`Werkzame personen: ${data.werkzamePersonen}`);
  if (data.plaats) parts.push(`Gevestigd: ${data.plaats}`);
  if (data.registratiedatum)
    parts.push(`Ingeschreven: ${data.registratiedatum}`);

  const snippet = parts.join(' | ').slice(0, 240);
  const sourceUrl = `https://www.kvk.nl/zoeken/?source=all&q=${encodeURIComponent(data.naam)}&start=0&site=kvk`;

  return {
    sourceType: 'REGISTRY',
    sourceUrl,
    title: `${data.naam} - KvK Handelsregister`,
    snippet,
    workflowTag: 'workflow-context',
    confidenceScore: 0.82,
    metadata: {
      adapter: 'kvk',
      kvkNummer: data.kvkNummer,
      sbiCode: data.sbiCode,
      werkzamePersonen: data.werkzamePersonen,
    },
  };
}
