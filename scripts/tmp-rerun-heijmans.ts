import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { executeResearchRun } from '../lib/research-executor';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { domain: { contains: 'heijmans' } },
    select: { id: true, companyName: true, domain: true },
  });

  if (!prospect) {
    console.log('No Heijmans prospect found');
    return;
  }

  console.log(
    'Starting deep rerun for',
    prospect.companyName,
    prospect.domain,
    prospect.id,
  );

  const existing = await prisma.researchRun.findFirst({
    where: { prospectId: prospect.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const result = await executeResearchRun(prisma as any, {
    prospectId: prospect.id,
    manualUrls: [],
    existingRunId: existing?.id,
    deepCrawl: true,
  });

  console.log('DONE', JSON.stringify(result));
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
