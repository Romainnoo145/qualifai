export interface OutreachSender {
  fromName: string;
  company: string;
  language: 'nl' | 'en';
  tone: string;
  companyPitch: string;
  signatureHtml: string;
  signatureText: string;
}

export interface EvidenceContext {
  sourceType: string;
  snippet: string;
  title: string | null;
}

export interface HypothesisContext {
  title: string;
  problemStatement: string;
}

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
  sender?: OutreachSender;
  /** Full URL to the prospect's discover page, appended as CTA button */
  discoverUrl?: string;
  /** Optional: top evidence items from most recent ResearchRun (cap at 8) */
  evidence?: EvidenceContext[];
  /** Optional: confirmed hypotheses (title + problem) for this prospect */
  hypotheses?: HypothesisContext[];
}

// ── Defaults (Klarifai) ──────────────────────────────────────────────

const DEFAULT_SENDER: OutreachSender = {
  fromName: 'Romano Kanters',
  company: 'Klarifai',
  language: 'nl',
  tone: 'Zakelijk, strategisch, beheerst — geen smalltalk, geen uitroeptekens, feiten als wapen',
  companyPitch:
    'Klarifai helpt bedrijven met AI-gedreven oplossingen voor procesoptimalisatie en groei.',
  signatureHtml: `<p style="margin-top:24px;">Met vriendelijke groet,</p>
<p><strong>Romano Kanters</strong><br>Klarifai<br>
<a href="https://klarifai.nl" style="color:#007AFF;text-decoration:none;">klarifai.nl</a></p>`,
  signatureText: `\nMet vriendelijke groet,\n\nRomano Kanters\nKlarifai\nklarifai.nl`,
};

export function getSender(ctx: OutreachContext): OutreachSender {
  return ctx.sender ?? DEFAULT_SENDER;
}

export function getSignatureHtml(ctx: OutreachContext): string {
  return getSender(ctx).signatureHtml;
}

export function getSignatureText(ctx: OutreachContext): string {
  return getSender(ctx).signatureText;
}

// ── Discover CTA block ──────────────────────────────────────────────

export function getDiscoverCtaHtml(ctx: OutreachContext): string {
  if (!ctx.discoverUrl) return '';
  const s = getSender(ctx);
  const label =
    s.language === 'nl'
      ? 'Bekijk uw persoonlijke analyse'
      : 'View your personalized analysis';
  return `<p style="margin-top:20px;margin-bottom:12px;"><a href="${ctx.discoverUrl}" style="display:inline-block;padding:10px 22px;background:#0A0A23;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${label}</a></p>`;
}

export function getDiscoverCtaText(ctx: OutreachContext): string {
  if (!ctx.discoverUrl) return '';
  const s = getSender(ctx);
  const label =
    s.language === 'nl'
      ? 'Bekijk uw persoonlijke analyse'
      : 'View your personalized analysis';
  return `\n\n${label}: ${ctx.discoverUrl}`;
}

// ── Shared prompt blocks ─────────────────────────────────────────────

function toneInstructions(s: OutreachSender): string {
  const langLine =
    s.language === 'nl' ? '- Schrijf in het NEDERLANDS' : '- Write in ENGLISH';
  const signOffLine =
    s.language === 'nl'
      ? '- Onderteken NIET zelf — de handtekening wordt automatisch toegevoegd'
      : '- Do NOT sign off — the signature is added automatically';
  return `TONE & STYLE:
${langLine}
- ${s.tone}
- ${s.language === 'nl' ? 'Elke zin heeft een doel. Als een zin geen informatie of waarde toevoegt, verwijder hem' : 'Every sentence must serve a purpose. Remove filler.'}
- ${s.language === 'nl' ? 'Gebruik feiten als wapen: verwijs naar concrete data, projecten, cijfers' : 'Use facts as leverage: reference concrete data, projects, numbers'}
- ${s.language === 'nl' ? 'GEEN opvulzinnen zoals "Ik hoop dat het goed met u gaat"' : 'NO filler phrases like "I hope this finds you well"'}
${signOffLine}`;
}

const HTML_INSTRUCTIONS = `HTML FORMAT:
- Use <p style="margin-bottom:12px;"> for every paragraph (NOT bare <p>)
- Use <strong> for emphasis
- Use <br> only within a paragraph
- Do NOT include a signature in bodyHtml — it is appended automatically`;

// ── Intro Email ──────────────────────────────────────────────────────

