/**
 * Master analysis prompt builder — constructs the Gemini prompt combining
 * evidence items + RAG passages + SPV data + prospect profile into a structured
 * JSON generation request.
 *
 * Supports three input shapes:
 *   - KlarifaiNarrativeInput (analysis-v2): raw evidence + Use Cases (new)
 *   - NarrativeAnalysisInput (analysis-v2): raw evidence + RAG passages (Atlantis)
 *   - MasterAnalysisInput (analysis-v1): intent variables + RAG passages (legacy)
 */

import type { IntentCategory } from '@/lib/extraction/types';
import type {
  KlarifaiNarrativeInput,
  MasterAnalysisInput,
  NarrativeAnalysisInput,
} from './types';

const SYSTEM_PREAMBLE = `Je bent een senior strategisch adviseur die boardroom-ready partnership analyses schrijft voor Europe's Gate. Toon: zakelijk-visionair Nederlands — clean business language, geen anglicismen, confident maar niet stijf. Schrijf alsof het een McKinsey board-presentatie is.`;

const TONE_RULES = `
KRITISCHE TOONREGELS:
- Gebruik "uw" voor professionele afstand; gebruik de bedrijfsnaam in hooks en headers
- Cijfers MOETEN prospect-relevant zijn (staalcapaciteit die zij zouden gebruiken, afvalreductie in hun sector) — GEEN project-grandeur marketingstatistieken
- Wanneer bronnen geen harde cijfers bevatten: schrijf kwalitatief narratief met directioneel bewijs, verzin NOOIT cijfers
- Wanneer prospect-data conflicteert met brondocument-data: toon beide perspectieven
- NOOIT termen als AI, RAG, scraping, embeddings, machine learning, of technische pipeline-terminologie gebruiken
- Schrijf in het Nederlands, zakelijk-visionair register
- Denk McKinsey board-presentatie in het Nederlands, niet startup pitch deck
`.trim();

// ---------------------------------------------------------------------------
// Type guards to detect which input shape was passed
// ---------------------------------------------------------------------------

function isKlarifaiInput(
  input: NarrativeAnalysisInput | MasterAnalysisInput | KlarifaiNarrativeInput,
): input is KlarifaiNarrativeInput {
  return 'useCases' in input;
}

function isNarrativeInput(
  input: NarrativeAnalysisInput | MasterAnalysisInput | KlarifaiNarrativeInput,
): input is NarrativeAnalysisInput {
  return 'evidence' in input && !('useCases' in input);
}

// ---------------------------------------------------------------------------
// Narrative prompt builder (analysis-v2)
// ---------------------------------------------------------------------------

