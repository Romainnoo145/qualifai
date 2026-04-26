export const ADMIN_TOKEN_STORAGE_KEY = 'admin-token';

const BEARER_PREFIX_REGEX = /^bearer\s+/i;
const WRAPPED_IN_QUOTES_REGEX = /^(['"])(.*)\1$/;

export function normalizeAdminToken(
  rawToken: string | null | undefined,
): string | null {
  if (typeof rawToken !== 'string') return null;

  let token = rawToken.trim();
  if (!token) return null;

  // Strip Bearer prefix and surrounding quotes in either order — recipients
  // produce both `Bearer "abc"` and `"Bearer abc"` shapes. Loop until stable.
  let previous: string;
  do {
    previous = token;
    if (BEARER_PREFIX_REGEX.test(token)) {
      token = token.replace(BEARER_PREFIX_REGEX, '').trim();
    }
    const quotedMatch = token.match(WRAPPED_IN_QUOTES_REGEX);
    if (quotedMatch) {
      token = quotedMatch[2]?.trim() ?? '';
    }
  } while (token !== previous);

  return token.length > 0 ? token : null;
}
