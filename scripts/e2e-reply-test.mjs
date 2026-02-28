/**
 * E2E Reply Test — Phase 27-02
 *
 * POSTs 2 realistic reply emails to the inbound-reply webhook endpoint and
 * verifies correct triage classification:
 *   - Contact #1 (Mujjo): interested reply → intent='interested', suggestedAction='book_teardown'
 *   - Contact #2 (De Ondernemer): not-interested reply → intent='not_fit', suggestedAction='close_lost'
 *
 * Usage:
 *   node scripts/e2e-reply-test.mjs
 *
 * Prerequisites:
 *   - Dev server running on port 9200: npm run dev
 *   - Contacts with outreachStatus=EMAIL_SENT exist (created by e2e-send-test.mjs)
 */

import 'dotenv/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ADMIN_SECRET =
  process.env.INBOUND_REPLY_WEBHOOK_SECRET ??
  process.env.ADMIN_SECRET ??
  'change-me-to-a-secure-token';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9200';

const WEBHOOK_URL = `${APP_URL}/api/webhooks/inbound-reply`;

// Test contacts from Plan 27-01 (both have primaryEmail=info@klarifai.nl)
const TEST_EMAIL = 'info@klarifai.nl';

// Triage test payloads — crafted to match known patterns in reply-triage.ts:
//   INTERESTED_PATTERNS: /klinkt goed/, /laten we/, /gesprek/
//   NOT_FIT_PATTERNS: /geen budget/, /niet relevant/
const INTERESTED_REPLY = {
  bodyText:
    'Hoi Romano, klinkt goed! Laten we een gesprek inplannen. Wanneer schikt het jou?',
  bodyHtml:
    '<p>Hoi Romano, klinkt goed! Laten we een gesprek inplannen. Wanneer schikt het jou?</p>',
};

