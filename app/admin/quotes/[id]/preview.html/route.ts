/**
 * Phase 61-03 / ADMIN-04 — admin-only HTML preview route.
 *
 * Returns the rendered proposal HTML for a Quote scoped through
 * prospect.projectId (Phase 60-04 multi-tenant boundary). The live Quote
 * row is fed directly to renderQuotePreview — no frozen blob is read or
 * constructed here (Pitfall 1).
 *
 * Pitfall 4 security headers: no-store, noindex, no-referrer.
 * Pitfall 8: renderQuotePreview already reads the template from
 * process.cwd(), so Next.js bundling resolves it at build time.
 */
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveAdminProjectScope } from '@/server/admin-auth';
import { renderQuotePreview } from '@/lib/quotes/preview-template';

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  // Next 15 ships params as either sync or Promise depending on compat mode.
  const rawParams = await Promise.resolve(context.params);
  const id = rawParams.id;

  const token =
    req.headers.get('x-admin-token') ?? req.nextUrl.searchParams.get('token');
  const scope = resolveAdminProjectScope(token);
  if (!scope) {
    return new Response('Unauthorized', { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { slug: scope.allowedProjectSlug },
    select: { id: true },
  });
  if (!project) {
    return new Response(`Unknown project scope: ${scope.allowedProjectSlug}`, {
      status: 400,
    });
  }

  // Multi-tenant filter: prospect.projectId is the Phase 60-04 tenancy boundary.
  const quote = await prisma.quote.findFirst({
    where: {
      id,
      prospect: { projectId: project.id },
    },
    include: {
      lines: { orderBy: { position: 'asc' } },
      prospect: { select: { slug: true, companyName: true } },
    },
  });
  if (!quote) {
    return new Response('Not Found', { status: 404 });
  }

  const html = await renderQuotePreview(quote);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
}
