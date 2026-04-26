# Qualifai Production Deployment Runbook

**Last updated:** 2026-04-26
**Production URL:** https://qualifai.klarifai.nl
**Stack:** Vercel (app) + Railway (Postgres + Redis) + Cloudflare DNS + Resend (email)

---

## Account scope (read first)

- **Vercel** — single account, GitHub login `romainnoo145`, scope `romano-kanters-projects`. Primary email `info@klarifai.nl` is verified on this account but is not a separate login. If `vercel whoami` returns anything else, switch login (`vercel login`) before continuing.
- **Railway** — single account, login `info@klarifai.nl`. Project: `qualifai` (id `044bc7de-faed-4d18-b867-94f9fbfd07f8`).
- **Cloudflare** — DNS for `klarifai.nl` is hosted here. Account: `Rtlkanters@gmail.com`'s zone.
- **Resend** — sending domain `klarifai.nl` (DKIM + SPF verified).

---

## One-time setup (already done — historical record)

The first deploy on 2026-04-26 hit several non-obvious gotchas. Preserve this section so future deploys (new environments, second app, etc.) skip the same traps.

### Vercel project + framework

Two-step. The first step is the trap.

```bash
vercel project add qualifai --scope romano-kanters-projects
vercel link --yes --project qualifai --scope romano-kanters-projects
```

**Critical:** when a Vercel project is created via `vercel project add` (not via the dashboard or via `vercel link` against existing code), the `framework` field is `null` in the project settings. Builds succeed, the deployment shows "Ready", but **all routes return 404 with `x-vercel-error: NOT_FOUND`** — including static assets like `/icon.svg`. This is silent and hard to diagnose.

**Fix:** add `vercel.json` at repo root:

```json
{ "framework": "nextjs" }
```

Without this file, Vercel does not know how to route the build output. With it, everything works on the next deploy.

### Railway services

```bash
railway init --name qualifai
printf "" | railway add --database postgres --json
printf "" | railway add --database redis --json
```

The `printf "" |` is required — `railway add --database postgres` shows an interactive prompt even when the flag is supplied; piping empty stdin auto-confirms.

Capture the **public** connection strings (Vercel cannot reach `*.railway.internal`):

```bash
railway variables --service Postgres-XXXX --kv | grep DATABASE_PUBLIC_URL
railway variables --service Redis-XXXX --kv | grep REDIS_PUBLIC_URL
```

Use these as `DATABASE_URL` and `REDIS_URL` in Vercel.

### Cloudflare DNS — per-project CNAME

The classic `cname.vercel-dns.com` does **not** work for new Vercel projects. Vercel now issues a **unique per-project DNS hostname** (e.g. `f512cc6ecde90982.vercel-dns-017.com`). You must use this exact value, not the generic one.

How to find the right value:

1. In Vercel: Project → Settings → Domains → `qualifai.klarifai.nl` → click `Manual setup`
2. Vercel reveals the per-project CNAME target

In Cloudflare for `klarifai.nl` zone:

| Field        | Value                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Type         | `CNAME`                                                                       |
| Name         | `qualifai`                                                                    |
| Target       | `<unique>.vercel-dns-XXX.com` (from Manual setup, NOT `cname.vercel-dns.com`) |
| Proxy status | **DNS only** (grey cloud — NOT orange)                                        |
| TTL          | Auto                                                                          |

**Proxy must be off.** Cloudflare proxy interferes with Vercel SSL provisioning and edge caching, and can cause redirect loops.

After save, propagation is near-instant. Verify:

```bash
dig qualifai.klarifai.nl CNAME +short
# Expected: f512cc6ecde90982.vercel-dns-017.com.
```

### Custom domain registration in Vercel

```bash
vercel domains add qualifai.klarifai.nl
```

Then verify in dashboard: Project → Settings → Domains → status should be `Valid Configuration` with green checkmark within ~30s. SSL is provisioned automatically.

If it stays "DNS Change Recommended" — the CNAME target is wrong. Re-do the Cloudflare step with the per-project hostname.

### Production env vars

Push from `.env` (or generate fresh secrets for prod-only values):

```bash
# Required by env.mjs (build will fail without these)
printf "production"                                                  | vercel env add NODE_ENV production
printf "$DATABASE_URL_RAILWAY_PUBLIC"                                | vercel env add DATABASE_URL production
printf "$(openssl rand -hex 32)"                                     | vercel env add ADMIN_SECRET production
printf "info@klarifai.nl"                                            | vercel env add ADMIN_EMAIL production
printf "$RESEND_API_KEY"                                             | vercel env add RESEND_API_KEY production

# Required for warm-track (offerte) flow
printf "$REDIS_URL_RAILWAY_PUBLIC"                                   | vercel env add REDIS_URL production
printf "https://qualifai.klarifai.nl"                                | vercel env add NEXT_PUBLIC_APP_URL production
printf "https://cal.com/klarifai/15min"                              | vercel env add NEXT_PUBLIC_CALCOM_BOOKING_URL production
printf "+31682326128"                                                | vercel env add NEXT_PUBLIC_WHATSAPP_NUMBER production
printf "+31682326128"                                                | vercel env add NEXT_PUBLIC_PHONE_NUMBER production
printf "info@klarifai.nl"                                            | vercel env add NEXT_PUBLIC_CONTACT_EMAIL production

# Webhook + cron secrets (generate fresh per-environment)
printf "$(openssl rand -hex 32)"                                     | vercel env add INTERNAL_CRON_SECRET production
printf "$(openssl rand -hex 32)"                                     | vercel env add RESEND_WEBHOOK_SECRET production

# AI / enrichment / scraping (copy from .env)
printf "$APOLLO_API_KEY"                                             | vercel env add APOLLO_API_KEY production
printf "$ANTHROPIC_API_KEY"                                          | vercel env add ANTHROPIC_API_KEY production
printf "$GOOGLE_AI_API_KEY"                                          | vercel env add GOOGLE_AI_API_KEY production
printf "$OPENAI_API_KEY"                                             | vercel env add OPENAI_API_KEY production
printf "$SERP_API_KEY"                                               | vercel env add SERP_API_KEY production
```