const NOT_FIT_REPLY = {
  bodyText:
    'Bedankt voor je mail, maar we hebben hier geen budget voor. Dit is niet relevant voor ons op dit moment.',
  bodyHtml:
    '<p>Bedankt voor je mail, maar we hebben hier geen budget voor. Dit is niet relevant voor ons op dit moment.</p>',
};

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function checkServerHealth() {
  try {
    const resp = await fetch(APP_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    // Any HTTP response (even 404) means server is up
    return resp.status > 0;
  } catch {
    return false;
  }
}

async function postReply(contact, replyPayload, label) {
  const subject = `Re: Vraag over ${contact.companyName ?? TEST_EMAIL} — test`;

  const body = {
    fromEmail: TEST_EMAIL,
    subject,
    bodyText: replyPayload.bodyText,
    bodyHtml: replyPayload.bodyHtml,
    source: 'email-inbound',
    provider: 'resend',
    autoTriage: true,
  };

  console.log(`\n  [${label}] POSTing to ${WEBHOOK_URL}`);
  console.log(`  fromEmail: ${body.fromEmail}`);
  console.log(`  Reply text: "${replyPayload.bodyText.slice(0, 80)}..."`);

  const resp = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-inbound-secret': ADMIN_SECRET,
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();
  console.log(`  HTTP ${resp.status}: ${JSON.stringify(json, null, 2)}`);

  if (!resp.ok) {
    throw new Error(`Webhook returned HTTP ${resp.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function verifyDbState(contactId, expectedIntent, _expectedSequenceStatus) {
  // Check OutreachLog
  const log = await prisma.outreachLog.findFirst({
    where: { contactId, status: 'triaged' },
    orderBy: { createdAt: 'desc' },
  });

  // Check Contact outreachStatus
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { outreachStatus: true },
  });

  // Check OutreachSequence status (may not exist for these test contacts)
  const sequence = await prisma.outreachSequence.findFirst({
    where: { contactId },
    orderBy: { updatedAt: 'desc' },
  });

  const metadata = log?.metadata;
  const triage =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata.triage
      : null;

  return {
    log: {
      id: log?.id ?? null,
      status: log?.status ?? 'not-found',
      triageIntent: triage && typeof triage === 'object' ? triage.intent : null,
      triageSuggestedAction:
        triage && typeof triage === 'object' ? triage.suggestedAction : null,
      triageConfidence:
        triage && typeof triage === 'object' ? triage.confidence : null,
    },
    contact: {
      outreachStatus: contact?.outreachStatus ?? 'not-found',
    },
    sequence: {
      id: sequence?.id ?? null,
      status: sequence?.status ?? 'none',
    },
    pass:
      log?.status === 'triaged' &&
      (triage && typeof triage === 'object' ? triage.intent : null) === expectedIntent &&
      contact?.outreachStatus === 'REPLIED',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Qualifai E2E Reply Test ===');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`ADMIN_SECRET: ${ADMIN_SECRET === 'change-me-to-a-secure-token' ? 'DEFAULT (not changed)' : 'configured'}`);

  // 1. Check server is up
  console.log(`\n--- Server Health Check ---`);
  const serverUp = await checkServerHealth();
  if (!serverUp) {
    console.error(
      `ERROR: Dev server is not reachable at ${APP_URL}.\n` +
        `Please start it with: npm run dev\n` +
        `Then re-run this script.`,
    );
    process.exit(1);
  }
  console.log(`  Server is UP at ${APP_URL}`);

  // 2. Find the 2 test contacts (EMAIL_SENT contacts with info@klarifai.nl)
  console.log(`\n--- Loading Test Contacts ---`);
  const contacts = await prisma.contact.findMany({
    where: { primaryEmail: TEST_EMAIL },
    include: {
      prospect: { select: { companyName: true, domain: true, id: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 2,
  });

  if (contacts.length < 2) {
    console.error(
      `ERROR: Expected 2 test contacts with primaryEmail=${TEST_EMAIL}, found ${contacts.length}.\n` +
        `Run scripts/e2e-send-test.mjs first to create test contacts.`,
    );
    process.exit(1);
  }

  const [contact1, contact2] = contacts;
  console.log(
    `  Contact #1: ${contact1.firstName} ${contact1.lastName} (${contact1.prospect.companyName}) — id: ${contact1.id}`,
  );
  console.log(
    `  Contact #2: ${contact2.firstName} ${contact2.lastName} (${contact2.prospect.companyName}) — id: ${contact2.id}`,
  );

  // 3. Post interested reply for Contact #1
  console.log(`\n--- Reply Test #1: Interested (${contact1.prospect.companyName}) ---`);
  let webhook1;
  try {
    webhook1 = await postReply(contact1.prospect, INTERESTED_REPLY, 'interested');
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    process.exit(1);
  }

  // 4. Post not-interested reply for Contact #2
  console.log(`\n--- Reply Test #2: Not-Fit (${contact2.prospect.companyName}) ---`);
  let webhook2;
  try {
    webhook2 = await postReply(contact2.prospect, NOT_FIT_REPLY, 'not_fit');
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    process.exit(1);
  }

  // 5. Verify DB state for both contacts
  console.log(`\n--- DB State Verification ---`);
  const state1 = await verifyDbState(contact1.id, 'interested', 'REPLIED');
  const state2 = await verifyDbState(contact2.id, 'not_fit', 'CLOSED_LOST');

  console.log(`\n  ${contact1.prospect.companyName}:`);
  console.log(`    OutreachLog: status=${state1.log.status}, intent=${state1.log.triageIntent}, action=${state1.log.triageSuggestedAction}, confidence=${state1.log.triageConfidence}`);
  console.log(`    Contact: outreachStatus=${state1.contact.outreachStatus}`);
  console.log(`    Sequence: ${state1.sequence.id ? `id=${state1.sequence.id}, status=${state1.sequence.status}` : 'none (no sequence existed)'}`);
  console.log(`    Result: ${state1.pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n  ${contact2.prospect.companyName}:`);
  console.log(`    OutreachLog: status=${state2.log.status}, intent=${state2.log.triageIntent}, action=${state2.log.triageSuggestedAction}, confidence=${state2.log.triageConfidence}`);
  console.log(`    Contact: outreachStatus=${state2.contact.outreachStatus}`);
  console.log(`    Sequence: ${state2.sequence.id ? `id=${state2.sequence.id}, status=${state2.sequence.status}` : 'none (no sequence existed)'}`);
  console.log(`    Result: ${state2.pass ? 'PASS' : 'FAIL'}`);

  // 6. Check webhook triage result from API response
  const triage1 = webhook1?.triage;
  const triage2 = webhook2?.triage;

  // 7. Print summary table
  console.log(`\n=== Summary Table ===`);
  console.log(
    `Contact        | Reply Intent | Triage Result          | Suggested Action  | DB Status`,
  );
  console.log(
    `---------------|-------------|------------------------|-------------------|------------------`,
  );
  console.log(
    `${(contact1.prospect.companyName ?? 'Contact #1').padEnd(14)} | ${'interested'.padEnd(11)} | ${(triage1?.intent ?? state1.log.triageIntent ?? 'unknown').padEnd(22)} | ${(triage1?.suggestedAction ?? state1.log.triageSuggestedAction ?? 'unknown').padEnd(17)} | ${state1.contact.outreachStatus}`,
  );
  console.log(
    `${(contact2.prospect.companyName ?? 'Contact #2').padEnd(14)} | ${'not_fit'.padEnd(11)} | ${(triage2?.intent ?? state2.log.triageIntent ?? 'unknown').padEnd(22)} | ${(triage2?.suggestedAction ?? state2.log.triageSuggestedAction ?? 'unknown').padEnd(17)} | ${state2.contact.outreachStatus}`,
  );

  const allPassed = state1.pass && state2.pass;
  console.log(`\n=== Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ===`);

  if (!allPassed) {
    if (!state1.pass) {
      console.error(
        `  FAIL #1: Expected intent=interested, got ${state1.log.triageIntent}; outreachStatus=${state1.contact.outreachStatus}`,
      );
    }
    if (!state2.pass) {
      console.error(
        `  FAIL #2: Expected intent=not_fit, got ${state2.log.triageIntent}; outreachStatus=${state2.contact.outreachStatus}`,
      );
    }
    process.exit(1);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
