export type EnrichmentProviderName = 'apollo';

export interface EnrichedEmail {
  email: string;
  type: 'work' | 'personal' | 'other';
  status?: 'verified' | 'unverified';
}

export interface EnrichedPhone {
  phone: string;
  type: 'work' | 'mobile' | 'direct' | 'other';
}

export interface EnrichedCompanyData {
  companyName: string | null;
  domain: string;
  industry: string | null;
  subIndustry: string | null;
  employeeRange: string | null;
  employeeCount: number | null;
  revenueRange: string | null;
  revenueEstimate: string | null;
  technologies: string[];
  specialties: string[];
  country: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  logoUrl: string | null;
  linkedinUrl: string | null;
  foundedYear: number | null;
  naicsCode: string | null;
  sicCode: string | null;
  lushaCompanyId: string | null;
  intentTopics: unknown | null;
  fundingInfo: unknown | null;
  rawData: Record<string, unknown>;
}

export interface EnrichedContactData {
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  seniority: string | null;
  department: string | null;
  emails: EnrichedEmail[];
  phones: EnrichedPhone[];
  primaryEmail: string | null;
  primaryPhone: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  lushaPersonId: string | null;
  linkedinUrl: string | null;
  socialProfiles: unknown | null;
  rawData: Record<string, unknown>;
  company?: {
    companyId?: string;
    companyName?: string;
    domain?: string;
  };
}

export interface CompanySearchFilters {
  companyName?: string;
  domain?: string;
  industries?: string[];
  countries?: string[];
  cities?: string[];
  employeesRange?: { min?: number; max?: number };
  revenueRange?: { min?: number; max?: number };
  technologies?: string[];
  intentTopics?: string[];
  page?: number;
  pageSize?: number;
}

export interface ContactSearchFilters {
  jobTitles?: string[];
  seniorities?: string[];
  departments?: string[];
  countries?: string[];
  cities?: string[];
  companySize?: { min?: number; max?: number };
  companyIndustries?: string[];
  companyDomains?: string[];
  hasSignals?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SearchResult<T> {
  results: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalPages: number;
  };
}

export interface PersonLookupParams {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyDomain?: string;
  linkedinUrl?: string;
}

export interface EnrichmentProvider {
  name: EnrichmentProviderName;
  enrichCompany?: (
    domain: string,
    prospectId?: string,
  ) => Promise<EnrichedCompanyData>;
  lookupPerson?: (
    params: PersonLookupParams,
    contactId?: string,
  ) => Promise<EnrichedContactData>;
  searchCompanies?: (
    filters: CompanySearchFilters,
  ) => Promise<SearchResult<EnrichedCompanyData>>;
  searchContacts?: (
    filters: ContactSearchFilters,
  ) => Promise<SearchResult<EnrichedContactData>>;
}
