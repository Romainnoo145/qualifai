import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { discoverSitemapUrls } from '../lib/enrichment/sitemap';
import { extractSourceSet } from '../lib/enrichment/source-discovery';

type Args = {
  domain?: string;
  prospectId?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--domain' && argv[i + 1]) {
      args.domain = argv[i + 1];
      i++;
      continue;
    }
    if (token === '--prospect-id' && argv[i + 1]) {
      args.prospectId = argv[i + 1];
      i++;
      continue;
    }
  }
  return args;
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${host}${path}${u.search}`;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const where = args.prospectId
      ? { id: args.prospectId }
      : args.domain
        ? { domain: args.domain }
        : { domain: 'heijmans.nl' };

    const prospect = await prisma.prospect.findFirst({
      where,
      select: { id: true, domain: true, companyName: true },
    });

    if (!prospect) {
      throw new Error('Prospect not found for provided arguments.');
    }

    const run = await prisma.researchRun.findFirst({
      where: { prospectId: prospect.id },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        inputSnapshot: true,
        _count: { select: { evidenceItems: true } },
      },
    });

    if (!run) {
      throw new Error('No research run found for this prospect.');
    }

    const sourceSet = extractSourceSet(run.inputSnapshot);
    const selected = (sourceSet?.urls ?? []).map((u) => ({
      url: u.url,
      provenance: u.provenance,
      normalized: normalizeUrl(u.url),
    }));

    const discovery = await discoverSitemapUrls(prospect.domain);
    const sitemapUrls = discovery.candidates.map((c) => ({
      url: c.url,
      normalized: c.normalizedUrl,
      lastmod: c.lastmod,
      topSegment: c.topSegment,
      pathDepth: c.pathDepth,
    }));

    const selectedSet = new Set(
      selected
        .map((item) => item.normalized)
        .filter((item): item is string => Boolean(item)),
    );
    const sitemapSet = new Set(
      sitemapUrls
        .map((item) => item.normalized)
        .filter((item): item is string => Boolean(item)),
    );

    const overlap = Array.from(selectedSet).filter((url) => sitemapSet.has(url));
    const selectedNotInSitemap = selected.filter(
      (item) => item.normalized && !sitemapSet.has(item.normalized),
    );
    const sitemapNotSelected = sitemapUrls.filter(
      (item) => item.normalized && !selectedSet.has(item.normalized),
    );

    const coveragePct =
      sitemapSet.size > 0
        ? Number(((overlap.length / sitemapSet.size) * 100).toFixed(2))
        : 0;

    const report = {
      generatedAt: new Date().toISOString(),
      prospect,
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        evidenceCount: run._count.evidenceItems,
      },
      discovery: {
        status: discovery.status,
        errorCode: discovery.errorCode ?? null,
        discoveredTotal: discovery.discoveredTotal,
        seedUrls: discovery.seedUrls,
        crawledSitemaps: discovery.crawledSitemaps,
      },
      counts: {
        selectedUrls: selected.length,
        sitemapUrls: sitemapUrls.length,
        overlap: overlap.length,
        coveragePct,
        selectedNotInSitemap: selectedNotInSitemap.length,
        sitemapNotSelected: sitemapNotSelected.length,
      },
      selected,
      sitemapUrls,
      diff: {
        selectedNotInSitemap,
        sitemapNotSelected,
      },
    };

    const outJson = `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/coverage-audits/${prospect.id}.json`;
    const outTxt = `/home/klarifai/Documents/klarifai/projects/qualifai/.planning/coverage-audits/${prospect.id}.txt`;
    mkdirSync(dirname(outJson), { recursive: true });
    writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');

    const lines: string[] = [];
    lines.push(`# Prospect: ${prospect.companyName ?? prospect.domain} (${prospect.id})`);
    lines.push(`# Run: ${run.id} (${run.status})`);
    lines.push(`# Coverage: ${coveragePct}% (${overlap.length}/${sitemapUrls.length})`);
    lines.push('');
    lines.push('## Selected URLs');
    for (const item of selected) {
      lines.push(`${item.provenance}\t${item.url}`);
    }
    lines.push('');
    lines.push('## Sitemap URLs');
    for (const item of sitemapUrls) {
      lines.push(item.url);
    }

    writeFileSync(outTxt, `${lines.join('\n')}\n`, 'utf8');

    console.log(
      JSON.stringify(
        {
          outJson,
          outTxt,
          counts: report.counts,
          discovery: report.discovery,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
