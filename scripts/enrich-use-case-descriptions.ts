/**
 * Enrich all catalog use case summaries with richer Dutch descriptions.
 * Runs against the 164 active Klarifai use cases and rewrites `summary`
 * with a 4-5 sentence Dutch description covering: what it is, the pain
 * it solves, how it works, and what concrete outcomes clients get.
 *
 * Usage:
 *   npx tsx scripts/enrich-use-case-descriptions.ts
 *   npx tsx scripts/enrich-use-case-descriptions.ts --dry-run
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const isDryRun = process.argv.includes('--dry-run');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) } as any);
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateDescription(
  title: string,
  category: string,
  currentSummary: string,
  outcomes: string[],
): Promise<string> {
  const outcomesText =
    outcomes.length > 0 ? `Concrete uitkomsten: ${outcomes.join(', ')}.` : '';

  const prompt = `Je bent een B2B-copywriter voor een AI-dienstverlener (Klarifai). Schrijf een rijke, professionele beschrijving in het Nederlands voor de volgende dienst. De beschrijving moet:
- 4 tot 5 zinnen lang zijn (max 500 woorden)
- Uitleggen wat de dienst doet en voor wie
- Het zakelijke probleem benoemen dat het oplost
- Kort ingaan op hoe het technisch werkt (AI, automatisering, integraties)
- Afsluiten met concrete bedrijfsresultaten die klanten bereiken

Dienst: ${title}
Categorie: ${category}
Huidige omschrijving (verbeteren): ${currentSummary}
${outcomesText}

Schrijf ALLEEN de beschrijving, geen extra opmaak of titels.`;

  const result = await model.generateContent(prompt);
  return result.response
    .text()
    .trim()
    .replace(/^["']|["']$/g, '');
}

async function main() {
  const useCases = await db.useCase.findMany({
    where: { isActive: true, projectId: 'project_klarifai' },
    select: {
      id: true,
      title: true,
      category: true,
      summary: true,
      outcomes: true,
    },
    orderBy: { category: 'asc' },
  });

  console.log(
    `${isDryRun ? '[DRY RUN] ' : ''}Processing ${useCases.length} use cases...\n`,
  );

  let success = 0;
  let failed = 0;

  for (let i = 0; i < useCases.length; i++) {
    const uc = useCases[i]!;
    const prefix = `[${String(i + 1).padStart(3, '0')}/${useCases.length}]`;
    process.stdout.write(`${prefix} ${uc.title}... `);

    try {
      const newSummary = await generateDescription(
        uc.title,
        uc.category,
        uc.summary,
        uc.outcomes as string[],
      );

      if (!isDryRun) {
        await db.useCase.update({
          where: { id: uc.id },
          data: { summary: newSummary },
        });
      }

      console.log(`✓ (${newSummary.length} chars)`);
      if (isDryRun) console.log(`  Preview: ${newSummary.slice(0, 120)}...\n`);
      success++;
    } catch (err) {
      console.log(`✗ FAILED`);
      console.error(`  Error:`, err instanceof Error ? err.message : err);
      failed++;
    }

    // Rate limit: pause between calls
    if (i < useCases.length - 1) await sleep(300);
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
