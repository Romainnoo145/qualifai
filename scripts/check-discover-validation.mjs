import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Mujjo prospect slug — the only prospect with ENGAGED status allowing /discover/ access
const PROSPECT_SLUG = '3Bi1vv2M';

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { slug: PROSPECT_SLUG },
    select: { id: true, companyName: true, domain: true, status: true },
  });

  if (!prospect) {
    console.error('ERROR: Prospect with slug ' + PROSPECT_SLUG + ' not found');
    process.exit(1);
  }

  console.log('\n=== /discover/ Validation Check ===');
  console.log('Prospect: ' + (prospect.companyName || prospect.domain) + ' (slug: ' + PROSPECT_SLUG + ')');
  console.log('Status:   ' + prospect.status);

  const hyps = await prisma.workflowHypothesis.findMany({
    where: { prospectId: prospect.id },
    select: { id: true, title: true, status: true, confidenceScore: true },
    orderBy: { confidenceScore: 'desc' },
  });

  if (hyps.length === 0) {
    console.error('\nERROR: No hypotheses found for this prospect');
    process.exit(1);
  }

  // Print table header
  console.log('\n' + 'ID'.padEnd(10) + 'Status'.padEnd(12) + 'Conf'.padEnd(8) + 'Title');
  console.log('-'.repeat(90));

  for (const h of hyps) {
    const id = h.id.slice(0, 8);
    const status = h.status.padEnd(12);
    const conf = h.confidenceScore.toFixed(2).padEnd(8);
    const title = h.title.slice(0, 60);
    console.log(id.padEnd(10) + status + conf + title);
  }

  // Assertions
  console.log('\n--- Assertions ---');

  let allPassed = true;

  const accepted = hyps.filter((h) => h.status === 'ACCEPTED');
  if (accepted.length >= 1) {
    console.log('PASS  At least one hypothesis ACCEPTED (' + accepted.length + ' found)');
    for (const h of accepted) {
      console.log('      - ' + h.id.slice(0, 8) + ': ' + h.title.slice(0, 60));
    }
  } else {
    console.log('FAIL  No hypothesis with status ACCEPTED found');
    console.log('      Run /discover/' + PROSPECT_SLUG + ' in browser and confirm at least one hypothesis');
    allPassed = false;
  }

  const declined = hyps.filter((h) => h.status === 'DECLINED');
  if (declined.length >= 1) {
    console.log('PASS  At least one hypothesis DECLINED (' + declined.length + ' found)');
    for (const h of declined) {
      console.log('      - ' + h.id.slice(0, 8) + ': ' + h.title.slice(0, 60));
    }
  } else {
    console.log('FAIL  No hypothesis with status DECLINED found');
    console.log('      Run /discover/' + PROSPECT_SLUG + ' in browser and decline at least one hypothesis');
    allPassed = false;
  }

  console.log('\n--- Result ---');
  if (allPassed) {
    console.log('ALL ASSERTIONS PASSED — /discover/ validation flow confirmed working\n');
  } else {
    console.log('ASSERTIONS FAILED — complete the browser session first:\n');
    console.log('  1. Open: http://localhost:9200/discover/mujjo-' + PROSPECT_SLUG);
    console.log('  2. Confirm one hypothesis (click confirm/accept button)');
    console.log('  3. Decline one hypothesis (click decline button)');
    console.log('  4. Re-run this script\n');
  }

  await prisma.$disconnect();
  await pool.end();

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
