/**
 * Temporary script: generate Klarifai narrative analysis for Mujjo
 * using existing evidence + use cases. No re-scraping needed.
 *
 * Usage: npx tsx scripts/tmp-run-klarifai-narrative.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { generateKlarifaiNarrativeAnalysis } from '../lib/analysis/master-analyzer';
import type {
  KlarifaiNarrativeInput,
  EvidenceItem,
  CrossProspectConnection,
} from '../lib/analysis/types';

const PROSPECT_SLUG = '3Bi1vv2M'; // Mujjo

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as never);

  // 1. Fetch prospect
  const prospect = await db.prospect.findUnique({
    where: { slug: PROSPECT_SLUG },
    include: { project: true },
  });
  if (!prospect) throw new Error(`Prospect ${PROSPECT_SLUG} not found`);
  console.log(`Prospect: ${prospect.companyName} (${prospect.domain})`);

  // 2. Fetch latest completed research run
  const run = await db.researchRun.findFirst({
    where: { prospectId: prospect.id, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!run) throw new Error('No completed research run found');
  console.log(`Research run: ${run.id} (${run.createdAt.toISOString()})`);

  // 3. Fetch evidence items
  const evidenceRecords = await db.evidenceItem.findMany({
    where: { researchRunId: run.id },
    orderBy: { confidenceScore: 'desc' },
  });
  console.log(`Evidence items: ${evidenceRecords.length}`);

  // 4. Fetch use cases
  const useCases = await db.useCase.findMany({
    where: {
      projectId: prospect.project.id,
      isActive: true,
      isShipped: true,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      category: true,
      outcomes: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  console.log(`Use cases: ${useCases.length}`);

  if (useCases.length === 0) {
    console.error(
      'No active/shipped use cases found — narrative needs use cases as domain knowledge',
    );
    process.exit(1);
  }

  // 5. Map evidence
  const evidenceItems: EvidenceItem[] = evidenceRecords
    .filter((item) => item.sourceType !== 'RAG_DOCUMENT')
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 60)
    .map((item) => ({
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      title: item.title,
      snippet: item.snippet,
      confidenceScore: item.confidenceScore,
      workflowTag: item.workflowTag,
    }));

  // 6. Cross-prospect connections
  const crossConnections: CrossProspectConnection[] = [];
  const otherProspects = await db.prospect.findMany({
    where: { projectId: prospect.project.id, id: { not: prospect.id } },
    select: { id: true, companyName: true, domain: true },
  });
  for (const other of otherProspects) {
    const name = other.companyName ?? other.domain;
    if (name.length < 3) continue;
    const nameLower = name.toLowerCase();
    const match = evidenceRecords.find(
      (e) =>
        e.snippet.toLowerCase().includes(nameLower) ||
        (e.title?.toLowerCase().includes(nameLower) ?? false),
    );
    if (match) {
      crossConnections.push({
        companyName: name,
        relationship: 'prospect',
        evidenceSnippet: match.snippet.slice(0, 200),
      });
    }
  }
  console.log(`Cross-connections: ${crossConnections.length}`);

  // 7. Build input
  const klarifaiInput: KlarifaiNarrativeInput = {
    evidence: evidenceItems,
    useCases: useCases.map((uc) => ({
      id: uc.id,
      title: uc.title,
      summary: uc.summary,
      category: uc.category,
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
    crossConnections,
  };

  console.log('\nGenerating Klarifai narrative analysis...');
  const result = await generateKlarifaiNarrativeAnalysis(klarifaiInput);

  console.log(
    `\n✓ Generated: ${result.sections.length} sections, ${result.useCaseRecommendations.length} use case recommendations`,
  );
  console.log(`  Model: ${result.modelUsed}`);
  console.log(`  Opening hook: ${result.openingHook.slice(0, 100)}...`);

  // 8. Persist to DB
  await db.prospectAnalysis.create({
    data: {
      researchRunId: run.id,
      prospectId: prospect.id,
      version: 'analysis-v2',
      content: result as never,
      modelUsed: result.modelUsed,
      inputSnapshot: {
        evidenceCount: evidenceItems.length,
        useCaseCount: useCases.length,
        crossConnectionCount: crossConnections.length,
      } as never,
    },
  });

  console.log('✓ Saved to ProspectAnalysis table');

  await db.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
