'use client';

import { api } from '@/components/providers';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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

export default function NewCampaignWizardPage() {
  const router = useRouter();
  const utils = api.useUtils();

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
  const effectiveCampaignName = campaignNameTouched
    ? campaignName
    : autoCampaignName;

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

  const canContinueFromStep1 = effectiveCampaignName.trim().length >= 3;
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
    setGuardrail(null);
    setPersonaGuardrail(null);
    setPersonaMatchDomains(new Set());
    setPersonaMatchSource('none');
    setShowOnlyPersonaMatches(false);
    setShowRecommendedFirst(true);
    setSelectedDomains(new Map());
    try {
      const companyResponse = await searchCompaniesMutation.mutateAsync({
        industries: sector === 'Overig' ? undefined : [sector],
        countries: [selectedCountry.value],
        employeesMin: selectedSize.min,
        employeesMax: selectedSize.max,
        page: 1,
        pageSize: 40,
      });

      const nextResults = (
        (companyResponse.results ?? []) as CompanyResult[]
      ).sort(compareCompanies);
      setResults(nextResults);
      setGuardrail(
        (companyResponse.guardrail ?? null) as SearchGuardrail | null,
      );
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

    const created = await createCampaignMutation.mutateAsync({
      name: effectiveCampaignName.trim(),
      nicheKey: campaignNicheKey,
      language,
      tone: selectedTone.value,
      strictGate,
    });

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
            campaignId: created.id,
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

    router.push(`/admin/campaigns/${created.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-brand-indigo tracking-tighter">
            Nieuwe Campaign
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-2">
            Kies doelgroep, haal prospects op en maak direct een werkende
            campaign.
          </p>
        </div>
        <Link
          href="/admin/campaigns"
          className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-brand-indigo hover:bg-slate-100 border border-slate-100"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Terug
        </Link>
      </div>

      <div className="glass-card p-8 rounded-[2.5rem] space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border',
                  step > item.id
                    ? 'bg-white text-brand-yellow border-brand-yellow/70'
                    : step === item.id
                      ? 'bg-brand-indigo text-brand-yellow border-brand-yellow/70'
                      : 'bg-white text-brand-yellow/60 border-brand-yellow/40',
                )}
              >
                {step > item.id ? <Check className="w-4 h-4" /> : item.id + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-black uppercase tracking-widest',
                  step >= item.id ? 'text-brand-indigo' : 'text-slate-400',
                )}
              >
                {item.label}
              </span>
              {item.id < STEPS.length - 1 && (
                <div className="w-8 h-px bg-slate-200 mx-1" />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Campaign naam
              </label>
              <input
                value={effectiveCampaignName}
                onChange={(event) => {
                  setCampaignNameTouched(true);
                  setCampaignName(event.target.value);
                }}
                placeholder="Voorjaar doelgroep run"
                className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-brand-indigo focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 focus:border-brand-yellow transition-all"
              />
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Sector
                </label>
                <select
                  value={sector}
                  onChange={(event) =>
                    setSector(event.target.value as (typeof SECTORS)[number])
                  }
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-brand-indigo focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 focus:border-brand-yellow transition-all"
                >
                  {sortedSectors.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Land
                </label>
                <select
                  value={countryValue}
                  onChange={(event) => setCountryValue(event.target.value)}
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-brand-indigo focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 focus:border-brand-yellow transition-all"
                >
                  {sortedCountryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-brand-indigo focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 focus:border-brand-yellow transition-all"
                >
                  {COMPANY_SIZE_PRESETS.map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-yellow/40 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-white border border-brand-yellow/40 flex items-center justify-center shrink-0">
                  <WandSparkles className="w-3.5 h-3.5 text-brand-indigo" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Doel
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    {getUseCaseLabel(selectedUseCase.id)}:{' '}
                    {getUseCaseStrategyNote(selectedUseCase.id)}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-white border border-brand-yellow/40 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-brand-indigo" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Beslisser Persona
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    We zoeken op {selectedPersona.label}.{' '}
                    {personaSearchConfig.note}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-white border border-brand-yellow/40 flex items-center justify-center shrink-0">
                  <Search className="w-3.5 h-3.5 text-brand-indigo" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Zoekrun
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Prospect zoekrun
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Filter: {sector} in {selectedCountry.label},{' '}
                  {selectedSize.label.toLowerCase()}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Persona check: {selectedPersona.label}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Persona-config: {personaSearchConfig.note}
                </p>
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 btn-pill-primary border-brand-yellow/60 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
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
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-amber-900">
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

            {personaGuardrail && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-amber-900">
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
                <div className="space-y-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="w-4 h-4 rounded accent-brand-indigo"
                      />
                      {selectedDomains.size} geselecteerd van{' '}
                      {visibleResults.length}
                    </label>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Geen mail wordt nu verstuurd
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOnlyPersonaMatches}
                        onChange={(event) =>
                          setShowOnlyPersonaMatches(event.target.checked)
                        }
                        disabled={personaMatchDomains.size === 0}
                        className="w-4 h-4 rounded accent-brand-indigo disabled:opacity-40"
                      />
                      Alleen decision-maker matches
                    </label>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {personaMatchDomains.size} van {results.length} bedrijven
                      met beslisser
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Match bron
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {personaMatchSource === 'real'
                        ? 'Apollo contacts'
                        : personaMatchSource === 'mock'
                          ? 'Mock fallback'
                          : 'Geen'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showRecommendedFirst}
                        onChange={(event) =>
                          setShowRecommendedFirst(event.target.checked)
                        }
                        disabled={personaMatchDomains.size === 0}
                        className="w-4 h-4 rounded accent-brand-indigo disabled:opacity-40"
                      />
                      Recommended eerst
                    </label>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Recommended: {personaMatchDomains.size}
                    </p>
                  </div>
                </div>

                {visibleResults.length === 0 ? (
                  <div className="glass-card p-16 text-center rounded-[2rem]">
                    <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                    <p className="text-sm font-black text-brand-indigo">
                      Geen resultaten gevonden
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
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
                          'w-full text-left p-4 rounded-2xl border transition-all',
                          selectedDomains.has(company.domain)
                            ? 'border-brand-indigo bg-brand-indigo/[0.03]'
                            : 'border-slate-100 bg-slate-50/40 hover:bg-slate-50',
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            readOnly
                            checked={selectedDomains.has(company.domain)}
                            className="w-4 h-4 rounded accent-brand-indigo"
                          />
                          <div className="w-10 h-10 rounded-xl border border-slate-100 bg-white flex items-center justify-center overflow-hidden shrink-0">
                            {company.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={company.logoUrl}
                                alt=""
                                className="w-6 h-6 object-contain"
                              />
                            ) : (
                              <Building2 className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-brand-indigo truncate">
                                {company.companyName ?? company.domain}
                              </p>
                              {personaMatchDomains.has(
                                normalizeDomain(company.domain),
                              ) && (
                                <span className="text-[9px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">
                                  {personaMatchSource === 'mock'
                                    ? 'Recommended (mock)'
                                    : 'Recommended'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold truncate">
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Taal
                </label>
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as 'nl' | 'en')
                  }
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-brand-indigo focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 focus:border-brand-yellow transition-all"
                >
                  <option value="nl">Nederlands</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-brand-indigo focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 focus:border-brand-yellow transition-all"
                >
                  {sortedTonePresets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 cursor-pointer">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-indigo" />
                <div>
                  <p className="text-sm font-bold text-brand-indigo">
                    Kwaliteitscheck verplicht
                  </p>
                  <p className="text-xs text-slate-400">
                    Alleen acties toestaan als research sterk genoeg is.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={strictGate}
                onChange={(event) => setStrictGate(event.target.checked)}
                className="h-4 w-4 accent-brand-indigo"
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-brand-indigo">
              <WandSparkles className="w-4 h-4" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
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
              <SummaryRow label="Niche key" value={campaignNicheKey} />
              <SummaryRow label="Taal" value={language.toUpperCase()} />
              <SummaryRow label="Tone" value={selectedTone.label} />
              <SummaryRow
                label="Kwaliteitscheck"
                value={strictGate ? 'Aan' : 'Uit'}
              />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold text-slate-600">
                Bij aanmaken gebeurt het volgende: campaign wordt opgeslagen,
                geselecteerde bedrijven worden geimporteerd als prospects en
                direct gekoppeld aan deze campaign. Er worden nog geen e-mails
                verstuurd.
              </p>
              {runSummary && (
                <p className="text-xs font-bold text-brand-indigo mt-3">
                  {runSummary}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() =>
              setStep((current) => Math.max(0, current - 1) as WizardStepId)
            }
            disabled={step === 0 || isSubmitting}
            className="ui-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-brand-indigo hover:bg-slate-100 border border-slate-100 disabled:opacity-40"
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
              className="ui-tap inline-flex items-center gap-2 px-6 py-3 btn-pill-primary border-brand-yellow/60 text-xs font-black uppercase tracking-widest disabled:opacity-40"
            >
              Volgende
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreateCampaign}
              disabled={isSubmitting || effectiveCampaignName.trim().length < 3}
              className="ui-tap inline-flex items-center gap-2 px-6 py-3 btn-pill-primary border-brand-yellow/60 text-xs font-black uppercase tracking-widest disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aanmaken...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Campaign aanmaken
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
        'text-left rounded-2xl border p-4 transition-all',
        active
          ? 'border-brand-yellow-dark bg-brand-yellow'
          : 'border-brand-yellow/40 bg-slate-50/50 hover:bg-slate-50',
      )}
    >
      <p className="text-sm font-black text-brand-indigo tracking-tight">
        {title}
      </p>
      <p className="text-xs font-semibold text-slate-500 mt-1">{description}</p>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-yellow/35 bg-slate-50/60 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="text-sm font-bold text-brand-indigo mt-1">{value}</p>
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
