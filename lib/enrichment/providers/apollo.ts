import { env } from '@/env.mjs';
import prisma from '@/lib/prisma';
import { encodeProviderId } from '@/lib/enrichment/provider-id';
import type {
  CompanySearchFilters,
  ContactSearchFilters,
  EnrichmentProvider,
  EnrichedCompanyData,
  EnrichedContactData,
  EnrichedEmail,
  EnrichedPhone,
  PersonLookupParams,
  SearchResult,
} from '@/lib/enrichment/types';

const APOLLO_BASE_URL = 'https://api.apollo.io/api/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 120; // Apollo rate limits vary by plan, keep conservative by default.

let lastRequestTime = 0;

function getApolloApiKey(): string {
  const key = env.APOLLO_API_KEY ?? process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error(
      'APOLLO_API_KEY is not configured. Set APOLLO_API_KEY to enable Apollo enrichment.',
    );
  }
  return key;
}

function cleanDomain(input: string): string {
  return input.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] ?? input;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractDomainFromUrl(urlValue: string | null): string | null {
  if (!urlValue) return null;
  try {
    const parsed = new URL(
      urlValue.startsWith('http') ? urlValue : `https://${urlValue}`,
    );
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return cleanDomain(urlValue);
  }
}

function employeeRangeFromCount(count: number | null): string | null {
  if (count === null) return null;
  if (count < 11) return '1-10';
  if (count < 51) return '11-50';
  if (count < 201) return '51-200';
  if (count < 501) return '201-500';
  if (count < 1001) return '501-1000';
  if (count < 5001) return '1001-5000';
  return '5001+';
}

function normalizeStatus(
  value: unknown,
): 'verified' | 'unverified' | undefined {
  if (typeof value !== 'string') return undefined;
  const lowered = value.toLowerCase();
  if (
    lowered === 'verified' ||
    lowered === 'valid' ||
    lowered === 'deliverable'
  ) {
    return 'verified';
  }
  if (
    lowered === 'unverified' ||
    lowered === 'invalid' ||
    lowered === 'undeliverable'
  ) {
    return 'unverified';
  }
  return undefined;
}

function toEmailList(person: Record<string, unknown>): EnrichedEmail[] {
  const emails: EnrichedEmail[] = [];
  const workEmail = firstString(person.email, person.work_email);
  if (workEmail) {
    emails.push({
      email: workEmail,
      type: 'work',
      status: normalizeStatus(person.email_status),
    });
  }

  for (const entry of parseArray(person.personal_emails)) {
    if (typeof entry === 'string' && entry.trim()) {
      emails.push({
        email: entry,
        type: 'personal',
        status: normalizeStatus(person.email_status),
      });
    }
  }

  return emails;
}

function toPhoneList(person: Record<string, unknown>): EnrichedPhone[] {
  const phones: EnrichedPhone[] = [];
  const phoneEntries = parseArray(person.phone_numbers);

  for (const entry of phoneEntries) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const number = firstString(
      item.sanitized_number,
      item.raw_number,
      item.phone,
      item.value,
    );
    if (!number) continue;

    const kind = firstString(item.type, item.phone_type)?.toLowerCase();
    const mappedType: EnrichedPhone['type'] =
      kind === 'mobile'
        ? 'mobile'
        : kind === 'direct'
          ? 'direct'
          : kind === 'work'
            ? 'work'
            : 'other';

    phones.push({ phone: number, type: mappedType });
  }

  const fallbackPhone = firstString(person.phone, person.sanitized_phone);
  if (fallbackPhone && !phones.some((item) => item.phone === fallbackPhone)) {
    phones.push({ phone: fallbackPhone, type: 'work' });
  }

  return phones;
}

