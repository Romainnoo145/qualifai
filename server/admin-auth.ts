import { env } from '@/env.mjs';
import { normalizeAdminToken } from '@/lib/admin-token';

export const KLARIFAI_PROJECT_SLUG = 'klarifai';
export const ATLANTIS_PROJECT_SLUG = 'europes-gate';

export function resolveAdminProjectScope(
  rawToken: string | null | undefined,
):
  | {
      adminScope: 'project';
      allowedProjectSlug: string;
    }
  | null {
  const token = normalizeAdminToken(rawToken);
  if (!token) return null;

  const klarifaiSecret = normalizeAdminToken(env.ADMIN_SECRET);
  if (klarifaiSecret && token === klarifaiSecret) {
    return {
      adminScope: 'project',
      allowedProjectSlug: KLARIFAI_PROJECT_SLUG,
    };
  }

  const atlantisSecret = normalizeAdminToken(env.ATLANTIS_ADMIN_SECRET);
  if (atlantisSecret && token === atlantisSecret) {
    return {
      adminScope: 'project',
      allowedProjectSlug: ATLANTIS_PROJECT_SLUG,
    };
  }

  return null;
}
