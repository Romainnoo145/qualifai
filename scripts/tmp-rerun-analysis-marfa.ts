import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { generateKlarifaiNarrativeAnalysis } from '../lib/analysis/master-analyzer';
import { generateSectionVisuals } from '../lib/analysis/visual-generator';
import { matchProofs } from '../lib/workflow-engine';
import { selectEvidenceForPrompt } from '../lib/analysis/evidence-selector';
import { industryToSector } from '../lib/constants/sectors';
import type { EvidenceItem } from '../lib/analysis/types';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: 'marfa' },
    select: {
      id: true,
      companyName: true,
      domain: true,
      industry: true,
      employeeRange: true,
      revenueRange: true,
      country: true,
      city: true,
      description: true,
      specialties: true,
      project: { select: { id: true } },
    },
  });

  if (!prospect) {
    console.error('Marfa niet gevonden');
    return;
  }

  // Get the latest research run
  const run = await prisma.researchRun.findFirst({
    where: { prospectId: prospect.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!run) {
    console.error('Geen research run gevonden — draai eerst de pipeline');
    return;
  }

  console.log(`Run: ${run.id} (${run.status})`);

  // Get evidence items for this run
  const evidenceRecords = await prisma.evidenceItem.findMany({
    where: { researchRunId: run.id },
    select: {
      sourceType: true,
      sourceUrl: true,
      title: true,
      snippet: true,
      confidenceScore: true,
      workflowTag: true,
    },
  });

  console.log(`Evidence items: ${evidenceRecords.length}`);

  const allEvidence: EvidenceItem[] = evidenceRecords
    .filter((item) => item.sourceType !== 'RAG_DOCUMENT')
    .map((item) => ({
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      title: item.title,
      snippet: item.snippet,
      confidenceScore: item.confidenceScore,
      workflowTag: item.workflowTag,
    }));

  const evidenceItems = selectEvidenceForPrompt(allEvidence);
  console.log(`Top evidence selected: ${evidenceItems.length}`);

  // Get use cases (sector-matched)
  const prospectSector = industryToSector(prospect.industry);
  const sectorUseCases = prospectSector
    ? await prisma.useCase.findMany({
        where: { isActive: true, isShipped: true, sector: prospectSector },
        select: {
          id: true,
          title: true,
          summary: true,
          category: true,
          sector: true,
          outcomes: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      })
    : [];
  const otherUseCases = await prisma.useCase.findMany({
    where: {
      isActive: true,
      isShipped: true,
      ...(prospectSector ? { sector: { not: prospectSector } } : {}),
    },
    select: {
      id: true,
      title: true,
      summary: true,
      category: true,
      sector: true,
      outcomes: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: prospectSector ? 5 : 20,
  });

  const useCases = [...sectorUseCases, ...otherUseCases];
  console.log(
    `Use cases: ${useCases.length} (sector: ${prospectSector ?? 'none'})`,
  );

  // Generate analysis
  console.log('Generating Klarifai narrative analysis...');
  const analysisResult = await generateKlarifaiNarrativeAnalysis({
    evidence: evidenceItems,
    useCases: useCases.map((uc) => ({
      id: uc.id,
      title: uc.title,
      summary: uc.summary,
      category: uc.category,
      sector: uc.sector ?? null,
      outcomes: uc.outcomes as string[],
    })),
    prospect: {
      companyName: prospect.companyName ?? prospect.domain,
      industry: prospect.industry ?? null,
      description: prospect.description ?? null,
      specialties: prospect.specialties ?? [],
      country: prospect.country ?? null,
      city: prospect.city ?? null,
      employeeRange: prospect.employeeRange ?? null,
      revenueRange: prospect.revenueRange ?? null,
    },
    crossConnections: [],
  });

  console.log(`Analysis done: ${analysisResult.sections.length} sections`);

  // matchProofs
  const narrativeQuery = [
    analysisResult.executiveSummary,
    ...analysisResult.sections.map((s) => s.title),
  ].join('. ');

  const proofMatches = await matchProofs(prisma as any, narrativeQuery, 6, {
    projectId: prospect.project.id,
    sector: prospectSector ?? undefined,
  });

  const useCaseRecommendations = proofMatches
    .filter((m) => m.score >= 0.3 && !m.isCustomPlan)
    .map((m) => ({
      useCaseTitle: m.proofTitle,
      category: '',
      relevanceNarrative: m.proofSummary ?? '',
      applicableOutcomes: [] as string[],
    }));

  for (const rec of useCaseRecommendations) {
    const fullUc = useCases.find((uc) => uc.title === rec.useCaseTitle);
    if (fullUc) {
      rec.category = fullUc.category;
      rec.applicableOutcomes = fullUc.outcomes as string[];
    }
  }

  const finalRecommendations =
    useCaseRecommendations.length > 0
      ? useCaseRecommendations
      : analysisResult.useCaseRecommendations;

  console.log(`Use case matches: ${finalRecommendations.length}`);
  finalRecommendations.forEach((r) => console.log(` - ${r.useCaseTitle}`));

  // Visual enrichment
  const finalResult = {
    ...analysisResult,
    useCaseRecommendations: finalRecommendations,
  };
  let enrichedResult = finalResult;
  try {
    const visualResults = await generateSectionVisuals(
      finalResult.sections,
      evidenceItems,
    );
    enrichedResult = {
      ...finalResult,
      sections: finalResult.sections.map((s, i) => ({
        ...s,
        ...(visualResults[i]?.visualType
          ? {
              visualType: visualResults[i].visualType,
              visualData: visualResults[i].visualData,
            }
          : {}),
      })),
    };
    console.log('Visual enrichment done');
  } catch (err) {
    console.warn('Visual enrichment failed, proceeding without:', err);
  }

  // Replace existing analysis for this run
  await prisma.prospectAnalysis.deleteMany({
    where: { researchRunId: run.id },
  });
  await prisma.prospectAnalysis.create({
    data: {
      researchRunId: run.id,
      prospectId: prospect.id,
      version: 'analysis-v2',
      content: toJson(enrichedResult),
      modelUsed: analysisResult.modelUsed,
      inputSnapshot: toJson({
        evidenceCount: evidenceItems.length,
        useCaseCount: useCases.length,
        crossConnectionCount: 0,
        recommendationSource:
          useCaseRecommendations.length > 0
            ? 'matchProofs'
            : 'masterprompt-fallback',
      }),
    },
  });

  console.log('=== KLAAR ===');
  console.log(
    'Nieuwe analyse opgeslagen. Open: http://localhost:9200/analyse/marfa',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
