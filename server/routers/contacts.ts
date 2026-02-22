import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import {
  lookupPerson,
  searchContacts,
  isEnrichmentPlanLimitedError,
} from '@/lib/enrichment';
import type { Prisma } from '@prisma/client';
import { scoreContactForOutreach } from '@/lib/outreach/quality';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function buildApolloDiscoveryGuardrail() {
  return {
    code: 'APOLLO_PLAN_LIMIT',
    provider: 'apollo',
    blockedOperation: 'contact_discovery',
    title: 'Contact discovery blocked by Apollo plan',
    message:
      'Apollo returned API_INACCESSIBLE for people discovery endpoints on this key.',
    recommendation:
      'Use manual contact import for priority accounts or upgrade Apollo API access.',
  } as const;
}

export const contactsRouter = router({
  discoverForCompany: adminProcedure
    .input(
      z.object({
        prospectId: z.string(),
        seniorities: z.array(z.string()).optional(),
        departments: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(25),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prospect = await ctx.db.prospect.findUniqueOrThrow({
        where: { id: input.prospectId },
      });

      let searchResult;
      try {
        searchResult = await searchContacts({
          companyDomains: [prospect.domain],
          seniorities: input.seniorities,
          departments: input.departments,
          pageSize: input.limit,
        });
      } catch (error) {
        if (isEnrichmentPlanLimitedError(error)) {
          return {
            discovered: 0,
            total: 0,
            guardrail: buildApolloDiscoveryGuardrail(),
          };
        }
        throw error;
      }

      const providerIds = searchResult.results
        .map((contact) => contact.lushaPersonId)
        .filter((value): value is string => Boolean(value));
      const candidateEmails = searchResult.results
        .map((contact) => contact.primaryEmail?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value));

      const existingContacts =
        providerIds.length > 0 || candidateEmails.length > 0
          ? await ctx.db.contact.findMany({
              where: {
                prospectId: input.prospectId,
                OR: [
                  ...(providerIds.length > 0
                    ? [{ lushaPersonId: { in: providerIds } }]
                    : []),
                  ...(candidateEmails.length > 0
                    ? [{ primaryEmail: { in: candidateEmails } }]
                    : []),
                ],
              },
              select: {
                lushaPersonId: true,
                primaryEmail: true,
              },
            })
          : [];

      const existingProviderIds = new Set(
        existingContacts
          .map((contact) => contact.lushaPersonId)
          .filter((value): value is string => Boolean(value)),
      );
      const existingEmails = new Set(
        existingContacts
          .map((contact) => contact.primaryEmail?.trim().toLowerCase())
          .filter((value): value is string => Boolean(value)),
      );

      const created = [];
      for (const contact of searchResult.results) {
        const providerId = contact.lushaPersonId;
        const normalizedEmail =
          contact.primaryEmail?.trim().toLowerCase() ?? null;

        if (providerId && existingProviderIds.has(providerId)) continue;
        if (normalizedEmail && existingEmails.has(normalizedEmail)) continue;

        const record = await ctx.db.contact.create({
          data: {
            prospectId: input.prospectId,
            firstName: contact.firstName,
            lastName: contact.lastName,
            jobTitle: contact.jobTitle,
            seniority: contact.seniority,
            department: contact.department,
            emails:
              contact.emails.length > 0 ? toJson(contact.emails) : undefined,
            phones:
              contact.phones.length > 0 ? toJson(contact.phones) : undefined,
            primaryEmail: normalizedEmail ?? contact.primaryEmail,
            primaryPhone: contact.primaryPhone,
            country: contact.country,
            city: contact.city,
            state: contact.state,
            lushaPersonId: contact.lushaPersonId,
            linkedinUrl: contact.linkedinUrl,
            socialProfiles: contact.socialProfiles
              ? toJson(contact.socialProfiles)
              : undefined,
            lushaRawData: toJson(contact.rawData),
          },
        });
        created.push(record);

        if (providerId) existingProviderIds.add(providerId);
        if (normalizedEmail) existingEmails.add(normalizedEmail);
      }

      return {
        discovered: created.length,
        total: searchResult.pagination.totalResults,
        guardrail: null,
      };
    }),

  create: adminProcedure
    .input(
      z.object({
        prospectId: z.string(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        jobTitle: z.string().optional(),
        seniority: z.string().optional(),
        primaryEmail: z.string().email().optional(),
        primaryPhone: z.string().optional(),
        linkedinUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contact.create({
        data: {
          prospectId: input.prospectId,
          firstName: input.firstName,
          lastName: input.lastName,
          jobTitle: input.jobTitle,
          seniority: input.seniority,
          primaryEmail: input.primaryEmail,
          primaryPhone: input.primaryPhone,
          linkedinUrl: input.linkedinUrl,
        },
      });
    }),

  enrichContact: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await ctx.db.contact.findUniqueOrThrow({
        where: { id: input.id },
        include: { prospect: { select: { domain: true } } },
      });

      let enriched;
      try {
        enriched = await lookupPerson(
          {
            firstName: contact.firstName,
            lastName: contact.lastName,
            companyDomain: contact.prospect.domain,
            linkedinUrl: contact.linkedinUrl ?? undefined,
          },
          contact.id,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes('API_INACCESSIBLE') ||
          message.includes('endpoint unavailable for current Apollo plan') ||
          message.includes(
            '[enrichment:lookupPerson] no provider returned data',
          )
        ) {
          return contact;
        }
        throw error;
      }

      return ctx.db.contact.update({
        where: { id: input.id },
        data: {
          jobTitle: enriched.jobTitle ?? contact.jobTitle,
          seniority: enriched.seniority ?? contact.seniority,
          department: enriched.department ?? contact.department,
          emails:
            enriched.emails.length > 0 ? toJson(enriched.emails) : undefined,
          phones:
            enriched.phones.length > 0 ? toJson(enriched.phones) : undefined,
          primaryEmail: enriched.primaryEmail ?? contact.primaryEmail,
          primaryPhone: enriched.primaryPhone ?? contact.primaryPhone,
          country: enriched.country ?? contact.country,
          city: enriched.city ?? contact.city,
          state: enriched.state ?? contact.state,
          lushaPersonId: enriched.lushaPersonId ?? contact.lushaPersonId,
          linkedinUrl: enriched.linkedinUrl ?? contact.linkedinUrl,
          socialProfiles: enriched.socialProfiles
            ? toJson(enriched.socialProfiles)
            : undefined,
          lushaRawData: toJson(enriched.rawData),
        },
      });
    }),

  list: adminProcedure
    .input(
      z
        .object({
          prospectId: z.string().optional(),
          seniority: z.string().optional(),
          department: z.string().optional(),
          outreachStatus: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ContactWhereInput = {};
      if (input?.prospectId) where.prospectId = input.prospectId;
      if (input?.seniority) where.seniority = input.seniority;
      if (input?.department) where.department = input.department;
      if (input?.outreachStatus)
        where.outreachStatus = input.outreachStatus as never;
      if (input?.search) {
        where.OR = [
          { firstName: { contains: input.search, mode: 'insensitive' } },
          { lastName: { contains: input.search, mode: 'insensitive' } },
          { jobTitle: { contains: input.search, mode: 'insensitive' } },
          { primaryEmail: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const contacts = await ctx.db.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: (input?.limit ?? 50) + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              logoUrl: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (contacts.length > (input?.limit ?? 50)) {
        const next = contacts.pop();
        nextCursor = next?.id;
      }

      return { contacts, nextCursor };
    }),

  getOutreachQueue: adminProcedure
    .input(
      z
        .object({
          prospectId: z.string().optional(),
          manualReviewOnly: z.boolean().default(false),
          limit: z.number().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 100;

      const contacts = await ctx.db.contact.findMany({
        where: {
          ...(input?.prospectId ? { prospectId: input.prospectId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(limit * 3, 200),
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              logoUrl: true,
            },
          },
        },
      });

      const scored = contacts.map((contact) => {
        const priority = scoreContactForOutreach(contact);
        return {
          ...contact,
          outreachPriority: {
            score: priority.score,
            tier: priority.tier,
            status: priority.status,
            dataCompleteness: priority.completeness,
            manualReviewReasons: priority.reasons,
          },
        };
      });

      const filtered = input?.manualReviewOnly
        ? scored.filter(
            (contact) => contact.outreachPriority.status !== 'ready',
          )
        : scored;

      const statusRank: Record<'ready' | 'review' | 'blocked', number> = {
        ready: 0,
        review: 1,
        blocked: 2,
      };

      filtered.sort((a, b) => {
        const rank =
          statusRank[a.outreachPriority.status] -
          statusRank[b.outreachPriority.status];
        if (rank !== 0) return rank;
        const score = b.outreachPriority.score - a.outreachPriority.score;
        if (score !== 0) return score;
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      const items = filtered.slice(0, limit);
      const summary = {
        total: scored.length,
        ready: scored.filter(
          (contact) => contact.outreachPriority.status === 'ready',
        ).length,
        review: scored.filter(
          (contact) => contact.outreachPriority.status === 'review',
        ).length,
        blocked: scored.filter(
          (contact) => contact.outreachPriority.status === 'blocked',
        ).length,
      };

      return { items, summary };
    }),

  get: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contact.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              domain: true,
              logoUrl: true,
            },
          },
          signals: { orderBy: { createdAt: 'desc' }, take: 20 },
          outreachLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        outreachNotes: z.string().optional(),
        outreachStatus: z
          .enum([
            'NONE',
            'QUEUED',
            'EMAIL_SENT',
            'OPENED',
            'REPLIED',
            'CONVERTED',
            'OPTED_OUT',
          ])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contact.update({
        where: { id: input.id },
        data: {
          ...(input.outreachNotes !== undefined && {
            outreachNotes: input.outreachNotes,
          }),
          ...(input.outreachStatus !== undefined && {
            outreachStatus: input.outreachStatus,
          }),
        },
      });
    }),
});
