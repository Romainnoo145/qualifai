'use client';

import { api } from '@/components/providers';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Search,
  Shield,
  WandSparkles,
} from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';

type WizardStepId = 0 | 1 | 2 | 3;

type SearchGuardrail = {
  code: string;
  title: string;
  message: string;
  recommendation?: string;
};

type CompanyResult = {
  companyName: string | null;
  domain: string;
  industry: string | null;
  description?: string | null;
  employeeRange: string | null;
  city: string | null;
  country: string | null;
  logoUrl: string | null;
  lushaCompanyId: string | null;
};

type ImportCompanyResult = {
  prospect: { id: string };
  alreadyExists: boolean;
};

type ContactResult = {
  company?: {
    domain?: string;
  };
};

type PersonaPreset = {
  id: string;
  label: string;
  description: string;
  jobTitles: string[];
  seniorities: string[];
  departments?: string[];
};

type CountryOption = {
  label: string;
  value: string;
};

type PersonaSearchConfig = {
  jobTitles: string[];
  seniorities: string[];
  departments?: string[];
  note: string;
};

const STEPS: Array<{ id: WizardStepId; label: string }> = [
  { id: 0, label: 'Doelgroep' },
  { id: 1, label: 'Prospects' },
  { id: 2, label: 'Instellingen' },
  { id: 3, label: 'Afronden' },
];

const USE_CASES = [
  {
    id: 'new-clients',
    label: 'Nieuwe klanten binnenhalen',
    nicheKey: 'new_clients',
    toneHint: 'Direct en resultaatgericht',
  },
  {
    id: 'reactivate',
    label: 'Inactieve leads reactiveren',
    nicheKey: 'reactivation',
    toneHint: 'Kort en persoonlijk',
  },
  {
    id: 'new-service',
    label: 'Nieuwe dienst introduceren',
    nicheKey: 'new_service',
    toneHint: 'Helder en adviserend',
  },
] as const;

const SECTORS = [
  'Bouw & Installatie',
  'Marketing & Creative',
  'SaaS & Software',
  'Zakelijke Dienstverlening',
  'E-commerce',
  'Vastgoed',
  'Industrie',
  'Overig',
] as const;

const COUNTRY_OPTIONS: CountryOption[] = [
  { label: 'Belgie', value: 'Belgium' },
  { label: 'Duitsland', value: 'Germany' },
  { label: 'Nederland', value: 'Netherlands' },
  { label: 'Verenigd Koninkrijk', value: 'United Kingdom' },
  { label: 'Verenigde Staten', value: 'United States' },
];
const COUNTRY_CODE_TO_VALUE = {
  NL: 'Netherlands',
  DE: 'Germany',
  UK: 'United Kingdom',
} as const;
const DEFAULT_COUNTRY_VALUE = 'Netherlands';

const COMPANY_SIZE_PRESETS = [
  { id: '5-20', label: '5-20 medewerkers', min: 5, max: 20 },
  { id: '21-50', label: '21-50 medewerkers', min: 21, max: 50 },
  { id: '51-100', label: '51-100 medewerkers', min: 51, max: 100 },
] as const;

const TONE_PRESETS = [
  { id: 'direct', label: 'Direct', value: 'Direct en concreet' },
  { id: 'consultative', label: 'Adviserend', value: 'Adviserend en scherp' },
  {
    id: 'friendly',
    label: 'Vriendelijk',
    value: 'Vriendelijk en professioneel',
  },
] as const;

const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'owner-founder',
    label: 'Founder / Owner',
    description: 'Eigenaar of founder als primaire beslisser.',
    jobTitles: ['Founder', 'Co-Founder', 'Owner', 'Managing Director', 'CEO'],
    seniorities: ['C-Level', 'Director'],
    departments: ['Executive', 'Operations'],
  },
  {
    id: 'commercial-lead',
    label: 'Commercieel directeur',
    description: 'Directie op groei, sales en marketing.',
    jobTitles: [
      'Commercial Director',
      'Head of Sales',
      'Sales Director',
      'Marketing Director',
      'Chief Revenue Officer',
    ],
    seniorities: ['C-Level', 'Director', 'VP'],
    departments: ['Sales', 'Marketing'],
  },
  {
    id: 'operations-lead',
    label: 'Operations lead',
    description: 'Verantwoordelijk voor uitvoering en processen.',
    jobTitles: [
      'Operations Director',
      'COO',
      'Head of Operations',
      'General Manager',
      'Managing Partner',
    ],
    seniorities: ['C-Level', 'Director', 'Manager'],
    departments: ['Operations', 'Management'],
  },
];
const DEFAULT_PERSONA_PRESET = PERSONA_PRESETS[0]!;
type UseCaseId = (typeof USE_CASES)[number]['id'];
type SectorOption = (typeof SECTORS)[number];
type CompanySizeId = (typeof COMPANY_SIZE_PRESETS)[number]['id'];
type PersonaId = PersonaPreset['id'];
type SpvCampaignPreset = {
  label: string;
  useCaseId: UseCaseId;
  sector: SectorOption;
  countryValue: CountryOption['value'];
  companySizeId: CompanySizeId;
  personaId: PersonaId;
  apolloIndustryKeywords: string[];
  includeTerms: string[];
  excludeTerms?: string[];
};

const DEFAULT_EXCLUDE_TERMS = [
  'staffing',
  'recruit',
  'human resources',
  'hr services',
  'talent acquisition',
  'placement',
];

const SECTOR_APOLLO_KEYWORDS: Partial<Record<SectorOption, string[]>> = {
  'Bouw & Installatie': [
    'construction',
    'infrastructure',
    'building services',
    'installation',
  ],
  'Marketing & Creative': ['marketing', 'advertising', 'creative agency'],
  'SaaS & Software': ['software', 'saas', 'information technology'],
  'Zakelijke Dienstverlening': [
    'professional services',
    'business consulting',
    'management consulting',
  ],
  'E-commerce': ['ecommerce', 'online retail', 'retail'],
  Vastgoed: ['real estate', 'property management', 'commercial real estate'],
  Industrie: ['industrial', 'manufacturing', 'engineering'],
};

