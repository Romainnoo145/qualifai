---
name: Never null-out existing prospect data during enrichment
description: buildEnrichmentData must filter null values — Apollo no-coverage fallback was overwriting companyName/industry with null
type: feedback
---

Never write null values to existing prospect fields during enrichment. Apollo no-coverage fallback returns `companyName: null` which was overwriting real data in the DB.

**Why:** Mujjo lost its companyName, industry, city, country after clicking Re-enrich. The enrichment mutation wrote nulls from the no-coverage fallback over existing data. User lost trust in action buttons.

**How to apply:** Any mutation that updates prospect fields from external API responses must filter out null/undefined values before the DB update. Only write fields that have actual new data. This applies to `buildEnrichmentData` in `server/routers/admin.ts` and any future enrichment flows.
