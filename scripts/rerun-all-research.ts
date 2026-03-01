import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { executeResearchRun } from '../lib/research-executor';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter }) as any;

  const prospects = await db.prospect.findMany({
    select: { id: true, companyName: true, domain: true },
  });

  console.log(
    `Re-running research for ${prospects.length} prospects with full pipeline...\n`,
  );

  for (const p of prospects) {
    const name = p.companyName || p.domain;
    console.log(`--- ${name} ---`);
    try {
      const result = await executeResearchRun(db, {
        prospectId: p.id,
        manualUrls: [],
        deepCrawl: true,
      });
      console.log(
        `  Evidence: ${result.counts.evidence} | Hypotheses: ${result.counts.hypotheses} | Opportunities: ${result.counts.opportunities}`,
      );
      console.log(
        `  Gate passed: ${result.gate.passed} | Avg confidence: ${result.gate.averageConfidence} | Source types: ${result.gate.sourceTypeCount}`,
      );
      if (result.gate.reasons.length > 0) {
        console.log(`  Reasons: ${result.gate.reasons.join('; ')}`);
      }
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}`);
      console.error(err.stack);
    }
    console.log('');
  }

  console.log('Done. All research re-runs complete.');
  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
