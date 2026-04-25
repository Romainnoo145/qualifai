/**
 * Trigger real outreach pipeline for Nedri Spanstaal BV
 * Generates AI-powered intro + follow-up emails using actual evidence data
 *
 * Usage: npx tsx scripts/tmp-trigger-nedri-outreach.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import {
  generateIntroEmail,
  generateFollowUp,
} from '../lib/ai/generate-outreach';
import type { OutreachContext } from '../lib/ai/outreach-prompts';

const PROSPECT_ID = 'cmmf2kojk003cpwijx38pr0gc';
const CONTACT_ID = 'cmmqpcksh00001xij0ch0mf9q';
const RESEARCH_RUN_ID = 'cmmf2mwkj003fpwij67q5fllx';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  try {
    // Load prospect
    const prospect = await prisma.prospect.findUniqueOrThrow({
      where: { id: PROSPECT_ID },
    });

    // Load contact
    const contact = await prisma.contact.findUniqueOrThrow({
      where: { id: CONTACT_ID },
    });

    // Load top evidence (non-RAG, by confidence)
    const evidence = await prisma.evidenceItem.findMany({
      where: {
        researchRunId: RESEARCH_RUN_ID,
        sourceType: { notIn: ['RAG_DOCUMENT'] },
        confidenceScore: { gte: 0.55 },
      },
      orderBy: { confidenceScore: 'desc' },
      take: 15,
    });

    // Load analysis
    const analysis = await prisma.prospectAnalysis.findFirst({
      where: { prospectId: PROSPECT_ID },
      orderBy: { createdAt: 'desc' },
    });

    // Build evidence summary for enriched context
    const evidenceSummary = evidence
      .map((e) => `[${e.sourceType}] ${e.title}: ${e.snippet?.slice(0, 200)}`)
      .join('\n');

    // Extract analysis highlights
    let analysisHighlights = '';
    if (analysis?.content) {
      const content = analysis.content as any;
      if (content.tracks) {
        analysisHighlights = content.tracks
          .slice(0, 3)
          .map((t: any) => `${t.spvName}: ${t.scope}`)
          .join('\n');
      }
    }

    const ctx: OutreachContext = {
      contact: {
        firstName: contact.firstName ?? 'Directie',
        lastName: contact.lastName ?? '',
        jobTitle: contact.jobTitle ?? 'Directie',
        seniority: contact.seniority ?? 'C-Level',
        department: contact.department ?? 'Management',
      },
      company: {
        companyName: prospect.companyName ?? prospect.domain,
        domain: prospect.domain,
        industry: prospect.industry ?? 'Staal & Infrastructuur',
        employeeRange: '200-500',
        technologies: [],
        description: [
          "Nedri Spanstaal BV is sinds 1925 een van Europa's grootste spanstaalproducenten.",
          'Gevestigd in Venlo, levert aan infrastructuur, spoorwegen, offshore en prefab bouw.',
          evidenceSummary ? `\n\nRECENT EVIDENCE:\n${evidenceSummary}` : '',
          analysisHighlights
            ? `\n\nPARTNERSHIP ANALYSIS:\n${analysisHighlights}`
            : '',
        ].join(' '),
      },
    };

    console.log('📧 Generating intro email for Nedri...');
    const intro = await generateIntroEmail(ctx);
    console.log('\n--- INTRO EMAIL ---');
    console.log(`Subject: ${intro.subject}`);
    console.log(`Opener: ${intro.personalizedOpener}`);
    console.log(`CTA: ${intro.callToAction}`);
    console.log(`\n${intro.bodyText}`);

    // Save intro draft
    const introDraft = await prisma.outreachLog.create({
      data: {
        contactId: CONTACT_ID,
        type: 'INTRO_EMAIL',
        status: 'draft',
        subject: intro.subject,
        bodyHtml: intro.bodyHtml,
        bodyText: intro.bodyText,
        metadata: {
          source: 'pipeline-test',
          personalizedOpener: intro.personalizedOpener,
          callToAction: intro.callToAction,
          evidenceCount: evidence.length,
          analysisVersion: analysis?.version ?? null,
        },
      },
    });
    console.log(`\n✅ Intro draft saved: ${introDraft.id}`);

    console.log('\n📧 Generating follow-up email...');
    const followUp = await generateFollowUp(ctx, intro.subject);
    console.log('\n--- FOLLOW-UP EMAIL ---');
    console.log(`Subject: ${followUp.subject}`);
    console.log(`Opener: ${followUp.personalizedOpener}`);
    console.log(`CTA: ${followUp.callToAction}`);
    console.log(`\n${followUp.bodyText}`);

    // Save follow-up draft
    const followUpDraft = await prisma.outreachLog.create({
      data: {
        contactId: CONTACT_ID,
        type: 'FOLLOW_UP',
        status: 'draft',
        subject: followUp.subject,
        bodyHtml: followUp.bodyHtml,
        bodyText: followUp.bodyText,
        metadata: {
          source: 'pipeline-test',
          personalizedOpener: followUp.personalizedOpener,
          callToAction: followUp.callToAction,
          previousSubject: intro.subject,
        },
      },
    });
    console.log(`\n✅ Follow-up draft saved: ${followUpDraft.id}`);

    console.log('\n🎉 Done! Check /admin/outreach for the new drafts.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
