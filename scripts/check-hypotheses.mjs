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

    const run = await prisma.researchRun.findFirst({
      where: { prospectId: prospect.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });

    if (!run) {
      console.log(domain + ': no run');
      continue;
    }

    const hypotheses = await prisma.workflowHypothesis.findMany({
      where: { researchRunId: run.id },
      select: { title: true, problemStatement: true, confidenceScore: true },
    });

    console.log('\n=== ' + domain + ' (' + (prospect.industry || 'unknown industry') + ') ===');
    console.log('Company: ' + prospect.companyName);
    for (const h of hypotheses) {
      console.log('  [' + h.confidenceScore.toFixed(2) + '] ' + h.title);
      console.log('     ' + h.problemStatement.slice(0, 150));
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
