import { env } from '@/env.mjs';
import { apolloProvider } from '@/lib/enrichment/providers/apollo';
import type {
  CompanySearchFilters,
  ContactSearchFilters,
  EnrichmentProvider,
  EnrichmentProviderName,
  EnrichedCompanyData,
  EnrichedContactData,
  PersonLookupParams,
  SearchResult,
} from '@/lib/enrichment/types';

const PROVIDERS: Record<EnrichmentProviderName, EnrichmentProvider> = {
  apollo: apolloProvider,
};

const MEMORY_CACHE_TTL_MS =
  (env.ENRICHMENT_MEMORY_CACHE_TTL_SECONDS ?? 900) * 1000;
const SEARCH_CACHE_TTL_MS =
  (env.ENRICHMENT_SEARCH_CACHE_TTL_SECONDS ?? 240) * 1000;
const MAX_CACHE_ENTRIES = env.ENRICHMENT_CACHE_MAX_ENTRIES ?? 1500;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const companyCache = new Map<string, CacheEntry<EnrichedCompanyData>>();
const personCache = new Map<string, CacheEntry<EnrichedContactData>>();
const companySearchCache = new Map<
  string,
  CacheEntry<SearchResult<EnrichedCompanyData>>
>();
const contactSearchCache = new Map<
  string,
  CacheEntry<SearchResult<EnrichedContactData>>
>();
const inFlight = new Map<string, Promise<unknown>>();
const PLAN_LIMIT_ERROR_MARKERS = [
  'API_INACCESSIBLE',
  'endpoint unavailable for current Apollo plan',
];

class EnrichmentNoResultError extends Error {
  constructor(operation: string, details: string[]) {
    super(
      `[enrichment:${operation}] no provider returned data. ${details.join(' | ')}`,
    );
  }
}

export class EnrichmentPlanLimitedError extends Error {
  readonly operation: string;
  readonly details: string[];

  constructor(operation: string, details: string[]) {
    super(
      `[enrichment:${operation}] provider endpoints unavailable for current plan. ${details.join(' | ')}`,
    );
    this.name = 'EnrichmentPlanLimitedError';
    this.operation = operation;
    this.details = details;
  }
}

