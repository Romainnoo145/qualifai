# Prisma Drift Resolution (Railway, Non-Destructive)

This project may have drift between `prisma/migrations` and an already-running Railway database.
Use this runbook to align migration bookkeeping without wiping data.

## 1) Configure a separate shadow database

In Railway, set:

- `DATABASE_URL`: main app database
- `SHADOW_DATABASE_URL`: separate empty Postgres database

Never point `SHADOW_DATABASE_URL` to the same DB/schema as `DATABASE_URL`.

## 2) Deploy strategy

### Fresh database (new environment)

Run normal deployment:

```bash
npx prisma migrate deploy
```

This applies:

- `20260206151704_init`
- `20260207183000_workflow_sprint_engine`

### Existing drifted database (already contains contact/outreach tables)

If tables from `20260207183000_workflow_sprint_engine` already exist in DB, mark migration as applied:

```bash
npx prisma migrate resolve --applied 20260207183000_workflow_sprint_engine
```

Then deploy remaining migrations as usual:

```bash
npx prisma migrate deploy
```

## 3) Verify

```bash
npx prisma migrate status
npx prisma generate
```

Expected outcome: migration history aligned and deploy commands no longer prompt for destructive reset.
