import * as AppModule from '../server/routers/_app.ts';
import * as PrismaModule from '../lib/prisma.ts';

type UnknownObject = Record<string, unknown>;

type AppRouterLike = {
  createCaller: (ctx: { db: unknown; adminToken: string | null }) => {
    campaigns: {
      create: (input: {
        name: string;
        nicheKey: string;
        language: string;
        strictGate: boolean;
      }) => Promise<{ id: string; name: string }>;
      attachProspect: (input: {
        campaignId: string;
        prospectId: string;
      }) => Promise<unknown>;
      runAutopilot: (input: {
        campaignId: string;
        limit: number;
        dryRun: boolean;
        queueDrafts: boolean;
      }) => Promise<{
        scanned: number;
        completed: number;
        blockedGate: number;
        noContact: number;
        failed: number;
        results: Array<{
          prospectId: string;
          company: string;
          status: string;
          runId?: string;
          lossMapId?: string;
          sequenceId?: string;
        }>;
      }>;
    };
    outreach: {
      getDecisionInbox: (input: {
        limit: number;
      }) => Promise<{ summary: { lowRisk: number } }>;
      captureReply: (input: {
        contactId: string;
        subject?: string;
        bodyText: string;
        source: string;
        outreachSequenceId?: string;
        metadata?: Record<string, unknown>;
      }) => Promise<{ replyLogId: string }>;
      triageReply: (input: { replyLogId: string }) => Promise<{
        replyLogId: string;
        intent: string;
        suggestedAction: string;
      }>;
      getReplyInbox: (input: {
        limit: number;
        status: 'pending' | 'triaged' | 'all';
      }) => Promise<{
        summary: { total: number; pending: number; triaged: number };
      }>;
    };
  };
};

function resolveAppRouter(): AppRouterLike {
  const mod = AppModule as UnknownObject;
  const appRouter =
    (mod.appRouter as AppRouterLike | undefined) ??
    ((mod.default as UnknownObject | undefined)?.appRouter as
      | AppRouterLike
      | undefined);
  if (!appRouter || typeof appRouter.createCaller !== 'function') {
    throw new Error('Unable to resolve appRouter export');
  }
  return appRouter;
}

function resolvePrismaClient(): any {
  const mod = PrismaModule as UnknownObject;
  return ((mod.default as UnknownObject | undefined)?.default ??
    mod.default ??
    mod) as any;
}

function makeSlug(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return out;
}

function asObj(value: unknown): UnknownObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as UnknownObject;
}

function validAdminSecret(): string {
  const token = process.env.ADMIN_SECRET;
  if (!token || token.length < 8) {
    throw new Error(
      'ADMIN_SECRET is missing. Run with dotenv-loaded env vars.',
    );
  }
  return token;
}

