/**
 * E2E Cal.com Booking Test — Phase 27.1
 *
 * Simulates a BOOKING_CREATED webhook event from Cal.com, verifies that the
 * booking-to-call-prep pipeline runs correctly, and confirms all six DB state
 * changes:
 *
 *   1. OutreachSequence  → status = BOOKED, metadata.calcom.bookingUid set
 *   2. OutreachStep(s)   → status = BOOKED
 *   3. Contact           → outreachStatus = CONVERTED
 *   4. Prospect          → status = ENGAGED
 *   5. OutreachLog       → channel = calcom, status = booked
 *   6. CallPrepPlan      → summary + plan30/60/90 non-null
 *
 * Closes requirement E2E-03 (Phase 27.1 gap closure).
 *
 * Usage:
 *   node scripts/e2e-calcom-booking-test.mjs
 *
 * Prerequisites:
 *   - Dev server running on port 9200: npm run dev
 *   - CALCOM_WEBHOOK_SECRET set in .env (e.g. CALCOM_WEBHOOK_SECRET=e2e-calcom-test-secret)
 *   - At least one prospect with a COMPLETED research run that has WorkflowHypothesis
 *     and AutomationOpportunity records (created by earlier research pipeline)
 */

import 'dotenv/config';
import { createRequire } from 'module';
import { createHmac } from 'node:crypto';

const require = createRequire(import.meta.url);
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9200';
const WEBHOOK_URL = `${APP_URL}/api/webhooks/calcom`;

// CALCOM_WEBHOOK_SECRET must match what the dev server has loaded in env.mjs
const CALCOM_WEBHOOK_SECRET = process.env.CALCOM_WEBHOOK_SECRET;
if (!CALCOM_WEBHOOK_SECRET) {
  console.error(
    'ERROR: CALCOM_WEBHOOK_SECRET is not set in your environment.\n' +
      'Add the following line to your .env file and restart the dev server:\n\n' +
      '  CALCOM_WEBHOOK_SECRET=e2e-calcom-test-secret\n\n' +
      'Then re-run this script.',
  );
  process.exit(1);
}

// Preferred test prospect domains (from Phase 27 E2E suite)
const TEST_PROSPECT_DOMAINS = ['mujjo.com', 'deondernemer.nl'];

// Test contact email (same address used in e2e-send-test.mjs)
const TEST_EMAIL = 'info@klarifai.nl';

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
    return resp.status > 0;
  } catch {
    return false;
  }
}

/**
 * Find a prospect that has a COMPLETED research run with at least one
 * WorkflowHypothesis and one AutomationOpportunity.
 * Prefers the test domains from Phase 27 but falls back to any eligible prospect.
 */
