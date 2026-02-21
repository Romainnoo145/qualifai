import type { EnrichmentProviderName } from './types';

const KNOWN_PROVIDERS = new Set<EnrichmentProviderName>(['apollo']);

export function encodeProviderId(
  provider: EnrichmentProviderName,
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  return `${provider}:${id}`;
}

export function decodeProviderId(
  value: string | null | undefined,
): { provider: EnrichmentProviderName; id: string } | null {
  if (!value) return null;
  const split = value.indexOf(':');
  if (split <= 0) {
    // Legacy unscoped IDs are treated as Apollo IDs during the migration.
    return { provider: 'apollo', id: value };
  }

  const provider = value.slice(0, split) as EnrichmentProviderName;
  const id = value.slice(split + 1);
  if (!KNOWN_PROVIDERS.has(provider) || !id) return null;
  return { provider, id };
}
