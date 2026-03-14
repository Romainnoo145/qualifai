import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@/env.mjs';
import { outreachEmailSchema, type OutreachEmail } from './outreach-schemas';
import {
  buildIntroEmailPrompt,
  buildFollowUpPrompt,
  buildSignalTriggeredPrompt,
  getSignatureHtml,
  getSignatureText,
  getSender,
  type OutreachContext,
} from './outreach-prompts';

let genai: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genai) {
    genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!);
  }
  return genai;
}

function buildSystemInstruction(ctx: OutreachContext): string {
  const s = getSender(ctx);
  return s.language === 'nl'
    ? `Je bent een expert B2B sales copywriter voor ${s.company}. Je schrijft gepersonaliseerde, data-gedreven outreach emails in het Nederlands. Geef altijd valide JSON terug die exact overeenkomt met het gevraagde schema. Geen markdown code fences.`
    : `You are an expert B2B sales copywriter for ${s.company}. You write personalized, data-driven outreach emails in English. Always return valid JSON matching the requested schema exactly. No markdown code fences.`;
}

async function generateJSON<T>(
  prompt: string,
  schema: { parse: (data: unknown) => T },
  ctx: OutreachContext,
): Promise<T> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: buildSystemInstruction(ctx),
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);
  return schema.parse(parsed);
}

// Strip any AI-generated sign-off that would duplicate the real signature
function stripTrailingSignature(text: string): string {
  return text
    .replace(
      /\s*<p[^>]*>\s*(Met vriendelijke groet|Kind regards|Best regards|Sincerely),?.*?<\/p>(\s*<p[^>]*>\s*\S.*?<\/p>)*\s*$/is,
      '',
    )
    .replace(
      /\s*(Met vriendelijke groet|Kind regards|Best regards|Sincerely),?\s*([\n\r]+\S.*)*\s*$/is,
      '',
    );
}

function withSignature(
  email: OutreachEmail,
  ctx: OutreachContext,
): OutreachEmail {
  return {
    ...email,
    bodyHtml: `${stripTrailingSignature(email.bodyHtml)}${getSignatureHtml(ctx)}`,
    bodyText: `${stripTrailingSignature(email.bodyText)}${getSignatureText(ctx)}`,
  };
}

export async function generateIntroEmail(
  ctx: OutreachContext,
): Promise<OutreachEmail> {
  const email = await generateJSON(
    buildIntroEmailPrompt(ctx),
    outreachEmailSchema,
    ctx,
  );
  return withSignature(email, ctx);
}

export async function generateFollowUp(
  ctx: OutreachContext,
  previousSubject: string,
): Promise<OutreachEmail> {
  const email = await generateJSON(
    buildFollowUpPrompt(ctx, previousSubject),
    outreachEmailSchema,
    ctx,
  );
  return withSignature(email, ctx);
}

export async function generateSignalEmail(
  ctx: OutreachContext,
): Promise<OutreachEmail> {
  const email = await generateJSON(
    buildSignalTriggeredPrompt(ctx),
    outreachEmailSchema,
    ctx,
  );
  return withSignature(email, ctx);
}
