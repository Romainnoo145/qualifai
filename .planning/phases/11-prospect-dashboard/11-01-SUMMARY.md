---
phase: 11-prospect-dashboard
plan: 01
subsystem: database
tags: [prisma, postgresql, trpc, notifications, resend, slug, env]

# Dependency graph
requires:
  - phase: 10-cadence-engine
    provides: WizardSession model, outreach sequence infrastructure used here
provides:
  - readableSlug field on Prospect (unique, nullable VARCHAR(80)) with @index
  - quoteRequested/quoteRequestedAt fields on WizardSession
  - lib/readable-slug.ts (toReadableSlug, generateUniqueReadableSlug)
  - admin.enrichProspect auto-generates readableSlug when companyName truthy and slug absent
  - admin.generateReadableSlug mutation (override or auto from companyName/domain)
  - wizard.requestQuote public mutation (quote tracking, CONVERTED status, admin notification)
  - notifyAdmin extends to quote_request type with Dutch email body and matchedUseCases
  - NEXT_PUBLIC_WHATSAPP_NUMBER, NEXT_PUBLIC_PHONE_NUMBER, NEXT_PUBLIC_CONTACT_EMAIL in env.mjs
affects:
  - 11-02 (dashboard UI that uses readableSlug for routing and requestQuote for CTA)
  - 11-03 (contact channel display uses the three new env vars)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - generateUniqueReadableSlug accepts PrismaClient as explicit db param (testable, same as matchProofs pattern)
    - readableSlug auto-generation is additive inside enrichProspect (no new DB round-trips on re-enrich if slug exists)
    - requestQuote fires notifyAdmin fire-and-forget with .catch(console.error) — same as all other wizard notify calls

key-files:
  created:
    - lib/readable-slug.ts
    - prisma/migrations/20260221120000_readable_slug_and_quote/migration.sql
  modified:
    - prisma/schema.prisma
    - server/routers/admin.ts
    - server/routers/wizard.ts
    - lib/notifications.ts
    - env.mjs

key-decisions:
  - 'readableSlug auto-generation checks !prospect.readableSlug before enriching — re-enriching never overwrites a custom slug'
  - 'generateReadableSlug mutation sanitises override with toReadableSlug then checks uniqueness against other prospects'
  - 'quote_request email body in Dutch (matching target market NL/BE) with matched use case list for admin context'
  - 'matchedUseCases built from ACCEPTED workflowHypotheses proofMatches useCase titles — 3 hypotheses x 2 proofMatches max'
  - 'requestQuote only updates prospect status to CONVERTED when not already CONVERTED — idempotent'

patterns-established:
  - 'Slug utilities: PrismaClient injected as first arg for testability, no module-level DB singleton'
  - 'Admin notification: fire-and-forget with .catch(console.error), non-blocking wizard mutations'

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 11 Plan 01: Backend Infrastructure for Prospect Dashboard Summary

**Prisma migration adding readableSlug (Prospect) and quoteRequested/quoteRequestedAt (WizardSession), with slug utilities, enrichment auto-slug wiring, requestQuote mutation, Dutch quote_request admin notification, and contact channel env vars**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T22:11:35Z
- **Completed:** 2026-02-20T22:14:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Migrated database: Prospect gains unique readableSlug VARCHAR(80) with index; WizardSession gains quoteRequested Boolean and quoteRequestedAt DateTime
- Built slug utilities in lib/readable-slug.ts: toReadableSlug (sanitise to URL-safe) and generateUniqueReadableSlug (collision-safe with incrementing suffix)
- Wired readableSlug auto-generation into admin.enrichProspect and added admin.generateReadableSlug manual override mutation
- Added wizard.requestQuote public mutation: marks session, converts prospect, fires Dutch admin email with matched use case titles
- Extended notifyAdmin to handle quote_request type with Dutch subject, HTML body listing matchedUseCases, and admin panel link
- Declared three optional client env vars: NEXT_PUBLIC_WHATSAPP_NUMBER, NEXT_PUBLIC_PHONE_NUMBER, NEXT_PUBLIC_CONTACT_EMAIL

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema migration + slug utility** - `ddfaebf` (feat)
2. **Task 2: Backend wiring — enrichment auto-slug, quote mutation, notification, env vars** - `0194dd4` (feat)

## Files Created/Modified

- `prisma/schema.prisma` - Added readableSlug to Prospect, quoteRequested/quoteRequestedAt to WizardSession
- `prisma/migrations/20260221120000_readable_slug_and_quote/migration.sql` - SQL applying both AlterTable statements and indexes
- `lib/readable-slug.ts` - Exports toReadableSlug and generateUniqueReadableSlug utilities
- `server/routers/admin.ts` - enrichProspect auto-slugs on enrich; new generateReadableSlug mutation
- `server/routers/wizard.ts` - New requestQuote public mutation
- `lib/notifications.ts` - Extended type union to include quote_request; added Dutch email body with matchedUseCases
- `env.mjs` - Three new optional NEXT_PUBLIC contact channel vars in client section and runtimeEnv

## Decisions Made

- readableSlug auto-generation checks `!prospect.readableSlug` — re-enriching never overwrites a custom slug
- generateReadableSlug mutation sanitises override input with toReadableSlug then handles uniqueness conflict if another prospect owns it
- quote_request email written in Dutch (NL/BE target market), lists matched use case titles so admin has immediate context on the deal
- matchedUseCases sourced from ACCEPTED workflowHypotheses only (take 3), each with up to 2 proofMatches (useCase.title) — bounded cost, relevant signal
- requestQuote only sets CONVERTED if not already CONVERTED — idempotent for repeated quote requests
- generateUniqueReadableSlug passes PrismaClient as explicit `db` parameter — matches matchProofs pattern, keeps function testable

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Project has no `npm run check` script. Ran `npx tsc --noEmit` and `npx eslint [files]` separately. Both passed with no errors.

## User Setup Required

Optional — add these to `.env.local` for contact channel display on the prospect dashboard:

```
NEXT_PUBLIC_WHATSAPP_NUMBER=+31612345678
NEXT_PUBLIC_PHONE_NUMBER=+31612345678
NEXT_PUBLIC_CONTACT_EMAIL=hello@klarifai.nl
```

## Next Phase Readiness

- All backend infrastructure for Phase 11 is in place
- Schema migrated and Prisma client regenerated
- readableSlug utilities available for dashboard URL routing
- requestQuote mutation ready for CTA wiring in 11-02
- Admin notification with matched use cases ready to fire

---

_Phase: 11-prospect-dashboard_
_Completed: 2026-02-21_

## Self-Check: PASSED

- All 7 files confirmed present on disk
- Both task commits (ddfaebf, 0194dd4) confirmed in git log
