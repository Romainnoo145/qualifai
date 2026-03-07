import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const targetDomains = [
  'hydrogen-central.com',
  'deondernemer.nl',
  'motiondesignawards.com',
  'us3consulting.co.uk',
  'cybersecuritydistrict.com',
];

async function main() {
  for (const domain of targetDomains) {
    const prospect = await prisma.prospect.findFirst({
      where: { domain },
      select: { id: true, domain: true, companyName: true, industry: true },
    });
    if (!prospect) {
      console.log(domain + ': NOT FOUND');
      continue;
    }

    const runs = await prisma.researchRun.findMany({
      where: { prospectId: prospect.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, status: true },
    });

    console.log('\n=== ' + domain + ' — ' + runs.length + ' runs ===');
    for (const run of runs) {
      const hyps = await prisma.workflowHypothesis.findMany({
        where: { researchRunId: run.id },
        select: { title: true },
      });
      console.log('  Run ' + run.id.slice(-8) + ' (' + run.status + ') @ ' + run.createdAt.toISOString());
      for (const h of hyps) {
        console.log('    - ' + h.title);
      }
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