**Do NOT push:** `NEXT_PUBLIC_ADMIN_SECRET` — this would embed the admin token in the client bundle (visible to anyone hitting `/admin`). The login UI now reads the token via password input instead.

**Do NOT push:** `OBSIDIAN_VAULT_PATH`, `KATANA_*`, or any local-machine paths.

### Migrations

Run from local against production:

```bash
DATABASE_URL="<railway-postgres-public-url>" npx prisma migrate deploy
```

The schema uses `pgvector` (RAG embeddings). Railway's Postgres template includes pgvector by default — works out of the box. If you ever switch DB providers, verify `CREATE EXTENSION IF NOT EXISTS vector` succeeds.

### Seed (Klarifai-only)

```bash
DATABASE_URL="<railway-postgres-public-url>" npx tsx prisma/seed.ts             # → Klarifai project + 10 industry templates
DATABASE_URL="<railway-postgres-public-url>" npx tsx prisma/seed-use-cases.ts   # → 97 sector-tagged use cases
```

`prisma/seed.ts` skips Atlantis project + SPVs unless `SEED_ATLANTIS=true`. Production runs Klarifai-only.

### Deployment Protection

Project → Settings → Deployment Protection → Vercel Authentication.

Recommended setting: **Standard Protection**. This blocks deployment URLs (e.g. `qualifai-XXXX.vercel.app`) but exposes the production custom domain (`qualifai.klarifai.nl`). Public-facing routes (`/voorstel`, `/offerte`, `/api/webhooks/*`) must remain reachable for prospects.

⚠️ Standard Protection on Hobby tier behaves slightly differently from Pro — alias URLs may also get blocked. Test with `curl -I https://qualifai.klarifai.nl/admin` after enabling — must be 200, not 401.

---

## Routine deploys

Once initial setup is done, deploys are normal:

```bash
git push origin main           # if you've configured Vercel for auto-deploy on push
# OR
vercel --prod --yes            # manual production deploy
```

Vercel runs `next build` against the latest code. If the build references env vars that aren't in production scope, the build will fail loudly — fix by adding the var via `vercel env add NAME production` then redeploy.

**Avoid `vercel --prod --force`** unless you know why. The `--force` flag has been observed to produce empty deployments (build outputs missing) — use a clean `vercel --prod --yes` instead.

---

## Smoke tests

Run after every prod deploy:

```bash
# Public routes — must return 200 (or expected status)
curl -s -o /dev/null -w "%{http_code}\n" https://qualifai.klarifai.nl/voorstel/maintix      # 200
curl -s -o /dev/null -w "%{http_code}\n" https://qualifai.klarifai.nl/offerte/maintix       # 200
curl -s -X POST -d '{}' -o /dev/null -w "%{http_code}\n" \
    https://qualifai.klarifai.nl/api/offerte/viewed                                          # 400 (empty body, route alive)

# Private routes — must return 401 without admin token
curl -s -o /dev/null -w "%{http_code}\n" \
    "https://qualifai.klarifai.nl/api/trpc/projects.list?batch=1&input=%7B%7D"               # 401
curl -s -o /dev/null -w "%{http_code}\n" https://qualifai.klarifai.nl/api/export/companies  # 401
```

If `/admin` returns 200 but content is just empty navy bg, that's the hydration-flicker prevention placeholder — the login form mounts on next React tick. Not a bug.

---

## Common pitfalls (lessons from 2026-04-26 launch)

| Symptom                                                                          | Cause                                                               | Fix                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| All routes return 404 with `x-vercel-error: NOT_FOUND`                           | `vercel.json` missing → framework: null in project settings         | Add `vercel.json` with `"framework": "nextjs"` and redeploy                       |
| Custom domain works but deployment URL gives 401 with `_vercel_sso_nonce` cookie | Vercel Authentication deployment protection                         | Standard Protection mode; production custom domain bypasses                       |
| DNS resolves but Vercel reports "DNS Change Recommended"                         | Used `cname.vercel-dns.com` instead of per-project hostname         | Get the unique target from Vercel Domains → Manual setup, update Cloudflare CNAME |
| Email send returns 500 even with valid `RESEND_API_KEY`                          | `OUTREACH_FROM_EMAIL` not in `klarifai.nl` verified domain          | Use `Romano Kanters <info@klarifai.nl>` exact format                              |
| Quote signing returns 400 `cannot-accept`                                        | Quote status is DRAFT (signing requires SENT or VIEWED)             | Send the quote via admin first to trigger DRAFT → SENT                            |
| `/api/offerte/viewed` does not transition status                                 | Quote.viewedAt already set from earlier load                        | Reset `viewedAt: null` in DB if testing the transition                            |
| Admin login button shows but click does nothing on prod                          | `NEXT_PUBLIC_ADMIN_SECRET` set in prod env (and embedded in bundle) | Remove that env var; login uses password input                                    |

---

## Reference URLs

- Vercel project: https://vercel.com/romano-kanters-projects/qualifai
- Railway project: https://railway.com/project/044bc7de-faed-4d18-b867-94f9fbfd07f8
- Cloudflare DNS: https://dash.cloudflare.com → klarifai.nl → DNS → Records
- Resend: https://resend.com/domains/klarifai.nl
- Production: https://qualifai.klarifai.nl
- Admin: https://qualifai.klarifai.nl/admin
