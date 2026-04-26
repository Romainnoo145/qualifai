---
name: Apollo logos always first priority
description: Apollo/Zenprospect logo URLs are curated and consistent — never replace them with scraped favicons
type: feedback
---

Apollo URLs (zenprospect-production.s3.amazonaws.com) are curated company logos in a consistent format. They are ALWAYS better than scraped favicons which vary wildly across platforms (Wix generic, Framer social cards, Webflow defaults, etc).

**Why:** On 2026-04-18, the logo pipeline was changed to prefer scraped favicons over Apollo URLs. This broke logos for 7/10 prospects — replacing clean Apollo logos with tiny generic favicons. User was extremely frustrated after this was discussed 100+ times.

**How to apply:**

- In `lib/enrichment/logo-pipeline.ts`, Apollo logoUrl is ALWAYS priority #1
- Never replace an Apollo URL with a scraped alternative
- The og-logo.ts scraper is fallback only — for prospects without Apollo data
- When displaying logos, use `object-contain` with padding so any format renders cleanly
