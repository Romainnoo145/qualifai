import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Mirrors quality-config.ts constants exactly
const MIN_EVIDENCE_COUNT = 3;
const GREEN_MIN_SOURCE_TYPES = 3;
const MIN_AVERAGE_CONFIDENCE = 0.55; // NOTE: old calibration-table.mjs used 0.65 (wrong)
const AI_RELEVANCE_THRESHOLD = 0.5; // Items below this are excluded from confidence average

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const prospects = await db.prospect.findMany({
  orderBy: { companyName: 'asc' },
  include: {
    researchRuns: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        evidenceItems: {
          select: { sourceType: true, confidenceScore: true, metadata: true },
        },
      },
    },
  },
});

console.log('\n--- PAIN GATE CALIBRATION REPORT ---');
console.log(`Thresholds: MIN_EVIDENCE_COUNT=${MIN_EVIDENCE_COUNT}, GREEN_MIN_SOURCE_TYPES=${GREEN_MIN_SOURCE_TYPES}, MIN_AVERAGE_CONFIDENCE=${MIN_AVERAGE_CONFIDENCE}, AI_RELEVANCE_THRESHOLD=${AI_RELEVANCE_THRESHOLD}`);
console.log('');
console.log(
  'Prospect'.padEnd(30) +
    'Total'.padEnd(7) +
    'Srcs'.padEnd(6) +
    'Scorable'.padEnd(10) +
    'AvgConf(all)'.padEnd(14) +
    'AvgConf(scr)'.padEnd(14) +
    'Tier',
);
console.log('-'.repeat(100));

const results = [];

for (const p of prospects) {
  const run = p.researchRuns[0];
  if (!run) {
    const name = (p.companyName || p.domain || 'unknown').padEnd(30);
    console.log(name + 'No research run found');
    results.push({ name: p.companyName || p.domain, tier: 'NO_DATA', avgConfScorable: null });
    continue;
  }

  const items = run.evidenceItems;
  const srcTypes = new Set(items.map((e) => e.sourceType)).size;

  // Raw average (all items — matches old calibration-table.mjs behavior)
  const avgConfAll =
    items.length > 0
      ? items.reduce((s, e) => s + e.confidenceScore, 0) / items.length
      : 0;

  // Scorable average — applies aiRelevance filter, mirrors workflow-engine.ts evaluateQualityGate
  const scorableItems = items.filter((item) => {
    const meta = item.metadata;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return true; // no aiRelevance = include
    const aiRel = meta.aiRelevance;
    if (typeof aiRel !== 'number') return true;
    return aiRel >= AI_RELEVANCE_THRESHOLD;
  });

  const avgConfScorable =
    scorableItems.length > 0
      ? scorableItems.reduce((s, e) => s + e.confidenceScore, 0) / scorableItems.length
      : 0;

  // Gate logic mirrors computeTrafficLight() from quality-config.ts
  const tier =
    items.length < MIN_EVIDENCE_COUNT || srcTypes < 1
      ? 'RED'
      : srcTypes < GREEN_MIN_SOURCE_TYPES || avgConfScorable < MIN_AVERAGE_CONFIDENCE
        ? 'AMBER'
        : 'GREEN';

  const name = (p.companyName || p.domain || 'unknown').padEnd(30);
  console.log(
    name +
      String(items.length).padEnd(7) +
      String(srcTypes).padEnd(6) +
      String(scorableItems.length).padEnd(10) +
      avgConfAll.toFixed(3).padEnd(14) +
      avgConfScorable.toFixed(3).padEnd(14) +
      tier,
  );

  results.push({
    name: p.companyName || p.domain,
    totalItems: items.length,
    srcTypes,
    scorableCount: scorableItems.length,
    avgConfAll,
    avgConfScorable,
    tier,
  });
}

console.log('-'.repeat(100));
console.log('');

// Threshold analysis summary
const scored = results.filter((r) => r.avgConfScorable !== null && r.tier !== 'NO_DATA');
if (scored.length > 0) {
  const scorableAvgs = scored.map((r) => r.avgConfScorable);
  const minAvg = Math.min(...scorableAvgs);
  const maxAvg = Math.max(...scorableAvgs);
  const margin = minAvg - MIN_AVERAGE_CONFIDENCE;
  const greenCount = scored.filter((r) => r.tier === 'GREEN').length;
  const amberCount = scored.filter((r) => r.tier === 'AMBER').length;
  const redCount = scored.filter((r) => r.tier === 'RED').length;

  console.log('--- THRESHOLD ANALYSIS ---');
  console.log(`Current MIN_AVERAGE_CONFIDENCE: ${MIN_AVERAGE_CONFIDENCE}`);
  console.log(`Scorable avg range: ${minAvg.toFixed(3)} – ${maxAvg.toFixed(3)}`);
  console.log(`Margin above threshold (lowest – threshold): ${margin >= 0 ? '+' : ''}${margin.toFixed(3)}`);
  console.log(`Tier distribution: GREEN=${greenCount} AMBER=${amberCount} RED=${redCount} (of ${scored.length} prospects)`);
  console.log('');
  if (margin >= 0.03) {
    console.log(`Recommendation: No change needed — threshold 0.55 is correct.`);
    console.log(`  All ${greenCount} prospects are GREEN; lowest margin +${margin.toFixed(3)} provides adequate buffer.`);
  } else if (margin >= 0) {
    console.log(`Recommendation: Consider lowering threshold slightly — margin is thin (+${margin.toFixed(3)}).`);
  } else {
    console.log(`Recommendation: Threshold may be too high — ${Math.abs(margin).toFixed(3)} below current threshold.`);
    console.log(`  Consider adjusting to ${(minAvg - 0.02).toFixed(2)}.`);
  }
}

console.log('');
await db.$disconnect();
await pool.end();
