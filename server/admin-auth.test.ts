import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted env mock — must precede module imports ----
vi.mock('@/env.mjs', () => ({
  env: {
    ADMIN_SECRET: 'klarifai-env-secret',
    ATLANTIS_ADMIN_SECRET: 'atlantis-env-secret',
  },
}));

// ---- Hoisted prisma mock ----
const findManyMock = vi.fn();
vi.mock('@/lib/prisma', () => ({
  default: {
    project: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

// Import under test AFTER mocks
import { resolveAdminProjectScope } from './admin-auth';
import bcrypt from 'bcryptjs';

const klarifaiHash = bcrypt.hashSync('klarifai-db-secret', 10);
const atlantisHash = bcrypt.hashSync('atlantis-db-secret', 10);

describe('resolveAdminProjectScope', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('returns null for null/empty token', async () => {
    findManyMock.mockResolvedValue([]);
    expect(await resolveAdminProjectScope(null)).toBeNull();
    expect(await resolveAdminProjectScope('')).toBeNull();
    expect(await resolveAdminProjectScope('   ')).toBeNull();
  });

  it('returns project scope when token matches a DB hash (klarifai)', async () => {
    findManyMock.mockResolvedValue([
      { slug: 'klarifai', adminSecretHash: klarifaiHash },
      { slug: 'europes-gate', adminSecretHash: atlantisHash },
    ]);
    const scope = await resolveAdminProjectScope('klarifai-db-secret');
    expect(scope).toEqual({
      adminScope: 'project',
      allowedProjectSlug: 'klarifai',
    });
  });

  it('returns project scope when token matches a DB hash (atlantis)', async () => {
    findManyMock.mockResolvedValue([
      { slug: 'klarifai', adminSecretHash: klarifaiHash },
      { slug: 'europes-gate', adminSecretHash: atlantisHash },
    ]);
    const scope = await resolveAdminProjectScope('atlantis-db-secret');
    expect(scope).toEqual({
      adminScope: 'project',
      allowedProjectSlug: 'europes-gate',
    });
  });

  it('falls back to env compare when no DB hash matches', async () => {
    findManyMock.mockResolvedValue([]);
    const scope = await resolveAdminProjectScope('klarifai-env-secret');
    expect(scope).toEqual({
      adminScope: 'project',
      allowedProjectSlug: 'klarifai',
    });
  });

  it('falls back to env compare for atlantis when no DB hash matches', async () => {
    findManyMock.mockResolvedValue([]);
    const scope = await resolveAdminProjectScope('atlantis-env-secret');
    expect(scope).toEqual({
      adminScope: 'project',
      allowedProjectSlug: 'europes-gate',
    });
  });

  it('prefers DB hash over env compare when both could match', async () => {
    // DB has hash for 'klarifai-env-secret' under europes-gate (contrived but tests precedence)
    const envSecretHashedUnderAtlantis = bcrypt.hashSync(
      'klarifai-env-secret',
      10,
    );
    findManyMock.mockResolvedValue([
      { slug: 'europes-gate', adminSecretHash: envSecretHashedUnderAtlantis },
    ]);
    const scope = await resolveAdminProjectScope('klarifai-env-secret');
    expect(scope?.allowedProjectSlug).toBe('europes-gate');
  });

  it('returns null when neither DB hash nor env matches', async () => {
    findManyMock.mockResolvedValue([
      { slug: 'klarifai', adminSecretHash: klarifaiHash },
    ]);
    expect(await resolveAdminProjectScope('totally-wrong-token')).toBeNull();
  });

  it('strips Bearer prefix and surrounding quotes via normalizeAdminToken', async () => {
    findManyMock.mockResolvedValue([
      { slug: 'klarifai', adminSecretHash: klarifaiHash },
    ]);
    const scope = await resolveAdminProjectScope('Bearer "klarifai-db-secret"');
    expect(scope?.allowedProjectSlug).toBe('klarifai');
  });
});
