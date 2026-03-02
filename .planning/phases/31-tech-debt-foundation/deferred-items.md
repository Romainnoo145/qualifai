# Deferred Items — Phase 31 Tech Debt Foundation

## Pre-existing uncommitted modifications found at session start

These files were already modified in the working directory before Plan 31-01 execution began.
They are out of scope per deviation rules (not caused by current task changes).

### app/admin/prospects/[id]/page.tsx

**Status:** Modified with TypeScript errors (TS2589, TS2322, TS2339 etc)
**Observed:** Partial refactor to use `ResearchRunRow` Prisma type — incomplete change causing type mismatches
**Action needed:** Complete the `ResearchRunRow` type refactor or revert

### components/features/prospects/quality-chip.tsx

**Status:** Modified with TypeScript errors (TS2345 on evidenceItems array)
**Observed:** Pre-existing modification with type narrowing issues
**Action needed:** Fix array type casting for evidenceItems

### server/routers/outreach.ts

**Status:** Modified (no TypeScript errors observed)
**Observed:** In git diff at session start; content unknown
**Action needed:** Review and commit or revert as appropriate
