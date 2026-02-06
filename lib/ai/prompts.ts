export const SYSTEM_PROMPT = `You are a senior AI strategist at Klarifai, a European AI consultancy that helps businesses discover and implement AI solutions. You create personalized, practical AI roadmaps that make complex technology accessible and exciting.

Your tone is:
- Authoritative but approachable — like a trusted advisor, not a salesperson
- Specific and data-driven — reference concrete processes, metrics, and outcomes
- Visionary yet grounded — show what's possible while keeping it realistic
- European sensibility — professional, quality-focused, GDPR-aware

You always output valid JSON matching the requested schema exactly. Never include markdown code fences in your output.`;

export interface CompanyContext {
  companyName: string;
  domain: string;
  industry: string | null;
  subIndustry: string | null;
  employeeRange: string | null;
  revenueRange: string | null;
  technologies: string[];
  specialties: string[];
  country: string | null;
  city: string | null;
  description: string | null;
}

export interface IndustryPrompts {
  dataOpportunityPrompts: string[];
  automationPrompts: string[];
  successStoryTemplates: Array<{
    title: string;
    industry: string;
    outcome: string;
  }>;
  roadmapTemplates: Array<{ phase: string; items: string[] }>;
}

function companyContextBlock(company: CompanyContext): string {
  return `
COMPANY PROFILE:
- Name: ${company.companyName}
- Domain: ${company.domain}
- Industry: ${company.industry ?? 'General Business'}${company.subIndustry ? ` / ${company.subIndustry}` : ''}
- Size: ${company.employeeRange ?? 'Unknown'} employees
- Revenue: ${company.revenueRange ?? 'Unknown'}
- Location: ${[company.city, company.country].filter(Boolean).join(', ') || 'Europe'}
- Technologies: ${company.technologies.length > 0 ? company.technologies.join(', ') : 'Not specified'}
- Specialties: ${company.specialties.length > 0 ? company.specialties.join(', ') : 'Not specified'}
- Description: ${company.description ?? 'Not available'}`;
}

export function buildDataOpportunitiesPrompt(
  company: CompanyContext,
  industryPrompts?: IndustryPrompts,
): string {
  const hints = industryPrompts?.dataOpportunityPrompts?.join('\n- ') ?? '';
  return `${companyContextBlock(company)}

${hints ? `INDUSTRY-SPECIFIC DATA ANGLES:\n- ${hints}\n` : ''}
Generate 5 specific data opportunities for this company. Each opportunity should describe how their existing business data (customer data, operational data, market data, transaction data) could be leveraged with AI to create new value.

Respond with JSON:
{
  "opportunities": [
    {
      "title": "Short compelling title (5-8 words)",
      "icon": "lucide icon name (e.g., BarChart3, Users, TrendingUp, Database, Zap)",
      "description": "2-3 sentences explaining the opportunity, specific to their business",
      "impact": "HIGH" | "MEDIUM",
      "dataSource": "What existing data this leverages",
      "exampleOutcome": "Concrete metric or outcome (e.g., '15-25% reduction in churn')"
    }
  ]
}`;
}

export function buildAutomationAgentsPrompt(
  company: CompanyContext,
  industryPrompts?: IndustryPrompts,
): string {
  const hints = industryPrompts?.automationPrompts?.join('\n- ') ?? '';
  return `${companyContextBlock(company)}

${hints ? `INDUSTRY-SPECIFIC AUTOMATION ANGLES:\n- ${hints}\n` : ''}
Generate 4 AI agent/automation concepts for this company. Each should describe a specific business process that could be automated or augmented with AI agents.

Respond with JSON:
{
  "agents": [
    {
      "name": "Agent name (e.g., 'Smart Intake Agent', 'Revenue Copilot')",
      "icon": "lucide icon name",
      "description": "2-3 sentences about what this agent does, specific to their operations",
      "automatedTasks": ["task 1", "task 2", "task 3"],
      "effort": "LOW" | "MEDIUM" | "HIGH",
      "impact": "HIGH" | "MEDIUM",
      "timeToValue": "e.g., '2-4 weeks', '1-2 months'"
    }
  ]
}`;
}