async function ensureProspect(
  prisma: any,
): Promise<{ id: string; domain: string; companyName: string }> {
  const domain = 'example.com';
  const existing = await prisma.prospect.findFirst({
    where: { domain },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    const updated = await prisma.prospect.update({
      where: { id: existing.id },
      data: {
        companyName: existing.companyName ?? 'Smoke Bouw Installaties BV',
        industry: 'Construction',
        employeeRange: existing.employeeRange ?? '11-50',
        description:
          existing.description ??
          'Installatie- en bouwbedrijf voor utiliteit en renovatieprojecten.',
        technologies: existing.technologies?.length
          ? existing.technologies
          : ['Excel', 'Outlook'],
        specialties: existing.specialties?.length
          ? existing.specialties
          : ['Planning', 'Werkvoorbereiding', 'Service'],
      },
      select: { id: true, domain: true, companyName: true },
    });

    return {
      id: updated.id,
      domain: updated.domain,
      companyName: updated.companyName ?? 'Smoke Bouw Installaties BV',
    };
  }

  const created = await prisma.prospect.create({
    data: {
      slug: makeSlug(8),
      domain,
      companyName: 'Smoke Bouw Installaties BV',
      industry: 'Construction',
      employeeRange: '11-50',
      description:
        'Installatie- en bouwbedrijf voor utiliteit en renovatieprojecten.',
      technologies: ['Excel', 'Outlook'],
      specialties: ['Planning', 'Werkvoorbereiding', 'Service'],
      status: 'READY',
    },
    select: { id: true, domain: true, companyName: true },
  });

  return {
    id: created.id,
    domain: created.domain,
    companyName: created.companyName ?? 'Smoke Bouw Installaties BV',
  };
}

async function ensureContact(prisma: any, prospectId: string) {
  const existing = await prisma.contact.findFirst({
    where: {
      prospectId,
      primaryEmail: { not: null },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  return prisma.contact.create({
    data: {
      prospectId,
      firstName: 'Jeroen',
      lastName: 'de Vries',
      jobTitle: 'Operations Manager',
      seniority: 'owner',
      department: 'operations',
      primaryEmail: 'operations@example.com',
      emails: ['operations@example.com'],
      country: 'NL',
      city: 'Rotterdam',
    },
  });
}

async function run() {
  const appRouter = resolveAppRouter();
  const prisma = resolvePrismaClient();
  const adminToken = validAdminSecret();

  const caller = appRouter.createCaller({
    db: prisma,
    adminToken,
  });

  try {
    const campaign = await caller.campaigns.create({
      name: `Smoke Workflow Sprint ${new Date().toISOString().slice(0, 10)}`,
      nicheKey: 'construction_nl_sme',
      language: 'nl',
      strictGate: true,
    });

    const prospect = await ensureProspect(prisma);
    const contact = await ensureContact(prisma, prospect.id);

    await caller.campaigns.attachProspect({
      campaignId: campaign.id,
      prospectId: prospect.id,
    });

    const autopilot = await caller.campaigns.runAutopilot({
      campaignId: campaign.id,
      limit: 1,
      dryRun: false,
      queueDrafts: true,
    });

    const result = autopilot.results[0];
    if (
      !result ||
      result.status !== 'completed' ||
      !result.runId ||
      !result.lossMapId
    ) {
      throw new Error(
        `Autopilot did not complete. Result: ${JSON.stringify(autopilot)}`,
      );
    }

    const runRecord = await prisma.researchRun.findUniqueOrThrow({
      where: { id: result.runId },
      include: {
        evidenceItems: true,
        workflowHypotheses: true,
        automationOpportunities: true,
      },
    });

    const lossMap = await prisma.workflowLossMap.findUniqueOrThrow({
      where: { id: result.lossMapId },
    });

    const sequence = result.sequenceId
      ? await prisma.outreachSequence.findUnique({
          where: { id: result.sequenceId },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        })
      : null;

    const decisionInbox = await caller.outreach.getDecisionInbox({ limit: 50 });

    const capture = await caller.outreach.captureReply({
      contactId: contact.id,
      subject: 'Re: Workflow Loss Map',
      bodyText: 'Klinkt goed. Laten we volgende week een call plannen.',
      source: 'smoke-test',
      outreachSequenceId: result.sequenceId,
      metadata: {
        smokeTest: true,
        provider: 'manual',
      },
    });

    const triage = await caller.outreach.triageReply({
      replyLogId: capture.replyLogId,
    });

    const replyInbox = await caller.outreach.getReplyInbox({
      limit: 20,
      status: 'all',
    });

    const gate = asObj(runRecord.summary).gate as UnknownObject;
    const payload = {
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      prospect: {
        id: prospect.id,
        domain: prospect.domain,
        companyName: prospect.companyName,
      },
      contact: {
        id: contact.id,
        email: contact.primaryEmail,
      },
      autopilot: {
        scanned: autopilot.scanned,
        completed: autopilot.completed,
        blockedGate: autopilot.blockedGate,
        noContact: autopilot.noContact,
        failed: autopilot.failed,
      },
      run: {
        id: runRecord.id,
        status: runRecord.status,
        gate,
        evidenceCount: runRecord.evidenceItems.length,
        hypothesesCount: runRecord.workflowHypotheses.length,
        opportunitiesCount: runRecord.automationOpportunities.length,
      },
      lossMap: {
        id: lossMap.id,
        version: lossMap.version,
        title: lossMap.title,
        pdfUrl: lossMap.pdfUrl,
      },
      sequence: sequence
        ? {
            id: sequence.id,
            status: sequence.status,
            stepStatuses: sequence.steps.map((step: any) => ({
              order: step.stepOrder,
              status: step.status,
            })),
          }
        : null,
      replies: {
        capturedReplyLogId: capture.replyLogId,
        triage,
        inboxSummary: replyInbox.summary,
      },
      checks: {
        researchCompleted: runRecord.status === 'COMPLETED',
        gatePassed: gate?.passed === true,
        lossMapHasCta:
          typeof lossMap.markdown === 'string' &&
          lossMap.markdown.includes(
            'I made a 1-page Workflow Loss Map for your team.',
          ) &&
          lossMap.markdown.includes('Want a 15-min teardown + live mini-demo?'),
        lossMapPdfGenerated:
          typeof lossMap.pdfUrl === 'string' && lossMap.pdfUrl.length > 0,
        sequenceCreated: Boolean(sequence?.id),
        sequenceSteps: sequence?.steps.length ?? 0,
        decisionInboxLowRisk: decisionInbox.summary.lowRisk,
        triageIntent: triage.intent,
      },
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    if (typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  }
}

run().catch((error) => {
  console.error('workflow smoke failed', error);
  process.exit(1);
});
