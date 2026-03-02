/**
 * One-shot script: export golden baselines for all prospects from the current DB state.
 *
 * This captures hypothesis data AFTER:
 *  - Gemini 2.5 Flash swap (Plan 31-01)
 *  - TS type fixes (Plan 31-02)
 *
 * So Phase 32 prompt comparisons isolate prompt changes only, not model or type changes.
 *
 * Usage: npx tsx scripts/export-baselines.ts
 * Output: .planning/baselines/baselines.json
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { writeFile, mkdir } from 'node:fs/promises';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const prospects = await db.prospect.findMany({
    select: {
      id: true,
      companyName: true,
      domain: true,
      researchRuns: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          summary: true,
          workflowHypotheses: {
            select: {
              id: true,
              title: true,
              problemStatement: true,
              confidenceScore: true,
              evidenceRefs: true,
            },
            orderBy: { confidenceScore: 'desc' },
          },
        },
      },
    },
  });

  await mkdir('.planning/baselines', { recursive: true });
  await writeFile(
    '.planning/baselines/baselines.json',
    JSON.stringify(prospects, null, 2),
  );
  console.log(
    `Exported ${prospects.length} prospects to .planning/baselines/baselines.json`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
