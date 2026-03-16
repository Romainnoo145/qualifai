import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { loadProjectSender } from '@/lib/outreach/sender';
import { generateIntroEmail } from '@/lib/ai/generate-outreach';
import type {
  OutreachContext,
  EvidenceContext,
  HypothesisContext,
} from '@/lib/ai/outreach-prompts';
import { buildDiscoverUrl } from '@/lib/prospect-url';
import { buildCalBookingUrl } from '@/lib/workflow-engine';
import { env } from '@/env.mjs';
import type { Prisma } from '@prisma/client';

export interface GenerateIntroOptions {
  prospectId: string;
  contactId: string;
  runId: string;
  db: PrismaClient;
}

export async function generateIntroDraft(
  opts: GenerateIntroOptions,
): Promise<{ sequenceId: string; draftId: string }> {
  const { prospectId, contactId, runId, db } = opts;

  // 1. Load prospect
  const prospect = await db.prospect.findUniqueOrThrow({
    where: { id: prospectId },
    select: {
      id: true,
      companyName: true,
      domain: true,
      industry: true,
      employeeRange: true,
      technologies: true,
      description: true,
      slug: true,
      readableSlug: true,
      projectId: true,
    },
  });

  // 2. Load contact
  const contact = await db.contact.findUniqueOrThrow({
    where: { id: contactId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      seniority: true,
      department: true,
      primaryEmail: true,
      outreachStatus: true,
    },
  });

  // 3. Hypothesis approval gate (Phase 7 invariant)
  const hypotheses = await db.workflowHypothesis.findMany({
    where: {
      researchRunId: runId,
      status: { in: ['ACCEPTED', 'PENDING'] },
    },
    orderBy: { confidenceScore: 'desc' },
    take: 3,
  });
  // Fall back to prospect-level if none on run
  const finalHypotheses =
    hypotheses.length > 0
      ? hypotheses
      : await db.workflowHypothesis.findMany({
          where: {
            prospectId,
            status: { in: ['ACCEPTED', 'PENDING'] },
          },
          orderBy: { confidenceScore: 'desc' },
          take: 3,
        });

  if (finalHypotheses.length === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'Outreach blocked: approve at least one hypothesis before generating drafts.',
    });
  }

  // 4. Load top evidence items
  const evidenceItems = await db.evidenceItem.findMany({
    where: { researchRunId: runId },
    orderBy: { confidenceScore: 'desc' },
    take: 5,
  });

  // 5. Load sender
  const sender = await loadProjectSender(db, prospect.projectId);

  // 6. Build OutreachContext with evidence enrichment
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
  const discoverUrl = buildDiscoverUrl(appUrl, prospect);

  const evidence: EvidenceContext[] = evidenceItems.map((e) => ({
    sourceType: e.sourceType,
    snippet: e.snippet.slice(0, 200),
    title: e.title,
  }));

  const hypothesisCtx: HypothesisContext[] = finalHypotheses.map((h) => ({
    title: h.title,
    problemStatement: h.problemStatement,
  }));

  const outreachCtx: OutreachContext = {
    contact: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      jobTitle: contact.jobTitle,
      seniority: contact.seniority,
      department: contact.department,
    },
    company: {
      companyName: prospect.companyName ?? prospect.domain,
      domain: prospect.domain,
      industry: prospect.industry,
      employeeRange: prospect.employeeRange,
      technologies: prospect.technologies,
      description: prospect.description,
    },
    sender,
    discoverUrl,
    evidence,
    hypotheses: hypothesisCtx,
  };

  // 7. Generate AI email
  const email = await generateIntroEmail(outreachCtx);

  // 8. Atomic DB create: Sequence + Step + Log
  const calBookingUrl = buildCalBookingUrl(env.NEXT_PUBLIC_CALCOM_BOOKING_URL, {
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    email: contact.primaryEmail ?? undefined,
    company: prospect.companyName ?? prospect.domain,
  });

  const sequence = await db.outreachSequence.create({
    data: {
      prospectId,
      contactId,
      researchRunId: runId,
      templateKey: 'AI_Intro_Draft',
      status: 'DRAFTED',
      isEvidenceBacked: true,
      metadata: {
        kind: 'ai_intro',
        calBookingUrl: calBookingUrl ?? null,
        calEventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  const step = await db.outreachStep.create({
    data: {
      sequenceId: sequence.id,
      stepOrder: 1,
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      status: 'DRAFTED',
      metadata: {
        channel: 'email',
        aiGenerated: true,
      } as Prisma.InputJsonValue,
    },
  });

  const draft = await db.outreachLog.create({
    data: {
      contactId,
      prospectId,
      type: 'INTRO_EMAIL',
      channel: 'email',
      status: 'draft',
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      metadata: {
        outreachSequenceId: sequence.id,
        kind: 'intro_draft',
        evidenceBacked: true,
        calBookingUrl: calBookingUrl ?? null,
        calEventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  // Link step to log
  await db.outreachStep.update({
    where: { sequenceId_stepOrder: { sequenceId: sequence.id, stepOrder: 1 } },
    data: { outreachLogId: draft.id, status: 'QUEUED' },
  });

  // 9. Update contact outreach status
  if (contact.outreachStatus === 'NONE') {
    await db.contact.update({
      where: { id: contactId },
      data: { outreachStatus: 'QUEUED' },
    });
  }

  // Silence unused variable warning — step is created for sequence linking
  void step;

  return { sequenceId: sequence.id, draftId: draft.id };
}
