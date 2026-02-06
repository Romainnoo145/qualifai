import { env } from '@/env.mjs';

interface LushaCompanyResponse {
  data?: {
    companyName?: string;
    domain?: string;
    industry?: string;
    subIndustry?: string;
    employeesRange?: string;
    revenueRange?: string;
    technologies?: string[];
    specialties?: string[];
    country?: string;
    city?: string;
    description?: string;
    logo?: string;
  };
}

export interface EnrichedCompanyData {
  companyName: string | null;
  domain: string;
  industry: string | null;
  subIndustry: string | null;
  employeeRange: string | null;
  revenueRange: string | null;
  technologies: string[];
  specialties: string[];
  country: string | null;
  city: string | null;
  description: string | null;
  logoUrl: string | null;
  rawData: Record<string, unknown>;
}

export async function enrichCompanyByDomain(
  domain: string,
): Promise<EnrichedCompanyData> {
  const cleanDomain = domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0];

  if (!cleanDomain) {
    throw new Error('Invalid domain provided');
  }

  const response = await fetch(
    `https://api.lusha.com/company?domain=${encodeURIComponent(cleanDomain)}`,
    {
      headers: {
        api_key: env.LUSHA_API_KEY,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lusha API error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as LushaCompanyResponse;
  const data = result.data;

  return {
    companyName: data?.companyName ?? null,
    domain: cleanDomain,
    industry: data?.industry ?? null,
    subIndustry: data?.subIndustry ?? null,
    employeeRange: data?.employeesRange ?? null,
    revenueRange: data?.revenueRange ?? null,
    technologies: data?.technologies ?? [],
    specialties: data?.specialties ?? [],
    country: data?.country ?? null,
    city: data?.city ?? null,
    description: data?.description ?? null,
    logoUrl: data?.logo ?? null,
    rawData: (result as Record<string, unknown>) ?? {},
  };
}