function mapOrganizationToCompany(
  organizationInput: Record<string, unknown> | null,
  fallbackDomain?: string,
): EnrichedCompanyData {
  const organization = organizationInput ?? {};
  const orgId = firstString(organization.id, organization.organization_id);
  const employeeCount =
    firstNumber(
      organization.estimated_num_employees,
      organization.num_employees,
      organization.employee_count,
    ) ?? null;
  const technologies = parseArray(organization.technologies)
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        return firstString((entry as Record<string, unknown>).name);
      }
      return null;
    })
    .filter((entry): entry is string => Boolean(entry));
  const specialties = parseArray(organization.keywords)
    .map((entry) => (typeof entry === 'string' ? entry : null))
    .filter((entry): entry is string => Boolean(entry));

  const domain =
    firstString(
      organization.primary_domain,
      organization.domain,
      organization.website_url,
    ) ??
    fallbackDomain ??
    '';

  return {
    companyName: firstString(organization.name, organization.organization_name),
    domain: extractDomainFromUrl(domain) ?? fallbackDomain ?? '',
    industry: firstString(organization.industry, organization.primary_industry),
    subIndustry: firstString(
      organization.sub_industry,
      organization.subindustry,
    ),
    employeeRange:
      firstString(organization.employee_range) ??
      employeeRangeFromCount(employeeCount),
    employeeCount,
    revenueRange: firstString(organization.annual_revenue_range),
    revenueEstimate: firstString(organization.annual_revenue_printed),
    technologies,
    specialties,
    country: firstString(organization.country),
    city: firstString(organization.city),
    state: firstString(organization.state),
    description: firstString(
      organization.short_description,
      organization.description,
    ),
    logoUrl: firstString(organization.logo_url, organization.logo),
    linkedinUrl: firstString(
      organization.linkedin_url,
      organization.organization_linkedin_url,
    ),
    foundedYear: firstNumber(organization.founded_year),
    naicsCode: firstString(organization.naics_code),
    sicCode: firstString(organization.sic_code),
    lushaCompanyId: encodeProviderId('apollo', orgId),
    intentTopics: parseArray(organization.intent_topics),
    fundingInfo: {
      totalFunding: firstString(
        organization.total_funding_printed,
        organization.total_funding,
      ),
      lastRound: firstString(
        organization.latest_funding_stage,
        organization.latest_funding_round,
      ),
      lastRoundDate: firstString(organization.latest_funding_round_date),
      investors: parseArray(organization.latest_funding_investors)
        .map((entry) => (typeof entry === 'string' ? entry : null))
        .filter((entry): entry is string => Boolean(entry)),
    },
    rawData: organization,
  };
}

function mapPersonToContact(
  personInput: Record<string, unknown>,
): EnrichedContactData {
  const person = personInput;
  const emails = toEmailList(person);
  const phones = toPhoneList(person);
  const departments = parseArray(person.departments)
    .map((entry) => (typeof entry === 'string' ? entry : null))
    .filter((entry): entry is string => Boolean(entry));

  const orgRaw =
    person.organization && typeof person.organization === 'object'
      ? (person.organization as Record<string, unknown>)
      : null;
  const companyDomain = firstString(
    orgRaw?.primary_domain,
    orgRaw?.domain,
    orgRaw?.website_url,
  );
  const companyId = firstString(orgRaw?.id, orgRaw?.organization_id);

  return {
    firstName: firstString(person.first_name, person.firstName) ?? '',
    lastName: firstString(person.last_name, person.lastName) ?? '',
    jobTitle: firstString(person.title, person.job_title, person.headline),
    seniority: firstString(person.seniority),
    department: departments[0] ?? null,
    emails,
    phones,
    primaryEmail: emails[0]?.email ?? null,
    primaryPhone: phones[0]?.phone ?? null,
    country: firstString(person.country),
    city: firstString(person.city),
    state: firstString(person.state),
    lushaPersonId: encodeProviderId(
      'apollo',
      firstString(person.id, person.person_id),
    ),
    linkedinUrl: firstString(person.linkedin_url, person.linkedin_url_clean),
    socialProfiles: parseArray(person.social_links),
    rawData: person,
    company: orgRaw
      ? {
          companyId: encodeProviderId('apollo', companyId) ?? undefined,
          companyName:
            firstString(orgRaw.name, orgRaw.organization_name) ?? undefined,
          domain: extractDomainFromUrl(companyDomain) ?? undefined,
        }
      : undefined,
  };
}

function resolvePeopleArray(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const candidates = [
    payload.people,
    payload.contacts,
    payload.results,
    payload.persons,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object',
    );
  }
  return [];
}

function resolveOrganizationsArray(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const candidates = [
    payload.organizations,
    payload.accounts,
    payload.companies,
    payload.results,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object',
    );
  }
  return [];
}

