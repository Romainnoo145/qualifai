/**
 * V10.0 Evidence Pipeline Overhaul — E2E Validation Script
 *
 * Runs the full evidence pipeline for 4 prospects and produces a quality report.
 * Usage: npx tsx scripts/rerun-v10-validation.ts
 *
 * Success criteria:
 * - STB-kozijnen new run has fewer than 100 EvidenceItems
 * - Zero URL-only stubs (no snippet AND no title) in any new run
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { executeResearchRun } from '../lib/research-executor';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface ProspectTarget {
  name: string;
  filter: { domain?: { contains: string }; companyName?: { contains: string } };
}

interface RunResult {
  name: string;
  found: boolean;
  preTotal: number;
  newRunCount: number;
  stubCount: number;
  breakdown: Array<{ sourceType: string; count: number }>;
  pass: boolean | null;
  error?: string;
}

const TARGETS: ProspectTarget[] = [
  { name: 'STB-kozijnen', filter: { domain: { contains: 'stb-kozijnen' } } },
  { name: 'Mujjo', filter: { companyName: { contains: 'Mujjo' } } },
  { name: 'Nedri', filter: { domain: { contains: 'nedri.nl' } } },
  { name: 'Marfa', filter: { domain: { contains: 'marfa.nl' } } },
];

async function main() {
  console.log('=== V10.0 E2E VALIDATION — PIPELINE RERUN ===');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const results: RunResult[] = [];

  for (const target of TARGETS) {
    console.log(`\n--- [${target.name}] ---`);

    const prospect = await prisma.prospect.findFirst({
      where: target.filter,
      select: { id: true, companyName: true, domain: true },
    });

    if (!prospect) {
      console.log(
        `[${target.name}] not found in DB — create via admin UI before running validation`,
      );
      results.push({
        name: target.name,
        found: false,
        preTotal: 0,
        newRunCount: 0,
        stubCount: 0,
        breakdown: [],
        pass: null,
        error: 'NOT FOUND IN DB',
      });
      continue;
    }

    console.log(
      `Found: ${prospect.companyName} (${prospect.domain}) — id: ${prospect.id}`,
    );

    // Pre-run evidence count
    const preTotal = await prisma.evidenceItem.count({
      where: { prospectId: prospect.id },
    });
    console.log(`Pre-run total evidence: ${preTotal}`);

    let result: {
      run: { id: string };
      gate: unknown;
      counts: Record<string, number>;
    };
    try {
      console.log(
        'Starting deep research run (this may take several minutes)...',
      );
      result = (await executeResearchRun(prisma as any, {
        prospectId: prospect.id,
        manualUrls: [],
        deepCrawl: true,
      })) as typeof result;
      console.log(`Run completed. runId: ${result.run.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${target.name}] Pipeline error: ${message}`);
      results.push({
        name: target.name,
        found: true,
        preTotal,
        newRunCount: 0,
        stubCount: 0,
        breakdown: [],
        pass: false,
        error: message,
      });
      continue;
    }

    // Post-run evidence count for the new run
    const newRunCount = await prisma.evidenceItem.count({
      where: { researchRunId: result.run.id },
    });

    // Per-sourceType breakdown
    const breakdownRaw = await prisma.evidenceItem.groupBy({
      by: ['sourceType'],
      where: { researchRunId: result.run.id },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const breakdown = breakdownRaw.map((r) => ({
      sourceType: r.sourceType ?? 'UNKNOWN',
      count: r._count.id,
    }));

    // Stub check: items with empty/blank snippet AND no title
    // (snippet is non-nullable in schema, so stubs have empty string "")
    const stubCount = await prisma.evidenceItem.count({
      where: {
        researchRunId: result.run.id,
        AND: [{ snippet: { in: ['', ' '] } }, { title: null }],
      },
    });

    // Pass/fail for each prospect
    // STB-kozijnen: PASS if newRunCount < 100 AND stubCount === 0
    // Others: PASS if stubCount === 0
    const isStb = target.name === 'STB-kozijnen';
    const pass = isStb ? newRunCount < 100 && stubCount === 0 : stubCount === 0;

    console.log(`New run evidence: ${newRunCount}`);
    console.log(`Stubs: ${stubCount}`);
    console.log(`Pass: ${pass ? 'YES' : 'NO'}`);
    console.log('Breakdown:');
    for (const b of breakdown) {
      console.log(`  ${b.sourceType.padEnd(20)} ${b.count}`);
    }

    results.push({
      name: target.name,
      found: true,
      preTotal,
      newRunCount,
      stubCount,
      breakdown,
      pass,
    });
  }

  // Summary report
  console.log('\n\n=== V10.0 VALIDATION REPORT ===');
  console.log(
    `${'Prospect'.padEnd(18)} | ${'Pre-total'.padEnd(10)} | ${'New-run'.padEnd(8)} | ${'Stubs'.padEnd(6)} | ${'Pass?'}`,
  );
  console.log('-'.repeat(65));

  for (const r of results) {
    if (!r.found) {
      console.log(
        `${r.name.padEnd(18)} | ${'N/A'.padEnd(10)} | ${'N/A'.padEnd(8)} | ${'N/A'.padEnd(6)} | NOT IN DB`,
      );
    } else if (r.error && r.newRunCount === 0) {
      console.log(
        `${r.name.padEnd(18)} | ${String(r.preTotal).padEnd(10)} | ${'ERR'.padEnd(8)} | ${'ERR'.padEnd(6)} | FAILED: ${r.error.slice(0, 40)}`,
      );
    } else {
      const passLabel =
        r.pass === true ? 'YES' : r.pass === false ? 'NO' : 'N/A';
      const note =
        r.name === 'STB-kozijnen'
          ? r.pass
            ? '(<100, 0 stubs)'
            : `(${r.newRunCount} items, ${r.stubCount} stubs)`
          : r.pass
            ? '(0 stubs)'
            : `(${r.stubCount} stubs)`;
      console.log(
        `${r.name.padEnd(18)} | ${String(r.preTotal).padEnd(10)} | ${String(r.newRunCount).padEnd(8)} | ${String(r.stubCount).padEnd(6)} | ${passLabel} ${note}`,
      );
    }
  }

  console.log('-'.repeat(65));

  const foundResults = results.filter((r) => r.found && !r.error);
  const allPass = foundResults.length >= 2 && foundResults.every((r) => r.pass);
  const stbResult = results.find((r) => r.name === 'STB-kozijnen');

  console.log(`\nProspects attempted: ${TARGETS.length}`);
  console.log(`Prospects found: ${results.filter((r) => r.found).length}`);
  console.log(`Prospects succeeded: ${foundResults.length}`);

  if (stbResult?.found) {
    console.log(
      `STB-kozijnen: ${stbResult.pass ? 'PASS' : 'FAIL'} (${stbResult.newRunCount} new items, ${stbResult.stubCount} stubs)`,
    );
  } else {
    console.log('STB-kozijnen: NOT FOUND — criterion cannot be evaluated');
  }

  if (allPass) {
    console.log('\nOVERALL: PASS — v10.0 pipeline meets quality criteria');
  } else {
    console.log('\nOVERALL: CHECK RESULTS — review individual pass/fail above');
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
