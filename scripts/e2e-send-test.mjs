/**
 * E2E Send Test — Phase 27
 *
 * Sends real outreach emails via Resend for 2 test prospects, with the
 * recipient overridden to info@klarifai.nl. Creates OutreachLog records and
 * updates Contact outreachStatus to EMAIL_SENT.
 *
 * Usage:
 *   node scripts/e2e-send-test.mjs
 *   node scripts/e2e-send-test.mjs --dry-run   (print emails without sending)
 */

import 'dotenv/config';
import { createRequire } from 'module';
import { createHmac } from 'node:crypto';

const require = createRequire(import.meta.url);
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { Resend } = require('resend');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TEST_RECIPIENT = 'info@klarifai.nl';
const FROM_EMAIL =
  process.env.OUTREACH_FROM_EMAIL ?? 'Romano Kanters <info@klarifai.nl>';
const REPLY_TO_EMAIL =
  process.env.OUTREACH_REPLY_TO_EMAIL ?? 'info@klarifai.nl';
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'change-me-to-a-secure-token';
const DRY_RUN = process.argv.includes('--dry-run');

// Target 2 prospects for E2E testing (use domains that have completed research)
const TEST_PROSPECT_DOMAINS = ['mujjo.com', 'deondernemer.nl'];

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUnsubscribeToken(contactId, email) {
  return createHmac('sha256', ADMIN_SECRET)
    .update(`${contactId}:${email.trim().toLowerCase()}`)
    .digest('hex');
}

function buildUnsubscribeUrl(contactId, email) {
  const url = new URL('/api/outreach/unsubscribe', APP_URL);
  url.searchParams.set('contactId', contactId);
  url.searchParams.set('token', buildUnsubscribeToken(contactId, email));
  return url.toString();
}

function buildEmailHtml(prospect, contact, hypothesis) {
  const firstName = contact.firstName;
  const companyName = prospect.companyName ?? prospect.domain;
  const hypothesisTitle = hypothesis.title;
  const problemStatement = hypothesis.problemStatement;

  return `<div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a; line-height: 1.6;">
  <p>Hoi ${firstName},</p>

  <p>Ik ben Romano van Klarifai — we helpen bedrijven zoals ${companyName} om terugkerende werkprocessen te automatiseren zodat je team zich kan richten op wat echt waarde toevoegt.</p>

  <p>Ik heb wat onderzoek gedaan naar ${companyName} en viel op dat <strong>${hypothesisTitle.toLowerCase()}</strong> een bottleneck kan zijn:</p>

  <blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; margin: 16px 0; color: #555;">
    ${problemStatement}
  </blockquote>

  <p>Dit is precies het soort probleem dat we bij vergelijkbare bedrijven hebben opgelost. Zou het nuttig zijn om kort te sparren — 15 minuten, geen verplichtingen?</p>

  <p>Je kunt direct een moment pakken via: <a href="${APP_URL}/cal">klarifai.nl/plan</a></p>

  <p>Met vriendelijke groet,<br>
  <strong>Romano Kanters</strong><br>
  Klarifai — AI-gedreven procesautomatisering<br>
  <a href="https://klarifai.nl">klarifai.nl</a></p>
</div>`;
}

function buildEmailText(prospect, contact, hypothesis) {
  const firstName = contact.firstName;
  const companyName = prospect.companyName ?? prospect.domain;
  const hypothesisTitle = hypothesis.title;
  const problemStatement = hypothesis.problemStatement;

  return `Hoi ${firstName},

Ik ben Romano van Klarifai — we helpen bedrijven zoals ${companyName} om terugkerende werkprocessen te automatiseren zodat je team zich kan richten op wat echt waarde toevoegt.

Ik heb wat onderzoek gedaan naar ${companyName} en viel op dat "${hypothesisTitle.toLowerCase()}" een bottleneck kan zijn:

${problemStatement}

Dit is precies het soort probleem dat we bij vergelijkbare bedrijven hebben opgelost. Zou het nuttig zijn om kort te sparren — 15 minuten, geen verplichtingen?

Je kunt direct een moment pakken via: ${APP_URL}/cal

Met vriendelijke groet,
Romano Kanters
Klarifai — AI-gedreven procesautomatisering
klarifai.nl`;
}

function buildSubject(prospect, hypothesis) {
  const companyName = prospect.companyName ?? prospect.domain;
  return `Vraag over ${companyName} — ${hypothesis.title.split(' ').slice(0, 4).join(' ')}...`;
}

