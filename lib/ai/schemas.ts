import { z } from 'zod';

export const heroContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  stats: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      icon: z.string(),
    }),
  ),
  industryInsight: z.string(),
});

export const dataOpportunitiesSchema = z.object({
  opportunities: z.array(
    z.object({
      title: z.string(),
      icon: z.string(),
      description: z.string(),
      impact: z.enum(['HIGH', 'MEDIUM']),
      dataSource: z.string(),
      exampleOutcome: z.string(),
    }),
  ),
});

export const automationAgentsSchema = z.object({
  agents: z.array(
    z.object({
      name: z.string(),
      icon: z.string(),
      description: z.string(),
      automatedTasks: z.array(z.string()),
      effort: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      impact: z.enum(['HIGH', 'MEDIUM']),
      timeToValue: z.string(),
    }),
  ),
});

export const successStoriesSchema = z.object({
  stories: z.array(
    z.object({
      companyName: z.string(),
      industry: z.string(),
      challenge: z.string(),
      solution: z.string(),
      results: z.array(
        z.object({
          metric: z.string(),
          before: z.string(),
          after: z.string(),
        }),
      ),
      timeline: z.string(),
      quote: z.string(),
    }),
  ),
});

export const aiRoadmapSchema = z.object({
  phases: z.array(
    z.object({
      name: z.string(),
      duration: z.string(),
      icon: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          effort: z.enum(['LOW', 'MEDIUM', 'HIGH']),
          expectedOutcome: z.string(),
        }),
      ),
    }),
  ),
  estimatedROI: z.string(),
  nextStep: z.string(),
});

export type HeroContent = z.infer<typeof heroContentSchema>;
export type DataOpportunities = z.infer<typeof dataOpportunitiesSchema>;
export type AutomationAgents = z.infer<typeof automationAgentsSchema>;
export type SuccessStories = z.infer<typeof successStoriesSchema>;
export type AIRoadmap = z.infer<typeof aiRoadmapSchema>;