export function isEnrichmentPlanLimitedError(error: unknown): boolean {
  if (error instanceof EnrichmentPlanLimitedError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return PLAN_LIMIT_ERROR_MARKERS.some((marker) => message.includes(marker));
}

function parseProviderName(
  value: string | undefined,
): EnrichmentProviderName | null {
  if (!value) return null;
  const lowered = value.trim().toLowerCase();
  if (lowered === 'apollo') {
    return lowered;
  }
  return null;
}

function resolveProviderOrder(): EnrichmentProviderName[] {
  const primary = parseProviderName(env.ENRICHMENT_PROVIDER) ?? 'apollo';
  return [primary];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeDomain(value: string | null | undefined): string {
  return (
    normalizeText(value)
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .split('/')[0] ?? ''
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, itemValue]) => itemValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(
      ([key, itemValue]) =>
        `${JSON.stringify(key)}:${stableStringify(itemValue)}`,
    )
    .join(',')}}`;
}

function trimCache<T>(cache: Map<string, CacheEntry<T>>) {
  const overflow = cache.size - MAX_CACHE_ENTRIES;
  if (overflow <= 0) return;
  const keys = cache.keys();
  for (let i = 0; i < overflow; i++) {
    const key = keys.next().value;
    if (!key) break;
    cache.delete(key);
  }
}

function getCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  trimCache(cache);
}

async function withInFlightDedup<T>(
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise as Promise<unknown>);
  return promise;
}

async function runWithWaterfall<T>(
  operation: string,
  invoke: (provider: EnrichmentProvider) => Promise<T | null>,
): Promise<T> {
  const order = resolveProviderOrder();
  const errors: string[] = [];
  let errorCount = 0;
  let noResultCount = 0;
  let planLimitCount = 0;

  for (const providerName of order) {
    const provider = PROVIDERS[providerName];
    try {
      const result = await invoke(provider);
      if (result !== null) return result;
      errors.push(`${providerName}: no result`);
      noResultCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (PLAN_LIMIT_ERROR_MARKERS.some((marker) => message.includes(marker))) {
        errors.push(
          `${providerName}: endpoint unavailable for current Apollo plan`,
        );
        planLimitCount++;
        continue;
      }
      errors.push(`${providerName}: ${message}`);
      errorCount++;
    }
  }

  if (
    planLimitCount > 0 &&
    errorCount === 0 &&
    planLimitCount + noResultCount === order.length
  ) {
    throw new EnrichmentPlanLimitedError(operation, errors);
  }

  if (errorCount === 0) {
    throw new EnrichmentNoResultError(operation, errors);
  }

  throw new Error(
    `[enrichment:${operation}] all providers failed. ${errors.join(' | ')}`,
  );
}

function contactLooksUsable(contact: EnrichedContactData): boolean {
  return Boolean(
    contact.primaryEmail || contact.primaryPhone || contact.linkedinUrl,
  );
}

function emptyCompanySearchResult(
  filters: CompanySearchFilters,
): SearchResult<EnrichedCompanyData> {
  return {
    results: [],
    pagination: {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
      totalResults: 0,
      totalPages: 0,
    },
  };
}

function emptyContactSearchResult(
  filters: ContactSearchFilters,
): SearchResult<EnrichedContactData> {
  return {
    results: [],
    pagination: {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
      totalResults: 0,
      totalPages: 0,
    },
  };
}

export async function enrichCompany(
  domain: string,
  prospectId?: string,
): Promise<EnrichedCompanyData> {
  const cacheKey = `company:${normalizeDomain(domain)}`;
  const cached = getCached(companyCache, cacheKey);
  if (cached) return cached;

  return withInFlightDedup(cacheKey, async () => {
    const warm = getCached(companyCache, cacheKey);
    if (warm) return warm;

    const result = await runWithWaterfall('enrichCompany', async (provider) => {
      if (!provider.enrichCompany) return null;
      const company = await provider.enrichCompany(domain, prospectId);
      return company.companyName || company.description || company.industry
        ? company
        : null;
    });

    setCached(companyCache, cacheKey, result, MEMORY_CACHE_TTL_MS);
    return result;
  });
}

export async function lookupPerson(
  params: PersonLookupParams,
  contactId?: string,
): Promise<EnrichedContactData> {
  const cacheKey = `person:${stableStringify({
    firstName: normalizeText(params.firstName),
    lastName: normalizeText(params.lastName),
    companyName: normalizeText(params.companyName),
    companyDomain: normalizeDomain(params.companyDomain),
    linkedinUrl: normalizeText(params.linkedinUrl),
  })}`;
  const cached = getCached(personCache, cacheKey);
  if (cached) return cached;

  return withInFlightDedup(cacheKey, async () => {
    const warm = getCached(personCache, cacheKey);
    if (warm) return warm;

    const result = await runWithWaterfall('lookupPerson', async (provider) => {
      if (!provider.lookupPerson) return null;
      const person = await provider.lookupPerson(params, contactId);
      return contactLooksUsable(person) ? person : null;
    });
    setCached(personCache, cacheKey, result, MEMORY_CACHE_TTL_MS);
    return result;
  });
}

export async function searchCompanies(
  filters: CompanySearchFilters,
): Promise<SearchResult<EnrichedCompanyData>> {
  const cacheKey = `searchCompanies:${stableStringify(filters)}`;
  const cached = getCached(companySearchCache, cacheKey);
  if (cached) return cached;

  return withInFlightDedup(cacheKey, async () => {
    const warm = getCached(companySearchCache, cacheKey);
    if (warm) return warm;

    const result = await runWithWaterfall(
      'searchCompanies',
      async (provider) => {
        if (!provider.searchCompanies) return null;
        const companies = await provider.searchCompanies(filters);
        return companies.results.length > 0 ? companies : null;
      },
    ).catch(async (error) => {
      if (error instanceof EnrichmentNoResultError) {
        return emptyCompanySearchResult(filters);
      }
      throw error;
    });

    setCached(companySearchCache, cacheKey, result, SEARCH_CACHE_TTL_MS);
    return result;
  });
}

export async function searchContacts(
  filters: ContactSearchFilters,
): Promise<SearchResult<EnrichedContactData>> {
  const cacheKey = `searchContacts:${stableStringify(filters)}`;
  const cached = getCached(contactSearchCache, cacheKey);
  if (cached) return cached;

  return withInFlightDedup(cacheKey, async () => {
    const warm = getCached(contactSearchCache, cacheKey);
    if (warm) return warm;

    const result = await runWithWaterfall(
      'searchContacts',
      async (provider) => {
        if (!provider.searchContacts) return null;
        const contacts = await provider.searchContacts(filters);
        return contacts.results.length > 0 ? contacts : null;
      },
    ).catch(async (error) => {
      if (error instanceof EnrichmentNoResultError) {
        return emptyContactSearchResult(filters);
      }
      throw error;
    });

    setCached(contactSearchCache, cacheKey, result, SEARCH_CACHE_TTL_MS);
    return result;
  });
}