function withComplianceFooter(bodyHtml, bodyText, unsubscribeUrl) {
  const htmlFooter = `<p style="margin-top:24px;font-size:12px;color:#667085;">Als u liever geen verdere berichten ontvangt, kunt u zich <a href="${unsubscribeUrl}">hier direct uitschrijven</a>.</p>`;
  const textFooter = `\n\nAls u liever geen verdere berichten ontvangt, schrijf u dan direct uit: ${unsubscribeUrl}`;
  return {
    bodyHtml: `${bodyHtml}${htmlFooter}`,
    bodyText: `${bodyText}${textFooter}`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function getOrCreateTestContact(prospect, _researchRun) {
  // Check if a test contact already exists for this prospect
  const existing = await prisma.contact.findFirst({
    where: { prospectId: prospect.id },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    console.log(
      `  Using existing contact: ${existing.firstName} ${existing.lastName} (${existing.primaryEmail ?? 'no email'})`,
    );
    // If no primaryEmail, update with test address
    if (!existing.primaryEmail) {
      const updated = await prisma.contact.update({
        where: { id: existing.id },
        data: { primaryEmail: TEST_RECIPIENT },
      });
      console.log(
        `  Updated contact primaryEmail to ${TEST_RECIPIENT} (was null)`,
      );
      return updated;
    }
    return existing;
  }

  // Create a test contact with a fictitious name for the prospect
  const created = await prisma.contact.create({
    data: {
      prospectId: prospect.id,
      firstName: 'Test',
      lastName: prospect.companyName ?? prospect.domain,
      jobTitle: 'Operations Manager',
      seniority: 'Manager',
      department: 'Operations',
      primaryEmail: TEST_RECIPIENT,
      outreachStatus: 'NONE',
    },
  });
  console.log(
    `  Created test contact: ${created.firstName} ${created.lastName} (${created.primaryEmail})`,
  );
  return created;
}

async function getTopHypothesis(researchRun) {
  const hypothesis = await prisma.workflowHypothesis.findFirst({
    where: { researchRunId: researchRun.id },
    orderBy: { confidenceScore: 'desc' },
  });
  if (!hypothesis) {
    throw new Error(`No hypothesis found for research run ${researchRun.id}`);
  }
  return hypothesis;
}

async function sendTestEmail(prospect, contact, hypothesis) {
  const subject = buildSubject(prospect, hypothesis);
  const bodyHtml = buildEmailHtml(prospect, contact, hypothesis);
  const bodyText = buildEmailText(prospect, contact, hypothesis);
  const unsubscribeUrl = buildUnsubscribeUrl(contact.id, TEST_RECIPIENT);

  const compliant = withComplianceFooter(bodyHtml, bodyText, unsubscribeUrl);

  console.log(`\n  Subject: ${subject}`);
  console.log(`  To (test override): ${TEST_RECIPIENT}`);
  console.log(`  From: ${FROM_EMAIL}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] Email body (text preview):');
    console.log(
      compliant.bodyText.slice(0, 300) + (compliant.bodyText.length > 300 ? '...' : ''),
    );
    return { messageId: 'dry-run-' + Date.now(), status: 'sent' };
  }

  const { data: sendResult, error: sendError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [TEST_RECIPIENT],
    subject,
    html: compliant.bodyHtml,
    text: compliant.bodyText,
    replyTo: REPLY_TO_EMAIL,
    headers: {
      'List-Unsubscribe': `<mailto:${REPLY_TO_EMAIL}?subject=unsubscribe>, <${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-E2E-Test': 'true',
      'X-Original-Prospect': prospect.domain,
    },
  });

  if (sendError) {
    throw new Error(`Resend API error: ${JSON.stringify(sendError)}`);
  }

  return { messageId: sendResult?.id ?? null, status: 'sent' };
}

async function recordOutreachLog(contact, prospect, hypothesis, sendResult) {
  const subject = buildSubject(prospect, hypothesis);
  const bodyHtml = buildEmailHtml(prospect, contact, hypothesis);
  const bodyText = buildEmailText(prospect, contact, hypothesis);
  const unsubscribeUrl = buildUnsubscribeUrl(contact.id, TEST_RECIPIENT);
  const compliant = withComplianceFooter(bodyHtml, bodyText, unsubscribeUrl);

  const metadata = {
    resendMessageId: sendResult.messageId,
    unsubscribeUrl,
    testRecipient: TEST_RECIPIENT,
    originalProspectDomain: prospect.domain,
    hypothesisId: hypothesis.id,
    hypothesisTitle: hypothesis.title,
    e2eTest: true,
    emailQuality: { status: 'ready', reasons: [] },
  };

  const log = await prisma.outreachLog.create({
    data: {
      contactId: contact.id,
      type: 'INTRO_EMAIL',
      channel: 'email',
      status: sendResult.status,
      subject,
      bodyHtml: compliant.bodyHtml,
      bodyText: compliant.bodyText,
      metadata: metadata,
      sentAt: sendResult.status === 'sent' ? new Date() : null,
    },
  });

  return log;
}

async function updateContactStatus(contact) {
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      outreachStatus: 'EMAIL_SENT',
      lastContactedAt: new Date(),
    },
  });
}

