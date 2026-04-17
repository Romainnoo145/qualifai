/**
 * One-off: re-resolve all prospect logos using the fixed pipeline
 * (icons-first priority instead of og:image-first).
 *
 * Usage: npx tsx scripts/backfill-logos-v2.ts
 */
import 'dotenv/config';
import prisma from '../lib/prisma';
import { resolveLogoUrl } from '../lib/enrichment/logo-pipeline';

async function main() {
  const prospects = await prisma.prospect.findMany({
    select: { id: true, companyName: true, domain: true, logoUrl: true },
  });

  console.log(`Found ${prospects.length} prospects to re-resolve logos for.\n`);

  for (const p of prospects) {
    if (!p.domain) {
      console.log(`  SKIP ${p.companyName ?? p.id} — no domain`);
      continue;
    }

    const newUrl = await resolveLogoUrl(p.domain);
    const changed = newUrl !== p.logoUrl;

    if (changed) {
      await prisma.prospect.update({
        where: { id: p.id },
        data: { logoUrl: newUrl },
      });
      console.log(
        `  ✓ ${p.companyName ?? p.domain}: ${p.logoUrl?.slice(0, 60) ?? 'null'} → ${newUrl?.slice(0, 60) ?? 'null'}`,
      );
    } else {
      console.log(`  · ${p.companyName ?? p.domain}: unchanged`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
