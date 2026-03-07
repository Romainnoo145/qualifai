/**
 * Master analysis prompt builder — constructs the Claude Sonnet prompt
 * combining intent variables, RAG passages, SPV data, and prospect profile
 * into a structured JSON generation request.
 */

import type { IntentCategory } from '@/lib/extraction/types';
import type { MasterAnalysisInput } from './types';

const SYSTEM_PREAMBLE = `Je bent een senior strategisch adviseur die boardroom-ready partnership analyses schrijft voor Europe's Gate. Toon: zakelijk-visionair Nederlands — clean business language, geen anglicismen, confident maar niet stijf. Schrijf alsof het een McKinsey board-presentatie is.`;

const TONE_RULES = `
KRITISCHE TOONREGELS:
- Gebruik "uw" voor professionele afstand; gebruik de bedrijfsnaam in hooks en headers
- Cijfers MOETEN prospect-relevant zijn (staalcapaciteit die zij zouden gebruiken, afvalreductie in hun sector) — GEEN project-grandeur marketingstatistieken
- Wanneer bronnen geen harde cijfers bevatten: schrijf kwalitatieve trigger met directioneel bewijs, verzin NOOIT cijfers
- Wanneer prospect-data conflicteert met brondocument-data: toon beide perspectieven
- NOOIT termen als AI, RAG, scraping, embeddings, machine learning, of technische pipeline-terminologie gebruiken
- Schrijf in het Nederlands, zakelijk-visionair register
- Denk McKinsey board-presentatie in het Nederlands, niet startup pitch deck
`.trim();

/**
 * Build the complete prompt for Claude Sonnet to generate a MasterAnalysis.
 */
export function buildMasterPrompt(input: MasterAnalysisInput): string {
  const { intentVars, passages, prospect, spvs } = input;

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
