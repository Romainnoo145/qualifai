/**
 * GET /voorstel/[slug] — Warm-track prospect voorstel Route Handler.
 *
 * STANDARD prospects: 404 (cold-track deferred to Fase 3).
 * BESPOKE prospects:  serve frozen HTML snapshot (SENT state) or fall back to
 *                     live fetch of bespokeUrl, with <base> + tracking pixel
 *                     injected before delivery.
 *
 * Note on shared fetch helper: the state-machine's fetchBespokeSnapshot
 * returns null on failure (graceful degradation — it must not block the DB
 * transaction). This handler must surface specific HTTP error codes (502, 500)
 * to the client. Different contracts → kept separate, not extracted.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // 1. Look up prospect by readableSlug
  const prospect = await prisma.prospect.findFirst({
    where: { readableSlug: slug },
    select: {
      id: true,
      voorstelMode: true,
      bespokeUrl: true,
    },
  });

  if (!prospect) {
    return new NextResponse('Not found', { status: 404 });
  }

  // 2. Branch on voorstelMode
  if (prospect.voorstelMode === 'STANDARD') {
    // Cold-track wiring deferred to Fase 3.
    return new NextResponse('Voorstel not yet available', { status: 404 });
  }

  // BESPOKE — bespokeUrl must be configured
  if (!prospect.bespokeUrl) {
    return new NextResponse('Bespoke URL missing', { status: 500 });
  }

  // 3. Source resolution: snapshot first, live fetch fallback
  const activeQuote = await prisma.quote.findFirst({
    where: { prospectId: prospect.id, isActiveProposal: true },
    select: { bespokeHtmlSnapshot: true },
  });

  let html: string | null = activeQuote?.bespokeHtmlSnapshot ?? null;

  if (!html) {
    // No snapshot (DRAFT phase, pre-snapshot Quote, or fetch failed at SENT)
    // Fall back to live fetch
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(prospect.bespokeUrl, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return new NextResponse(`Bespoke source returned ${res.status}`, {
          status: 502,
        });
      }
      html = await res.text();
    } catch (err) {
      console.warn('[voorstel-route] live fetch failed', {
        url: prospect.bespokeUrl,
        err: String(err),
      });
      return new NextResponse('Bespoke source unreachable', { status: 502 });
    }
  }

  // 4. Inject <base> + tracking pixel
  const baseTag = `<base href="${prospect.bespokeUrl}/">`;
  const trackingScript = `<script>
fetch(window.location.origin + '/api/offerte/viewed', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prospectId: ${JSON.stringify(prospect.id)} }),
}).catch(() => {});
</script>`;

  // Insert <base> right after <head> (or before </head> as fallback)
  let withBase: string;
  if (html.includes('<head>')) {
    withBase = html.replace('<head>', `<head>\n${baseTag}`);
  } else if (html.includes('</head>')) {
    withBase = html.replace('</head>', `${baseTag}\n</head>`);
  } else {
    // No <head> — likely malformed HTML. Skip base injection, log warning.
    console.warn('[voorstel-route] no <head> found in source HTML', { slug });
    withBase = html;
  }

  // Insert tracking script before </body>
  const finalHtml = withBase.includes('</body>')
    ? withBase.replace('</body>', `${trackingScript}\n</body>`)
    : `${withBase}\n${trackingScript}`;

  // 5. Return as HTML response
  return new NextResponse(finalHtml, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Prevent CDN/proxy caching — every request re-evaluates snapshot vs live
      'cache-control': 'no-store, must-revalidate',
      // Prevent embedding in third-party iframes
      'x-frame-options': 'SAMEORIGIN',
    },
  });
}
