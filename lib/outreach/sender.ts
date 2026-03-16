import type { PrismaClient } from '@prisma/client';
import type { OutreachSender } from '@/lib/ai/outreach-prompts';

/**
 * Loads outreach sender settings for a project from the database.
 * Single source of truth — used by processor.ts, outreach.ts, and engine.ts.
 */
export async function loadProjectSender(
  db: PrismaClient,
  projectId: string,
  languageOverride?: 'nl' | 'en',
): Promise<OutreachSender> {
  const project = await db.project.findFirst({
    where: { id: projectId },
    select: { metadata: true, brandName: true },
  });
  const meta = (project?.metadata ?? {}) as Record<string, unknown>;
  const o = (meta.outreach ?? {}) as Record<string, string>;
  return {
    fromName: o.fromName || 'Romano Kanters',
    company: (project?.brandName as string) || 'Klarifai',
    language: languageOverride ?? (o.language as 'nl' | 'en') ?? 'nl',
    tone: o.tone || '',
    companyPitch: o.companyPitch || '',
    signatureHtml: o.signatureHtml || '',
    signatureText: o.signatureText || '',
  };
}
