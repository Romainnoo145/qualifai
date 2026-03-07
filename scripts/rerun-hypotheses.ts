/**
 * Temporary script: re-run research on all prospects to generate AI hypotheses.
 * Run with: npx tsx scripts/rerun-hypotheses.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { executeResearchRun } from '../lib/research-executor';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const prospects = await prisma.prospect.findMany({
    select: { id: true, domain: true, companyName: true },
  });
  console.log(
    'Prospects to re-run:',
    prospects.map((p) => p.domain).join(', '),
  );

  for (const p of prospects) {
    console.log(`\n--- Running research for ${p.domain} (${p.companyName ?? 'no name'}) ---`);
    try {
      const existing = await prisma.researchRun.findFirst({
        where: { prospectId: p.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      const result = await executeResearchRun(prisma, {
        prospectId: p.id,
        manualUrls: [],
        existingRunId: existing?.id,
        deepCrawl: false,
      });

      console.log(
        `  ${p.domain} -> hypotheses: ${result.counts.hypotheses}, evidence: ${result.counts.evidence}`,
      );
    } catch (err) {
      console.error(`  ${p.domain} -> FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  await prisma.$disconnect();
  await pool.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
