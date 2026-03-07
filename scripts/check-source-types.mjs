import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const prospects = await db.prospect.findMany({
  include: {
    researchRuns: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        evidenceItems: { select: { sourceType: true } },
      },
    },
  },
});

console.log('Source type breakdown per prospect:\n');
for (const p of prospects) {
  const run = p.researchRuns[0];
  if (!run) continue;
  const types = {};
  run.evidenceItems.forEach((e) => {
    types[e.sourceType] = (types[e.sourceType] || 0) + 1;
  });
  const name = (p.companyName || p.domain || 'unknown').padEnd(35);
  const breakdown = Object.entries(types)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
  console.log(name + breakdown);
}

console.log('\n--- Active source types across all prospects ---');
const allTypes = new Set();
for (const p of prospects) {
  const run = p.researchRuns[0];
  if (run) run.evidenceItems.forEach((e) => allTypes.add(e.sourceType));
}
console.log([...allTypes].sort().join(', '));

console.log('\n--- Last research run dates ---');
for (const p of prospects) {
  const run = p.researchRuns[0];
  const name = (p.companyName || p.domain || 'unknown').padEnd(35);
  console.log(name + (run ? run.createdAt.toISOString().slice(0, 16) : 'No run'));
}

await db.$disconnect();
await pool.end();
