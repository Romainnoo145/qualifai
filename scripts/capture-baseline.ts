/**
 * Baseline capture script: snapshot all ProspectAnalysis records to JSON files.
 *
 * Purpose: Phase 69 (E2E Validation) needs before/after comparison to prove
 * pipeline improvements. This script freezes the "before" state.
 *
 * Output: .planning/baselines/analysis/{slug}_{timestamp}.json
 *
 * Usage: npx tsx scripts/capture-baseline.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // Generate shared timestamp for this capture run (ISO, filesystem-safe)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // e.g. 2026-04-21T14-30-00

  const capturedAt = new Date().toISOString();

  // Output directory
  const outDir = path.resolve(process.cwd(), '.planning/baselines/analysis');
  fs.mkdirSync(outDir, { recursive: true });

  // Query all ProspectAnalysis records with prospect + researchRun
  const analyses = await prisma.prospectAnalysis.findMany({
    include: {
      prospect: {
        select: {
          slug: true,
          readableSlug: true,
          companyName: true,
          domain: true,
        },
      },
      researchRun: {
        select: {
          id: true,
          createdAt: true,
          status: true,
        },
      },
    },
  });

  if (analyses.length === 0) {
    console.log('No ProspectAnalysis records found.');
    return;
  }

  console.log(
    `Found ${analyses.length} ProspectAnalysis record(s). Writing snapshots...\n`,
  );

  const written: Array<{ slug: string; file: string }> = [];

  for (const analysis of analyses) {
    const {
      prospect,
      researchRun,
      id,
      version,
      createdAt,
      modelUsed,
      content,
      inputSnapshot,
    } = analysis;

    const nameKey = prospect.readableSlug ?? prospect.slug;
    // Include analysis id suffix to prevent collision when a prospect has multiple analyses
    const filename = `${nameKey}_${id.slice(-6)}_${timestamp}.json`;
    const filepath = path.join(outDir, filename);

    const snapshot = {
      capturedAt,
      prospect: {
        slug: prospect.slug,
        readableSlug: prospect.readableSlug ?? null,
        companyName: prospect.companyName ?? null,
        domain: prospect.domain,
      },
      analysis: {
        id,
        version,
        createdAt: createdAt.toISOString(),
        modelUsed: modelUsed ?? null,
        content,
        inputSnapshot: inputSnapshot ?? null,
      },
      researchRun: {
        id: researchRun.id,
        createdAt: researchRun.createdAt.toISOString(),
        status: researchRun.status,
      },
    };

    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');

    console.log(`  Written: ${filename}`);
    written.push({ slug: nameKey, file: filepath });
  }

  console.log(
    `\nCapture complete. ${written.length} snapshot(s) written to ${outDir}`,
  );

  // -------------------------------------------------------------------------
  // Post-capture validation
  // -------------------------------------------------------------------------
  console.log('\n--- Validation ---');
  console.log(
    `${'Prospect'.padEnd(30)} ${'Version'.padEnd(14)} ${'Evidence items'.padEnd(16)} ${'File size'}`,
  );
  console.log('-'.repeat(80));

  let allValid = true;

  for (const { slug, file } of written) {
    const raw = fs.readFileSync(file, 'utf8');
    let parsed: {
      capturedAt?: string;
      prospect?: { slug?: string };
      analysis?: {
        version?: string;
        content?: unknown;
        inputSnapshot?: { passageCount?: number } | null;
      };
    };

    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      console.error(`  INVALID JSON: ${file}`);
      allValid = false;
      continue;
    }

    const hasContent =
      typeof parsed.analysis?.content === 'object' &&
      parsed.analysis.content !== null &&
      Object.keys(parsed.analysis.content as object).length > 0;
    const hasSlug =
      typeof parsed.prospect?.slug === 'string' &&
      parsed.prospect.slug.length > 0;
    const hasTimestamp =
      typeof parsed.capturedAt === 'string' && parsed.capturedAt.length > 0;

    if (!hasContent || !hasSlug || !hasTimestamp) {
      console.error(
        `  VALIDATION FAILED for ${slug}: content=${hasContent} slug=${hasSlug} ts=${hasTimestamp}`,
      );
      allValid = false;
      continue;
    }

    const evidenceItems =
      (parsed.analysis?.inputSnapshot as { passageCount?: number } | null)
        ?.passageCount ?? 'n/a';
    const fileSize = `${(fs.statSync(file).size / 1024).toFixed(1)} KB`;

    console.log(
      `  ${slug.padEnd(30)} ${((parsed.analysis?.version as string) ?? '').padEnd(14)} ${String(evidenceItems).padEnd(16)} ${fileSize}`,
    );
  }

  console.log('-'.repeat(80));

  if (allValid) {
    console.log(
      '\nAll snapshots valid. Files are diffable with standard tools (diff, jq).',
    );
    console.log(
      'Example: jq .analysis.content .planning/baselines/analysis/<file>.json',
    );
  } else {
    console.error('\nSome snapshots failed validation — check errors above.');
    process.exitCode = 1;
  }
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
