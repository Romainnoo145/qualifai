import { z } from 'zod';
import { adminProcedure, router } from '../trpc';
import {
  searchCompanies,
  searchContacts,
  enrichCompany,
  isEnrichmentPlanLimitedError,
} from '@/lib/enrichment';
import { nanoid } from 'nanoid';
import type { Prisma } from '@prisma/client';
import { env } from '@/env.mjs';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const REENRICH_AFTER_HOURS = env.ENRICHMENT_REENRICH_AFTER_HOURS ?? 72;
const PREFERRED_COMPANY_SIZE_MIN = 5;
const PREFERRED_COMPANY_SIZE_MAX = 50;

type GuardrailOperation =
  | 'company_search'
  | 'contact_search'
  | 'contact_discovery';

function buildApolloPlanGuardrail(operation: GuardrailOperation) {
  const context =
    operation === 'company_search'
      ? 'company search'
      : operation === 'contact_search'
        ? 'contact search'
        : 'contact discovery';
  return {
    code: 'APOLLO_PLAN_LIMIT',
    provider: 'apollo',
    blockedOperation: operation,
    title: 'Apollo endpoint unavailable on current plan',
    message: `Apollo returned API_INACCESSIBLE for ${context}.`,
    recommendation:
      'Upgrade Apollo API access for people endpoints or use manual contact import for now.',
  } as const;
}

function emptyPagination(page: number, pageSize: number) {
  return {
    page,
    pageSize,
    totalResults: 0,
    totalPages: 0,
  };
}

function isEnrichmentFresh(lastEnrichedAt: Date | null | undefined): boolean {
  if (!lastEnrichedAt) return false;
  const ageMs = Date.now() - lastEnrichedAt.getTime();
  return ageMs < REENRICH_AFTER_HOURS * 60 * 60 * 1000;
}