function buildNarrativePrompt(input: NarrativeAnalysisInput): string {
  const { evidence, passages, prospect, spvs, crossConnections } = input;

  const sections: string[] = [];

  // --- System context ---
  sections.push(SYSTEM_PREAMBLE);
  sections.push('');
  sections.push(TONE_RULES);

  // --- Prospect profile ---
  sections.push('');
  sections.push('=== PROSPECT PROFIEL ===');
  sections.push(`Bedrijfsnaam: ${prospect.companyName}`);
  if (prospect.industry) sections.push(`Sector: ${prospect.industry}`);
  if (prospect.description)
    sections.push(`Omschrijving: ${prospect.description}`);
  if (prospect.specialties.length > 0)
    sections.push(`Specialismen: ${prospect.specialties.join(', ')}`);
  if (prospect.country) sections.push(`Land: ${prospect.country}`);
  if (prospect.city) sections.push(`Stad: ${prospect.city}`);
  if (prospect.employeeRange)
    sections.push(`Medewerkers: ${prospect.employeeRange}`);
  if (prospect.revenueRange) sections.push(`Omzet: ${prospect.revenueRange}`);

  // --- Raw evidence items (PIPE-01) ---
  sections.push('');
  sections.push(
    `=== BEWIJS UIT EXTERN ONDERZOEK (${evidence.length} items) ===`,
  );
  sections.push(
    'Dit zijn de ruwe bewijsitems uit extern onderzoek, gesorteerd op betrouwbaarheid. Gebruik ze direct in het narratief — citeer specifieke datapunten, namen en feiten.',
  );

  // Sort by confidence descending, include up to 60 items
  const sortedEvidence = [...evidence]
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 60);

  for (let i = 0; i < sortedEvidence.length; i++) {
    const item = sortedEvidence[i]!;
    const conf = Math.round(item.confidenceScore * 100);
    const titlePart = item.title ? ` | ${item.title}` : '';
    sections.push(
      `\n[${i + 1}] ${item.sourceType}${titlePart} | confidence: ${conf}%`,
    );
    sections.push(`    ${item.snippet.slice(0, 300)}`);
    if (item.sourceUrl) sections.push(`    Bron: ${item.sourceUrl}`);
  }

  // --- RAG passages (PIPE-02) ---
  sections.push('');
  sections.push("=== BRONDOCUMENTEN (Europe's Gate) ===");
  sections.push(
    "Gebruik deze passages als feitelijke basis voor Europe's Gate context. Refereer naar nummers waar relevant.",
  );

  if (passages.length === 0) {
    sections.push('Geen passages beschikbaar — gebruik visionaire framing.');
  } else {
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i]!;
      const sim = Math.round(p.similarity * 100);
      sections.push(`\n[${i + 1}] ${p.content.slice(0, 800)}`);
      sections.push(`    Bron: ${p.sourceLabel} | relevantie: ${sim}%`);
    }
  }

  // --- Cross-prospect connections (PIPE-05) ---
  if (crossConnections.length > 0) {
    sections.push('');
    sections.push('=== KRUISVERBANDEN MET ANDERE PROSPECTS ===');
    sections.push(
      'Verwerk deze verbanden naturel in het narratief waar relevant — geen apart hoofdstuk, maar geïntegreerd.',
    );
    for (const conn of crossConnections) {
      sections.push(
        `- ${conn.companyName}: ${conn.relationship} — "${conn.evidenceSnippet}"`,
      );
    }
  }

  // --- SPV data for recommendation ---
  sections.push('');
  sections.push('=== BESCHIKBARE SPV TRACKS ===');
  sections.push(
    'Selecteer de top 2-3 meest relevante SPVs op basis van het bewijs en de brondocumenten.',
  );

  for (const spv of spvs) {
    const metrics =
      spv.metricsTemplate && typeof spv.metricsTemplate === 'object'
        ? JSON.stringify(spv.metricsTemplate)
        : 'Geen metrics beschikbaar';
    sections.push(`\n- ${spv.name} (code: ${spv.code}, slug: ${spv.slug})`);
    sections.push(`  Metrics: ${metrics}`);
  }

  // --- Adaptive instructions ---
  sections.push('');
  sections.push('=== ADAPTIEVE INSTRUCTIES ===');

  if (evidence.length < 5) {
    sections.push(
      'LET OP: Er is weinig extern bewijs beschikbaar. Gebruik visionaire framing boven data-first benadering. Schrijf overtuigend vanuit strategisch perspectief.',
    );
  }

  if (passages.length < 5) {
    sections.push(
      'LET OP: Er zijn weinig brondocumenten beschikbaar. Schrijf kwalitatieve narratieven met directioneel bewijs.',
    );
  }

  if (passages.length >= 10) {
    sections.push(
      'De brondocumenten zijn rijkelijk gevuld. Prioriteer specifieke cijfers en datapunten uit de bronnen.',
    );
  }

  // --- Output format specification (analysis-v2 narrative) ---
  sections.push('');
  sections.push('=== OPDRACHT ===');
  sections.push(
    `Genereer een boardroom partnership analyse voor ${prospect.companyName} in exact het volgende JSON-formaat (analysis-v2).`,
  );
  sections.push('');
  sections.push(
    'Schrijf 3-5 narratieve secties. Elke sectie heeft een vloeiend verhaal dat bewijsmateriaal natuurlijk citeert.',
  );
  sections.push(
    'Suggereer secties als: Marktpositie & Strategische Kans, Operationele Uitdagingen, Duurzaamheid & Compliance, Financiële Structuur & Groei — maar kies secties die passen bij het beschikbare bewijs.',
  );
  sections.push(
    'Liever 3 sterke secties dan 5 dunne. Niet elk sjabloon hoeft gevuld.',
  );
  sections.push('');
  sections.push('Elke sectie moet bevatten:');
  sections.push('- "id": slug identifier');
  sections.push('- "title": korte titel in het Nederlands');
  sections.push('- "body": narratief (2-3 alinea\'s boardroom Dutch)');
  sections.push('- "citations": bronverwijzingen');
  sections.push(
    '- "punchline": één pakkende zin die de kernboodschap samenvat (max 15 woorden)',
  );
  sections.push(
    '- "visualType": kies het meest passende type op basis van de gevonden data:',
  );
  sections.push(
    '  * "quote" — wanneer er een krachtig citaat of review-fragment is gevonden',
  );
  sections.push(
    '  * "comparison" — wanneer er een voor/na of A-vs-B vergelijking mogelijk is',
  );
  sections.push(
    '  * "signals" — wanneer er meetbare signalen of trends zijn (bijv. groei, marktpositie)',
  );
  sections.push(
    '  * "stats" — wanneer er concrete cijfers of percentages beschikbaar zijn',
  );
  sections.push(
    '- "visualData": gestructureerde data die past bij het gekozen visualType:',
  );
  sections.push(
    '  * Voor "quote": { "type": "quote", "quote": "het citaat", "attribution": "bron" }',
  );
  sections.push(
    '  * Voor "comparison": { "type": "comparison", "items": [{ "label": "aspect", "before": "huidig", "after": "mogelijk" }] } (2-4 items)',
  );
  sections.push(
    '  * Voor "signals": { "type": "signals", "items": [{ "label": "signaal", "value": "waarde", "trend": "up"|"down"|"neutral" }] } (2-4 items)',
  );
  sections.push(
    '  * Voor "stats": { "type": "stats", "items": [{ "label": "metric", "value": "getal", "context": "toelichting" }] } (2-4 items)',
  );
  sections.push('');
  sections.push(
    'BELANGRIJK: visualData moet ALTIJD afgeleid zijn van echte brondata — NOOIT verzonnen. Als er geen geschikte data is voor een visualType, laat visualType en visualData weg en gebruik alleen body tekst.',
  );
  sections.push('');
  sections.push('Retourneer UITSLUITEND valide JSON in dit formaat:');
  sections.push('```json');
  sections.push('{');
  sections.push('  "version": "analysis-v2",');
  sections.push('  "openingHook": "2-3 zinnen prospect-specifieke hook...",');
  sections.push('  "executiveSummary": "1 alinea executive summary...",');
  sections.push('  "sections": [');
  sections.push('    {');
  sections.push('      "id": "slug-identifier",');
  sections.push('      "title": "Sectietitel in het Nederlands",');
  sections.push(
    '      "body": "Vloeiend narratief dat bewijsmateriaal citeert...",',
  );
  sections.push(
    '      "citations": ["Bron: Volume X — Document Y", "Bron: REVIEWS — ..."],',
  );
  sections.push('      "punchline": "Eén pakkende zin als headline",');
  sections.push('      "visualType": "stats",');
  sections.push(
    '      "visualData": { "type": "stats", "items": [{ "label": "metric", "value": "42%", "context": "toelichting" }] }',
  );
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "spvRecommendations": [');
  sections.push('    {');
  sections.push('      "spvName": "...",');
  sections.push('      "spvCode": "...",');
  sections.push(
    '      "relevanceNarrative": "waarom deze SPV past bij dit bedrijf...",',
  );
  sections.push('      "strategicTags": ["tag1", "tag2"]');
  sections.push('    }');
  sections.push('  ]');
  sections.push('}');
  sections.push('```');
  sections.push('');
  sections.push(
    'BELANGRIJK: Retourneer ALLEEN de JSON, geen markdown-formatting, geen uitleg, geen prefix/suffix.',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Klarifai narrative prompt builder (analysis-v2, Use Cases as knowledge source)
// ---------------------------------------------------------------------------

const KLARIFAI_SYSTEM_PREAMBLE = `Je bent een senior workflow-consultant die bedrijven adviseert over procesautomatisering en AI-integratie. Toon: helder, direct, data-gedreven Nederlands — concreet over pijnpunten, specifiek over oplossingen. Schrijf alsof het een executive briefing is voor een ondernemer die zijn tijd bewaakt.`;

function buildKlarifaiNarrativePrompt(input: KlarifaiNarrativeInput): string {
  const { evidence, useCases, prospect, crossConnections } = input;

  const parts: string[] = [];

  // --- System context ---
  parts.push(KLARIFAI_SYSTEM_PREAMBLE);
  parts.push('');
  parts.push(TONE_RULES);

  // --- Prospect profile ---
  parts.push('');
  parts.push('=== PROSPECT PROFIEL ===');
  parts.push(`Bedrijfsnaam: ${prospect.companyName}`);
  if (prospect.industry) parts.push(`Sector: ${prospect.industry}`);
  if (prospect.description) parts.push(`Omschrijving: ${prospect.description}`);
  if (prospect.specialties.length > 0)
    parts.push(`Specialismen: ${prospect.specialties.join(', ')}`);
  if (prospect.country) parts.push(`Land: ${prospect.country}`);
  if (prospect.city) parts.push(`Stad: ${prospect.city}`);
  if (prospect.employeeRange)
    parts.push(`Medewerkers: ${prospect.employeeRange}`);
  if (prospect.revenueRange) parts.push(`Omzet: ${prospect.revenueRange}`);

  // --- Raw evidence items ---
  parts.push('');
  parts.push(`=== BEWIJS UIT EXTERN ONDERZOEK (${evidence.length} items) ===`);
  parts.push(
    'Dit zijn de ruwe bewijsitems uit extern onderzoek, gesorteerd op betrouwbaarheid. Gebruik ze direct in het narratief — citeer specifieke datapunten, namen en feiten.',
  );

  const sortedEvidence = [...evidence]
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 60);

  for (let i = 0; i < sortedEvidence.length; i++) {
    const item = sortedEvidence[i]!;
    const conf = Math.round(item.confidenceScore * 100);
    const titlePart = item.title ? ` | ${item.title}` : '';
    parts.push(
      `\n[${i + 1}] ${item.sourceType}${titlePart} | confidence: ${conf}%`,
    );
    parts.push(`    ${item.snippet.slice(0, 300)}`);
    if (item.sourceUrl) parts.push(`    Bron: ${item.sourceUrl}`);
  }

  // --- Use Cases (replaces RAG passages) ---
  parts.push('');
  parts.push('=== BEWEZEN DIENSTEN (Klarifai) ===');
  if (prospect.industry) {
    parts.push(
      `Dit bedrijf zit in de sector "${prospect.industry}". Prioriteer diensten die passen bij deze sector.`,
    );
  }
  parts.push(
    'Match diensten aan pijnpunten uit het bewijs. Kies de 3-6 meest relevante.',
  );

  if (useCases.length === 0) {
    parts.push(
      'Geen diensten beschikbaar — schrijf vanuit algemeen procesautomatisering perspectief.',
    );
  } else {
    for (let i = 0; i < useCases.length; i++) {
      const uc = useCases[i]!;
      parts.push(`\n[${i + 1}] ${uc.title} | Categorie: ${uc.category}`);
      parts.push(`    ${uc.summary}`);
      parts.push(`    Resultaten: ${uc.outcomes.join(', ')}`);
    }
  }

  // --- Cross-prospect connections ---
  if (crossConnections.length > 0) {
    parts.push('');
    parts.push('=== KRUISVERBANDEN MET ANDERE PROSPECTS ===');
    parts.push(
      'Verwerk deze verbanden naturel in het narratief waar relevant — geen apart hoofdstuk, maar geïntegreerd.',
    );
    for (const conn of crossConnections) {
      parts.push(
        `- ${conn.companyName}: ${conn.relationship} — "${conn.evidenceSnippet}"`,
      );
    }
  }

  // --- Adaptive instructions ---
  parts.push('');
  parts.push('=== ADAPTIEVE INSTRUCTIES ===');

  if (evidence.length < 5) {
    parts.push(
      'LET OP: Er is weinig extern bewijs beschikbaar. Gebruik visionaire framing boven data-first benadering. Schrijf overtuigend vanuit strategisch perspectief.',
    );
  }

  if (useCases.length < 3) {
    parts.push(
      'LET OP: Er zijn weinig diensten beschikbaar. Schrijf kwalitatieve narratieven met directioneel bewijs.',
    );
  }

  if (useCases.length >= 5) {
    parts.push(
      'De dienstencatalogus is rijkelijk gevuld. Selecteer de meest relevante diensten en prioriteer concrete resultaten.',
    );
  }

  // --- Output format specification (analysis-v2, useCaseRecommendations) ---
  parts.push('');
  parts.push('=== OPDRACHT ===');
  parts.push(
    `Genereer een executive briefing voor ${prospect.companyName} in exact het volgende JSON-formaat (analysis-v2).`,
  );
  parts.push('');
  parts.push(
    'Schrijf 3-5 narratieve secties. Elke sectie heeft een vloeiend verhaal dat bewijsmateriaal natuurlijk citeert.',
  );
  parts.push(
    'Suggereer secties als: Operationele Bottlenecks, Handmatige Processen, Data & Rapportage, Groeibelemmeringen — maar kies secties die passen bij het beschikbare bewijs.',
  );
  parts.push(
    'Liever 3 sterke secties dan 5 dunne. Niet elk sjabloon hoeft gevuld.',
  );
  parts.push('');
  parts.push('Elke sectie moet bevatten:');
  parts.push('- "id": slug identifier');
  parts.push('- "title": korte titel in het Nederlands');
  parts.push('- "body": narratief (2-3 alinea\'s boardroom Dutch)');
  parts.push('- "citations": bronverwijzingen');
  parts.push(
    '- "punchline": één pakkende zin die de kernboodschap samenvat (max 15 woorden)',
  );
  parts.push(
    '- "visualType": kies het meest passende type op basis van de gevonden data:',
  );
  parts.push(
    '  * "quote" — wanneer er een krachtig citaat of review-fragment is gevonden',
  );
  parts.push(
    '  * "comparison" — wanneer er een voor/na of A-vs-B vergelijking mogelijk is',
  );
  parts.push(
    '  * "signals" — wanneer er meetbare signalen of trends zijn (bijv. groei, marktpositie)',
  );
  parts.push(
    '  * "stats" — wanneer er concrete cijfers of percentages beschikbaar zijn',
  );
  parts.push(
    '- "visualData": gestructureerde data die past bij het gekozen visualType:',
  );
  parts.push(
    '  * Voor "quote": { "type": "quote", "quote": "het citaat", "attribution": "bron" }',
  );
  parts.push(
    '  * Voor "comparison": { "type": "comparison", "items": [{ "label": "aspect", "before": "huidig", "after": "mogelijk" }] } (2-4 items)',
  );
  parts.push(
    '  * Voor "signals": { "type": "signals", "items": [{ "label": "signaal", "value": "waarde", "trend": "up"|"down"|"neutral" }] } (2-4 items)',
  );
  parts.push(
    '  * Voor "stats": { "type": "stats", "items": [{ "label": "metric", "value": "getal", "context": "toelichting" }] } (2-4 items)',
  );
  parts.push('');
  parts.push(
    'BELANGRIJK: visualData moet ALTIJD afgeleid zijn van echte brondata — NOOIT verzonnen. Als er geen geschikte data is voor een visualType, laat visualType en visualData weg en gebruik alleen body tekst.',
  );
  parts.push('');
  parts.push('Retourneer UITSLUITEND valide JSON in dit formaat:');
  parts.push('```json');
  parts.push('{');
  parts.push('  "version": "analysis-v2",');
  parts.push('  "openingHook": "2-3 zinnen prospect-specifieke hook...",');
  parts.push('  "executiveSummary": "1 alinea executive summary...",');
  parts.push('  "sections": [');
  parts.push('    {');
  parts.push('      "id": "slug-identifier",');
  parts.push('      "title": "Sectietitel in het Nederlands",');
  parts.push(
    '      "body": "Vloeiend narratief dat bewijsmateriaal citeert...",',
  );
  parts.push(
    '      "citations": ["Bron: REVIEWS — ...", "Bron: WEBSITE — ..."],',
  );
  parts.push('      "punchline": "Eén pakkende zin als headline",');
  parts.push('      "visualType": "quote",');
  parts.push(
    '      "visualData": { "type": "quote", "quote": "het citaat uit een review", "attribution": "Trustpilot review" }',
  );
  parts.push('    }');
  parts.push('  ],');
  parts.push('  "useCaseRecommendations": [');
  parts.push('    {');
  parts.push('      "useCaseTitle": "...",');
  parts.push('      "category": "...",');
  parts.push(
    '      "relevanceNarrative": "waarom deze dienst past bij dit bedrijf...",',
  );
  parts.push(
    '      "applicableOutcomes": ["specifiek resultaat relevant voor dit bedrijf"]',
  );
  parts.push('    }');
  parts.push('  ]');
  parts.push('}');
  parts.push('```');
  parts.push('');
  parts.push(
    'BELANGRIJK: Retourneer ALLEEN de JSON, geen markdown-formatting, geen uitleg, geen prefix/suffix.',
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Legacy prompt builder (analysis-v1)
// ---------------------------------------------------------------------------

function buildLegacyPrompt(input: MasterAnalysisInput): string {
  // intentVars is typed as any for backward compat — cast to known shape
  const intentVars = input.intentVars as {
    categories: Record<
      IntentCategory,
      { signal: string; confidence: number; sourceType: string }[]
    >;
    extras: {
      category: string;
      signals: { signal: string; confidence: number }[];
    }[];
    sparse: boolean;
  };
  const { passages, prospect, spvs } = input;

  const sections: string[] = [];

  // --- System context ---
  sections.push(SYSTEM_PREAMBLE);
  sections.push('');
  sections.push(TONE_RULES);

  // --- Prospect profile ---
  sections.push('');
  sections.push('=== PROSPECT PROFIEL ===');
  sections.push(`Bedrijfsnaam: ${prospect.companyName}`);
  if (prospect.industry) sections.push(`Sector: ${prospect.industry}`);
  if (prospect.description)
    sections.push(`Omschrijving: ${prospect.description}`);
  if (prospect.specialties.length > 0)
    sections.push(`Specialismen: ${prospect.specialties.join(', ')}`);
  if (prospect.country) sections.push(`Land: ${prospect.country}`);
  if (prospect.city) sections.push(`Stad: ${prospect.city}`);
  if (prospect.employeeRange)
    sections.push(`Medewerkers: ${prospect.employeeRange}`);
  if (prospect.revenueRange) sections.push(`Omzet: ${prospect.revenueRange}`);

  // --- Intent signals per category ---
  sections.push('');
  sections.push('=== INTENT SIGNALEN ===');
  sections.push(
    'Hieronder staan de gesignaleerde intentiesignalen per categorie, gebaseerd op extern onderzoek:',
  );

  const categoryLabels: Record<IntentCategory, string> = {
    sector_fit: 'Sector Fit',
    operational_pains: 'Operationele Pijnpunten',
    esg_csrd: 'ESG / CSRD Compliance',
    investment_growth: 'Investering & Groei',
    workforce: 'Workforce & Talent',
  };

  for (const [cat, signals] of Object.entries(intentVars.categories)) {
    const label = categoryLabels[cat as IntentCategory] ?? cat;
    if (signals.length === 0) {
      sections.push(`\n[${label}]: Geen signalen gevonden`);
      continue;
    }
    sections.push(`\n[${label}]:`);
    for (const sig of signals.slice(0, 5)) {
      const conf = Math.round(sig.confidence * 100);
      sections.push(
        `- ${sig.signal} (vertrouwen: ${conf}%, bron: ${sig.sourceType})`,
      );
    }
  }

  if (intentVars.extras.length > 0) {
    for (const extra of intentVars.extras) {
      sections.push(`\n[Extra: ${extra.category}]:`);
      for (const sig of extra.signals.slice(0, 3)) {
        const conf = Math.round(sig.confidence * 100);
        sections.push(`- ${sig.signal} (vertrouwen: ${conf}%)`);
      }
    }
  }

  // --- RAG passages as numbered references ---
  sections.push('');
  sections.push("=== BRONDOCUMENTEN (Europe's Gate) ===");
  sections.push(
    'Gebruik deze passages als feitelijke basis. Refereer naar nummers waar relevant.',
  );

  if (passages.length === 0) {
    sections.push('Geen passages beschikbaar — gebruik visionaire framing.');
  } else {
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i]!;
      const sim = Math.round(p.similarity * 100);
      const spvLabel = p.spvName ? ` | SPV: ${p.spvName}` : '';
      sections.push(
        `\n[${i + 1}] ${p.content.slice(0, 800)} (bron: ${p.documentTitle}${spvLabel} | relevantie: ${sim}%)`,
      );
    }
  }

  // --- SPV data for partnership track selection ---
  sections.push('');
  sections.push('=== BESCHIKBARE SPV TRACKS ===');
  sections.push(
    'Selecteer de top 2-3 meest relevante SPVs op basis van de intent signalen en brondocumenten.',
  );

  for (const spv of spvs) {
    const metrics =
      spv.metricsTemplate && typeof spv.metricsTemplate === 'object'
        ? JSON.stringify(spv.metricsTemplate)
        : 'Geen metrics beschikbaar';
    sections.push(`\n- ${spv.name} (code: ${spv.code}, slug: ${spv.slug})`);
    sections.push(`  Metrics: ${metrics}`);
  }

  // --- Adaptive tone instructions ---
  sections.push('');
  sections.push('=== ADAPTIEVE INSTRUCTIES ===');

  if (intentVars.sparse) {
    sections.push(
      'LET OP: Er zijn weinig intentiesignalen (<2 gevulde categorieën). Gebruik visionaire framing boven data-first benadering. Schrijf overtuigend vanuit strategisch perspectief.',
    );
  }

  if (passages.length < 5) {
    sections.push(
      'LET OP: Er zijn weinig brondocumenten beschikbaar. Schrijf kwalitatieve triggers met directioneel bewijs. Verwijs niet naar specifieke nummers die niet in de bronnen staan.',
    );
  }

  if (passages.length >= 10) {
    sections.push(
      'De brondocumenten zijn rijkelijk gevuld. Prioriteer specifieke cijfers en datapunten uit de bronnen. Maak triggers concreet en data-gedreven.',
    );
  }

  // --- Output format specification ---
  sections.push('');
  sections.push('=== OPDRACHT ===');
  sections.push(
    `Genereer een partnership analyse voor ${prospect.companyName} in exact het volgende JSON-formaat.`,
  );
  sections.push('');
  sections.push('SECTIE 1 — CONTEXT:');
  sections.push(
    '- hook: 2-3 zinnen (opzet + inzicht + relevantie voor dit bedrijf)',
  );
  sections.push(
    '- kpis: EXACT 3 KPI-blokken die RAG-cijfers verbinden met de operaties van de prospect',
  );
  sections.push(
    '  Elk KPI-blok heeft: label (kort), value (getal of metric), context (waarom relevant voor hen)',
  );
  sections.push(
    "- executiveHook: 1 zin die hun pijnpunt koppelt aan wat Atlantis / Europe's Gate biedt",
  );
  sections.push('');
  sections.push('SECTIE 2 — TRIGGERS:');
  sections.push('EXACT 3 trigger-kaarten, elk met:');
  sections.push(
    '- category: "market" OF "compliance_esg" OF "capital_derisking"',
  );
  sections.push('- title: pakkende titel');
  sections.push(
    '- narrative: analyse waarom dit relevant is voor dit bedrijf (variabele lengte, afhankelijk van bewijskracht)',
  );
  sections.push(
    '- numbers: array van specifieke cijfers/feiten uit de bronnen (mag leeg zijn als er geen harde data is)',
  );
  sections.push('- urgency: "high", "medium", of "low"');
  sections.push('');
  sections.push('SECTIE 3 — TRACKS:');
  sections.push('Top 2-3 meest relevante SPV tracks, elk met:');
  sections.push('- spvName: naam van de SPV');
  sections.push('- spvCode: code van de SPV');
  sections.push('- scope: wat deze track specifiek biedt voor dit bedrijf');
  sections.push('- relevance: waarom deze track past bij hun situatie');
  sections.push('- strategicTags: array van 2-4 strategische tags');
  sections.push('Geen CTA — het contactformulier bestaat al.');
  sections.push('');
  sections.push('Retourneer UITSLUITEND valide JSON in dit formaat:');
  sections.push('```json');
  sections.push('{');
  sections.push('  "version": "analysis-v1",');
  sections.push('  "context": {');
  sections.push('    "hook": "...",');
  sections.push('    "kpis": [');
  sections.push('      { "label": "...", "value": "...", "context": "..." },');
  sections.push('      { "label": "...", "value": "...", "context": "..." },');
  sections.push('      { "label": "...", "value": "...", "context": "..." }');
  sections.push('    ],');
  sections.push('    "executiveHook": "..."');
  sections.push('  },');
  sections.push('  "triggers": [');
  sections.push(
    '    { "category": "market", "title": "...", "narrative": "...", "numbers": ["..."], "urgency": "high|medium|low" },',
  );
  sections.push(
    '    { "category": "compliance_esg", "title": "...", "narrative": "...", "numbers": ["..."], "urgency": "high|medium|low" },',
  );
  sections.push(
    '    { "category": "capital_derisking", "title": "...", "narrative": "...", "numbers": ["..."], "urgency": "high|medium|low" }',
  );
  sections.push('  ],');
  sections.push('  "tracks": [');
  sections.push(
    '    { "spvName": "...", "spvCode": "...", "scope": "...", "relevance": "...", "strategicTags": ["..."] }',
  );
  sections.push('  ]');
  sections.push('}');
  sections.push('```');
  sections.push('');
  sections.push(
    'BELANGRIJK: Retourneer ALLEEN de JSON, geen markdown-formatting, geen uitleg, geen prefix/suffix.',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Public API — dispatches to the appropriate builder
// ---------------------------------------------------------------------------

/**
 * Build the master prompt. Accepts three input shapes and dispatches accordingly:
 *   - KlarifaiNarrativeInput (analysis-v2, Use Cases): Klarifai prospects
 *   - NarrativeAnalysisInput (analysis-v2, RAG passages): Atlantis prospects
 *   - MasterAnalysisInput (analysis-v1, intent vars): legacy
 */
export function buildMasterPrompt(
  input: NarrativeAnalysisInput | MasterAnalysisInput | KlarifaiNarrativeInput,
): string {
  if (isKlarifaiInput(input)) {
    return buildKlarifaiNarrativePrompt(input);
  }
  if (isNarrativeInput(input)) {
    return buildNarrativePrompt(input);
  }
  return buildLegacyPrompt(input);
}
