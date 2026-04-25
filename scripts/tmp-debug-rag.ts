import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import {
  buildRagQueryInputs,
  retrieveRagPassages,
  rankRagPassagesForProspect,
} from '../lib/rag/retriever';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { domain: { contains: 'heijmans' } },
    select: {
      id: true,
      companyName: true,
      domain: true,
      industry: true,
      description: true,
      specialties: true,
      technologies: true,
      country: true,
      project: { select: { id: true } },
      spv: { select: { id: true, name: true } },
    },
  });

  if (!prospect) {
    console.log('No prospect');
    return;
  }

  const latestCompleted = await prisma.researchRun.findFirst({
    where: { prospectId: prospect.id, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: {
      evidenceItems: {
        where: { sourceType: { not: 'RAG_DOCUMENT' } },
        select: {
          workflowTag: true,
          snippet: true,
          confidenceScore: true,
          sourceType: true,
        },
      },
    },
  });

  const queryInputs = buildRagQueryInputs(
    {
      companyName: prospect.companyName ?? prospect.domain,
      industry: prospect.industry,
      description: prospect.description,
      specialties: prospect.specialties,
      technologies: prospect.technologies,
      country: prospect.country,
      campaignNiche: null,
      spvName: prospect.spv?.name ?? null,
      evidence: latestCompleted?.evidenceItems ?? [],
    },
    6,
  );

  console.log('queries', queryInputs.length);
  queryInputs.forEach((q, i) =>
    console.log(i + 1, q.workflowTag, q.query.slice(0, 140)),
  );

  for (const threshold of [0.2, 0.25, 0.3, 0.35, 0.4]) {
    const raw = await retrieveRagPassages(prisma as any, {
      projectId: prospect.project.id,
      spvId: prospect.spv?.id ?? null,
      queryInputs,
      limitPerQuery: 16,
      maxResults: 48,
      similarityThreshold: threshold,
    });
    const ranked = rankRagPassagesForProspect(
      raw,
      {
        companyName: prospect.companyName ?? prospect.domain,
        industry: prospect.industry,
        description: prospect.description,
        specialties: prospect.specialties,
        technologies: prospect.technologies,
        country: prospect.country,
        campaignNiche: null,
        spvName: prospect.spv?.name ?? null,
      },
      12,
    );

    const docIds = Array.from(new Set(raw.map((r) => r.documentId)));
    const rankedDocIds = Array.from(new Set(ranked.map((r) => r.documentId)));
    console.log(
      `\nthreshold ${threshold}: raw=${raw.length} docs=${docIds.length} ranked=${ranked.length} rankedDocs=${rankedDocIds.length}`,
    );
    ranked.slice(0, 8).forEach((p, i) => {
      console.log(
        `  ${i + 1}. sim=${p.similarity.toFixed(3)} ${p.documentId} | ${p.sectionHeader ?? p.documentTitle}`,
      );
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
