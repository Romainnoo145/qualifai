import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const KEEP = [
  'Motion Design Awards',
  'De Ondernemer',
  'Brainport Eindhoven',
  'DuckDB',
  'Mujjo',
];

const { rows: all } = await pool.query('SELECT id, "companyName", domain FROM "Prospect"');
const toDelete = all.filter((p) => !KEEP.includes(p.companyName));
const toKeep = all.filter((p) => KEEP.includes(p.companyName));

console.log(`Keeping ${toKeep.length} prospects:`);
toKeep.forEach((p) => console.log(`  - ${p.companyName} (${p.domain})`));
console.log(`\nDeleting ${toDelete.length} prospects...`);

for (const p of toDelete) {
  const { rows: runs } = await pool.query('SELECT id FROM "ResearchRun" WHERE "prospectId" = $1', [p.id]);
  const runIds = runs.map((r) => r.id);

  if (runIds.length > 0) {
    await pool.query('DELETE FROM "EvidenceItem" WHERE "researchRunId" = ANY($1)', [runIds]);
    await pool.query('DELETE FROM "WorkflowHypothesis" WHERE "researchRunId" = ANY($1)', [runIds]);
    await pool.query('DELETE FROM "ResearchRun" WHERE id = ANY($1)', [runIds]);
  }

  // Delete outreach sequences (cascade deletes steps)
  await pool.query('DELETE FROM "OutreachSequence" WHERE "prospectId" = $1', [p.id]);

  // Delete outreach logs tied to contacts
  const { rows: contacts } = await pool.query('SELECT id FROM "Contact" WHERE "prospectId" = $1', [p.id]);
  const contactIds = contacts.map((c) => c.id);
  if (contactIds.length > 0) {
    // OutreachStep references OutreachLog, delete steps first via their logs
    const { rows: logs } = await pool.query('SELECT id FROM "OutreachLog" WHERE "contactId" = ANY($1::text[])', [contactIds]);
    const logIds = logs.map((l) => l.id);
    if (logIds.length > 0) {
      await pool.query('DELETE FROM "OutreachStep" WHERE "outreachLogId" = ANY($1::text[])', [logIds]);
    }
    await pool.query('DELETE FROM "OutreachLog" WHERE "contactId" = ANY($1::text[])', [contactIds]);
  }

  await pool.query('DELETE FROM "Contact" WHERE "prospectId" = $1', [p.id]);
  await pool.query('DELETE FROM "Prospect" WHERE id = $1', [p.id]);
  console.log(`  Deleted: ${p.companyName || p.domain}`);
}

const { rows: remaining } = await pool.query('SELECT "companyName", domain FROM "Prospect"');
console.log(`\nDone. ${remaining.length} prospects remaining:`);
remaining.forEach((p) => console.log(`  - ${p.companyName} (${p.domain})`));

await pool.end();