export function buildSuccessStoriesPrompt(
  company: CompanyContext,
  industryPrompts?: IndustryPrompts,
): string {
  const templates = industryPrompts?.successStoryTemplates ?? [];
  const templateHints =
    templates.length > 0
      ? `\nINDUSTRY CASE STUDY THEMES:\n${templates.map((t) => `- ${t.title} (${t.industry}): ${t.outcome}`).join('\n')}\n`
      : '';
  return `${companyContextBlock(company)}
${templateHints}
Generate 3 realistic but fictional success stories of companies similar to ${company.companyName} that implemented AI. These should feel authentic and relatable, with specific metrics.

Respond with JSON:
{
  "stories": [
    {
      "companyName": "A realistic fictional company name in their industry",
      "industry": "Their specific industry niche",
      "challenge": "1-2 sentences about the business challenge",
      "solution": "2-3 sentences about the AI solution implemented",
      "results": [
        { "metric": "e.g., Customer Response Time", "before": "48 hours", "after": "2 hours" },
        { "metric": "e.g., Revenue Growth", "before": "3% quarterly", "after": "12% quarterly" }
      ],
      "timeline": "e.g., '3 months'",
      "quote": "A brief fictional quote from a C-level executive"
    }
  ]
}`;
}

export function buildRoadmapPrompt(
  company: CompanyContext,
  dataOpportunities: unknown,
  automationAgents: unknown,
  industryPrompts?: IndustryPrompts,
): string {
  const templates = industryPrompts?.roadmapTemplates ?? [];
  const templateHints =
    templates.length > 0
      ? `\nINDUSTRY ROADMAP STRUCTURE:\n${templates.map((t) => `${t.phase}: ${t.items.join(', ')}`).join('\n')}\n`
      : '';
  return `${companyContextBlock(company)}

PREVIOUSLY GENERATED DATA OPPORTUNITIES:
${JSON.stringify(dataOpportunities, null, 2)}

PREVIOUSLY GENERATED AUTOMATION AGENTS:
${JSON.stringify(automationAgents, null, 2)}
${templateHints}
Create a 90-day AI implementation roadmap for ${company.companyName}. This should be phased from quick wins to strategic initiatives, referencing the specific opportunities and agents identified above.

Respond with JSON:
{
  "phases": [
    {
      "name": "Phase name (e.g., 'Quick Wins')",
      "duration": "e.g., 'Week 1-2'",
      "icon": "lucide icon name",
      "items": [
        {
          "title": "Specific action item",
          "description": "1-2 sentences",
          "effort": "LOW" | "MEDIUM" | "HIGH",
          "expectedOutcome": "Concrete expected result"
        }
      ]
    }
  ],
  "estimatedROI": "A realistic ROI estimate for 12 months",
  "nextStep": "The single most impactful first action"
}`;
}

export function buildHeroPrompt(
  company: CompanyContext,
  dataOpportunities: unknown,
  automationAgents: unknown,
  roadmap: unknown,
): string {
  return `${companyContextBlock(company)}

ANALYSIS SUMMARY (previously generated):
- Data Opportunities: ${JSON.stringify(dataOpportunities)}
- Automation Agents: ${JSON.stringify(automationAgents)}
- Roadmap: ${JSON.stringify(roadmap)}

Write a compelling hero section for ${company.companyName}'s personalized AI discovery page. This is the first thing they see, so it should create an "aha moment" — showing that we deeply understand their business and see AI potential they haven't considered.

Respond with JSON:
{
  "headline": "A bold, personalized headline (max 10 words)",
  "subheadline": "A compelling 1-2 sentence hook specific to their industry and challenges",
  "stats": [
    {
      "label": "e.g., 'Data Opportunities Identified'",
      "value": "e.g., '5'",
      "icon": "lucide icon name"
    },
    {
      "label": "e.g., 'Automatable Processes'",
      "value": "e.g., '4'",
      "icon": "lucide icon name"
    },
    {
      "label": "e.g., 'Estimated Time to First Win'",
      "value": "e.g., '2 weeks'",
      "icon": "lucide icon name"
    }
  ],
  "industryInsight": "A single surprising or thought-provoking insight about AI in their industry (1-2 sentences)"
}`;
}
