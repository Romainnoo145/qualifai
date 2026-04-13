/**
 * Phase 61-01 / ADMIN-04 — pure preview renderer.
 *
 * Reads lib/quotes/proposal-template.html (byte-identical copy of the
 * shipped design) and produces an HTML string with real quote data
 * substituted. No browser. No Puppeteer. No DB access. Just:
 *   1. Read template from process.cwd() (Pitfall 8: NEVER __dirname on Next.js)
 *   2. Replace {{client_name}}, {{project_title}}, {{tagline}} tokens
 *   3. Structurally rebuild pages 2/3/4/5 using the real Quote fields
 *
 * Totals math is delegated to lib/quotes/quote-totals so the snapshot freeze
 * and the preview renderer stay consistent. Page builders live in
 * ./preview-builders to keep this file under 300 LOC.
 *
 * Note: This renderer produces HTML suitable for an iframe preview inside
 * the admin UI (Phase 61-02+). PDF is out of scope (see Q5 — deferred to
 * a separate Railway worker).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { computeQuoteTotals } from './quote-totals';
import {
  buildUitdagingPage,
  buildAanpakPage,
  buildInvesteringPage,
  buildScopePage,
  escapeHtml,
  type QuoteWithRelations,
} from './preview-builders';

export type { QuoteWithRelations } from './preview-builders';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'lib/quotes/proposal-template.html',
);

// ---------------------------------------------------------------------------
// Section regexes — each a4-page div is replaced wholesale using the
// <!-- PAGINA N — SECTION --> comment as the starting anchor and the next
// section banner (or </body>) as the end-anchor via lookahead. This avoids
// the lazy-divs-nested-too-deep problem of trying to balance </div> tags.
// ---------------------------------------------------------------------------
const PAGE_2_BLOCK = /<!-- PAGINA 2 [\s\S]*?(?=<!-- =+ -->\s*<!-- PAGINA 3)/;
const PAGE_3_BLOCK = /<!-- PAGINA 3 [\s\S]*?(?=<!-- =+ -->\s*<!-- PAGINA 4)/;
const PAGE_4_BLOCK = /<!-- PAGINA 4 [\s\S]*?(?=<!-- =+ -->\s*<!-- PAGINA 5)/;
const PAGE_5_BLOCK = /<!-- PAGINA 5 [\s\S]*?(?=<\/body>)/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function renderQuotePreview(
  quote: QuoteWithRelations,
): Promise<string> {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const totals = computeQuoteTotals(quote.lines, quote.btwPercentage);
  const clientName = quote.prospect.companyName ?? quote.prospect.slug;
  const projectTitle = quote.onderwerp;
  const tagline = quote.tagline ?? '';

  return template
    .replace(/\{\{client_name\}\}/g, escapeHtml(clientName))
    .replace(/\{\{project_title\}\}/g, escapeHtml(projectTitle))
    .replace(/\{\{tagline\}\}/g, escapeHtml(tagline))
    .replace(PAGE_2_BLOCK, buildUitdagingPage(quote, clientName))
    .replace(PAGE_3_BLOCK, buildAanpakPage(quote, clientName))
    .replace(PAGE_4_BLOCK, buildInvesteringPage(quote, totals, clientName))
    .replace(PAGE_5_BLOCK, buildScopePage(quote, clientName));
}
