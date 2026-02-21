import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';

const evidenceSchema = z.object({
  sourceType: z.enum([
    'WEBSITE',
    'DOCS',
    'CAREERS',
    'HELP_CENTER',
    'JOB_BOARD',
    'REVIEWS',
    'MANUAL_URL',
  ]),
  sourceUrl: z.string().url(),
  title: z.string().optional(),
  snippet: z.string(),
  workflowTag: z.string(),
  confidenceScore: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const hypothesisSchema = z.object({
  title: z.string(),
  problemStatement: z.string(),
  assumptions: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).default([]),
  validationQuestions: z.array(z.string()).default([]),
  hoursSavedWeekLow: z.number().int().nonnegative().optional(),
  hoursSavedWeekMid: z.number().int().nonnegative().optional(),
  hoursSavedWeekHigh: z.number().int().nonnegative().optional(),
  handoffSpeedGainPct: z.number().nonnegative().optional(),
  errorReductionPct: z.number().nonnegative().optional(),
  revenueLeakageRecoveredLow: z.number().nonnegative().optional(),
  revenueLeakageRecoveredMid: z.number().nonnegative().optional(),
  revenueLeakageRecoveredHigh: z.number().nonnegative().optional(),
});

const opportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  assumptions: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).default([]),
  hoursSavedWeekLow: z.number().int().nonnegative().optional(),
  hoursSavedWeekMid: z.number().int().nonnegative().optional(),
  hoursSavedWeekHigh: z.number().int().nonnegative().optional(),
  handoffSpeedGainPct: z.number().nonnegative().optional(),
  errorReductionPct: z.number().nonnegative().optional(),
  revenueLeakageRecoveredLow: z.number().nonnegative().optional(),
  revenueLeakageRecoveredMid: z.number().nonnegative().optional(),
  revenueLeakageRecoveredHigh: z.number().nonnegative().optional(),
});

const payloadSchema = z.object({
  runId: z.string(),
  status: z.enum([
    'PENDING',
    'CRAWLING',
    'EXTRACTING',
    'HYPOTHESIS',
    'BRIEFING',
    'FAILED',
    'COMPLETED',
  ]),
  summary: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  evidence: z.array(evidenceSchema).optional(),
  hypotheses: z.array(hypothesisSchema).optional(),
  opportunities: z.array(opportunitySchema).optional(),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isSignatureValid(rawBody: string, signature: string): boolean {
  if (!env.WORKER_SHARED_SECRET) return false;
  const expected = createHmac('sha256', env.WORKER_SHARED_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-worker-signature');
  if (!signature || !isSignatureValid(await req.clone().text(), signature)) {
    return NextResponse.json(
      { error: 'Invalid worker signature' },
      { status: 401 },
    );
  }

  try {
    const payload = payloadSchema.parse(await req.json());
    const run = await prisma.researchRun.findUnique({
      where: { id: payload.runId },
    });
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    await prisma.researchRun.update({
      where: { id: payload.runId },
      data: {
        status: payload.status,
        error: payload.error,
        summary: payload.summary ? toJson(payload.summary) : undefined,
        completedAt: payload.status === 'COMPLETED' ? new Date() : null,
      },
    });

    if (payload.evidence) {
      await prisma.evidenceItem.deleteMany({
        where: { researchRunId: payload.runId },
      });
      for (const evidence of payload.evidence) {
        await prisma.evidenceItem.create({
          data: {
            researchRunId: payload.runId,
            prospectId: run.prospectId,
            sourceType: evidence.sourceType,
            sourceUrl: evidence.sourceUrl,
            title: evidence.title,
            snippet: evidence.snippet,
            workflowTag: evidence.workflowTag,
            confidenceScore: evidence.confidenceScore,
            metadata: evidence.metadata ? toJson(evidence.metadata) : undefined,
          },
        });
      }
    }

    if (payload.hypotheses) {
      await prisma.workflowHypothesis.deleteMany({
        where: { researchRunId: payload.runId },
      });
      for (const hypothesis of payload.hypotheses) {
        await prisma.workflowHypothesis.create({
          data: {
            researchRunId: payload.runId,
            prospectId: run.prospectId,
            title: hypothesis.title,
            problemStatement: hypothesis.problemStatement,
            assumptions: hypothesis.assumptions,
            confidenceScore: hypothesis.confidenceScore,
            evidenceRefs: hypothesis.evidenceRefs,
            validationQuestions: hypothesis.validationQuestions,
            hoursSavedWeekLow: hypothesis.hoursSavedWeekLow,
            hoursSavedWeekMid: hypothesis.hoursSavedWeekMid,
            hoursSavedWeekHigh: hypothesis.hoursSavedWeekHigh,
            handoffSpeedGainPct: hypothesis.handoffSpeedGainPct,
            errorReductionPct: hypothesis.errorReductionPct,
            revenueLeakageRecoveredLow: hypothesis.revenueLeakageRecoveredLow,
            revenueLeakageRecoveredMid: hypothesis.revenueLeakageRecoveredMid,
            revenueLeakageRecoveredHigh: hypothesis.revenueLeakageRecoveredHigh,
          },
        });
      }
    }

    if (payload.opportunities) {
      await prisma.automationOpportunity.deleteMany({
        where: { researchRunId: payload.runId },
      });
      for (const opportunity of payload.opportunities) {
        await prisma.automationOpportunity.create({
          data: {
            researchRunId: payload.runId,
            prospectId: run.prospectId,
            title: opportunity.title,
            description: opportunity.description,
            assumptions: opportunity.assumptions,
            confidenceScore: opportunity.confidenceScore,
            evidenceRefs: opportunity.evidenceRefs,
            hoursSavedWeekLow: opportunity.hoursSavedWeekLow,
            hoursSavedWeekMid: opportunity.hoursSavedWeekMid,
            hoursSavedWeekHigh: opportunity.hoursSavedWeekHigh,
            handoffSpeedGainPct: opportunity.handoffSpeedGainPct,
            errorReductionPct: opportunity.errorReductionPct,
            revenueLeakageRecoveredLow: opportunity.revenueLeakageRecoveredLow,
            revenueLeakageRecoveredMid: opportunity.revenueLeakageRecoveredMid,
            revenueLeakageRecoveredHigh:
              opportunity.revenueLeakageRecoveredHigh,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('research callback error', error);
    return NextResponse.json(
      { error: 'Invalid callback payload' },
      { status: 400 },
    );
  }
}
