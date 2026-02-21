export interface OutreachContext {
  contact: {
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    seniority: string | null;
    department: string | null;
  };
  company: {
    companyName: string;
    domain: string;
    industry: string | null;
    employeeRange: string | null;
    technologies: string[];
    description: string | null;
  };
  signal?: {
    signalType: string;
    title: string;
    description: string | null;
  };
}

export function buildIntroEmailPrompt(ctx: OutreachContext): string {
  return `You are writing a personalized cold outreach email from Romano at Klarifai (a European AI consultancy) to a potential client.

RECIPIENT:
- Name: ${ctx.contact.firstName} ${ctx.contact.lastName}
- Title: ${ctx.contact.jobTitle ?? 'Unknown'}
- Seniority: ${ctx.contact.seniority ?? 'Unknown'}
- Department: ${ctx.contact.department ?? 'Unknown'}

THEIR COMPANY:
- Name: ${ctx.company.companyName}
- Domain: ${ctx.company.domain}
- Industry: ${ctx.company.industry ?? 'General'}
- Size: ${ctx.company.employeeRange ?? 'Unknown'}
- Technologies: ${ctx.company.technologies.length > 0 ? ctx.company.technologies.join(', ') : 'Unknown'}
- Description: ${ctx.company.description ?? 'Not available'}

${ctx.signal ? `TRIGGER SIGNAL:\n- Type: ${ctx.signal.signalType}\n- ${ctx.signal.title}\n- ${ctx.signal.description ?? ''}\n` : ''}

RULES:
- Keep it under 150 words
- Open with something specific about their company or role — never generic
- Reference how AI/data could help their specific industry or department
- End with a clear, low-commitment CTA (e.g., "Would a 15-minute call make sense?")
- Tone: Professional but warm, European sensibility, not salesy
- Sign off as "Romano Groenewoud, Klarifai"
- Do NOT use exclamation marks excessively

Respond with JSON:
{
  "subject": "Short, compelling subject line (no emojis)",
  "bodyHtml": "Full email in HTML (use <p> tags, <br> for line breaks, <strong> for emphasis)",
  "bodyText": "Plain text version of the same email",
  "personalizedOpener": "The opening line that hooks them",
  "callToAction": "The specific CTA used"
}`;
}

export function buildFollowUpPrompt(
  ctx: OutreachContext,
  previousSubject: string,
): string {
  return `You are writing a follow-up email from Romano at Klarifai. The recipient hasn't replied to the first email.

RECIPIENT:
- Name: ${ctx.contact.firstName} ${ctx.contact.lastName}
- Title: ${ctx.contact.jobTitle ?? 'Unknown'}

THEIR COMPANY:
- Name: ${ctx.company.companyName}
- Industry: ${ctx.company.industry ?? 'General'}

PREVIOUS EMAIL SUBJECT: "${previousSubject}"

RULES:
- Under 100 words
- Reference the previous email briefly
- Add ONE new value angle (case study result, industry insight, or relevant data point)
- Different CTA than the original (e.g., share a resource, quick audit, etc.)
- Don't be apologetic or pushy
- Sign off as "Romano, Klarifai"

Respond with JSON:
{
  "subject": "Re: ${previousSubject}",
  "bodyHtml": "Full email in HTML",
  "bodyText": "Plain text version",
  "personalizedOpener": "Opening line",
  "callToAction": "The CTA"
}`;
}

export function buildSignalTriggeredPrompt(ctx: OutreachContext): string {
  if (!ctx.signal) throw new Error('Signal context required');

  const signalMessages: Record<string, string> = {
    JOB_CHANGE: `${ctx.contact.firstName} recently changed roles. Congratulate them and introduce Klarifai as a resource for their new position.`,
    PROMOTION: `${ctx.contact.firstName} was promoted. Congratulate them and suggest how AI could help in their expanded role.`,
    FUNDING_EVENT: `${ctx.company.companyName} received funding. Suggest how AI/data solutions could help them scale with their new resources.`,
    HEADCOUNT_GROWTH: `${ctx.company.companyName} is growing their team. Suggest how AI automation could help them scale efficiently.`,
    TECHNOLOGY_ADOPTION: `${ctx.company.companyName} adopted new technology. Connect this to AI/data opportunities.`,
  };

  const context =
    signalMessages[ctx.signal.signalType] ??
    `A relevant buying signal was detected. Use it to personalize the outreach.`;

  return `You are writing a signal-triggered outreach email from Romano at Klarifai.

${context}

SIGNAL: ${ctx.signal.title}
${ctx.signal.description ? `Details: ${ctx.signal.description}` : ''}

RECIPIENT:
- Name: ${ctx.contact.firstName} ${ctx.contact.lastName}
- Title: ${ctx.contact.jobTitle ?? 'Unknown'}

THEIR COMPANY:
- Name: ${ctx.company.companyName}
- Industry: ${ctx.company.industry ?? 'General'}

RULES:
- Under 120 words
- Lead with the signal (congratulations, observation, etc.)
- Naturally transition to how Klarifai could help
- Low-pressure CTA
- Sign off as "Romano, Klarifai"

Respond with JSON:
{
  "subject": "Compelling subject referencing the signal (no emojis)",
  "bodyHtml": "Full email in HTML",
  "bodyText": "Plain text version",
  "personalizedOpener": "Opening line referencing the signal",
  "callToAction": "The CTA"
}`;
}