export function buildIntroEmailPrompt(ctx: OutreachContext): string {
  const s = getSender(ctx);
  const isNl = s.language === 'nl';

  return `${isNl ? `Je schrijft een gepersonaliseerde koude outreach email van ${s.fromName} bij ${s.company} naar een potentiële klant.` : `You are writing a personalized cold outreach email from ${s.fromName} at ${s.company} to a potential client.`}

${isNl ? 'OVER ONS' : 'ABOUT US'}:
${s.companyPitch}

${isNl ? 'ONTVANGER' : 'RECIPIENT'}:
- ${isNl ? 'Naam' : 'Name'}: ${ctx.contact.firstName} ${ctx.contact.lastName}
- ${isNl ? 'Functie' : 'Title'}: ${ctx.contact.jobTitle ?? (isNl ? 'Onbekend' : 'Unknown')}
- ${isNl ? 'Senioriteit' : 'Seniority'}: ${ctx.contact.seniority ?? (isNl ? 'Onbekend' : 'Unknown')}
- ${isNl ? 'Afdeling' : 'Department'}: ${ctx.contact.department ?? (isNl ? 'Onbekend' : 'Unknown')}

${isNl ? 'HUN BEDRIJF' : 'THEIR COMPANY'}:
- ${isNl ? 'Naam' : 'Name'}: ${ctx.company.companyName}
- ${isNl ? 'Domein' : 'Domain'}: ${ctx.company.domain}
- ${isNl ? 'Industrie' : 'Industry'}: ${ctx.company.industry ?? (isNl ? 'Algemeen' : 'General')}
- ${isNl ? 'Omvang' : 'Size'}: ${ctx.company.employeeRange ?? (isNl ? 'Onbekend' : 'Unknown')}
- ${isNl ? 'Technologieën' : 'Technologies'}: ${ctx.company.technologies.length > 0 ? ctx.company.technologies.join(', ') : isNl ? 'Onbekend' : 'Unknown'}
- ${isNl ? 'Beschrijving' : 'Description'}: ${ctx.company.description ?? (isNl ? 'Niet beschikbaar' : 'Not available')}

${ctx.signal ? `${isNl ? 'TRIGGER SIGNAAL' : 'TRIGGER SIGNAL'}:\n- Type: ${ctx.signal.signalType}\n- ${ctx.signal.title}\n- ${ctx.signal.description ?? ''}\n` : ''}
${
  ctx.evidence && ctx.evidence.length > 0
    ? `
${isNl ? 'BEWIJS UIT PROSPECT-ONDERZOEK' : 'EVIDENCE FROM PROSPECT RESEARCH'}:
${ctx.evidence
  .slice(0, 8)
  .map(
    (e) =>
      `- [${e.sourceType}] ${e.title ? e.title + ': ' : ''}${e.snippet.slice(0, 200)}`,
  )
  .join('\n')}
`
    : ''
}${
    ctx.hypotheses && ctx.hypotheses.length > 0
      ? `
${isNl ? 'PIJNPUNTEN (GEVALIDEERDE HYPOTHESEN)' : 'PAIN POINTS (VALIDATED HYPOTHESES)'}:
${ctx.hypotheses.map((h) => `- ${h.title}: ${h.problemStatement}`).join('\n')}
`
      : ''
  }
${toneInstructions(s)}

${isNl ? 'REGELS' : 'RULES'}:
- ${isNl ? 'Maximaal 150 woorden' : 'Maximum 150 words'}
- ${isNl ? 'Begin met een aanhef: "Geachte heer/mevrouw [Achternaam],"' : 'Start with a salutation: "Dear Mr./Ms. [LastName],"'}
- ${isNl ? 'Open met iets specifieks over hun bedrijf — nooit generiek' : 'Open with something specific about their company — never generic'}
- ${isNl ? 'Eindig met een concrete, laagdrempelige CTA' : 'End with a clear, low-commitment CTA'}${ctx.discoverUrl ? `\n- ${isNl ? 'Er wordt automatisch een link naar hun persoonlijke analyse-pagina toegevoegd onder de email — verwijs hier subtiel naar in je CTA (bijv. "Ik heb een korte analyse gemaakt")' : 'A link to their personalized analysis page is automatically appended below the email — subtly reference it in your CTA (e.g. "I prepared a brief analysis")'}` : ''}
- ${isNl ? 'Gebruik u/uw (formeel)' : 'Use formal tone'}

${HTML_INSTRUCTIONS}

${isNl ? 'Antwoord' : 'Respond'} with JSON:
{
  "subject": "${isNl ? "Kort, pakkend onderwerp (geen emoji's)" : 'Short, compelling subject (no emojis)'}",
  "bodyHtml": "${isNl ? 'Volledige email in HTML met paragraph spacing' : 'Full email in HTML with paragraph spacing'}",
  "bodyText": "${isNl ? 'Platte tekst versie' : 'Plain text version'}",
  "personalizedOpener": "${isNl ? 'De openingszin' : 'The opening line'}",
  "callToAction": "${isNl ? 'De gebruikte CTA' : 'The CTA used'}"
}`;
}

