import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@/env.mjs';
import {
  SYSTEM_PROMPT,
  type CompanyContext,
  type IndustryPrompts,
  buildDataOpportunitiesPrompt,
  buildAutomationAgentsPrompt,
  buildSuccessStoriesPrompt,
  buildRoadmapPrompt,
  buildHeroPrompt,
} from './prompts';
import {
  dataOpportunitiesSchema,
  automationAgentsSchema,
  successStoriesSchema,
  aiRoadmapSchema,
  heroContentSchema,
  type DataOpportunities,
  type AutomationAgents,
  type SuccessStories,
  type AIRoadmap,
  type HeroContent,
} from './schemas';

let genai: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genai) {
    genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!);
  }
  return genai;
}

const WIZARD_STEP_TIMEOUT_MS = 8_000;
const WIZARD_TOTAL_TIMEOUT_MS = 25_000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function generateJSON<T>(
  prompt: string,
  schema: { parse: (data: unknown) => T },
  systemPrompt?: string,
): Promise<T> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt ?? SYSTEM_PROMPT,
  });

  const result = await withTimeout(
    model.generateContent(prompt),
    WIZARD_STEP_TIMEOUT_MS,
    'Gemini generateContent',
  );
  const text = result.response.text();

  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);
  return schema.parse(parsed);
}

export interface GeneratedWizardContent {
  heroContent: HeroContent;
  dataOpportunities: DataOpportunities;
  automationAgents: AutomationAgents;
  successStories: SuccessStories;
  aiRoadmap: AIRoadmap;
}

function buildFallbackWizardContent(company: CompanyContext): GeneratedWizardContent {
  const companyName = company.companyName ?? company.domain;
  const industry = company.industry ?? 'your sector';
  const location = [company.city, company.country].filter(Boolean).join(', ');
  const locationLabel = location.length > 0 ? location : 'your market';

  return {
    heroContent: {
      headline: `AI opportunities for ${companyName}`,
      subheadline:
        'Initial draft generated from profile data. Refine this after enrichment completes.',
      stats: [
        { label: 'Speed to first use case', value: '2-4 weeks', icon: 'Timer' },
        { label: 'Initial automation potential', value: '10-20%', icon: 'TrendingUp' },
        { label: 'Data readiness baseline', value: 'Medium', icon: 'Database' },
      ],
      industryInsight: `${companyName} in ${industry} can typically unlock value by standardizing intake, prioritization, and follow-up workflows in ${locationLabel}.`,
    },
    dataOpportunities: {
      opportunities: [
        {
          title: 'Operational data unification',
          icon: 'Database',
          description:
            'Unify siloed operational signals into one decision layer for teams.',
          impact: 'HIGH',
          dataSource: 'ERP/CRM and service workflow events',
          exampleOutcome:
            'Faster identification of high-priority accounts and bottlenecks.',
        },
        {
          title: 'Pipeline health visibility',
          icon: 'BarChart3',
          description:
            'Track conversion and delay patterns by stage with proactive alerts.',
          impact: 'MEDIUM',
          dataSource: 'Campaign, outreach, and response timeline data',
          exampleOutcome: 'Clear ownership and shorter time-to-next-action.',
        },
      ],
    },
    automationAgents: {
      agents: [
        {
          name: 'Prospect Qualification Agent',
          icon: 'Filter',
          description:
            'Scores incoming prospects against SPV and campaign fit criteria.',
          automatedTasks: [
            'Normalize firmographic fields',
            'Flag off-target profiles',
            'Prioritize recommended prospects',
          ],
          effort: 'LOW',
          impact: 'HIGH',
          timeToValue: '1-2 weeks',
        },
        {
          name: 'Follow-up Orchestrator',
          icon: 'Send',
          description:
            'Suggests and schedules the next best outbound action per contact.',
          automatedTasks: [
            'Detect inactivity windows',
            'Draft next-touch suggestions',
            'Route tasks to sales owners',
          ],
          effort: 'MEDIUM',
          impact: 'MEDIUM',
          timeToValue: '2-4 weeks',
        },
      ],
    },
    successStories: {
      stories: [
        {
          companyName: `Regional ${industry} Operator`,
          industry,
          challenge: 'Fragmented processes slowed qualification and outbound execution.',
          solution:
            'Introduced fit scoring, workflow triggers, and structured campaign handoffs.',
          results: [
            { metric: 'Lead response time', before: '3 days', after: 'same day' },
            { metric: 'Qualified pipeline share', before: '22%', after: '34%' },
          ],
          timeline: '90 days',
          quote:
            'The team gained clear focus on high-fit opportunities without adding headcount.',
        },
      ],
    },
    aiRoadmap: {
      phases: [
        {
          name: 'Foundation',
          duration: 'Weeks 1-2',
          icon: 'Layers',
          items: [
            {
              title: 'Baseline data model',
              description: 'Align entity mapping for prospects, contacts, and campaigns.',
              effort: 'LOW',
              expectedOutcome: 'Consistent reporting and filter reliability.',
            },
          ],
        },
        {
          name: 'Activation',
          duration: 'Weeks 3-6',
          icon: 'Rocket',
          items: [
            {
              title: 'Automated qualification and routing',
              description: 'Deploy fit scoring and owner assignment for high-priority leads.',
              effort: 'MEDIUM',
              expectedOutcome: 'Higher throughput with less manual triage.',
            },
          ],
        },
      ],
      estimatedROI: 'Initial measurable impact expected within one quarter.',
      nextStep:
        'Run one campaign pilot with manual QA, then scale by SPV after validation.',
    },
  };
}

export async function generateWizardContent(
  company: CompanyContext,
  industryPrompts?: IndustryPrompts,
): Promise<GeneratedWizardContent> {
  try {
    const generated = await withTimeout(
      (async () => {
        // Step 1: Generate data opportunities and automation agents in parallel (independent)
        const [dataOpportunities, automationAgents] = await Promise.all([
          generateJSON(
            buildDataOpportunitiesPrompt(company, industryPrompts),
            dataOpportunitiesSchema,
          ),
          generateJSON(
            buildAutomationAgentsPrompt(company, industryPrompts),
            automationAgentsSchema,
          ),
        ]);

        // Step 2: Generate success stories (uses steps 1-2 context implicitly via industry)
        const successStories = await generateJSON(
          buildSuccessStoriesPrompt(company, industryPrompts),
          successStoriesSchema,
        );

        // Step 3: Generate roadmap (synthesizes data opportunities + automation agents)
        const aiRoadmap = await generateJSON(
          buildRoadmapPrompt(
            company,
            dataOpportunities,
            automationAgents,
            industryPrompts,
          ),
          aiRoadmapSchema,
        );

        // Step 4: Generate hero content (final, references everything)
        const heroContent = await generateJSON(
          buildHeroPrompt(
            company,
            dataOpportunities,
            automationAgents,
            aiRoadmap,
          ),
          heroContentSchema,
        );

        return {
          heroContent,
          dataOpportunities,
          automationAgents,
          successStories,
          aiRoadmap,
        };
      })(),
      WIZARD_TOTAL_TIMEOUT_MS,
      'Wizard generation pipeline',
    );

    return generated;
  } catch (error) {
    console.error('Wizard AI generation failed, returning fallback content:', error);
    return buildFallbackWizardContent(company);
  }
}