export const searchRouter = router({
  companies: adminProcedure
    .input(
      z.object({
        companyName: z.string().optional(),
        domain: z.string().optional(),
        industries: z.array(z.string()).optional(),
        countries: z.array(z.string()).optional(),
        cities: z.array(z.string()).optional(),
        employeesMin: z.number().optional(),
        employeesMax: z.number().optional(),
        technologies: z.array(z.string()).optional(),
        intentTopics: z.array(z.string()).optional(),
        page: z.number().default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }),
    )
    .mutation(async ({ input }) => {
      const employeesRange =
        input.employeesMin || input.employeesMax
          ? { min: input.employeesMin, max: input.employeesMax }
          : {
              min: PREFERRED_COMPANY_SIZE_MIN,
              max: PREFERRED_COMPANY_SIZE_MAX,
            };

      try {
        const result = await searchCompanies({
          companyName: input.companyName,
          domain: input.domain,
          industries: input.industries,
          countries: input.countries,
          cities: input.cities,
          employeesRange,
          technologies: input.technologies,
          intentTopics: input.intentTopics,
          page: input.page,
          pageSize: input.pageSize,
        });
        return {
          ...result,
          guardrail: null,
        };
      } catch (error) {
        if (isEnrichmentPlanLimitedError(error)) {
          return {
            results: [],
            pagination: emptyPagination(input.page, input.pageSize),
            guardrail: buildApolloPlanGuardrail('company_search'),
          };
        }
        throw error;
      }
    }),

  contacts: adminProcedure
    .input(
      z.object({
        jobTitles: z.array(z.string()).optional(),
        seniorities: z.array(z.string()).optional(),
        departments: z.array(z.string()).optional(),
        countries: z.array(z.string()).optional(),
        companyIndustries: z.array(z.string()).optional(),
        companyDomains: z.array(z.string()).optional(),
        companySizeMin: z.number().optional(),
        companySizeMax: z.number().optional(),
        page: z.number().default(1),
        pageSize: z.number().min(1).max(100).default(25),
      }),
    )
    .mutation(async ({ input }) => {
      const companySize =
        input.companySizeMin || input.companySizeMax
          ? { min: input.companySizeMin, max: input.companySizeMax }
          : {
              min: PREFERRED_COMPANY_SIZE_MIN,
              max: PREFERRED_COMPANY_SIZE_MAX,
            };

      try {
        const result = await searchContacts({
          jobTitles: input.jobTitles,
          seniorities: input.seniorities,
          departments: input.departments,
          countries: input.countries,
          companyIndustries: input.companyIndustries,
          companyDomains: input.companyDomains,
          companySize,
          page: input.page,
          pageSize: input.pageSize,
        });
        return {
          ...result,
          guardrail: null,
        };
      } catch (error) {
        if (isEnrichmentPlanLimitedError(error)) {
          return {
            results: [],
            pagination: emptyPagination(input.page, input.pageSize),
            guardrail: buildApolloPlanGuardrail('contact_search'),
          };
        }
        throw error;
      }
    }),

  importCompany: adminProcedure
    .input(
      z.object({
        domain: z.string(),
        companyName: z.string().optional(),
        enrich: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cleanDomain = input.domain
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .split('/')[0]!;

      // Check if already exists
      const existing = await ctx.db.prospect.findFirst({
        where: { domain: cleanDomain },
      });
      if (existing) {
        if (input.enrich && !isEnrichmentFresh(existing.lastEnrichedAt)) {
          try {
            const enriched = await enrichCompany(cleanDomain, existing.id);
            const refreshed = await ctx.db.prospect.update({
              where: { id: existing.id },
              data: {
                companyName: enriched.companyName ?? existing.companyName,
                industry: enriched.industry,
                subIndustry: enriched.subIndustry,
                employeeRange: enriched.employeeRange,
                employeeCount: enriched.employeeCount,
                revenueRange: enriched.revenueRange,
                revenueEstimate: enriched.revenueEstimate,
                technologies: enriched.technologies,
                specialties: enriched.specialties,
                country: enriched.country,
                city: enriched.city,
                state: enriched.state,
                description: enriched.description,
                logoUrl: enriched.logoUrl,
                linkedinUrl: enriched.linkedinUrl,
                foundedYear: enriched.foundedYear,
                lushaCompanyId: enriched.lushaCompanyId,
                lushaRawData: toJson(enriched.rawData),
                intentTopics: enriched.intentTopics
                  ? toJson(enriched.intentTopics)
                  : undefined,
                fundingInfo: enriched.fundingInfo
                  ? toJson(enriched.fundingInfo)
                  : undefined,
                lastEnrichedAt: new Date(),
                status: 'ENRICHED',
              },
            });
            return {
              prospect: refreshed,
              alreadyExists: true,
              refreshed: true,
            };
          } catch (error) {
            console.error(
              'Stale enrichment refresh failed for',
              cleanDomain,
              error,
            );
          }
        }

        return { prospect: existing, alreadyExists: true, refreshed: false };
      }

      const slug = nanoid(8);
      let prospect = await ctx.db.prospect.create({
        data: {
          domain: cleanDomain,
          slug,
          companyName: input.companyName,
          status: 'DRAFT',
        },
      });

      if (input.enrich) {
        try {
          const enriched = await enrichCompany(cleanDomain, prospect.id);
          prospect = await ctx.db.prospect.update({
            where: { id: prospect.id },
            data: {
              companyName: enriched.companyName ?? input.companyName,
              industry: enriched.industry,
              subIndustry: enriched.subIndustry,
              employeeRange: enriched.employeeRange,
              employeeCount: enriched.employeeCount,
              revenueRange: enriched.revenueRange,
              revenueEstimate: enriched.revenueEstimate,
              technologies: enriched.technologies,
              specialties: enriched.specialties,
              country: enriched.country,
              city: enriched.city,
              state: enriched.state,
              description: enriched.description,
              logoUrl: enriched.logoUrl,
              linkedinUrl: enriched.linkedinUrl,
              foundedYear: enriched.foundedYear,
              lushaCompanyId: enriched.lushaCompanyId,
              lushaRawData: toJson(enriched.rawData),
              intentTopics: enriched.intentTopics
                ? toJson(enriched.intentTopics)
                : undefined,
              fundingInfo: enriched.fundingInfo
                ? toJson(enriched.fundingInfo)
                : undefined,
              lastEnrichedAt: new Date(),
              status: 'ENRICHED',
            },
          });
        } catch (error) {
          console.error('Enrichment failed for', cleanDomain, error);
        }
      }

      return { prospect, alreadyExists: false };
    }),

  importContact: adminProcedure
    .input(
      z.object({
        prospectId: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        jobTitle: z.string().optional(),
        seniority: z.string().optional(),
        department: z.string().optional(),
        primaryEmail: z.string().optional(),
        primaryPhone: z.string().optional(),
        linkedinUrl: z.string().optional(),
        lushaPersonId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if already exists by external provider person ID
      if (input.lushaPersonId) {
        const existing = await ctx.db.contact.findUnique({
          where: { lushaPersonId: input.lushaPersonId },
        });
        if (existing) return { contact: existing, alreadyExists: true };
      }

      const normalizedEmail = input.primaryEmail?.trim().toLowerCase();
      if (normalizedEmail) {
        const existingByEmail = await ctx.db.contact.findFirst({
          where: {
            prospectId: input.prospectId,
            primaryEmail: normalizedEmail,
          },
        });
        if (existingByEmail) {
          return { contact: existingByEmail, alreadyExists: true };
        }
      }

      const contact = await ctx.db.contact.create({
        data: {
          prospectId: input.prospectId,
          firstName: input.firstName,
          lastName: input.lastName,
          jobTitle: input.jobTitle,
          seniority: input.seniority,
          department: input.department,
          primaryEmail: normalizedEmail ?? input.primaryEmail,
          primaryPhone: input.primaryPhone,
          linkedinUrl: input.linkedinUrl,
          lushaPersonId: input.lushaPersonId,
        },
      });

      return { contact, alreadyExists: false };
    }),

  saveSearch: adminProcedure
    .input(
      z.object({
        name: z.string(),
        type: z.enum(['company', 'contact']),
        filters: z.record(z.string(), z.unknown()),
        resultCount: z.number().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.savedSearch.create({
        data: {
          name: input.name,
          type: input.type,
          filters: toJson(input.filters),
          resultCount: input.resultCount,
          lastRunAt: new Date(),
        },
      });
    }),

  savedSearches: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.savedSearch.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }),
});