function paginationFromPayload(
  payload: Record<string, unknown>,
  fallbackPage: number,
  fallbackPageSize: number,
  resultCount: number,
) {
  const pagination =
    payload.pagination && typeof payload.pagination === 'object'
      ? (payload.pagination as Record<string, unknown>)
      : {};
  const page = firstNumber(pagination.page, payload.page) ?? fallbackPage;
  const pageSize =
    firstNumber(pagination.per_page, pagination.page_size, payload.per_page) ??
    fallbackPageSize;
  const totalResults =
    firstNumber(
      pagination.total_entries,
      pagination.total_results,
      payload.total_entries,
      payload.total_results,
    ) ?? resultCount;
  const totalPages =
    firstNumber(
      pagination.total_pages,
      payload.total_pages,
      Math.ceil(totalResults / Math.max(pageSize, 1)),
    ) ?? 1;

  return {
    page,
    pageSize,
    totalResults,
    totalPages,
  };
}

async function rateLimitWait() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed),
    );
  }
  lastRequestTime = Date.now();
}

async function logUsage(
  endpoint: string,
  operation: string,
  credits = 1,
  prospectId?: string,
  contactId?: string,
) {
  try {
    await prisma.creditUsage.create({
      data: {
        endpoint,
        operation,
        credits,
        prospectId,
        contactId,
        metadata: {
          provider: 'apollo',
        },
      },
    });
  } catch (error) {
    console.error('failed to log Apollo credit usage', error);
  }
}

type ApolloRequestOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
  operation: string;
  credits?: number;
  prospectId?: string;
  contactId?: string;
};

