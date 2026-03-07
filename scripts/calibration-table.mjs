import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const prospects = await db.prospect.findMany({
  include: {
    researchRuns: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        evidenceItems: { select: { sourceType: true, confidenceScore: true } },
      },
    },
  },
});

console.log('\n--- QUALITY CALIBRATION TABLE (post-pipeline-expansion) ---\n');
console.log(
  'Prospect'.padEnd(35) +
    'EvidCt'.padEnd(8) +
    'SrcTypes'.padEnd(10) +
    'AvgConf'.padEnd(10) +
    'Types'.padEnd(40) +
    'Tier (3=green)',
);
console.log('-'.repeat(115));

for (const p of prospects) {
  const run = p.researchRuns[0];
  if (!run) {
    console.log(
      (p.companyName || p.domain || 'unknown').padEnd(35) + 'No data',
    );
    continue;
  }
  const items = run.evidenceItems;
  const evidCt = items.length;
  const typeSet = new Set(items.map((e) => e.sourceType));
  const srcTypes = typeSet.size;
  const avgConf =
    items.length > 0
      ? (
          items.reduce((s, e) => s + e.confidenceScore, 0) / items.length
        ).toFixed(2)
      : '0';
  const tier =
    evidCt < 3 || srcTypes < 1
      ? 'RED'
      : srcTypes < 3 || parseFloat(avgConf) < 0.65
        ? 'AMBER'
        : 'GREEN';
  const typeList = [...typeSet].sort().join(', ');
  console.log(
    (p.companyName || p.domain || 'unknown').padEnd(35) +
      String(evidCt).padEnd(8) +
      String(srcTypes).padEnd(10) +
      String(avgConf).padEnd(10) +
      typeList.padEnd(40) +
      tier,
  );
}
console.log('\n');

await db.$disconnect();
await pool.end();
