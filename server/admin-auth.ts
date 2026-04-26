import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { normalizeAdminToken } from '@/lib/admin-token';

type AdminScope = {
  adminScope: 'project';
  allowedProjectSlug: string;
};

/**
 * Resolve an admin token to a project scope.
 *
 * Lookup order:
 *   1. DB: bcrypt-compare token against every Project.adminSecretHash.
 *      First match wins; iteration order is whatever Prisma returns.
 *   2. Env fallback (dual-mode safety net during migration; removed
 *      in a follow-up PR once prod is healthy on the DB path):
 *      env.ADMIN_SECRET           → 'klarifai'
 *      env.ATLANTIS_ADMIN_SECRET  → 'europes-gate'
 *
 * Returns null if no match.
 */
export async function resolveAdminProjectScope(
  rawToken: string | null | undefined,
): Promise<AdminScope | null> {
  const token = normalizeAdminToken(rawToken);
  if (!token) return null;

  // 1. DB lookup — primary path. If the DB is unreachable, swallow the
  // error and fall through to env-compare. This is the dual-mode safety
  // net the spec calls for: env-secrets remain a working noodingang
  // during DB outages, deploys, or test runs that don't mock prisma.
  try {
    const projects = await prisma.project.findMany({
      where: { adminSecretHash: { not: null } },
      select: { slug: true, adminSecretHash: true },
    });
    for (const p of projects) {
      if (p.adminSecretHash && bcrypt.compareSync(token, p.adminSecretHash)) {
        return { adminScope: 'project', allowedProjectSlug: p.slug };
      }
    }
  } catch {
    // intentional fall-through to env fallback
  }

  // 2. Env-var fallback — removed in follow-up PR
  const klarifaiSecret = normalizeAdminToken(env.ADMIN_SECRET);
  if (klarifaiSecret && token === klarifaiSecret) {
    return { adminScope: 'project', allowedProjectSlug: 'klarifai' };
  }
  const atlantisSecret = normalizeAdminToken(env.ATLANTIS_ADMIN_SECRET);
  if (atlantisSecret && token === atlantisSecret) {
    return { adminScope: 'project', allowedProjectSlug: 'europes-gate' };
  }

  return null;
}
