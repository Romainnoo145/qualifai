---
created: 2026-04-19T00:00:00.000Z
title: Renew Apollo API key - 401 unauthorized
area: general
files:
  - .env
  - lib/enrichment/providers/apollo.ts
---

## Problem

Apollo API returns 401 "Invalid access credentials" on all search requests. This blocks:

- Company search (Search Companies tab on /admin/prospects)
- Contact search (Search Contacts tab)
- Any enrichment that falls through to Apollo

Confirmed by running `scripts/tmp-test-search.ts` directly — the error is at the API level, not a frontend issue.

## Solution

1. Log in to Apollo.io dashboard
2. Generate a new API key
3. Update `APOLLO_API_KEY` in `.env`
4. Verify with: `npx tsx scripts/tmp-test-search.ts`
5. Delete the test script after verification
