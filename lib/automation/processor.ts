import prisma from '@/lib/prisma';
import { findMatchingRules } from './rules';
import {
  generateIntroEmail,
  generateSignalEmail,
} from '@/lib/ai/generate-outreach';
import type { OutreachContext } from '@/lib/ai/outreach-prompts';
import type { Signal, Contact, Prospect } from '@prisma/client';

type SignalWithRelations = Signal & {
  prospect: Prospect | null;
  contact: (Contact & { prospect: Prospect }) | null;
};

export async function processSignal(
  signal: SignalWithRelations,
): Promise<{ draftsCreated: number }> {
  const rules = findMatchingRules(signal.signalType, signal.contact?.seniority);

  if (rules.length === 0) return { draftsCreated: 0 };

  let draftsCreated = 0;

  for (const rule of rules) {
    if (rule.action === 'DRAFT_EMAIL') {
      // Need a contact to draft an email
      const contact = signal.contact;
      if (!contact) continue;

      const prospect = contact.prospect ?? signal.prospect;
      if (!prospect) continue;

      const ctx: OutreachContext = {
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          jobTitle: contact.jobTitle,
          seniority: contact.seniority,
          department: contact.department,
        },
        company: {
          companyName: prospect.companyName ?? prospect.domain,
          domain: prospect.domain,
          industry: prospect.industry,
          employeeRange: prospect.employeeRange,
          technologies: prospect.technologies,
          description: prospect.description,
        },
        signal: {
          signalType: signal.signalType,
          title: signal.title,
          description: signal.description,
        },
      };

      try {
        const email =
          rule.emailType === 'SIGNAL_TRIGGERED'
            ? await generateSignalEmail(ctx)
            : await generateIntroEmail(ctx);

        await prisma.outreachLog.create({
          data: {
            contactId: contact.id,
            type: 'SIGNAL_TRIGGERED',
            channel: 'email',
            status: 'draft',
            subject: email.subject,
            bodyHtml: email.bodyHtml,
            bodyText: email.bodyText,
            metadata: {
              ruleId: rule.id,
              signalId: signal.id,
              personalizedOpener: email.personalizedOpener,
              callToAction: email.callToAction,
            } as never,
          },
        });

        // Queue contact for review
        if (contact.outreachStatus === 'NONE') {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { outreachStatus: 'QUEUED' },
          });
        }

        draftsCreated++;
      } catch (error) {
        console.error(`Failed to generate email for rule ${rule.id}:`, error);
      }
    }
  }

  // Mark signal as processed
  await prisma.signal.update({
    where: { id: signal.id },
    data: { isProcessed: true },
  });

  return { draftsCreated };
}

export async function processUnprocessedSignals(): Promise<{
  processed: number;
  draftsCreated: number;
}> {
  const signals = await prisma.signal.findMany({
    where: { isProcessed: false },
    include: {
      prospect: true,
      contact: {
        include: { prospect: true },
      },
    },
    take: 50,
  });

  let totalDrafts = 0;

  for (const signal of signals) {
    const result = await processSignal(signal as SignalWithRelations);
    totalDrafts += result.draftsCreated;
  }

  return { processed: signals.length, draftsCreated: totalDrafts };
}
