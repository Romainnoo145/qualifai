import { getJson, config as serpConfig } from 'serpapi';
import type { EvidenceDraft } from '@/lib/workflow-engine';

const AUTOMATION_KEYWORDS = [
  // Dutch
  'automatisering',
  'procesverbetering',
  'digitalisering',
  'data-analyse',
  'workflow',
  'integratie',
  'optimalisatie',
  'efficiëntie',
  'kwaliteitsbewaking',
  'planningssysteem',
  // English
  'automation',
  'process improvement',
  'digital transformation',
  'data analyst',
  'integration',
  'rpa',
  'workflow',
  'crm',
  'erp',
  'lean',
  'six sigma',
  'continuous improvement',
  'project coordinator',
  'operations manager',
];

function hasAutomationSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return AUTOMATION_KEYWORDS.some((kw) => lower.includes(kw));
}

interface SerpJobResult {
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
  };
  job_highlights?: Array<{
    title?: string;
    items?: Array<{ snippet?: string } | string>;
  }>;
  apply_options?: Array<{
    title?: string;
    link?: string;
  }>;
}

/**
 * Analyze job postings via SerpAPI google_jobs engine.
 *
 * Job postings reveal skill gaps and operational needs:
 * - Hiring "process analyst" = workflow pain
 * - Hiring "RPA developer" = automation appetite
 * - Multiple ops roles = scaling pains
 *
 * Returns up to 5 EvidenceDraft items with sourceType CAREERS.
 */
export async function fetchLinkedInJobs(input: {
  companyName: string;
  domain: string;
}): Promise<EvidenceDraft[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  serpConfig.api_key = apiKey;

  const drafts: EvidenceDraft[] = [];

  try {
    const result = (await getJson({
      engine: 'google_jobs',
      q: `"${input.companyName}" vacatures`,
      gl: 'nl',
      hl: 'nl',
    })) as {
      jobs_results?: SerpJobResult[];
    };

    const jobs = (result.jobs_results ?? []).slice(0, 5);

    for (const job of jobs) {
      if (!job.title) continue;

      // Build snippet from job highlights or description
      const highlightSnippets: string[] = [];
      for (const highlight of job.job_highlights ?? []) {
        for (const item of highlight.items ?? []) {
          const text = typeof item === 'string' ? item : (item.snippet ?? '');
          if (text.length >= 20) {
            highlightSnippets.push(text);
          }
        }
      }

      const snippet =
        highlightSnippets.length > 0
          ? highlightSnippets.join(' | ').slice(0, 600)
          : (job.description ?? '').slice(0, 600);

      if (snippet.length < 20) continue;

      const applyUrl = job.apply_options?.[0]?.link;
      const sourceUrl =
        applyUrl ??
        `https://www.google.com/search?q=${encodeURIComponent(`"${input.companyName}" ${job.title} vacature`)}`;

      const hasSignal = hasAutomationSignal(`${job.title} ${snippet}`);

      drafts.push({
        sourceType: 'CAREERS',
        sourceUrl,
        title: `${input.companyName} - Vacature: ${job.title}`,
        snippet,
        workflowTag: 'workflow-context',
        confidenceScore: hasSignal ? 0.8 : 0.72,
        metadata: {
          adapter: 'linkedin-jobs-serpapi',
          source: 'google-jobs',
          jobTitle: job.title,
          location: job.location,
          hasAutomationSignal: hasSignal,
          postedAt: job.detected_extensions?.posted_at,
        },
      });
    }
  } catch {
    // SerpAPI call failed
  }

  return drafts.slice(0, 5);
}