const ATLANTIS_SPV_CAMPAIGN_PRESETS: Record<string, SpvCampaignPreset> = {
  infraco: {
    label: 'InfraCo',
    useCaseId: 'new-clients',
    sector: 'Bouw & Installatie',
    countryValue: 'Netherlands',
    companySizeId: '51-100',
    personaId: 'operations-lead',
    apolloIndustryKeywords: [
      'infrastructure',
      'construction',
      'civil engineering',
      'utilities',
    ],
    includeTerms: [
      'infrastructure',
      'construction',
      'engineering',
      'utilities',
    ],
  },
  energyco: {
    label: 'EnergyCo',
    useCaseId: 'new-clients',
    sector: 'Industrie',
    countryValue: 'Germany',
    companySizeId: '51-100',
    personaId: 'operations-lead',
    apolloIndustryKeywords: ['energy', 'utilities', 'power generation'],
    includeTerms: ['energy', 'utilities', 'power', 'renewable', 'grid'],
  },
  steelco: {
    label: 'SteelCo',
    useCaseId: 'new-clients',
    sector: 'Industrie',
    countryValue: 'Germany',
    companySizeId: '51-100',
    personaId: 'commercial-lead',
    apolloIndustryKeywords: ['steel', 'metals', 'industrial manufacturing'],
    includeTerms: ['steel', 'metals', 'manufacturing', 'foundry'],
  },
  realestateco: {
    label: 'RealEstateCo',
    useCaseId: 'new-clients',
    sector: 'Vastgoed',
    countryValue: 'Netherlands',
    companySizeId: '51-100',
    personaId: 'commercial-lead',
    apolloIndustryKeywords: ['real estate', 'property management'],
    includeTerms: ['real estate', 'property', 'proptech', 'asset management'],
  },
  dataco: {
    label: 'DataCo',
    useCaseId: 'new-clients',
    sector: 'SaaS & Software',
    countryValue: 'United Kingdom',
    companySizeId: '51-100',
    personaId: 'commercial-lead',
    apolloIndustryKeywords: ['data infrastructure', 'software', 'cloud'],
    includeTerms: [
      'data',
      'cloud',
      'software',
      'saas',
      'digital infrastructure',
    ],
  },
  mobilityco: {
    label: 'MobilityCo',
    useCaseId: 'new-clients',
    sector: 'Industrie',
    countryValue: 'Netherlands',
    companySizeId: '51-100',
    personaId: 'operations-lead',
    apolloIndustryKeywords: ['mobility', 'transportation', 'logistics'],
    includeTerms: ['mobility', 'transport', 'rail', 'logistics', 'fleet'],
  },
  blueco: {
    label: 'BlueCo',
    useCaseId: 'new-clients',
    sector: 'Industrie',
    countryValue: 'United Kingdom',
    companySizeId: '51-100',
    personaId: 'operations-lead',
    apolloIndustryKeywords: ['maritime', 'shipping', 'offshore'],
    includeTerms: ['maritime', 'shipping', 'offshore', 'port', 'naval'],
  },
  defenceco: {
    label: 'DefenceCo',
    useCaseId: 'new-clients',
    sector: 'Industrie',
    countryValue: 'United Kingdom',
    companySizeId: '51-100',
    personaId: 'operations-lead',
    apolloIndustryKeywords: ['defense', 'defence', 'aerospace', 'security'],
    includeTerms: ['defense', 'defence', 'aerospace', 'military', 'security'],
    excludeTerms: [
      'staffing',
      'recruit',
      'human resources',
      'talent',
      'placement',
      'executive search',
    ],
  },
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0]!;
}

function compareAlpha(a: string, b: string) {
  return a.localeCompare(b, 'nl', { sensitivity: 'base' });
}

function companySortKey(company: CompanyResult) {
  return (company.companyName ?? company.domain).trim();
}

function compareCompanies(a: CompanyResult, b: CompanyResult) {
  const byName = compareAlpha(companySortKey(a), companySortKey(b));
  if (byName !== 0) return byName;
  return compareAlpha(normalizeDomain(a.domain), normalizeDomain(b.domain));
}

function dedupeSorted(values: string[]) {
  return [...new Set(values)].sort(compareAlpha);
}

function getDefaultToneIdForUseCase(
  useCaseId: (typeof USE_CASES)[number]['id'],
): (typeof TONE_PRESETS)[number]['id'] {
  switch (useCaseId) {
    case 'new-service':
      return 'consultative';
    case 'reactivate':
      return 'friendly';
    case 'new-clients':
    default:
      return 'direct';
  }
}

function buildPersonaSearchConfig(
  persona: PersonaPreset,
  companySize: { min: number; max: number },
): PersonaSearchConfig {
  const jobTitles = [...persona.jobTitles];
  const seniorities = [...persona.seniorities];
  const departments = [...(persona.departments ?? [])];
  const notes: string[] = [];

  if (companySize.max <= 50 && persona.id === 'commercial-lead') {
    jobTitles.push(
      'Founder',
      'Co-Founder',
      'Owner',
      'Managing Director',
      'CEO',
    );
    seniorities.push('C-Level', 'Director');
    notes.push('MKB: eigenaar/founder automatisch toegevoegd');
  }

  const normalizedJobs = dedupeSorted(jobTitles);
  const normalizedSeniorities = dedupeSorted(seniorities);
  const normalizedDepartments = dedupeSorted(departments);

  return {
    jobTitles: normalizedJobs,
    seniorities: normalizedSeniorities,
    departments:
      normalizedDepartments.length > 0 ? normalizedDepartments : undefined,
    note: notes.length > 0 ? notes.join(' • ') : 'Standaard beslisser-profiel',
  };
}

function buildAutoCampaignName(
  useCaseLabel: string,
  sector: string,
  sizeLabel: string,
) {
  const shortSize = sizeLabel.replace(' medewerkers', '');
  return `${useCaseLabel} | ${sector} | ${shortSize}`;
}