async function apolloFetch<T>(
  path: string,
  options: ApolloRequestOptions,
): Promise<T> {
  const apiKey = getApolloApiKey();
  const {
    method = 'GET',
    query,
    body,
    operation,
    credits = 1,
    prospectId,
    contactId,
  } = options;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await rateLimitWait();
    try {
      const url = new URL(`${APOLLO_BASE_URL}${path}`);
      if (query) {
        for (const [key, value] of Object.entries(query)) {
          if (value === undefined || value === null || value === '') continue;
          url.searchParams.set(key, String(value));
        }
      }

      const response = await fetch(url.toString(), {
        method,
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '2');
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(1, retryAfter) * 1000),
        );
        continue;
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Apollo API error (${response.status}): ${message}`);
      }

      const payload = (await response.json()) as T;
      await logUsage(path, operation, credits, prospectId, contactId);
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES - 1) {
        const backoff = RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError ?? new Error('Apollo request failed');
}

async function enrichCompanyWithFallbackQueries(
  domain: string,
  prospectId?: string,
): Promise<Record<string, unknown> | null> {
  const clean = cleanDomain(domain);
  const queryCandidates = [
    { domain: clean },
    { organization_domain: clean },
    { website_url: clean },
  ];
  let sawSuccessfulResponse = false;
  let lastError: Error | null = null;

  for (const query of queryCandidates) {
    try {
      const payload = await apolloFetch<Record<string, unknown>>(
        '/organizations/enrich',
        {
          query,
          operation: 'apollo.enrichCompany',
          prospectId,
        },
      );
      sawSuccessfulResponse = true;

      const organization =
        payload.organization && typeof payload.organization === 'object'
          ? (payload.organization as Record<string, unknown>)
          : payload.data && typeof payload.data === 'object'
            ? (payload.data as Record<string, unknown>)
            : null;
      if (organization) return organization;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (!sawSuccessfulResponse && lastError) {
    throw lastError;
  }

  return null;
}

export const apolloProvider: EnrichmentProvider = {
  name: 'apollo',

  async enrichCompany(
    domain: string,
    prospectId?: string,
  ): Promise<EnrichedCompanyData> {
    const clean = cleanDomain(domain);
    const organization = await enrichCompanyWithFallbackQueries(
      clean,
      prospectId,
    );
    if (!organization) {
      throw new Error(`Apollo returned no organization for domain "${clean}"`);
    }
    return mapOrganizationToCompany(organization, clean);
  },

  async lookupPerson(
    params: PersonLookupParams,
    contactId?: string,
  ): Promise<EnrichedContactData> {
    const payload = await apolloFetch<Record<string, unknown>>(
      '/people/match',
      {
        method: 'POST',
        operation: 'apollo.lookupPerson',
        contactId,
        body: {
          first_name: params.firstName,
          last_name: params.lastName,
          organization_name: params.companyName,
          organization_domain: params.companyDomain
            ? cleanDomain(params.companyDomain)
            : undefined,
          linkedin_url: params.linkedinUrl,
          reveal_personal_emails: true,
          reveal_phone_number: true,
        },
      },
    );

    const directPerson =
      payload.person && typeof payload.person === 'object'
        ? (payload.person as Record<string, unknown>)
        : null;
    if (directPerson) return mapPersonToContact(directPerson);

    // Fallback path when /people/match cannot resolve but search can.
    const searchPayload = await apolloFetch<Record<string, unknown>>(
      '/mixed_people/search',
      {
        method: 'POST',
        operation: 'apollo.lookupPerson.fallbackSearch',
        contactId,
        body: {
          page: 1,
          per_page: 1,
          first_name: params.firstName,
          last_name: params.lastName,
          organization_domains: params.companyDomain
            ? [cleanDomain(params.companyDomain)]
            : undefined,
          person_linkedin_url: params.linkedinUrl,
        },
      },
    );
    const fallbackPerson = resolvePeopleArray(searchPayload)[0];
    if (!fallbackPerson) {
      throw new Error('Apollo lookup returned no person');
    }
    return mapPersonToContact(fallbackPerson);
  },

  async searchCompanies(
    filters: CompanySearchFilters,
  ): Promise<SearchResult<EnrichedCompanyData>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    // Domain lookups are deterministic and cheaper through enrich.
    if (filters.domain) {
      const company = await this.enrichCompany!(filters.domain);
      return {
        results: [company],
        pagination: {
          page: 1,
          pageSize: 1,
          totalResults: 1,
          totalPages: 1,
        },
      };
    }

    const payload = await apolloFetch<Record<string, unknown>>(
      '/organizations/search',
      {
        method: 'POST',
        operation: 'apollo.searchCompanies',
        body: {
          page,
          per_page: pageSize,
          q_organization_name: filters.companyName,
          organization_locations:
            [...(filters.countries ?? []), ...(filters.cities ?? [])].filter(
              Boolean,
            ).length > 0
              ? [...(filters.countries ?? []), ...(filters.cities ?? [])]
              : undefined,
          organization_keywords: filters.industries?.length
            ? filters.industries
            : undefined,
          organization_num_employees_ranges:
            filters.employeesRange &&
            (filters.employeesRange.min || filters.employeesRange.max)
              ? [
                  `${filters.employeesRange.min ?? ''},${filters.employeesRange.max ?? ''}`,
                ]
              : undefined,
          q_organization_technologies: filters.technologies,
        },
      },
    );

    const organizations = resolveOrganizationsArray(payload);
    const results = organizations.map((organization) =>
      mapOrganizationToCompany(organization),
    );

    return {
      results,
      pagination: paginationFromPayload(
        payload,
        page,
        pageSize,
        results.length,
      ),
    };
  },

  async searchContacts(
    filters: ContactSearchFilters,
  ): Promise<SearchResult<EnrichedContactData>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;

    const payload = await apolloFetch<Record<string, unknown>>(
      '/mixed_people/search',
      {
        method: 'POST',
        operation: 'apollo.searchContacts',
        body: {
          page,
          per_page: pageSize,
          person_titles: filters.jobTitles,
          person_seniorities: filters.seniorities,
          person_departments: filters.departments,
          organization_domains: filters.companyDomains,
          person_locations: filters.countries,
          organization_num_employees_ranges:
            filters.companySize &&
            (filters.companySize.min || filters.companySize.max)
              ? [
                  `${filters.companySize.min ?? ''},${filters.companySize.max ?? ''}`,
                ]
              : undefined,
        },
      },
    );

    const people = resolvePeopleArray(payload);
    const results = people.map((person) => mapPersonToContact(person));

    return {
      results,
      pagination: paginationFromPayload(
        payload,
        page,
        pageSize,
        results.length,
      ),
    };
  },
};
