/**
 * Standalone research refresh sweep — runs via crontab every 14 days.
 * Usage: npx tsx scripts/cron-research-refresh.ts [--dry-run]
 *
 * Finds all prospects with stale research (>14 days) and re-runs the full
 * pipeline including evidence collection and analysis-v2 generation.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { runResearchRefreshSweep } from '../lib/research-refresh';

const STALE_DAYS = parseInt(
  process.env.RESEARCH_REFRESH_STALE_DAYS ?? '14',
  10,
);
const LIMIT = parseInt(process.env.RESEARCH_REFRESH_LIMIT ?? '25', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log(`[cron-research-refresh] ${new Date().toISOString()}`);
  console.log(`  staleDays=${STALE_DAYS}, limit=${LIMIT}, dryRun=${DRY_RUN}`);

  const result = await runResearchRefreshSweep(prisma as any, {
    staleDays: STALE_DAYS,
    limit: LIMIT,
    dryRun: DRY_RUN,
  });

  console.log(
    `  scanned=${result.scannedProspects}, stale=${result.staleCandidates}`,
  );

  if (result.candidates.length > 0) {
    console.log('  candidates:');
    for (const c of result.candidates) {
      console.log(`    - ${c.prospectName} (${c.domain}) [${c.reason}]`);
    }
  }

  if (!DRY_RUN) {
    console.log(`  executed=${result.executed}, failed=${result.failed}`);
    console.log(
      `  signalsDetected=${result.signalsDetected}, draftsCreated=${result.draftsCreated}`,
    );
    for (const e of result.executions) {
      const status = e.ok ? 'OK' : `FAILED: ${e.error}`;
      console.log(`    - ${e.prospectId}: ${status}`);
    }
  }

  console.log('[cron-research-refresh] done');
}

main()
  .catch((error) => {
    console.error('[cron-research-refresh] fatal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