async function findEligibleProspect() {
  // Try preferred domains first
  for (const domain of TEST_PROSPECT_DOMAINS) {
    const prospect = await prisma.prospect.findFirst({ where: { domain } });
    if (!prospect) continue;

    const run = await prisma.researchRun.findFirst({
      where: { prospectId: prospect.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!run) continue;

    const [hypothesisCount, opportunityCount] = await Promise.all([
      prisma.workflowHypothesis.count({ where: { researchRunId: run.id } }),
      prisma.automationOpportunity.count({ where: { researchRunId: run.id } }),
    ]);

    if (hypothesisCount > 0 && opportunityCount > 0) {
      return { prospect, run };
    }
    console.log(
      `  SKIP ${domain}: run ${run.id} has ${hypothesisCount} hypotheses, ${opportunityCount} opportunities`,
    );
  }

  // Fall back to any eligible prospect
  console.log('  Preferred domains not eligible — searching all prospects...');
  const allRuns = await prisma.researchRun.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  for (const run of allRuns) {
    const [hypothesisCount, opportunityCount] = await Promise.all([
      prisma.workflowHypothesis.count({ where: { researchRunId: run.id } }),
      prisma.automationOpportunity.count({ where: { researchRunId: run.id } }),
    ]);
    if (hypothesisCount > 0 && opportunityCount > 0) {
      const prospect = await prisma.prospect.findUnique({
        where: { id: run.prospectId },
      });
      if (prospect) return { prospect, run };
    }
  }

  return null;
}

/**
 * Find or create an OutreachSequence + OutreachStep in SENT status for the
 * given contact and prospect. This gives the webhook handler a sequence to
 * update.
 */
async function getOrCreateSequence(contact, prospect, run) {
  // Look for an existing sequence for this contact
  const existing = await prisma.outreachSequence.findFirst({
    where: { contactId: contact.id },
    include: { steps: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    // Reset to SENT so the webhook can transition it to BOOKED
    if (existing.status !== 'SENT') {
      await prisma.outreachSequence.update({
        where: { id: existing.id },
        data: { status: 'SENT' },
      });
      console.log(`  Reset existing sequence ${existing.id} to status=SENT`);
    }

    // Ensure at least one step exists and is in SENT status
    if (existing.steps.length === 0) {
      await prisma.outreachStep.create({
        data: {
          sequenceId: existing.id,
          stepOrder: 1,
          bodyText: 'E2E test step',
          status: 'SENT',
        },
      });
      console.log(`  Created OutreachStep for existing sequence`);
    } else {
      // Reset step statuses to SENT
      await prisma.outreachStep.updateMany({
        where: { sequenceId: existing.id },
        data: { status: 'SENT' },
      });
      console.log(
        `  Reset ${existing.steps.length} OutreachStep(s) to status=SENT`,
      );
    }

    return { ...existing, researchRunId: run.id };
  }

  // Create a new sequence
  const sequence = await prisma.outreachSequence.create({
    data: {
      prospectId: prospect.id,
      contactId: contact.id,
      researchRunId: run.id,
      templateKey: 'e2e-test',
      status: 'SENT',
      isEvidenceBacked: false,
    },
  });
  console.log(`  Created OutreachSequence: ${sequence.id}`);

  await prisma.outreachStep.create({
    data: {
      sequenceId: sequence.id,
      stepOrder: 1,
      bodyText: 'E2E test step',
      status: 'SENT',
    },
  });
  console.log(`  Created OutreachStep for new sequence`);

  return sequence;
}

/**
 * Find or create a test contact for the given prospect.
 * Reuses the test contact from e2e-send-test.mjs (primaryEmail=info@klarifai.nl).
 */
async function getOrCreateContact(prospect) {
  // Prefer an existing contact with the test email
  const existing = await prisma.contact.findFirst({
    where: { prospectId: prospect.id, primaryEmail: TEST_EMAIL },
  });
  if (existing) {
    console.log(
      `  Using existing contact: ${existing.firstName} ${existing.lastName} (${existing.primaryEmail})`,
    );
    return existing;
  }

  // Fall back to any contact for this prospect
  const anyContact = await prisma.contact.findFirst({
    where: { prospectId: prospect.id },
    orderBy: { createdAt: 'desc' },
  });
  if (anyContact) {
    console.log(
      `  Using existing contact (no test email): ${anyContact.firstName} ${anyContact.lastName}`,
    );
    return anyContact;
  }

  // Create a test contact
  const created = await prisma.contact.create({
    data: {
      prospectId: prospect.id,
      firstName: 'Test',
      lastName: prospect.companyName ?? prospect.domain,
      jobTitle: 'Operations Manager',
      seniority: 'Manager',
      department: 'Operations',
      primaryEmail: TEST_EMAIL,
      outreachStatus: 'NONE',
    },
  });
  console.log(
    `  Created test contact: ${created.firstName} ${created.lastName} (${created.primaryEmail})`,
  );
  return created;
}

/**
 * Build and POST a BOOKING_CREATED webhook payload to /api/webhooks/calcom.
 * Returns { status, json }.
 */
async function postBookingCreated(contact, sequence) {
  const bookingUid = `e2e-test-${Date.now()}`;
  const startTime = new Date(Date.now() + 86400000).toISOString(); // tomorrow
  const endTime = new Date(Date.now() + 86400000 + 1800000).toISOString(); // +30min

  const payload = {
    triggerEvent: 'BOOKING_CREATED',
    payload: {
      bookingUid,
      startTime,
      endTime,
      eventTypeId: 999,
      attendees: [
        {
          email: contact.primaryEmail,
          name: `${contact.firstName} ${contact.lastName}`,
        },
      ],
      metadata: {
        outreachSequenceId: sequence.id,
        contactId: contact.id,
      },
      responses: {},
    },
  };

  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', CALCOM_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  console.log(`\n  Booking UID: ${bookingUid}`);
  console.log(`  POSTing to ${WEBHOOK_URL}`);
  console.log(`  Signature: ${signature.slice(0, 16)}... (sha256 hex)`);

  const resp = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cal-signature-256': signature,
    },
    body: rawBody,
  });

  const json = await resp.json().catch(() => ({}));
  console.log(`  HTTP ${resp.status}: ${JSON.stringify(json)}`);

  if (resp.status !== 200) {
    throw new Error(
      `Webhook returned HTTP ${resp.status}: ${JSON.stringify(json)}`,
    );
  }

  return { status: resp.status, json, bookingUid };
}

/**
 * Verify all 6 DB state changes that the webhook handler should produce.
 * Returns an array of { label, pass, detail } result objects.
 */
async function verifyDbState(sequence, contact, prospect, bookingUid) {
  const results = [];

  // 1. OutreachSequence status = BOOKED + metadata.calcom.bookingUid set
  const updatedSequence = await prisma.outreachSequence.findUnique({
    where: { id: sequence.id },
  });
  const seqMeta =
    updatedSequence?.metadata &&
    typeof updatedSequence.metadata === 'object' &&
    !Array.isArray(updatedSequence.metadata)
      ? updatedSequence.metadata
      : {};
  const calcomMeta =
    seqMeta.calcom && typeof seqMeta.calcom === 'object' ? seqMeta.calcom : {};
  const sequenceBooked = updatedSequence?.status === 'BOOKED';
  const bookingUidSet = calcomMeta.bookingUid === bookingUid;
  results.push({
    label: 'OutreachSequence status=BOOKED + bookingUid in metadata',
    pass: sequenceBooked && bookingUidSet,
    detail: `status=${updatedSequence?.status ?? 'null'}, calcom.bookingUid=${calcomMeta.bookingUid ?? 'null'}`,
  });

  // 2. OutreachStep(s) status = BOOKED
  const steps = await prisma.outreachStep.findMany({
    where: { sequenceId: sequence.id },
  });
  const allStepsBooked =
    steps.length > 0 && steps.every((s) => s.status === 'BOOKED');
  results.push({
    label: 'OutreachStep(s) status=BOOKED',
    pass: allStepsBooked,
    detail: `${steps.length} step(s); statuses: ${steps.map((s) => s.status).join(', ') || 'none'}`,
  });

  // 3. Contact outreachStatus = CONVERTED
  const updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: { outreachStatus: true, lastContactedAt: true },
  });
  const contactConverted = updatedContact?.outreachStatus === 'CONVERTED';
  results.push({
    label: 'Contact outreachStatus=CONVERTED',
    pass: contactConverted,
    detail: `outreachStatus=${updatedContact?.outreachStatus ?? 'null'}, lastContactedAt=${updatedContact?.lastContactedAt?.toISOString() ?? 'null'}`,
  });

  // 4. Prospect status = ENGAGED
  const updatedProspect = await prisma.prospect.findUnique({
    where: { id: prospect.id },
    select: { status: true },
  });
  const prospectEngaged = updatedProspect?.status === 'ENGAGED';
  results.push({
    label: 'Prospect status=ENGAGED',
    pass: prospectEngaged,
    detail: `status=${updatedProspect?.status ?? 'null'}`,
  });

  // 5. OutreachLog with channel=calcom, status=booked, bookingUid in metadata
  const outreachLog = await prisma.outreachLog.findFirst({
    where: {
      contactId: contact.id,
      channel: 'calcom',
      status: 'booked',
    },
    orderBy: { createdAt: 'desc' },
  });
  const logMeta =
    outreachLog?.metadata &&
    typeof outreachLog.metadata === 'object' &&
    !Array.isArray(outreachLog.metadata)
      ? outreachLog.metadata
      : {};
  const logBookingUidOk = logMeta.bookingUid === bookingUid;
  const logEventTypeOk = logMeta.eventType === 'BOOKING_CREATED';
  results.push({
    label: 'OutreachLog channel=calcom, status=booked, eventType=BOOKING_CREATED',
    pass: Boolean(outreachLog) && logBookingUidOk && logEventTypeOk,
    detail: `id=${outreachLog?.id ?? 'null'}, bookingUid=${logMeta.bookingUid ?? 'null'}, eventType=${logMeta.eventType ?? 'null'}`,
  });

  // 6. CallPrepPlan created with summary + plan30/60/90 non-null
  const callPrepPlan = await prisma.callPrepPlan.findFirst({
    where: {
      prospectId: prospect.id,
      researchRunId: sequence.researchRunId,
    },
    orderBy: { createdAt: 'desc' },
  });
  const hasSummary =
    typeof callPrepPlan?.summary === 'string' &&
    callPrepPlan.summary.length > 0;
  const hasPlans =
    callPrepPlan?.plan30 !== null &&
    callPrepPlan?.plan60 !== null &&
    callPrepPlan?.plan90 !== null;
  results.push({
    label: 'CallPrepPlan created with summary + plan30/60/90',
    pass: Boolean(callPrepPlan) && hasSummary && hasPlans,
    detail: `id=${callPrepPlan?.id ?? 'null'}, summary=${hasSummary ? `"${callPrepPlan.summary.slice(0, 50)}..."` : 'null/empty'}, plan30=${callPrepPlan?.plan30 !== null ? 'set' : 'null'}, plan60=${callPrepPlan?.plan60 !== null ? 'set' : 'null'}, plan90=${callPrepPlan?.plan90 !== null ? 'set' : 'null'}`,
  });

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Qualifai E2E Cal.com Booking Test ===');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(
    `CALCOM_WEBHOOK_SECRET: ${CALCOM_WEBHOOK_SECRET ? 'set' : 'MISSING'}`,
  );

  // 1. Server health check
  console.log('\n--- Server Health Check ---');
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

  // 2. Find eligible prospect
  console.log('\n--- Finding Eligible Prospect ---');
  const found = await findEligibleProspect();
  if (!found) {
    console.error(
      'ERROR: No eligible prospect found.\n' +
        'Need a prospect with a COMPLETED research run that has at least one\n' +
        'WorkflowHypothesis and one AutomationOpportunity.\n' +
        'Run the research pipeline first (Phase 25+).',
    );
    process.exit(1);
  }
  const { prospect, run } = found;
  console.log(
    `  Prospect: ${prospect.companyName ?? prospect.domain} (${prospect.id})`,
  );
  console.log(`  Research run: ${run.id} (status: ${run.status})`);

  // 3. Get or create test contact
  console.log('\n--- Setting Up Test Contact ---');
  const contact = await getOrCreateContact(prospect);

  // 4. Get or create OutreachSequence in SENT status
  console.log('\n--- Setting Up OutreachSequence ---');
  const sequence = await getOrCreateSequence(contact, prospect, run);
  console.log(`  Sequence ID: ${sequence.id} (status will be reset to SENT)`);

  // 5. Ensure prospect status allows transition to ENGAGED
  //    The webhook sets status=ENGAGED regardless of prior status, so no guard needed.

  // 6. POST BOOKING_CREATED webhook
  console.log('\n--- POSTing BOOKING_CREATED Webhook ---');
  let webhookResult;
  try {
    webhookResult = await postBookingCreated(contact, sequence);
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    process.exit(1);
  }

  if (!webhookResult.json.success) {
    console.error(
      `  ERROR: Webhook responded but success=false: ${JSON.stringify(webhookResult.json)}`,
    );
    process.exit(1);
  }
  console.log(
    `  callPrepId from response: ${webhookResult.json.callPrepId ?? 'null (not yet created or handler returned null)'}`,
  );

  // 7. DB state verification
  console.log('\n--- DB State Verification ---');
  const checks = await verifyDbState(
    sequence,
    contact,
    prospect,
    webhookResult.bookingUid,
  );

  for (const check of checks) {
    const icon = check.pass ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${check.label}`);
    console.log(`         ${check.detail}`);
  }

  // 8. Summary table
  const allPassed = checks.every((c) => c.pass);
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;

  console.log('\n=== Summary Table ===');
  console.log(
    'Check                                                       | Result',
  );
  console.log(
    '------------------------------------------------------------|-------',
  );
  for (const check of checks) {
    const label = check.label.padEnd(60);
    console.log(`${label}| ${check.pass ? 'PASS' : 'FAIL'}`);
  }
  console.log(
    `------------------------------------------------------------|-------`,
  );
  console.log(
    `${'Total'.padEnd(60)}| ${passed}/${checks.length} PASS`,
  );

  console.log(
    `\n=== Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ===`,
  );

  if (!allPassed) {
    console.error(`\nFailed checks (${failed}):`);
    for (const check of checks.filter((c) => !c.pass)) {
      console.error(`  - ${check.label}: ${check.detail}`);
    }
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
