import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { executeResearchRun } from '../lib/research-executor';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: 'marfa' },
    select: { id: true, companyName: true, domain: true, readableSlug: true },
  });

  if (!prospect) {
    console.log('No Marfa prospect found (looked up by readableSlug=marfa)');
    return;
  }

  console.log('=== MARFA FULL PIPELINE RERUN ===');
  console.log(
    'Prospect:',
    prospect.readableSlug,
    prospect.companyName,
    prospect.domain,
    prospect.id,
  );

  console.log('Starting deep research run...');
  const result = await executeResearchRun(prisma as any, {
    prospectId: prospect.id,
    manualUrls: [],
    deepCrawl: true,
  });

  console.log('=== DONE ===');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