type CampaignPresetCandidate = {
  name?: string | null;
  slug?: string | null;
  nicheKey?: string | null;
};

function inferAtlantisSpvSlug(
  campaign: CampaignPresetCandidate,
): string | null {
  const source =
    `${campaign.slug ?? ''} ${campaign.nicheKey ?? ''}`.toLowerCase();
  const keys = Object.keys(ATLANTIS_SPV_CAMPAIGN_PRESETS).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (source.includes(key)) return key;
  }

  return null;
}

function getAtlantisCampaignPreset(campaign: CampaignPresetCandidate) {
  const spvSlug = inferAtlantisSpvSlug(campaign);
  if (!spvSlug) return null;
  const normalized = spvSlug.replace(/-/g, '');
  const mapped = ATLANTIS_SPV_CAMPAIGN_PRESETS[normalized];
  const countryToken =
    campaign.name?.split('|')?.[2]?.trim().toUpperCase() ?? '';
  const countryFromName =
    countryToken in COUNTRY_CODE_TO_VALUE
      ? COUNTRY_CODE_TO_VALUE[
          countryToken as keyof typeof COUNTRY_CODE_TO_VALUE
        ]
      : null;
  if (mapped) {
    return {
      ...mapped,
      countryValue: countryFromName ?? mapped.countryValue,
    };
  }

  const label = spvSlug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    label: label.length > 0 ? label : 'SPV',
    useCaseId: 'new-clients' as const,
    sector: 'Industrie' as const,
    countryValue: (countryFromName ?? 'Netherlands') as CountryOption['value'],
    companySizeId: '51-100' as const,
    personaId: 'operations-lead' as const,
    apolloIndustryKeywords: ['industrial', 'manufacturing', 'engineering'],
    includeTerms: [
      'industrial',
      'manufacturing',
      'engineering',
      'infrastructure',
    ],
  };
}

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function buildApolloIndustryKeywords(
  sector: SectorOption,
  preset: SpvCampaignPreset | null,
): string[] | undefined {
  if (preset?.apolloIndustryKeywords?.length) {
    return preset.apolloIndustryKeywords;
  }
  const mapped = SECTOR_APOLLO_KEYWORDS[sector];
  if (!mapped || mapped.length === 0) return undefined;
  return mapped;
}

function filterCompaniesByPresetRelevance(
  companies: CompanyResult[],
  preset: SpvCampaignPreset | null,
): { results: CompanyResult[]; dropped: number } {
  if (!preset) return { results: companies, dropped: 0 };

  const includeTerms = preset.includeTerms.map((term) => term.toLowerCase());
  const excludeTerms = [
    ...DEFAULT_EXCLUDE_TERMS,
    ...(preset.excludeTerms ?? []),
  ].map((term) => term.toLowerCase());

  const filtered = companies.filter((company) => {
    const haystack = [
      normalizeSearchText(company.companyName),
      normalizeSearchText(company.industry),
      normalizeSearchText(company.description),
    ].join(' ');

    if (excludeTerms.some((term) => haystack.includes(term))) {
      return false;
    }
    if (includeTerms.length === 0) return true;
    return includeTerms.some((term) => haystack.includes(term));
  });

  if (
    filtered.length >= 4 ||
    filtered.length >= Math.ceil(companies.length * 0.4)
  ) {
    return { results: filtered, dropped: companies.length - filtered.length };
  }

  // Avoid overly strict include filters: keep exclude-filtered set as fallback.
  const excludeOnly = companies.filter((company) => {
    const haystack = [
      normalizeSearchText(company.companyName),
      normalizeSearchText(company.industry),
      normalizeSearchText(company.description),
    ].join(' ');
    return !excludeTerms.some((term) => haystack.includes(term));
  });

  return {
    results: excludeOnly,
    dropped: companies.length - excludeOnly.length,
  };
}

