# Qualifai

Outbound and discovery app for the **Workflow Optimization Sprint** proposition.

## Current Status

The Workflow Sprint engine is now functional end-to-end inside `qualifai`:

- Prospect research runs (website + reviews-first ingestion + manual URLs)
- Evidence quality gate with strict blocking before asset generation
- Hypotheses/opportunities generation (3 bottlenecks + 2 opportunities)
- Proof matching from Obsidian exports (`inventory.json`, `client_offers.json`)
- Workflow Loss Map generation (in-app + PDF export)
- Outreach draft sequence generation with exact 2-step CTA
- Manual approval before sending outreach (v1)
- Call Prep generation (30/60/90 plan)
- Cal.com webhook flow for booking updates and call-prep follow-up generation
- Stale research refresh sweep (admin UI + internal cron endpoint)

## What Is Not Fully Automated Yet

- Research starts in-app directly (worker callback API exists, but dispatch to external worker is not enforced as the default path yet).
- Sequence sending is still manual-approval first (by design for v1).
- Advanced deliverability/sequence analytics are basic and can be expanded.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy env file and fill secrets:

```bash
cp .env.example .env
```

Enrichment provider default is Apollo:

- `ENRICHMENT_PROVIDER=apollo`
- Set `APOLLO_API_KEY` to enable enrichment/search through Apollo.
- `ENRICHMENT_MEMORY_CACHE_TTL_SECONDS` (default `900`)
- `ENRICHMENT_SEARCH_CACHE_TTL_SECONDS` (default `240`)
- `ENRICHMENT_CACHE_MAX_ENTRIES` (default `1500`)
- `ENRICHMENT_REENRICH_AFTER_HOURS` (default `72`)
- Prospect search defaults to company size `5-50` employees unless you override filters.

3. Generate Prisma client and run app:

```bash
npm run db:generate
npm run dev
```

App runs on `http://localhost:9200`.

## Quality Checks

```bash
npx tsc --noEmit --incremental false
npm test -- --run
npm run build
```

## Workflow Smoke Test

Run one end-to-end smoke scenario (campaign -> research -> loss map/pdf -> outreach draft -> reply triage):

```bash
npm run smoke:workflow
```

Notes:

- Requires a valid `.env` (`DATABASE_URL`, `ADMIN_SECRET`, etc.)
- Writes test records into your configured database

## Railway Deployment Checklist

1. Set all required env vars from `.env.example`.
2. Ensure both are configured:

- `DATABASE_URL` (main DB)
- `SHADOW_DATABASE_URL` (separate empty shadow DB)

3. Set admin and automation secrets:

- `ADMIN_SECRET`
- `INTERNAL_CRON_SECRET`
- `WORKER_SHARED_SECRET` (if using callback/worker flow)

4. Set app URLs:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CALCOM_BOOKING_URL` (if calendar CTA is enabled)

5. Configure storage:

- Either S3-compatible `PDF_STORAGE_*`
- Or volume fallback `PDF_STORAGE_VOLUME_PATH`

6. Run migrations on deploy:

```bash
npx prisma migrate deploy
npx prisma generate
```

7. Smoke test after deploy:

- Open `/admin/research`, start a run, check gate status.
- Generate a Loss Map from prospect detail.
- Download PDF via export link.
- Queue outreach draft and approve/send one test.

## DB Drift Handling (Important)

If Railway DB already contains tables not present in migration history, follow:

- `docs/DB_DRIFT_RAILWAY_RUNBOOK.md`

For existing drifted DBs that already have the workflow sprint tables:

```bash
npx prisma migrate resolve --applied 20260207183000_workflow_sprint_engine
npx prisma migrate deploy
```

## Cron Setup: Research Refresh Sweep

Endpoint:

- `POST /api/internal/cron/research-refresh`
- Header: `x-cron-secret: <INTERNAL_CRON_SECRET>`

Example command (Railway cron/scheduled job):

```bash
curl -sS -X POST "$NEXT_PUBLIC_APP_URL/api/internal/cron/research-refresh" \
  -H "content-type: application/json" \
  -H "x-cron-secret: $INTERNAL_CRON_SECRET" \
  -d '{"dryRun":false,"staleDays":14,"limit":25}'
```

Recommended schedule:

- Daily at 06:15 Europe/Amsterdam

Dry run check:

```bash
curl -sS -X POST "$NEXT_PUBLIC_APP_URL/api/internal/cron/research-refresh" \
  -H "content-type: application/json" \
  -H "x-cron-secret: $INTERNAL_CRON_SECRET" \
  -d '{"dryRun":true,"staleDays":14,"limit":25}'
```

## Inbound Reply Webhook

Endpoint:

- `POST /api/webhooks/inbound-reply`
- Header: `x-inbound-secret: <INBOUND_REPLY_WEBHOOK_SECRET>`
- Content-Type: `application/json`, `application/x-www-form-urlencoded`, or `multipart/form-data`

Canonical payload:

```json
{
  "fromEmail": "lead@company.com",
  "subject": "Re: Workflow Loss Map",
  "bodyText": "Klinkt goed, laten we een call plannen",
  "source": "email-provider",
  "autoTriage": true
}
```

Also supported provider-style payloads:

- Resend webhook (`data.from`, `data.text`, `data.html`)
- Mailgun webhook (`sender`, `body-plain`, `body-html`)
- Postmark/Sendgrid webhook (`From`, `TextBody`, `HtmlBody`)

The endpoint will:

1. Match sender email to a contact
2. Store the inbound reply in `OutreachLog`
3. Auto-triage intent (`interested`, `later`, `not_fit`, `stop`, `unknown`) when enabled
4. Update contact and sequence statuses