async function processProspect(domain) {
  console.log(`\n--- Processing ${domain} ---`);

  // 1. Find prospect
  const prospect = await prisma.prospect.findFirst({
    where: { domain },
  });
  if (!prospect) {
    console.log(`  SKIP: Prospect not found for domain ${domain}`);
    return null;
  }
  console.log(`  Prospect: ${prospect.companyName} (${prospect.id})`);

  // 2. Find latest completed research run
  const researchRun = await prisma.researchRun.findFirst({
    where: { prospectId: prospect.id, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!researchRun) {
    console.log(`  SKIP: No completed research run found`);
    return null;
  }
  console.log(`  Research run: ${researchRun.id} (qualityApproved: ${researchRun.qualityApproved ?? 'not reviewed'})`);

  // 3. Get top hypothesis
  const hypothesis = await getTopHypothesis(researchRun);
  console.log(
    `  Hypothesis: "${hypothesis.title}" (confidence: ${hypothesis.confidenceScore.toFixed(2)})`,
  );

  // 4. Get or create test contact
  const contact = await getOrCreateTestContact(prospect, researchRun);

  // 5. Check outreach status (skip if already sent in this run)
  if (contact.outreachStatus === 'EMAIL_SENT') {
    console.log(
      `  NOTE: Contact already has outreachStatus=EMAIL_SENT — resetting for E2E test`,
    );
    await prisma.contact.update({
      where: { id: contact.id },
      data: { outreachStatus: 'NONE' },
    });
  }

  // 6. Send email
  console.log(`  Sending email...`);
  let sendResult;
  try {
    sendResult = await sendTestEmail(prospect, contact, hypothesis);
    console.log(
      `  Resend messageId: ${sendResult.messageId}`,
    );
  } catch (err) {
    console.error(`  ERROR sending: ${err.message}`);
    return { prospect, contact, error: err.message };
  }

  // 7. Record OutreachLog
  const log = await recordOutreachLog(contact, prospect, hypothesis, sendResult);
  console.log(`  OutreachLog created: ${log.id} (status: ${log.status})`);

  // 8. Update contact status
  await updateContactStatus(contact);
  console.log(`  Contact outreachStatus -> EMAIL_SENT`);

  return {
    prospect,
    contact,
    hypothesis,
    sendResult,
    logId: log.id,
  };
}

async function verifyDbState(results) {
  console.log('\n--- DB State Verification ---');

  for (const result of results) {
    if (!result || result.error) continue;

    const log = await prisma.outreachLog.findUnique({
      where: { id: result.logId },
    });
    const contact = await prisma.contact.findUnique({
      where: { id: result.contact.id },
      select: { outreachStatus: true, lastContactedAt: true },
    });

    const metadata = log?.metadata;
    const resendMessageId =
      metadata && typeof metadata === 'object'
        ? metadata.resendMessageId
        : null;

    console.log(`\n  ${result.prospect.companyName}:`);
    console.log(
      `    OutreachLog: status=${log?.status}, resendMessageId=${resendMessageId ?? 'null'}`,
    );
    console.log(
      `    Contact: outreachStatus=${contact?.outreachStatus}, lastContactedAt=${contact?.lastContactedAt?.toISOString() ?? 'null'}`,
    );

    const logOk = log?.status === 'sent' && resendMessageId !== null;
    const contactOk = contact?.outreachStatus === 'EMAIL_SENT';
    console.log(
      `    Status: ${logOk && contactOk ? 'PASS' : 'FAIL'} (log=${logOk ? 'ok' : 'FAIL'}, contact=${contactOk ? 'ok' : 'FAIL'})`,
    );
  }
}

async function main() {
  console.log('=== Qualifai E2E Send Test ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no emails sent)' : 'LIVE SEND'}`);
  console.log(`Test recipient override: ${TEST_RECIPIENT}`);
  console.log(`From: ${FROM_EMAIL}`);
  console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? (process.env.RESEND_API_KEY === 're_your-key' ? 'PLACEHOLDER — set a real key!' : 'set') : 'MISSING'}`);

  if (!DRY_RUN && (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your-key')) {
    console.error(
      '\nERROR: RESEND_API_KEY is not configured. Set a real API key in .env or use --dry-run.',
    );
    process.exit(1);
  }

  const results = [];
  for (const domain of TEST_PROSPECT_DOMAINS) {
    const result = await processProspect(domain);
    results.push(result);
  }

  await verifyDbState(results);

  const sent = results.filter((r) => r && !r.error).length;
  const failed = results.filter((r) => r && r.error).length;
  const skipped = results.filter((r) => !r).length;

  console.log(`\n=== Summary ===`);
  console.log(`Sent: ${sent} | Failed: ${failed} | Skipped: ${skipped}`);

  for (const result of results) {
    if (!result) continue;
    if (result.error) {
      console.log(`  ${result.prospect?.companyName ?? 'unknown'}: FAILED — ${result.error}`);
    } else {
      console.log(
        `  ${result.prospect.companyName}: SENT (msgId: ${result.sendResult.messageId}, logId: ${result.logId})`,
      );
    }
  }

  if (!DRY_RUN && sent > 0) {
    console.log(`\nNext step: Check inbox at ${TEST_RECIPIENT} for ${sent} email(s).`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
