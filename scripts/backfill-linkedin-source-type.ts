/**
 * One-shot backfill script: re-classify WEBSITE LinkedIn evidence items to LINKEDIN.
 *
 * Usage:
 *   node -e "require('dotenv').config(); require('./scripts/backfill-linkedin-source-type.ts')"
 *   Or: npx ts-node scripts/backfill-linkedin-source-type.ts
 *
 * Follows project pattern: PrismaPg adapter with Pool from pg (MEMORY.md),
 * process.env direct reads (not env.mjs) for CLI testability.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const result = await db.evidenceItem.updateMany({
    where: {
      sourceType: 'WEBSITE',
      sourceUrl: { contains: 'linkedin.com' },
    },
    data: { sourceType: 'LINKEDIN' },
  });

  console.log(
    `Backfilled ${result.count} LinkedIn evidence items from WEBSITE → LINKEDIN`,
  );
  await db.$disconnect();
  await pool.end();
}

main().catch(console.error);
