/**
 * One-shot backfill: hash env.ADMIN_SECRET → klarifai.adminSecretHash
 * and env.ATLANTIS_ADMIN_SECRET → europes-gate.adminSecretHash.
 *
 * Idempotent: re-running picks a fresh salt and overwrites the hash.
 * Plain-token compare keeps working because bcrypt.compareSync hashes
 * the candidate against the stored salt+hash regardless of which run
 * produced the stored value.
 *
 * Run locally: pnpm tsx scripts/migrations/2026-04-26-backfill-admin-hashes.ts
 *
 * Run prod:
 *   vercel env pull .env.production.local
 *   pnpm dotenv -e .env.production.local -- tsx scripts/migrations/2026-04-26-backfill-admin-hashes.ts
 *   rm .env.production.local
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

async function main() {
  const klarifaiSecret = process.env.ADMIN_SECRET;
  if (klarifaiSecret) {
    const hash = bcrypt.hashSync(klarifaiSecret, 10);
    const result = await prisma.project.updateMany({
      where: { slug: 'klarifai' },
      data: { adminSecretHash: hash },
    });
    console.log(`✓ klarifai: ${result.count} row updated`);
  } else {
    console.warn('⚠ ADMIN_SECRET not set — klarifai hash not written');
  }

  const atlantisSecret = process.env.ATLANTIS_ADMIN_SECRET;
  if (atlantisSecret) {
    const hash = bcrypt.hashSync(atlantisSecret, 10);
    const result = await prisma.project.updateMany({
      where: { slug: 'europes-gate' },
      data: { adminSecretHash: hash },
    });
    console.log(`✓ europes-gate: ${result.count} row updated`);
  } else {
    console.log('ℹ ATLANTIS_ADMIN_SECRET not set — skipping europes-gate');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
