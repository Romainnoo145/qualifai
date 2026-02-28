const SCRAPLING_BASE_URL =
  process.env.SCRAPLING_BASE_URL ?? 'http://localhost:3010';

export interface StealthOptions {
  cookies?: Array<{ name: string; value: string; domain: string }>;
  network_idle?: boolean;
  google_search?: boolean;
}

interface ScraplingResponse {
  success: boolean;
  html: string;
  status_code: number;
  error?: string | null;
}

async function scraplingFetch(
  endpoint: '/fetch' | '/fetch-dynamic',
  url: string,
  options?: StealthOptions,
): Promise<{ html: string; ok: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${SCRAPLING_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...options }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { html: '', ok: false };
    const data = (await response.json()) as ScraplingResponse;
    return { html: data.html ?? '', ok: data.success && data.html.length > 0 };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('scrapling fetch failed for', url, err);
    return { html: '', ok: false };
  }
}

export async function fetchStealth(
  url: string,
  options?: StealthOptions,
): Promise<{ html: string; ok: boolean }> {
  return scraplingFetch('/fetch', url, options);
}

export async function fetchDynamic(
  url: string,
  options?: StealthOptions,
): Promise<{ html: string; ok: boolean }> {
  return scraplingFetch('/fetch-dynamic', url, options);
}