// ── Follow-Up ────────────────────────────────────────────────────────

export function buildFollowUpPrompt(
  ctx: OutreachContext,
  previousSubject: string,
): string {
  const s = getSender(ctx);
  const isNl = s.language === 'nl';

  return `${isNl ? `Je schrijft een follow-up email van ${s.fromName} bij ${s.company}. De ontvanger heeft niet gereageerd.` : `You are writing a follow-up email from ${s.fromName} at ${s.company}. The recipient hasn't replied.`}

${isNl ? 'OVER ONS' : 'ABOUT US'}:
${s.companyPitch}

${isNl ? 'ONTVANGER' : 'RECIPIENT'}:
- ${isNl ? 'Naam' : 'Name'}: ${ctx.contact.firstName} ${ctx.contact.lastName}
- ${isNl ? 'Functie' : 'Title'}: ${ctx.contact.jobTitle ?? (isNl ? 'Onbekend' : 'Unknown')}

${isNl ? 'HUN BEDRIJF' : 'THEIR COMPANY'}:
- ${isNl ? 'Naam' : 'Name'}: ${ctx.company.companyName}
- ${isNl ? 'Industrie' : 'Industry'}: ${ctx.company.industry ?? (isNl ? 'Algemeen' : 'General')}
- ${isNl ? 'Beschrijving' : 'Description'}: ${ctx.company.description ?? (isNl ? 'Niet beschikbaar' : 'Not available')}

${isNl ? 'VORIG ONDERWERP' : 'PREVIOUS SUBJECT'}: "${previousSubject}"

${
  ctx.evidence && ctx.evidence.length > 0
    ? `
${isNl ? 'BEWIJS UIT PROSPECT-ONDERZOEK' : 'EVIDENCE FROM PROSPECT RESEARCH'}:
${ctx.evidence
  .slice(0, 8)
  .map(
    (e) =>
      `- [${e.sourceType}] ${e.title ? e.title + ': ' : ''}${e.snippet.slice(0, 200)}`,
  )
  .join('\n')}
`
    : ''
}${
    ctx.hypotheses && ctx.hypotheses.length > 0
      ? `
${isNl ? 'PIJNPUNTEN (GEVALIDEERDE HYPOTHESEN)' : 'PAIN POINTS (VALIDATED HYPOTHESES)'}:
${ctx.hypotheses.map((h) => `- ${h.title}: ${h.problemStatement}`).join('\n')}
`
      : ''
  }
${toneInstructions(s)}

${isNl ? 'REGELS' : 'RULES'}:
- ${isNl ? 'Maximaal 100 woorden' : 'Maximum 100 words'}
- ${isNl ? 'Verwijs kort naar de vorige email' : 'Briefly reference the previous email'}
- ${isNl ? 'Voeg ÉÉN nieuwe invalshoek toe' : 'Add ONE new value angle'}
- ${isNl ? 'Andere CTA dan de originele' : 'Different CTA than the original'}${ctx.discoverUrl ? `\n- ${isNl ? 'Er wordt automatisch een link naar hun persoonlijke analyse-pagina toegevoegd — verwijs hier subtiel naar' : 'A link to their personalized analysis page is automatically appended — subtly reference it'}` : ''}

${HTML_INSTRUCTIONS}

${isNl ? 'Antwoord' : 'Respond'} with JSON:
{
  "subject": "Re: ${previousSubject}",
  "bodyHtml": "${isNl ? 'Volledige email in HTML' : 'Full email in HTML'}",
  "bodyText": "${isNl ? 'Platte tekst versie' : 'Plain text version'}",
  "personalizedOpener": "${isNl ? 'Openingszin' : 'Opening line'}",
  "callToAction": "${isNl ? 'De CTA' : 'The CTA'}"
}`;
}

// ── Signal-Triggered ─────────────────────────────────────────────────

export function buildSignalTriggeredPrompt(ctx: OutreachContext): string {
  if (!ctx.signal) throw new Error('Signal context required');
  const s = getSender(ctx);
  const isNl = s.language === 'nl';

  const signalMessagesNl: Record<string, string> = {
    JOB_CHANGE: `${ctx.contact.firstName} is recent van functie gewisseld. Feliciteer en introduceer ${s.company}.`,
    PROMOTION: `${ctx.contact.firstName} is gepromoveerd. Feliciteer en suggereer hoe ${s.company} kan helpen.`,
    FUNDING_EVENT: `${ctx.company.companyName} heeft funding ontvangen. Suggereer hoe ${s.company} kan helpen bij opschaling.`,
    HEADCOUNT_GROWTH: `${ctx.company.companyName} groeit in personeel. Suggereer hoe ${s.company} kan helpen.`,
    TECHNOLOGY_ADOPTION: `${ctx.company.companyName} heeft nieuwe technologie geadopteerd. Verbind aan ${s.company}.`,
  };

  const signalMessagesEn: Record<string, string> = {
    JOB_CHANGE: `${ctx.contact.firstName} recently changed roles. Congratulate and introduce ${s.company}.`,
    PROMOTION: `${ctx.contact.firstName} was promoted. Congratulate and suggest how ${s.company} can help.`,
    FUNDING_EVENT: `${ctx.company.companyName} received funding. Suggest how ${s.company} can help them scale.`,
    HEADCOUNT_GROWTH: `${ctx.company.companyName} is growing. Suggest how ${s.company} can help scale efficiently.`,
    TECHNOLOGY_ADOPTION: `${ctx.company.companyName} adopted new technology. Connect to ${s.company}.`,
  };

  const messages = isNl ? signalMessagesNl : signalMessagesEn;
  const context =
    messages[ctx.signal.signalType] ??
    (isNl
      ? `Er is een relevant koopsignaal gedetecteerd. Personaliseer de outreach.`
      : `A relevant buying signal was detected. Personalize the outreach.`);

  return `${isNl ? `Je schrijft een signaal-getriggerde outreach email van ${s.fromName} bij ${s.company}.` : `You are writing a signal-triggered outreach email from ${s.fromName} at ${s.company}.`}

${context}

${isNl ? 'SIGNAAL' : 'SIGNAL'}: ${ctx.signal.title}
${ctx.signal.description ? `Details: ${ctx.signal.description}` : ''}

${isNl ? 'ONTVANGER' : 'RECIPIENT'}:
- ${isNl ? 'Naam' : 'Name'}: ${ctx.contact.firstName} ${ctx.contact.lastName}
- ${isNl ? 'Functie' : 'Title'}: ${ctx.contact.jobTitle ?? (isNl ? 'Onbekend' : 'Unknown')}

${isNl ? 'HUN BEDRIJF' : 'THEIR COMPANY'}:
- ${isNl ? 'Naam' : 'Name'}: ${ctx.company.companyName}
- ${isNl ? 'Industrie' : 'Industry'}: ${ctx.company.industry ?? (isNl ? 'Algemeen' : 'General')}

${toneInstructions(s)}

${isNl ? 'REGELS' : 'RULES'}:
- ${isNl ? 'Maximaal 120 woorden' : 'Maximum 120 words'}
- ${isNl ? 'Open met het signaal' : 'Lead with the signal'}
- ${isNl ? 'Natuurlijke overgang naar hoe ' + s.company + ' kan helpen' : 'Natural transition to how ' + s.company + ' can help'}
- ${isNl ? 'Laagdrempelige CTA' : 'Low-pressure CTA'}${ctx.discoverUrl ? `\n- ${isNl ? 'Er wordt automatisch een link naar hun persoonlijke analyse-pagina toegevoegd — verwijs hier subtiel naar' : 'A link to their personalized analysis page is automatically appended — subtly reference it'}` : ''}

${HTML_INSTRUCTIONS}

${isNl ? 'Antwoord' : 'Respond'} with JSON:
{
  "subject": "${isNl ? 'Pakkend onderwerp' : 'Compelling subject'} (${isNl ? "geen emoji's" : 'no emojis'})",
  "bodyHtml": "${isNl ? 'Volledige email in HTML' : 'Full email in HTML'}",
  "bodyText": "${isNl ? 'Platte tekst versie' : 'Plain text version'}",
  "personalizedOpener": "${isNl ? 'Openingszin' : 'Opening line'}",
  "callToAction": "${isNl ? 'De CTA' : 'The CTA'}"
}`;
}
