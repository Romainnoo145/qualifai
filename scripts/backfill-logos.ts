/**
 * backfill-logos.ts — Phase 61.3 one-off backfill.
 *
 * Walks every prospect with a null/empty logoUrl and runs resolveLogoUrl
 * against it. Writes the result back to the DB. Logs per-prospect outcome
 * so you can see what got fixed.
 *
 * Usage:
 *   tsx scripts/backfill-logos.ts                  # dry run (no writes)
 *   tsx scripts/backfill-logos.ts --apply          # actually write
 *   tsx scripts/backfill-logos.ts --apply --force  # re-probe even prospects that already have a logoUrl
 *
 * Safe to re-run. No external dependencies beyond what's already in the app.
 */

import 'dotenv/config';
import prisma from '../lib/prisma';
import { resolveLogoUrl } from '../lib/enrichment/logo-pipeline';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');

async function main() {
  console.log(
    `[backfill-logos] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} force=${FORCE}`,
  );

  // Prisma's not:null isn't directly supported — filter in JS after the fetch
  const where = FORCE ? {} : { OR: [{ logoUrl: null }, { logoUrl: '' }] };

  const allProspects = await prisma.prospect.findMany({
    where,
    select: {
      id: true,
      readableSlug: true,
      companyName: true,
      domain: true,
      logoUrl: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const prospects = allProspects.filter((p) => p.domain && p.domain.trim());
  console.log(
    `[backfill-logos] scanning ${prospects.length} prospects with domain (of ${allProspects.length} total)`,
  );

  let updated = 0;
  let unchanged = 0;
  let nothingFound = 0;
  let errored = 0;

  for (const p of prospects) {
    if (!p.domain) continue;
    const label = `${p.readableSlug} (${p.domain})`;

    try {
      const resolved = await resolveLogoUrl(p.domain, {
        apolloLogoUrl: p.logoUrl,
      });

      if (!resolved) {
        console.log(`  ◦ ${label} — no logo source found`);
        nothingFound += 1;
        continue;
      }

      if (resolved === p.logoUrl) {
        console.log(`  = ${label} — already set (re-validated)`);
        unchanged += 1;
        continue;
      }

      const preview =
        resolved.length > 80 ? resolved.slice(0, 77) + '...' : resolved;
      console.log(`  ✓ ${label} → ${preview}`);

      if (APPLY) {
        await prisma.prospect.update({
          where: { id: p.id },
          data: { logoUrl: resolved },
        });
      }
      updated += 1;
    } catch (err) {
      console.log(
        `  ✗ ${label} — error: ${err instanceof Error ? err.message : String(err)}`,
      );
      errored += 1;
    }
  }

  console.log(
    `\n[backfill-logos] summary: updated=${updated} unchanged=${unchanged} no-logo=${nothingFound} errored=${errored}`,
  );

  if (!APPLY && updated > 0) {
    console.log(
      `[backfill-logos] DRY-RUN — re-run with --apply to persist ${updated} logo updates`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[backfill-logos] fatal:', err);
  process.exit(1);
});
