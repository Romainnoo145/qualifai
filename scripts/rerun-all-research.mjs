import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { executeResearchRun } from '../lib/research-executor.ts';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const prospects = await db.prospect.findMany({
  select: { id: true, companyName: true, domain: true },
});

console.log(`Re-running research for ${prospects.length} prospects with full pipeline...\n`);

for (const p of prospects) {
  const name = p.companyName || p.domain;
  console.log(`--- ${name} ---`);
  try {
    const result = await executeResearchRun(db, {
      prospectId: p.id,
      deepCrawl: true,
    });
    const summary = result.summary;
    const gate = summary?.gate;
    const sourceTypes = gate?.sourceTypeCount ?? '?';
    const evidCount = gate?.evidenceCount ?? '?';
    console.log(`  Status: ${result.status} | Evidence: ${evidCount} | Source types: ${sourceTypes}`);
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }
  console.log('');
}

console.log('Done. All research re-runs complete.');
await db.$disconnect();
await pool.end();
