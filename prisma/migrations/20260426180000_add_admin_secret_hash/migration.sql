-- Add per-project admin secret hash column for multi-tenant auth refactor.
-- bcrypt hashes are 60 chars; VarChar(72) gives headroom.
-- Nullable: dual-mode rollout — projects without hash fall back to env-compare
-- in resolveAdminProjectScope() until the env-fallback is removed in a follow-up PR.
ALTER TABLE "Project" ADD COLUMN "adminSecretHash" VARCHAR(72);
