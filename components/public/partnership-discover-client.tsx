'use client';

import type {
  PartnershipDiscoverEvidence,
  PartnershipDiscoverSnapshot,
  PartnershipDiscoverTrigger,
} from '@/lib/partnership/discover';
import { AtlantisProspectDashboardClient } from './prospect-dashboard-atlantis-client';

type DashboardProps = React.ComponentProps<
  typeof AtlantisProspectDashboardClient
>;
type DashboardHypothesis = DashboardProps['hypotheses'][number];
type DashboardProofMatch = DashboardHypothesis['proofMatches'][number];

type PartnershipDiscoverClientProps = DashboardProps & {
  projectName: string;
  spvName: string | null;
  partnership: PartnershipDiscoverSnapshot | null;
  sourceProvenanceByUrl?: Record<string, string>;
  evidencePreview?: PartnershipDiscoverEvidence[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function cleanForProspect(value: string): string {
  return value
    .replace(/\bSPV under review\b/gi, 'samenwerkingsroute')
    .replace(/\bsource(?:\s+types?)?\b\s*:\s*[^.]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isStackClueText(text: string | null | undefined): boolean {
  if (!text) return false;
  return /(?:public\s+)?stack clues|tech stack clues?|stack clues detected/i.test(
    text,
  );
}

function stripStackClueText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !isStackClueText(sentence))
    .join(' ')
    .trim();
}

function isStackClueEvidence(item: PartnershipDiscoverEvidence): boolean {
  return (
    isStackClueText(item.title) ||
    isStackClueText(item.snippet) ||
    isStackClueText(item.sourceUrl)
  );
}

function sanitizeTrigger(
  trigger: PartnershipDiscoverTrigger,
): PartnershipDiscoverTrigger {
  const cleanedEvidence = trigger.evidence.filter(
    (item) => !isStackClueEvidence(item),
  );
  const cleanedRationale = stripStackClueText(trigger.rationale);
  const cleanedWhyNow = stripStackClueText(trigger.whyNow);
  return {
    ...trigger,
    rationale:
      cleanedRationale.length > 0
        ? cleanedRationale
        : 'Er is een concrete kans op een waardevolle samenwerking.',
    whyNow:
      cleanedWhyNow.length > 0
        ? cleanedWhyNow
        : 'Timing is relevant door fase-1 allocatiebesluiten en beperkte capaciteit.',
    sourceTypes: trigger.sourceTypes.filter((source) => !/stack/i.test(source)),
    evidence: cleanedEvidence,
  };
}

function inferTheme(text: string): string {
  const haystack = text.toLowerCase();
  if (
    haystack.includes('co2') ||
    haystack.includes('emission') ||
    haystack.includes('ets') ||
    haystack.includes('cbam')
  ) {
    return 'compliance';
  }
  if (
    haystack.includes('capacity') ||
    haystack.includes('congestion') ||
    haystack.includes('grid')
  ) {
    return 'capacity';
  }
  if (
    haystack.includes('tender') ||
    haystack.includes('investment') ||
    haystack.includes('contract')
  ) {
    return 'capital';
  }
  if (
    haystack.includes('partnership') ||
    haystack.includes('consortium') ||
    haystack.includes('alliance')
  ) {
    return 'partnership';
  }
  return 'market';
}

const THEME_COPY: Record<
  string,
  { title: string; rationale: string; whyNow: string }
> = {
  compliance: {
    title: 'Versneld voldoen aan EU-eisen',
    rationale:
      'Met de juiste samenwerking kan jullie team sneller voldoen aan ESG- en regelgevingseisen, zonder rem op groei.',
    whyNow:
      'Vroege afstemming verlaagt compliance-risico en geeft voorrang op de beste uitvoeringsruimte.',
  },
  capacity: {
    title: 'Sneller capaciteit veiligstellen',
    rationale:
      'Er ligt een concrete kans om capaciteit en leverzekerheid te borgen voordat schaarste toeneemt.',
    whyNow:
      'Beslissingen over capaciteit vallen nu; later instappen betekent minder ruimte en hogere kosten.',
  },
  capital: {
    title: 'Sterkere businesscase voor investering',
    rationale:
      'De combinatie van financiering en contractmomenten maakt dit een sterk moment voor een rendabele samenwerking.',
    whyNow:
      'Door nu te positioneren, kunnen jullie sneller naar concrete deals met betere voorwaarden.',
  },
  partnership: {
    title: 'Directe samenwerkingskans',
    rationale:
      'Er zijn duidelijke aanknopingspunten voor een samenwerking die commercieel en operationeel direct waarde toevoegt.',
    whyNow:
      'Snelle afstemming verkort de doorlooptijd van intake naar gezamenlijke uitvoering.',
  },
  market: {
    title: 'Commerciële groeikans',
    rationale:
      'Er is een duidelijke kans om groei te versnellen via een samenwerking met meetbare business impact.',
    whyNow:
      'De timing is sterk: wie nu beweegt, pakt eerder positie en betere voorwaarden.',
  },
};
const DEFAULT_THEME_COPY = {
  title: 'Commerciële groeikans',
  rationale:
    'Er is een duidelijke kans om groei te versnellen via een samenwerking met meetbare business impact.',
  whyNow:
    'De timing is sterk: wie nu beweegt, pakt eerder positie en betere voorwaarden.',
};

const NOISY_URL_PATTERN =
  /\/(?:news|nieuws|press|blog|investor|ir|results?|resultaten|jaarverslag|annual-report|quarterly|q[1-4])(?:\/|$)/i;
const NOISY_SENTENCE_PATTERN =
  /\b(?:half[-\s]?year|quarterly|jaarverslag|investor relations|press release|interim results?|share capital|aandeel|stock|vacature|review|glassdoor|indeed|cookie|privacy|terms|404|not found)\b/i;

function splitSentences(input: string): string[] {
  return input
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 0);
}

function extractKpiValue(input: string): string | null {
  const patterns = [
    /(?:€|eur)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?(?:\s?-\s?\d{1,3}(?:[.,]\d+)?)?\s?(?:mln|mld|miljard|bn|billion|million|trillion)?/i,
    /\d{1,3}(?:[.,]\d+)?\s?-\s?\d{1,3}(?:[.,]\d+)?\s?(?:mln|mld|miljard|bn|billion|million|trillion)/i,
    /\d{1,3}(?:[.,]\d+)?\s?%/i,
    /\d{1,4}(?:[.,]\d+)?\s?(?:gw|mw|kw|mt|kt|m²|km²|km|ha|t\/jaar|mt\/jaar|pue)/i,
    /20\d{2}\s?(?:-|–|to)\s?20\d{2}/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[0]) {
      return match[0].replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

function inferKpiLabel(input: string, spvLabel: string): string {
  const haystack = input.toLowerCase();
  if (/(co2|scope|ets|cbam|emission)/.test(haystack)) return 'CO2-impact';
  if (/(irr|roi|return|margin|cashflow)/.test(haystack))
    return 'Rendementskader';
  if (/(capex|investment|fund|eib|subsid|financier)/.test(haystack))
    return 'Financieringsruimte';
  if (/(permit|vergunning|timeline|fase|allocation|allocatie)/.test(haystack))
    return 'Tijdlijn';
  if (/(hydrogen|h2|dri|steel|slag|industrie)/.test(haystack))
    return 'Industriële capaciteit';
  if (/(data|datacenter|server|it-load|pue)/.test(haystack))
    return 'Datacentercapaciteit';
  if (/(grid|power|energy|electric|wind)/.test(haystack))
    return 'Energiecapaciteit';
  if (spvLabel.toLowerCase().includes('data')) return 'Datacentercapaciteit';
  if (spvLabel.toLowerCase().includes('steel')) return 'Industriële capaciteit';
  if (spvLabel.toLowerCase().includes('energy')) return 'Energiecapaciteit';
  return 'Strategische metric';
}

function defaultKpis(input: {
  triggerCount: number;
  primaryTheme: string | null;
}): Array<{ value: string; label: string }> {
  const triggerDisplay = input.triggerCount > 0 ? `${input.triggerCount}` : '1';
  const planSteps =
    input.triggerCount >= 3
      ? '3 stappen'
      : input.triggerCount === 2
        ? '2 stappen'
        : '1 stap';
  const themeValue =
    input.primaryTheme && input.primaryTheme.trim().length > 0
      ? compact(input.primaryTheme.trim(), 22)
      : 'Kernkans';
  return [
    { value: triggerDisplay, label: 'Concrete kansen' },
    { value: planSteps, label: 'Voorstel plan' },
    { value: themeValue, label: 'Hoofdinzicht' },
  ];
}

function buildContextKpis(input: {
  evidence: PartnershipDiscoverEvidence[];
  spvLabel: string;
  triggerCount: number;
  primaryTheme: string | null;
}): Array<{ value: string; label: string }> {
  const candidates: Array<{ value: string; label: string; score: number }> = [];

  for (const item of input.evidence) {
    if (item.sourceType !== 'RAG_DOCUMENT') continue;
    if (NOISY_URL_PATTERN.test(item.sourceUrl)) continue;
    const text = `${item.title ?? ''}. ${item.snippet}`.trim();
    const sentences = splitSentences(text).slice(0, 3);
    for (const sentence of sentences) {
      if (NOISY_SENTENCE_PATTERN.test(sentence)) continue;
      const value = extractKpiValue(sentence);
      if (!value) continue;
      const label = inferKpiLabel(
        `${sentence} ${item.title ?? ''} ${input.spvLabel}`,
        input.spvLabel,
      );
      if (label === 'Strategische metric') continue;
      let score = item.sourceType === 'RAG_DOCUMENT' ? 60 : 38;
      if (/(€|%|gw|mw|mt|pue|co2|irr|roi)/i.test(sentence)) score += 12;
      if (/20(24|23|22)/.test(sentence)) score -= 14;
      if (/20(26|27|28|30)/.test(sentence)) score += 8;
      candidates.push({
        value: compact(value, 20),
        label,
        score,
      });
    }
  }

  if (candidates.length === 0) {
    return defaultKpis({
      triggerCount: input.triggerCount,
      primaryTheme: input.primaryTheme,
    });
  }

  const ranked = candidates
    .slice()
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const selected: Array<{ value: string; label: string }> = [];
  const seen = new Set<string>();
  for (const candidate of ranked) {
    const key = `${candidate.label}:${candidate.value}`;
    if (seen.has(key)) continue;
    if (selected.some((item) => item.label === candidate.label)) continue;
    seen.add(key);
    selected.push({ value: candidate.value, label: candidate.label });
    if (selected.length >= 3) break;
  }

  if (selected.length >= 3) return selected;

  const fallback = defaultKpis({
    triggerCount: input.triggerCount,
    primaryTheme: input.primaryTheme,
  });
  for (const item of fallback) {
    if (selected.some((entry) => entry.label === item.label)) continue;
    selected.push(item);
    if (selected.length >= 3) break;
  }

  return selected;
}

function buildContextSubtitle(input: {
  companyName: string;
  trigger: PartnershipDiscoverTrigger | null;
  primaryRagSentence: string | null;
  industry: string | null;
}): string {
  const intro = `Persoonlijke businesscase voor ${input.companyName}.`;
  if (input.primaryRagSentence) {
    return `${intro} ${limitWords(input.primaryRagSentence, 22)}`;
  }
  if (input.industry) {
    return `${intro} Kansen afgestemd op ${input.industry.toLowerCase()} met direct uitvoerbaar vervolg.`;
  }
  if (!input.trigger)
    return `${intro} Drie concrete kansen en een helder vervolgaanbod in één overzicht.`;
  const focus = cleanForProspect(input.trigger.title).replace(/\.$/, '');
  return `${intro} Focus op ${compact(focus.toLowerCase(), 120)} met direct uitvoerbaar vervolg.`;
}

function inferSectorPain(industry: string | null): string {
  const haystack = (industry ?? '').toLowerCase();
  if (
    /(construction|bouw|infra|civil|real estate|housing|property|contractor)/.test(
      haystack,
    )
  ) {
    return 'woningbouw en gebiedsontwikkeling onder druk staan door ruimte- en vergunningsbeperkingen';
  }
  if (
    /(data|datacenter|cloud|hosting|it|software|saas|telecom)/.test(haystack)
  ) {
    return 'digitale groei wordt geremd door energie- en capaciteitsdruk';
  }
  if (
    /(steel|metals|manufacturing|industrial|chemic|refining|shipbuilding)/.test(
      haystack,
    )
  ) {
    return 'industriële opschaling botst met CO2-kosten en leveringsrisico';
  }
  if (/(logistics|port|shipping|maritime|transport|warehouse)/.test(haystack)) {
    return 'logistieke groei botst met capaciteit, doorlooptijd en emissiedruk';
  }
  if (/(energy|power|utility|renewable|wind|solar|grid)/.test(haystack)) {
    return 'energievraag sneller groeit dan de beschikbare net- en opwekkingsruimte';
  }
  return 'marktgroei botst met capaciteit en compliance-eisen';
}

function buildExecutiveHook(input: {
  companyName: string;
  industry: string | null;
  trigger: PartnershipDiscoverTrigger | null;
  primaryRagSentence: string | null;
}): string {
  const sectorHint = 'voor jullie marktpositie en groeidoelen';
  const sectorPain = inferSectorPain(input.industry);
  if (input.primaryRagSentence) {
    return `Terwijl ${sectorPain}, laat het Atlantis-dossier een concrete route zien voor ${input.companyName}: ${limitWords(input.primaryRagSentence, 28)}. Dit maakt een gefaseerde samenwerking nu commercieel logisch en uitvoerbaar.`;
  }
  if (!input.trigger) {
    return `Voor ${input.companyName} ligt nu een concrete commerciële kans ${sectorHint}. In een korte intake vertalen we dit naar een uitvoerbaar plan met duidelijke business impact.`;
  }
  const rationale = cleanForProspect(input.trigger.rationale).replace(
    /\.$/,
    '',
  );
  const whyNow = cleanForProspect(input.trigger.whyNow).replace(/\.$/, '');
  const narrative = `Voor ${input.companyName} ligt nu een concrete commerciële kans ${sectorHint}: ${rationale}. ${whyNow}. In een korte intake vertalen we dit naar een plan met directe commerciële waarde.`;
  return narrative.replace(/\s+/g, ' ').trim();
}

function buildFallbackTriggers(input: {
  evidence: PartnershipDiscoverEvidence[];
  hypotheses: DashboardHypothesis[];
  spvLabel: string;
}): PartnershipDiscoverTrigger[] {
  const prefix = '';
  const grouped = new Map<string, PartnershipDiscoverEvidence[]>();
  for (const item of input.evidence) {
    const theme = inferTheme(
      `${item.title ?? ''} ${item.snippet} ${item.sourceUrl}`,
    );
    const current = grouped.get(theme) ?? [];
    current.push(item);
    grouped.set(theme, current);
  }

  const fromEvidence = Array.from(grouped.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([theme, evidence], index): PartnershipDiscoverTrigger => {
      const confidence = clamp(0.5 + evidence.length * 0.08, 0.52, 0.84);
      const urgency: 'low' | 'medium' | 'high' =
        evidence.length >= 3
          ? 'high'
          : evidence.length === 2
            ? 'medium'
            : 'low';
      const copy = THEME_COPY[theme] ?? DEFAULT_THEME_COPY;
      return {
        triggerType: `fallback_${theme}_${index + 1}`,
        title: `${prefix}${copy.title}`,
        rationale: copy.rationale,
        whyNow: copy.whyNow,
        confidenceScore: confidence,
        readinessImpact: Math.round(confidence * 100),
        urgency,
        sourceTypes: Array.from(
          new Set(evidence.map((item) => item.sourceType)),
        ),
        evidence: evidence.slice(0, 2),
      };
    });

  if (fromEvidence.length > 0) return fromEvidence;

  const fromHypotheses = input.hypotheses
    .slice(0, 3)
    .map((hypothesis, index) => ({
      triggerType: `fallback_hypothesis_${index + 1}`,
      title: `${prefix}${hypothesis.title}`,
      rationale: compact(hypothesis.problemStatement, 170),
      whyNow:
        'Bestaande hypothese wijst op strategische frictie die partnership-validatie vraagt.',
      confidenceScore: 0.55,
      readinessImpact: 55,
      urgency: 'medium' as const,
      sourceTypes: ['hypothesis'],
      evidence: [],
    }));

  if (fromHypotheses.length > 0) return fromHypotheses;

  return [
    {
      triggerType: 'fallback_seed',
      title: `${prefix}initial partnership fit`,
      rationale:
        'Nog beperkte input beschikbaar; eerste intake nodig om juiste allocatie- en samenwerkingsscope te bepalen.',
      whyNow:
        'Fase-1 allocaties lopen; vroege positionering verhoogt kans op beste slot.',
      confidenceScore: 0.45,
      readinessImpact: 45,
      urgency: 'low',
      sourceTypes: ['seed'],
      evidence: [],
    },
  ];
}

type OpportunityBucket = 'market' | 'compliance' | 'capital';

interface RagOpportunitySignal {
  bucket: OpportunityBucket;
  sentence: string;
  proof: string;
  score: number;
}

const OPPORTUNITY_BUCKET_PATTERNS: Record<OpportunityBucket, RegExp> = {
  market:
    /\b(?:capacity|opschalen|growth|groei|ruimte|congestie|supply|leverzeker|project|uitrol|delivery|throughput|markt)\b/i,
  compliance:
    /\b(?:co2|cbam|ets|scope\s?[123]|compliance|esg|csrd|emission|circular|duurzaam)\b/i,
  capital:
    /\b(?:capital|finance|fund|investment|investering|irr|roi|subsid|funding|yield|return|cashflow|capex|opex)\b/i,
};

const OPPORTUNITY_META: Record<
  OpportunityBucket,
  {
    title: string;
    fallbackDescription: string;
    fallbackProofs: [string, string];
  }
> = {
  market: {
    title: 'Market Opportunity',
    fallbackDescription:
      'Atlantis opent extra groeiruimte en versnelt toegang tot concrete projecten met uitvoerbare scope.',
    fallbackProofs: [
      'Gefaseerde instap in concrete projecten',
      'Opschalen zonder operationele congestie',
    ],
  },
  compliance: {
    title: 'Compliance Opportunity',
    fallbackDescription:
      'Atlantis helpt om ESG- en compliance-doelen aantoonbaar te versnellen met direct toepasbare samenwerkingsroutes.',
    fallbackProofs: [
      'Ondersteunt CSRD- en ETS-doelstellingen',
      'CO2- en circulariteitsimpact aantoonbaar',
    ],
  },
  capital: {
    title: 'Capital Opportunity',
    fallbackDescription:
      'Atlantis verlaagt investeringsrisico en maakt gefaseerde groei mogelijk met sterkere financiële onderbouwing.',
    fallbackProofs: [
      'Gefaseerde investering met risicoverlaging',
      'Toegang tot Europese financieringsroutes',
    ],
  },
};

function inferOpportunityBucket(
  trigger: PartnershipDiscoverTrigger,
): OpportunityBucket {
  if (trigger.triggerType === 'execution_gap') return 'market';
  if (trigger.triggerType === 'commercial_pressure') return 'capital';
  if (trigger.triggerType === 'timing_window') return 'market';
  if (trigger.triggerType === 'strategic_alignment') return 'market';
  const haystack =
    `${trigger.triggerType} ${trigger.title} ${trigger.rationale} ${trigger.whyNow}`.toLowerCase();
  if (OPPORTUNITY_BUCKET_PATTERNS.compliance.test(haystack)) {
    return 'compliance';
  }
  if (OPPORTUNITY_BUCKET_PATTERNS.capital.test(haystack)) {
    return 'capital';
  }
  return 'market';
}

function inferOpportunityBucketFromText(text: string): OpportunityBucket {
  if (OPPORTUNITY_BUCKET_PATTERNS.compliance.test(text)) return 'compliance';
  if (OPPORTUNITY_BUCKET_PATTERNS.capital.test(text)) return 'capital';
  return 'market';
}

function limitWords(text: string, maxWords: number): string {
  const words = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function shortProofText(input: string): string {
  const cleaned = cleanForProspect(input)
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' ')
    .trim();
  return limitWords(cleaned, 8);
}

function scoreRagSentence(sentence: string, bucket: OpportunityBucket): number {
  let score = 52;
  if (
    /(€|eur|%|gw|mw|mt|km²|pue|irr|roi|co2|scope|ets|cbam|csrd)/i.test(sentence)
  ) {
    score += 14;
  }
  if (OPPORTUNITY_BUCKET_PATTERNS[bucket].test(sentence)) {
    score += 10;
  }
  if (
    /20(24|23|22)/.test(sentence) &&
    /(results?|jaarverslag|quarter|half[-\s]?year)/i.test(sentence)
  ) {
    score -= 22;
  }
  if (/20(26|27|28|29|30)/.test(sentence)) {
    score += 6;
  }
  return score;
}

function collectRagOpportunitySignals(
  evidence: PartnershipDiscoverEvidence[],
  industry: string | null,
): RagOpportunitySignal[] {
  const industryNoiseTerms = inferIndustryNoiseTerms(industry);
  const signals: RagOpportunitySignal[] = [];
  for (const item of evidence) {
    if (item.sourceType !== 'RAG_DOCUMENT') continue;
    if (NOISY_URL_PATTERN.test(item.sourceUrl)) continue;
    const combined = `${item.title ?? ''}. ${item.snippet}`;
    const sentences = splitSentences(combined).slice(0, 8);
    for (const sentence of sentences) {
      const cleaned = cleanForProspect(sentence).replace(/\s+/g, ' ').trim();
      if (cleaned.length < 24) continue;
      if (NOISY_SENTENCE_PATTERN.test(cleaned)) continue;
      const lowered = `${item.title ?? ''} ${cleaned}`.toLowerCase();
      if (industryNoiseTerms.some((term) => lowered.includes(term))) continue;
      const bucket = inferOpportunityBucketFromText(
        `${item.title ?? ''} ${cleaned} ${item.sourceUrl}`,
      );
      const proofSource =
        item.title && item.title.trim().length > 0 ? item.title : cleaned;
      const proof = shortProofText(proofSource);
      if (proof.length === 0) continue;
      signals.push({
        bucket,
        sentence: cleaned,
        proof,
        score: scoreRagSentence(cleaned, bucket),
      });
    }
  }

  return signals
    .slice()
    .sort((a, b) => b.score - a.score || a.sentence.localeCompare(b.sentence));
}

function inferIndustryNoiseTerms(industry: string | null): string[] {
  const haystack = (industry ?? '').toLowerCase();
  if (
    /(construction|bouw|infra|civil|real estate|housing|property|contractor)/.test(
      haystack,
    )
  ) {
    return ['zeewier', 'seaweed', 'aquaculture', 'algae', 'fishery'];
  }
  if (
    /(data|datacenter|cloud|hosting|it|software|saas|telecom)/.test(haystack)
  ) {
    return ['fishery', 'aquaculture'];
  }
  return [];
}

function buildAtlantisHypotheses(input: {
  triggers: PartnershipDiscoverTrigger[];
  companyName: string;
  ragSignals: RagOpportunitySignal[];
}): DashboardHypothesis[] {
  const triggerByBucket = new Map<
    OpportunityBucket,
    PartnershipDiscoverTrigger
  >();
  for (const trigger of input.triggers) {
    const bucket = inferOpportunityBucket(trigger);
    const existing = triggerByBucket.get(bucket);
    if (!existing || trigger.confidenceScore > existing.confidenceScore) {
      triggerByBucket.set(bucket, trigger);
    }
  }

  const orderedBuckets: OpportunityBucket[] = [
    'market',
    'compliance',
    'capital',
  ];
  const ragByBucket = new Map<OpportunityBucket, RagOpportunitySignal[]>();
  for (const bucket of orderedBuckets) ragByBucket.set(bucket, []);
  for (const signal of input.ragSignals) {
    ragByBucket.get(signal.bucket)?.push(signal);
  }
  const consumedRagSentences = new Set<string>();

  return orderedBuckets.map((bucket, index) => {
    const trigger = triggerByBucket.get(bucket) ?? null;
    const meta = OPPORTUNITY_META[bucket];
    let bucketRagSignals = (ragByBucket.get(bucket) ?? []).filter(
      (signal) => !consumedRagSentences.has(signal.sentence),
    );
    if (bucketRagSignals.length === 0) {
      bucketRagSignals = input.ragSignals
        .filter((signal) => !consumedRagSentences.has(signal.sentence))
        .slice(0, 2);
    }
    for (const signal of bucketRagSignals.slice(0, 2)) {
      consumedRagSentences.add(signal.sentence);
    }
    const triggerRagSignals = (trigger?.evidence ?? [])
      .filter(
        (item) =>
          item.sourceType === 'RAG_DOCUMENT' &&
          !NOISY_URL_PATTERN.test(item.sourceUrl),
      )
      .flatMap((item) => {
        const merged = `${item.title ?? ''}. ${item.snippet}`;
        return splitSentences(merged)
          .map((sentence) =>
            cleanForProspect(sentence).replace(/\s+/g, ' ').trim(),
          )
          .filter(
            (sentence) =>
              sentence.length >= 24 && !NOISY_SENTENCE_PATTERN.test(sentence),
          )
          .map((sentence) => ({
            bucket: inferOpportunityBucketFromText(
              `${item.title ?? ''} ${sentence} ${item.sourceUrl}`,
            ),
            sentence,
            proof: shortProofText(item.title?.trim() || sentence),
            score: scoreRagSentence(sentence, bucket),
          }))
          .filter((candidate) => candidate.bucket === bucket);
      });
    const preferredSentence =
      bucketRagSignals[0]?.sentence ??
      triggerRagSignals[0]?.sentence ??
      (trigger
        ? cleanForProspect(trigger.rationale || trigger.whyNow)
        : null) ??
      meta.fallbackDescription;
    const leadByBucket: Record<OpportunityBucket, string> = {
      market: `${input.companyName} kan sneller opschalen in nieuwe projecten`,
      compliance: `${input.companyName} kan ESG- en compliance-doelen versnellen`,
      capital: `${input.companyName} kan investeringsrisico verlagen met beter rendementsperspectief`,
    };
    const description = limitWords(
      `${leadByBucket[bucket]}. ${preferredSentence}`
        .replace(/\s+/g, ' ')
        .trim(),
      30,
    );

    const evidenceProofs = [
      ...bucketRagSignals.map((signal) => signal.proof),
      ...triggerRagSignals.map((signal) => signal.proof),
    ].filter((proof) => proof.length > 0);
    const uniqueProofs = Array.from(new Set(evidenceProofs));
    const proofs =
      uniqueProofs.length >= 2
        ? (uniqueProofs.slice(0, 2) as [string, string])
        : ([
            ...uniqueProofs,
            ...meta.fallbackProofs.filter(
              (proof) => !uniqueProofs.includes(proof),
            ),
          ].slice(0, 2) as [string, string]);

    const confidenceScore =
      trigger?.confidenceScore ?? (bucketRagSignals.length > 0 ? 0.66 : 0.58);

    const proofMatches: DashboardProofMatch[] = proofs.map(
      (proof, proofIndex) => {
        const useCaseId = `atl-${bucket}-uc-${index + 1}-${proofIndex + 1}`;
        return {
          id: `atl-${bucket}-pm-${index + 1}-${proofIndex + 1}`,
          score: Math.round(confidenceScore * 100),
          useCase: {
            id: useCaseId,
            title: proof,
            summary: description,
            category: meta.title,
            outcomes: [proof],
          },
        };
      },
    );

    return {
      id: `atl-${bucket}-${index + 1}`,
      title: meta.title,
      problemStatement: description,
      confidenceScore,
      hoursSavedWeekLow: null,
      hoursSavedWeekMid: null,
      hoursSavedWeekHigh: null,
      handoffSpeedGainPct: null,
      errorReductionPct: null,
      revenueLeakageRecoveredMid: null,
      proofMatches,
      status: 'PENDING',
    };
  });
}

export function PartnershipDiscoverClient({
  projectName,
  spvName,
  partnership,
  evidencePreview,
  sourceProvenanceByUrl: _sourceProvenanceByUrl,
  ...dashboardProps
}: PartnershipDiscoverClientProps) {
  const trimmedSpv = spvName?.trim() ?? '';
  const clientSpvName = trimmedSpv.length > 0 ? trimmedSpv : null;
  const spvLabel = clientSpvName ?? '';
  const sanitizedEvidencePreview = (evidencePreview ?? []).filter(
    (item) => !isStackClueEvidence(item),
  );
  const fallbackTriggers = buildFallbackTriggers({
    evidence: sanitizedEvidencePreview,
    hypotheses: dashboardProps.hypotheses,
    spvLabel,
  });
  const effectiveTriggers =
    partnership && partnership.triggers.length > 0
      ? partnership.triggers.map(sanitizeTrigger)
      : fallbackTriggers;
  const ragSignals = collectRagOpportunitySignals(
    sanitizedEvidencePreview,
    dashboardProps.industry,
  );
  const primaryRagSentence = ragSignals[0]?.sentence ?? null;
  const synthesizedHypotheses = buildAtlantisHypotheses({
    triggers: effectiveTriggers,
    companyName: dashboardProps.companyName,
    ragSignals,
  });

  const primaryTrigger = effectiveTriggers[0] ?? null;
  const sourceTypeCount = new Set(
    sanitizedEvidencePreview.map((item) => item.sourceType),
  ).size;
  const fallbackReadiness = clamp(
    32 +
      Math.min(28, effectiveTriggers.length * 8) +
      Math.min(18, sourceTypeCount * 4) +
      Math.min(22, sanitizedEvidencePreview.length * 2),
    35,
    84,
  );
  const readinessScore = partnership?.readinessScore ?? fallbackReadiness;
  const bridgeCount = Math.max(
    1,
    effectiveTriggers.filter(
      (trigger) =>
        trigger.evidence.length > 0 || trigger.confidenceScore >= 0.55,
    ).length,
  );
  const topReason =
    cleanForProspect(
      primaryTrigger?.rationale?.trim() || primaryTrigger?.whyNow?.trim() || '',
    ) || null;
  const contextHeadline = `Partnership kansen voor ${dashboardProps.companyName}`;
  const contextSubtitle = buildContextSubtitle({
    companyName: dashboardProps.companyName,
    trigger: primaryTrigger,
    primaryRagSentence,
    industry: dashboardProps.industry,
  });
  const executiveHook = buildExecutiveHook({
    companyName: dashboardProps.companyName,
    industry: dashboardProps.industry,
    trigger: primaryTrigger,
    primaryRagSentence,
  });
  const contextKpis = buildContextKpis({
    evidence: sanitizedEvidencePreview,
    spvLabel: spvLabel || projectName,
    triggerCount: effectiveTriggers.length,
    primaryTheme:
      primaryTrigger && primaryTrigger.title.trim().length > 0
        ? cleanForProspect(primaryTrigger.title)
        : null,
  });

  return (
    <AtlantisProspectDashboardClient
      {...dashboardProps}
      projectBrandName={projectName}
      hypotheses={
        synthesizedHypotheses.length > 0
          ? synthesizedHypotheses
          : dashboardProps.hypotheses
      }
      atlantisContext={{
        triggerCount: partnership?.triggerCount ?? effectiveTriggers.length,
        readinessScore,
        bridgeCount,
        topReason,
        spvName: null,
        contextBadge: 'Voorstel op maat',
        contextHeadline,
        contextSubtitle,
        executiveHook,
        kpis: contextKpis,
      }}
    />
  );
}
