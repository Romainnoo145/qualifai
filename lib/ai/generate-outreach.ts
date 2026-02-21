import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@/env.mjs';
import { outreachEmailSchema, type OutreachEmail } from './outreach-schemas';
import {
  buildIntroEmailPrompt,
  buildFollowUpPrompt,
  buildSignalTriggeredPrompt,
  type OutreachContext,
} from './outreach-prompts';

let genai: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genai) {
    genai = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY!);
  }
  return genai;
}

const OUTREACH_SYSTEM =
  'You are an expert B2B sales copywriter for Klarifai, a European AI consultancy. You write personalized, data-driven outreach emails. Always output valid JSON matching the requested schema exactly. Never include markdown code fences.';

async function generateJSON<T>(
  prompt: string,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: OUTREACH_SYSTEM,
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

export async function generateIntroEmail(
  ctx: OutreachContext,
): Promise<OutreachEmail> {
  return generateJSON(buildIntroEmailPrompt(ctx), outreachEmailSchema);
}

export async function generateFollowUp(
  ctx: OutreachContext,
  previousSubject: string,
): Promise<OutreachEmail> {
  return generateJSON(
    buildFollowUpPrompt(ctx, previousSubject),
    outreachEmailSchema,
  );
}

export async function generateSignalEmail(
  ctx: OutreachContext,
): Promise<OutreachEmail> {
  return generateJSON(buildSignalTriggeredPrompt(ctx), outreachEmailSchema);
}