export default function NewCampaignWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const presetAppliedRef = useRef(false);
  const autoSearchTriggeredRef = useRef(false);

  const existingCampaignIdRaw = searchParams.get('campaignId');
  const existingCampaignId =
    existingCampaignIdRaw && existingCampaignIdRaw.trim().length > 0
      ? existingCampaignIdRaw.trim()
      : null;
  const isExistingCampaignMode = Boolean(existingCampaignId);
  const existingCampaignQuery = api.campaigns.get.useQuery(
    { id: existingCampaignId ?? '' },
    { enabled: isExistingCampaignMode },
  );

  const [step, setStep] = useState<WizardStepId>(0);
  const [campaignName, setCampaignName] = useState('');
  const [campaignNameTouched, setCampaignNameTouched] = useState(false);

  const [useCaseId, setUseCaseId] = useState<(typeof USE_CASES)[number]['id']>(
    USE_CASES[0].id,
  );
  const [sector, setSector] = useState<(typeof SECTORS)[number]>(SECTORS[0]);
  const [countryValue, setCountryValue] = useState<string>(
    DEFAULT_COUNTRY_VALUE,
  );
  const [companySizeId, setCompanySizeId] = useState<
    (typeof COMPANY_SIZE_PRESETS)[number]['id']
  >(COMPANY_SIZE_PRESETS[1].id);
  const [personaId, setPersonaId] = useState<string>(DEFAULT_PERSONA_PRESET.id);

  const [language, setLanguage] = useState<'nl' | 'en'>('nl');
  const [toneId, setToneId] = useState<(typeof TONE_PRESETS)[number]['id']>(
    TONE_PRESETS[0].id,
  );
  const [toneTouched, setToneTouched] = useState(false);
  const [strictGate, setStrictGate] = useState(true);

  const [results, setResults] = useState<CompanyResult[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<Map<string, string>>(
    new Map(),
  );
  const [hasSearched, setHasSearched] = useState(false);
  const [guardrail, setGuardrail] = useState<SearchGuardrail | null>(null);
  const [personaGuardrail, setPersonaGuardrail] =
    useState<SearchGuardrail | null>(null);
  const [personaMatchDomains, setPersonaMatchDomains] = useState<Set<string>>(
    new Set(),
  );
  const [personaMatchSource, setPersonaMatchSource] = useState<
    'none' | 'real' | 'mock'
  >('none');
  const [showOnlyPersonaMatches, setShowOnlyPersonaMatches] = useState(false);
  const [showRecommendedFirst, setShowRecommendedFirst] = useState(true);
  const [runSummary, setRunSummary] = useState<string | null>(null);
  const [searchFilterNote, setSearchFilterNote] = useState<string | null>(null);

  const selectedUseCase = useMemo(
    () => USE_CASES.find((item) => item.id === useCaseId) ?? USE_CASES[0],
    [useCaseId],
  );
  const selectedSize = useMemo(
    () =>
      COMPANY_SIZE_PRESETS.find((item) => item.id === companySizeId) ??
      COMPANY_SIZE_PRESETS[1],
    [companySizeId],
  );
  const selectedCountry = useMemo(
    () =>
      COUNTRY_OPTIONS.find((item) => item.value === countryValue) ??
      COUNTRY_OPTIONS.find((item) => item.value === DEFAULT_COUNTRY_VALUE)!,
    [countryValue],
  );
  const autoToneId = useMemo(
    () => getDefaultToneIdForUseCase(useCaseId),
    [useCaseId],
  );
  const effectiveToneId = toneTouched ? toneId : autoToneId;
  const selectedTone = useMemo(
    () =>
      TONE_PRESETS.find((item) => item.id === effectiveToneId) ??
      TONE_PRESETS[0],
    [effectiveToneId],
  );
  const selectedPersona: PersonaPreset = useMemo(
    () =>
      PERSONA_PRESETS.find((item) => item.id === personaId) ??
      DEFAULT_PERSONA_PRESET,
    [personaId],
  );
  const sortedUseCases = useMemo(
    () =>
      [...USE_CASES].sort((a, b) =>
        compareAlpha(getUseCaseLabel(a.id), getUseCaseLabel(b.id)),
      ),
    [],
  );
  const sortedPersonaPresets = useMemo(
    () => [...PERSONA_PRESETS].sort((a, b) => compareAlpha(a.label, b.label)),
    [],
  );
  const sortedSectors = useMemo(() => [...SECTORS].sort(compareAlpha), []);
  const sortedCountryOptions = useMemo(
    () => [...COUNTRY_OPTIONS].sort((a, b) => compareAlpha(a.label, b.label)),
    [],
  );
  const sortedTonePresets = useMemo(
    () => [...TONE_PRESETS].sort((a, b) => compareAlpha(a.label, b.label)),
    [],
  );
  const personaSearchConfig = useMemo(
    () =>
      buildPersonaSearchConfig(selectedPersona, {
        min: selectedSize.min,
        max: selectedSize.max,
      }),
    [selectedPersona, selectedSize.min, selectedSize.max],
  );

  const autoCampaignName = useMemo(
    () =>
      buildAutoCampaignName(
        getUseCaseLabel(selectedUseCase.id),
        sector,
        selectedSize.label,
      ),
    [selectedUseCase.id, sector, selectedSize.label],
  );
  const effectiveCampaignName = isExistingCampaignMode
    ? (existingCampaignQuery.data?.name ?? '')
    : campaignNameTouched
      ? campaignName
      : autoCampaignName;
  const atlantisPreset = useMemo(() => {
    if (!isExistingCampaignMode || !existingCampaignQuery.data) return null;
    return getAtlantisCampaignPreset(existingCampaignQuery.data);
  }, [isExistingCampaignMode, existingCampaignQuery.data]);

  const searchCompaniesMutation = api.search.companies.useMutation();
  const searchContactsMutation = api.search.contacts.useMutation();

  const createCampaignMutation = api.campaigns.create.useMutation();
  const importCompanyMutation = api.search.importCompany.useMutation();
  const attachProspectMutation = api.campaigns.attachProspect.useMutation();

  const isSubmitting =
    createCampaignMutation.isPending ||
    importCompanyMutation.isPending ||
    attachProspectMutation.isPending;
  const isSearching =
    searchCompaniesMutation.isPending || searchContactsMutation.isPending;

  const canContinueFromStep1 =
    isExistingCampaignMode || effectiveCampaignName.trim().length >= 3;
  const canContinueFromStep2 = hasSearched;

  const canGoNext =
    (step === 0 && canContinueFromStep1) ||
    (step === 1 && canContinueFromStep2) ||
    step >= 2;

  const campaignNicheKey = useMemo(() => {
    return [
      selectedUseCase.nicheKey,
      slugify(sector),
      slugify(selectedCountry.label),
      selectedSize.id,
      slugify(selectedPersona.label),
    ].join('_');
  }, [
    selectedUseCase.nicheKey,
    sector,
    selectedCountry.label,
    selectedSize.id,
    selectedPersona.label,
  ]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time init from loaded campaign data */
  useEffect(() => {
    if (
      !isExistingCampaignMode ||
      !existingCampaignQuery.data ||
      presetAppliedRef.current
    ) {
      return;
    }

    const campaignLanguage = existingCampaignQuery.data.language;
    setLanguage(campaignLanguage === 'en' ? 'en' : 'nl');
    setStrictGate(existingCampaignQuery.data.strictGate);

    if (atlantisPreset) {
      setUseCaseId(atlantisPreset.useCaseId);
      setSector(atlantisPreset.sector);
      setCountryValue(atlantisPreset.countryValue);
      setCompanySizeId(atlantisPreset.companySizeId);
      setPersonaId(atlantisPreset.personaId);
      setStep(1);
    }

    presetAppliedRef.current = true;
  }, [isExistingCampaignMode, existingCampaignQuery.data, atlantisPreset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const visibleResults = useMemo(() => {
    const filtered = showOnlyPersonaMatches
      ? results.filter((company) =>
          personaMatchDomains.has(normalizeDomain(company.domain)),
        )
      : results;
    return [...filtered].sort((a, b) => {
      if (showRecommendedFirst) {
        const aRecommended = personaMatchDomains.has(normalizeDomain(a.domain));
        const bRecommended = personaMatchDomains.has(normalizeDomain(b.domain));
        if (aRecommended !== bRecommended) return aRecommended ? -1 : 1;
      }
      return compareCompanies(a, b);
    });
  }, [
    results,
    showOnlyPersonaMatches,
    showRecommendedFirst,
    personaMatchDomains,
  ]);

  const allVisibleSelected =
    visibleResults.length > 0 &&
    visibleResults.every((company) => selectedDomains.has(company.domain));

  const handleSearch = async () => {
    setRunSummary(null);
    setSearchFilterNote(null);
    setGuardrail(null);
    setPersonaGuardrail(null);
    setPersonaMatchDomains(new Set());
    setPersonaMatchSource('none');
    setShowOnlyPersonaMatches(false);
    setShowRecommendedFirst(true);
    setSelectedDomains(new Map());
    try {
      const industryKeywords = buildApolloIndustryKeywords(
        sector,
        atlantisPreset,
      );

      const companyResponse = await searchCompaniesMutation.mutateAsync({
        industries:
          sector === 'Overig' && !industryKeywords
            ? undefined
            : industryKeywords,
        countries: [selectedCountry.value],
        employeesMin: selectedSize.min,
        employeesMax: selectedSize.max,
        page: 1,
        pageSize: 40,
      });

      const rawResults = (
        (companyResponse.results ?? []) as CompanyResult[]
      ).sort(compareCompanies);
      const relevance = filterCompaniesByPresetRelevance(
        rawResults,
        atlantisPreset,
      );
      const nextResults = relevance.results;
      setResults(nextResults);
      setGuardrail(
        (companyResponse.guardrail ?? null) as SearchGuardrail | null,
      );
      if (relevance.dropped > 0) {
        setSearchFilterNote(
          `${relevance.dropped} off-target resultaten weggefilterd op basis van SPV-focus.`,
        );
      }
      setHasSearched(true);

      if (nextResults.length === 0 || companyResponse.guardrail) {
        return;
      }

      const contactsResponse = await searchContactsMutation.mutateAsync({
        jobTitles: personaSearchConfig.jobTitles,
        seniorities: personaSearchConfig.seniorities,
        departments: personaSearchConfig.departments,
        countries: [selectedCountry.value],
        companyDomains: nextResults.map((company) =>
          normalizeDomain(company.domain),
        ),
        companySizeMin: selectedSize.min,
        companySizeMax: selectedSize.max,
        page: 1,
        pageSize: 100,
      });

      setPersonaGuardrail(
        (contactsResponse.guardrail ?? null) as SearchGuardrail | null,
      );

      if (contactsResponse.guardrail?.code === 'APOLLO_PLAN_LIMIT') {
        const mockMatches = new Set<string>();
        for (const company of nextResults.slice(
          0,
          Math.min(8, nextResults.length),
        )) {
          mockMatches.add(normalizeDomain(company.domain));
        }
        setPersonaMatchDomains(mockMatches);
        setPersonaMatchSource(mockMatches.size > 0 ? 'mock' : 'none');

        if (mockMatches.size > 0) {
          const autoSelected = new Map<string, string>();
          for (const company of nextResults) {
            if (mockMatches.has(normalizeDomain(company.domain))) {
              autoSelected.set(
                company.domain,
                company.companyName ?? company.domain,
              );
            }
          }
          setSelectedDomains(autoSelected);
          setShowOnlyPersonaMatches(true);
        }
        return;
      }

      const contacts = (contactsResponse.results ?? []) as ContactResult[];
      const matchedDomains = new Set<string>();
      for (const contact of contacts) {
        const domain = normalizeDomain(contact.company?.domain ?? '');
        if (domain) matchedDomains.add(domain);
      }
      setPersonaMatchDomains(matchedDomains);
      setPersonaMatchSource(matchedDomains.size > 0 ? 'real' : 'none');

      if (matchedDomains.size > 0) {
        const autoSelected = new Map<string, string>();
        for (const company of nextResults) {
          if (matchedDomains.has(normalizeDomain(company.domain))) {
            autoSelected.set(
              company.domain,
              company.companyName ?? company.domain,
            );
          }
        }
        setSelectedDomains(autoSelected);
        setShowOnlyPersonaMatches(true);
      }
    } catch (error) {
      console.error('Campaign search failed', error);
      setResults([]);
      setHasSearched(true);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect -- one-time auto-search trigger on campaign load */
  useEffect(() => {
    if (
      !isExistingCampaignMode ||
      !atlantisPreset ||
      !existingCampaignQuery.data ||
      step !== 1 ||
      hasSearched ||
      isSearching ||
      autoSearchTriggeredRef.current
    ) {
      return;
    }

    autoSearchTriggeredRef.current = true;
    void handleSearch();
  }, [
    isExistingCampaignMode,
    atlantisPreset,
    existingCampaignQuery.data,
    step,
    hasSearched,
    isSearching,
    handleSearch,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleCompany = (domain: string, companyName: string) => {
    setSelectedDomains((current) => {
      const next = new Map(current);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.set(domain, companyName);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedDomains(new Map());
      return;
    }

    const next = new Map<string, string>();
    for (const company of visibleResults) {
      next.set(company.domain, company.companyName ?? company.domain);
    }
    setSelectedDomains(next);
  };

  const handleCreateCampaign = async () => {
    setRunSummary(null);

    let targetCampaignId = existingCampaignQuery.data?.id ?? null;

    if (!targetCampaignId) {
      const created = await createCampaignMutation.mutateAsync({
        name: effectiveCampaignName.trim(),
        nicheKey: campaignNicheKey,
        language,
        tone: selectedTone.value,
        strictGate,
      });
      targetCampaignId = created.id;
    }
    if (!targetCampaignId) return;

    const selectedEntries = Array.from(selectedDomains.entries());

    if (selectedEntries.length > 0) {
      let imported = 0;
      let alreadyExisting = 0;
      let attached = 0;
      let failed = 0;

      for (let index = 0; index < selectedEntries.length; index += 1) {
        const [domain, companyName] = selectedEntries[index]!;
        setRunSummary(
          `Prospects toevoegen (${index + 1}/${selectedEntries.length})...`,
        );

        try {
          const importResult = (await importCompanyMutation.mutateAsync({
            domain,
            companyName,
            enrich: true,
          })) as ImportCompanyResult;

          if (importResult.alreadyExists) {
            alreadyExisting += 1;
          } else {
            imported += 1;
          }

          await attachProspectMutation.mutateAsync({
            campaignId: targetCampaignId,
            prospectId: importResult.prospect.id,
          });
          attached += 1;
        } catch (error) {
          failed += 1;
          console.error('Failed to import/attach prospect', domain, error);
        }
      }

      setRunSummary(
        `${attached} gekoppeld (${imported} nieuw, ${alreadyExisting} bestaand, ${failed} mislukt).`,
      );
    }

    await utils.campaigns.list.invalidate();
    await utils.admin.listProspects.invalidate();

    router.push(`/admin/campaigns/${targetCampaignId}`);
  };

  if (isExistingCampaignMode && existingCampaignQuery.isLoading) {
    return (
      <PageLoader
        label="Loading campaign"
        description="Opening the selected campaign."
      />
    );
  }

  if (isExistingCampaignMode && !existingCampaignQuery.data) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-[var(--color-ink)] tracking-[-0.025em]">
            Campaign not found
          </h1>
          <Link
            href="/admin/campaigns"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-medium uppercase tracking-[0.06em] bg-transparent text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-ink)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
        <div className="p-8 text-center">
          <p className="admin-meta-text-strong">
            De campaign voor deze wizard-run bestaat niet (meer).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] space-y-10">
      {/* Back line */}
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
        <Link
          href="/admin/campaigns"
          className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Campaigns
        </Link>
        <span className="text-[10px] text-[var(--color-border-strong)]">/</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink)]">
          {isExistingCampaignMode ? 'Toevoegen' : 'Nieuw'}
        </span>
      </div>

      <div>
        <h1 className="text-[48px] font-bold text-[var(--color-ink)] tracking-[-0.025em] leading-[1.05]">
          {isExistingCampaignMode ? 'Prospects toevoegen' : 'Nieuwe Campaign'}
          <span className="text-[var(--color-gold)]">.</span>
        </h1>
        <p className="text-[14px] font-light text-[var(--color-muted)] mt-3">
          {isExistingCampaignMode
            ? `Zoek en koppel prospects aan ${existingCampaignQuery.data?.name}.`
            : 'Kies doelgroep, haal prospects op en maak direct een werkende campaign.'}
        </p>
        {isExistingCampaignMode && atlantisPreset && (
          <p className="text-[12px] font-light text-[var(--color-muted)] mt-1">
            SPV preset: {atlantisPreset.label} • {atlantisPreset.sector} •{' '}
            {atlantisPreset.countryValue}
          </p>
        )}
      </div>

      <div className="space-y-8">
        {/* Step indicator — tab bar */}
        <div className="grid grid-cols-4 border-b border-[var(--color-ink)]">
          {STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (step > item.id) setStep(item.id);
              }}
              className={cn(
                'py-4 text-center transition-all relative',
                '[&+&]:border-l [&+&]:border-[var(--color-border)]',
                step > item.id && 'cursor-pointer',
                step <= item.id && step !== item.id && 'cursor-default',
              )}
            >
              <p
                className={cn(
                  'text-[10px] font-medium uppercase tracking-[0.12em]',
                  step === item.id
                    ? 'text-[var(--color-gold)]'
                    : step > item.id
                      ? 'text-[var(--color-ink)]'
                      : 'text-[var(--color-muted)]',
                )}
              >
                {String(item.id + 1).padStart(2, '0')}
              </p>
              <p
                className={cn(
                  'text-[12px] font-medium mt-0.5',
                  step >= item.id
                    ? 'text-[var(--color-ink)]'
                    : 'text-[var(--color-muted)]',
                )}
              >
                {item.label}
              </p>
              {step === item.id && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--color-ink)]" />
              )}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Campaign naam
              </label>
              {isExistingCampaignMode ? (
                <div className="w-full px-5 py-3.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-bold text-[var(--color-ink)]">
                  {effectiveCampaignName}
                </div>
              ) : (
                <input
                  value={effectiveCampaignName}
                  onChange={(event) => {
                    setCampaignNameTouched(true);
                    setCampaignName(event.target.value);
                  }}
                  placeholder="Voorjaar doelgroep run"
                  className="input-minimal w-full px-3 py-2.5 rounded-md text-[13px]"
                />
              )}
              {isExistingCampaignMode && (
                <p className="text-xs font-semibold text-[var(--color-muted)]">
                  Bestaande campaign modus: er wordt geen nieuwe campaign
                  aangemaakt.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Doel
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sortedUseCases.map((item) => (
                  <ChoiceCard
                    key={item.id}
                    active={useCaseId === item.id}
                    onClick={() => setUseCaseId(item.id)}
                    title={getUseCaseLabel(item.id)}
                    description={getUseCaseStrategyNote(item.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Beslisser Persona
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sortedPersonaPresets.map((item) => (
                  <ChoiceCard
                    key={item.id}
                    active={personaId === item.id}
                    onClick={() => setPersonaId(item.id)}
                    title={item.label}
                    description={item.description}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                  Sector
                </label>
                <select
                  value={sector}
                  onChange={(event) =>
                    setSector(event.target.value as (typeof SECTORS)[number])
                  }
                  className="input-minimal w-full px-3 py-2.5 rounded-md text-[13px]"
                >
                  {sortedSectors.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                  Land
                </label>
                <select
                  value={countryValue}
                  onChange={(event) => setCountryValue(event.target.value)}
                  className="input-minimal w-full px-3 py-2.5 rounded-md text-[13px]"
                >
                  {sortedCountryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                  Bedrijfsgrootte
                </label>
                <select
                  value={companySizeId}
                  onChange={(event) =>
                    setCompanySizeId(
                      event.target
                        .value as (typeof COMPANY_SIZE_PRESETS)[number]['id'],
                    )
                  }
                  className="input-minimal w-full px-3 py-2.5 rounded-md text-[13px]"
                >
                  {COMPANY_SIZE_PRESETS.map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-md border border-[var(--color-gold)]/40 bg-[var(--color-surface-2)]/70 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-white border border-[var(--color-gold)]/40 flex items-center justify-center shrink-0">
                  <WandSparkles className="w-3.5 h-3.5 text-[var(--color-ink)]" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                    Doel
                  </p>
                  <p className="text-xs font-semibold text-[var(--color-muted-dark)] mt-0.5">
                    {getUseCaseLabel(selectedUseCase.id)}:{' '}
                    {getUseCaseStrategyNote(selectedUseCase.id)}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-white border border-[var(--color-gold)]/40 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[var(--color-ink)]" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                    Beslisser Persona
                  </p>
                  <p className="text-xs font-semibold text-[var(--color-muted-dark)] mt-0.5">
                    We zoeken op {selectedPersona.label}.{' '}
                    {personaSearchConfig.note}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-white border border-[var(--color-gold)]/40 flex items-center justify-center shrink-0">
                  <Search className="w-3.5 h-3.5 text-[var(--color-ink)]" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                    Zoekrun
                  </p>
                  <p className="text-xs font-semibold text-[var(--color-muted-dark)] mt-0.5">
                    Sector {sector} in {selectedCountry.label}, grootte{' '}
                    {selectedSize.label.toLowerCase()}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                  Prospect zoekrun
                </p>
                <p className="text-xs font-semibold text-[var(--color-muted)] mt-1">
                  Filter: {sector} in {selectedCountry.label},{' '}
                  {selectedSize.label.toLowerCase()}
                </p>
                <p className="text-xs font-semibold text-[var(--color-muted)] mt-1">
                  Persona check: {selectedPersona.label}
                </p>
                <p className="text-xs font-semibold text-[var(--color-muted)] mt-1">
                  Persona-config: {personaSearchConfig.note}
                </p>
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] text-[10px] font-bold uppercase tracking-[0.1em] disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Zoeken...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Zoek prospects
                  </>
                )}
              </button>
            </div>

            {guardrail && (
              <div className="rounded-md border border-amber-200 bg-amber-50/80 px-5 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      {guardrail.title}
                    </p>
                    <p className="text-xs font-bold text-amber-800 mt-1">
                      {guardrail.message}
                    </p>
                    {guardrail.recommendation && (
                      <p className="text-xs font-semibold text-amber-700 mt-1">
                        {guardrail.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {searchFilterNote && (
              <div className="rounded-md border border-blue-200 bg-blue-50/70 px-5 py-4">
                <p className="text-xs font-bold text-blue-800">
                  {searchFilterNote}
                </p>
              </div>
            )}

            {personaGuardrail && (
              <div className="rounded-md border border-amber-200 bg-amber-50/80 px-5 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      {personaGuardrail.title}
                    </p>
                    <p className="text-xs font-bold text-amber-800 mt-1">
                      {personaGuardrail.message}
                    </p>
                    {personaGuardrail.recommendation && (
                      <p className="text-xs font-semibold text-amber-700 mt-1">
                        {personaGuardrail.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {hasSearched && (
              <>
                <div className="space-y-3 p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="w-4 h-4 rounded accent-[var(--color-ink)]"
                      />
                      {selectedDomains.size} geselecteerd van{' '}
                      {visibleResults.length}
                    </label>
                    <p className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em]">
                      Geen mail wordt nu verstuurd
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOnlyPersonaMatches}
                        onChange={(event) =>
                          setShowOnlyPersonaMatches(event.target.checked)
                        }
                        disabled={personaMatchDomains.size === 0}
                        className="w-4 h-4 rounded accent-[var(--color-ink)] disabled:opacity-40"
                      />
                      Alleen decision-maker matches
                    </label>
                    <p className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em]">
                      {personaMatchDomains.size} van {results.length} bedrijven
                      met beslisser
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em]">
                      Match bron
                    </p>
                    <p className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em]">
                      {personaMatchSource === 'real'
                        ? 'Apollo contacts'
                        : personaMatchSource === 'mock'
                          ? 'Mock fallback'
                          : 'Geen'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showRecommendedFirst}
                        onChange={(event) =>
                          setShowRecommendedFirst(event.target.checked)
                        }
                        disabled={personaMatchDomains.size === 0}
                        className="w-4 h-4 rounded accent-[var(--color-ink)] disabled:opacity-40"
                      />
                      Recommended eerst
                    </label>
                    <p className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.1em]">
                      Recommended: {personaMatchDomains.size}
                    </p>
                  </div>
                </div>

                {visibleResults.length === 0 ? (
                  <div className="p-16 text-center rounded-[2rem]">
                    <Building2 className="w-10 h-10 text-[var(--color-border-strong)] mx-auto mb-4" />
                    <p className="text-sm font-bold text-[var(--color-ink)]">
                      Geen resultaten gevonden
                    </p>
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                      Pas sector of land aan en probeer opnieuw.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
                    {visibleResults.map((company) => (
                      <button
                        key={company.lushaCompanyId ?? company.domain}
                        onClick={() =>
                          toggleCompany(
                            company.domain,
                            company.companyName ?? company.domain,
                          )
                        }
                        className={cn(
                          'w-full text-left p-4 rounded-md border transition-all',
                          selectedDomains.has(company.domain)
                            ? 'border-[var(--color-ink)] bg-[var(--color-ink)]/[0.03]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface-2)]/40 hover:bg-[var(--color-surface-2)]',
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            readOnly
                            checked={selectedDomains.has(company.domain)}
                            className="w-4 h-4 rounded accent-[var(--color-ink)]"
                          />
                          <div className="w-10 h-10 rounded-xl border border-[var(--color-border)] bg-white flex items-center justify-center overflow-hidden shrink-0">
                            {company.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={company.logoUrl}
                                alt=""
                                className="w-6 h-6 object-contain"
                              />
                            ) : (
                              <Building2 className="w-4 h-4 text-[var(--color-border-strong)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-[var(--color-ink)] truncate">
                                {company.companyName ?? company.domain}
                              </p>
                              {personaMatchDomains.has(
                                normalizeDomain(company.domain),
                              ) && (
                                <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-[0.1em]">
                                  {personaMatchSource === 'mock'
                                    ? 'Recommended (mock)'
                                    : 'Recommended'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--color-muted)] font-semibold truncate">
                              {company.domain}
                              {company.industry ? ` • ${company.industry}` : ''}
                              {company.employeeRange
                                ? ` • ${company.employeeRange}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                  Taal
                </label>
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as 'nl' | 'en')
                  }
                  className="input-minimal w-full px-3 py-2.5 rounded-md text-[13px]"
                >
                  <option value="nl">Nederlands</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
                  Schrijfstijl
                </label>
                <select
                  value={effectiveToneId}
                  onChange={(event) => {
                    setToneTouched(true);
                    setToneId(
                      event.target.value as (typeof TONE_PRESETS)[number]['id'],
                    );
                  }}
                  className="input-minimal w-full px-3 py-2.5 rounded-md text-[13px]"
                >
                  {sortedTonePresets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 cursor-pointer">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--color-ink)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-ink)]">
                    Kwaliteitscheck verplicht
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    Alleen acties toestaan als research sterk genoeg is.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={strictGate}
                onChange={(event) => setStrictGate(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-ink)]"
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-[var(--color-ink)]">
              <WandSparkles className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Controle
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SummaryRow label="Campaign" value={effectiveCampaignName} />
              <SummaryRow
                label="Doel"
                value={`${getUseCaseLabel(selectedUseCase.id)} • ${sector}`}
              />
              <SummaryRow
                label="Doel toelichting"
                value={getUseCaseStrategyNote(selectedUseCase.id)}
              />
              <SummaryRow label="Persona" value={selectedPersona.label} />
              <SummaryRow label="Land" value={selectedCountry.label} />
              <SummaryRow label="Bedrijfsgrootte" value={selectedSize.label} />
              <SummaryRow
                label="Geselecteerde prospects"
                value={`${selectedDomains.size}`}
              />
              <SummaryRow
                label="Recommended matches"
                value={`${personaMatchDomains.size}`}
              />
              <SummaryRow
                label="Niche key"
                value={
                  isExistingCampaignMode
                    ? (existingCampaignQuery.data?.nicheKey ?? campaignNicheKey)
                    : campaignNicheKey
                }
              />
              <SummaryRow label="Taal" value={language.toUpperCase()} />
              <SummaryRow label="Tone" value={selectedTone.label} />
              <SummaryRow
                label="Kwaliteitscheck"
                value={strictGate ? 'Aan' : 'Uit'}
              />
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-4">
              <p className="text-xs font-semibold text-[var(--color-muted-dark)]">
                {isExistingCampaignMode
                  ? 'Bij bevestigen worden geselecteerde bedrijven geimporteerd als prospects en gekoppeld aan deze bestaande campaign. Er worden nog geen e-mails verstuurd.'
                  : 'Bij aanmaken gebeurt het volgende: campaign wordt opgeslagen, geselecteerde bedrijven worden geimporteerd als prospects en direct gekoppeld aan deze campaign. Er worden nog geen e-mails verstuurd.'}
              </p>
              {runSummary && (
                <p className="text-xs font-bold text-[var(--color-ink)] mt-3">
                  {runSummary}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-8 mt-10 border-t border-[var(--color-border)]">
          <button
            onClick={() =>
              setStep((current) => Math.max(0, current - 1) as WizardStepId)
            }
            disabled={step === 0 || isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-[10px] font-medium uppercase tracking-[0.08em] bg-transparent text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] transition-all disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Vorige
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() =>
                setStep(
                  (current) =>
                    Math.min(STEPS.length - 1, current + 1) as WizardStepId,
                )
              }
              disabled={!canGoNext || isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] bg-[var(--color-ink)] text-white disabled:opacity-40"
            >
              Volgende
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleCreateCampaign}
              disabled={
                isSubmitting ||
                (!isExistingCampaignMode &&
                  effectiveCampaignName.trim().length < 3)
              }
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em] bg-gradient-to-b from-[#e4c33c] to-[#f4d95a] text-[var(--color-ink)] border border-[#e4c33c] disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isExistingCampaignMode ? 'Koppelen...' : 'Aanmaken...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {isExistingCampaignMode
                    ? 'Prospects koppelen'
                    : 'Campaign aanmaken'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-md border p-4 transition-all',
        active
          ? 'border-[var(--color-ink)] bg-[var(--color-ink)]'
          : 'border-[var(--color-border)] bg-transparent hover:border-[var(--color-ink)]',
      )}
    >
      <p
        className={cn(
          'text-[13px] font-medium tracking-tight',
          active ? 'text-[var(--color-gold)]' : 'text-[var(--color-ink)]',
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          'text-[11px] font-light mt-1',
          active ? 'text-white/50' : 'text-[var(--color-muted)]',
        )}
      >
        {description}
      </p>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-surface-2)]">
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
        {label}
      </span>
      <span className="text-[13px] font-medium text-[var(--color-ink)]">
        {value}
      </span>
    </div>
  );
}

function getUseCaseLabel(useCaseId: (typeof USE_CASES)[number]['id']) {
  switch (useCaseId) {
    case 'new-clients':
      return 'Nieuwe klanten';
    case 'reactivate':
      return 'Reactivatie';
    case 'new-service':
      return 'Nieuwe dienst';
    default:
      return 'Campagne';
  }
}

function getUseCaseStrategyNote(useCaseId: (typeof USE_CASES)[number]['id']) {
  switch (useCaseId) {
    case 'new-clients':
      return 'Nieuwe bedrijven benaderen die nog geen klant zijn';
    case 'new-service':
      return 'Bedrijven benaderen waarvoor je nieuwe dienst relevant is';
    case 'reactivate':
      return 'Eerdere leads opnieuw benaderen met een korte opvolging';
    default:
      return 'Algemene outreachstrategie';
  }
}
