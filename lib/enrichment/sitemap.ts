import Sitemapper from 'sitemapper';

/**
 * Cached result shape for sitemap URL discovery.
 * Matches the discoveredAt snapshot pattern used by SerpDiscoveryResult in serp.ts.
 */
export interface SitemapCache {
  discoveredAt: string;
  urls: string[];
}

/**
 * Discover content URLs from a domain's sitemap.xml.
 *
 * Filters out non-content file types (images, PDFs, scripts, etc.) and external
 * CDN/asset URLs. Caps at 25 URLs — WordPress/Shopify sitemaps can have thousands.
 *
 * Returns [] on any error (missing sitemap, malformed XML, network timeout) — sitemap
 * absence is expected for many Dutch SMB sites and should never throw.
 */
export async function discoverSitemapUrls(domain: string): Promise<string[]> {
  try {
    const sitemapper = new Sitemapper({
      url: `https://${domain}/sitemap.xml`,
      timeout: 12000,
      concurrency: 2,
      retries: 1,
    });

    const { sites } = await sitemapper.fetch();

    const filtered = (sites as string[])
      .filter((url) => url.includes(domain))
      .filter(
        (url) =>
          !/\.(jpg|jpeg|png|gif|svg|pdf|xml|css|js|woff|woff2|ttf|ico|mp4|mp3|zip)$/i.test(
            url,
          ),
      )
      .slice(0, 25);

    return filtered;
  } catch {
    return [];
  }
}
