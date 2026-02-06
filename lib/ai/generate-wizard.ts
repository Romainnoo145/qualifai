import Anthropic from '@anthropic-ai/sdk';
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

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

async function generateJSON<T>(
  prompt: string,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let jsonText = textBlock.text.trim();
  // Strip markdown code fences if present
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

export async function generateWizardContent(
  company: CompanyContext,
  industryPrompts?: IndustryPrompts,
): Promise<GeneratedWizardContent> {
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
    buildHeroPrompt(company, dataOpportunities, automationAgents, aiRoadmap),
    heroContentSchema,
  );

  return {
    heroContent,
    dataOpportunities,
    automationAgents,
    successStories,
    aiRoadmap,
  };
}
