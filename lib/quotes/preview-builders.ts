/**
 * Phase 61-01 / ADMIN-04 — preview renderer page builders.
 *
 * Extracted from preview-template.ts to keep the orchestrator under 300 LOC.
 * Each builder returns a full <div class="a4-page a4-inner">...</div> block
 * that replaces its counterpart in proposal-template.html via a structural
 * regex substitution in preview-template.ts.
 *
 * These helpers are pure — no IO, no randomness. All dynamic data comes in
 * via arguments so they are trivially unit-testable.
 */
import type { Quote, QuoteLine, Prospect } from '@prisma/client';
import { formatEuro } from './quote-totals';

export type QuoteWithRelations = Quote & {
  lines: QuoteLine[];
  prospect: Pick<Prospect, 'slug' | 'companyName'>;
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

function splitLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*]\s*/, '').trim())
    .filter((l) => l.length > 0);
}

function renderScopeList(
  items: string[],
  emptyLabel = 'Nog niet ingevuld',
): string {
  if (items.length === 0) {
    return `<li class="muted">${escapeHtml(emptyLabel)}</li>`;
  }
  return items.map((i) => `<li>${escapeHtml(i)}</li>`).join('\n            ');
}

export function formatGeldigTot(date: Date): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function paragraphsFrom(
  text: string | null | undefined,
  fallback: string,
): string {
  const clean = (text ?? '').trim();
  if (!clean) {
    return `<p class="text-body muted">${escapeHtml(fallback)}</p>`;
  }
  return clean
    .split(/\n\s*\n/)
    .map((p) => `<p class="text-body">${escapeHtml(p.trim())}</p>`)
    .join('\n    ');
}

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

export function buildUitdagingPage(
  quote: QuoteWithRelations,
  clientLabel: string,
): string {
  const heading = quote.onderwerp || 'De uitdaging';
  const body = paragraphsFrom(quote.uitdaging, 'Uitdaging nog niet ingevuld.');
  return `<div class="a4-page a4-inner">
    <div class="section-label"><span class="num">[ 01 ]</span> DE UITDAGING</div>
    <h2 class="main-heading">${escapeHtml(heading)}</h2>

    ${body}

    <div class="inner-footer">
      <span>Klarifai x ${escapeHtml(clientLabel)}</span>
      <span>Pagina 2</span>
    </div>
  </div>`;
}

export function buildAanpakPage(
  quote: QuoteWithRelations,
  clientLabel: string,
): string {
  const phaseList = quote.lines
    .filter((l) => l.tarief >= 0) // skip discount lines on the approach page
    .map((l, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      return `      <li>
        <div class="num">${num}</div>
        <div class="content">
          <div class="title">${escapeHtml(l.fase)}</div>
          <div class="desc">${escapeHtml(l.omschrijving ?? '')}</div>
          <div class="deliverable">
            <span class="deliverable-label">Oplevering</span>
            <span class="deliverable-text">${escapeHtml(l.oplevering ?? '')}</span>
          </div>
        </div>
        <div class="hours">${l.uren} uur</div>
      </li>`;
    })
    .join('\n');

  const lead = paragraphsFrom(quote.aanpak, 'Aanpak nog niet ingevuld.');

  return `<div class="a4-page a4-inner">
    <div class="section-label"><span class="num">[ 02 ]</span> ONZE AANPAK</div>
    <h2 class="main-heading">Zo pakken we het aan.</h2>

    ${lead}

    <ol class="numbered-list">
${phaseList}
    </ol>

    <div class="inner-footer">
      <span>Klarifai x ${escapeHtml(clientLabel)}</span>
      <span>Pagina 3</span>
    </div>
  </div>`;
}

export function buildInvesteringPage(
  quote: QuoteWithRelations,
  totals: { netto: number; btw: number; bruto: number },
  clientLabel: string,
): string {
  const rows = quote.lines
    .map((l) => {
      const isDiscount = l.tarief < 0;
      const subtotal = l.uren * l.tarief;
      const urenCell = isDiscount ? '—' : String(l.uren);
      const tariefCell = isDiscount ? '—' : formatEuro(l.tarief);
      const amountCell = formatEuro(subtotal);
      const rowClass = isDiscount ? ' class="discount-row"' : '';
      const tdClass = isDiscount ? 'bold discount' : 'bold';
      const amountClass = isDiscount ? 'right discount' : 'right';
      return `        <tr${rowClass}>
          <td class="${tdClass}">${escapeHtml(l.fase)}</td>
          <td class="right">${urenCell}</td>
          <td class="right">${tariefCell}</td>
          <td class="${amountClass}">${amountCell}</td>
        </tr>`;
    })
    .join('\n');

  const geldig = formatGeldigTot(quote.geldigTot);

  return `<div class="a4-page a4-inner">
    <div class="section-label"><span class="num">[ 03 ]</span> INVESTERING</div>
    <h2 class="main-heading">De investering in één beeld.</h2>

    <p class="intro-lead">
      De volledige investering per fase, zonder verrassingen.
    </p>

    <table class="pricing-table">
      <thead>
        <tr>
          <th>Fase omschrijving</th>
          <th class="right">Uren</th>
          <th class="right">Tarief</th>
          <th class="right">Bedrag</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>

    <div class="totals-block">
      <div class="total-row">
        <span>Subtotaal</span>
        <span>${formatEuro(totals.netto)}</span>
      </div>
      <div class="total-row">
        <span>BTW ${quote.btwPercentage}%</span>
        <span>${formatEuro(totals.btw)}</span>
      </div>
      <div class="total-row final">
        <span>Totaal incl. BTW</span>
        <span class="amount">${formatEuro(totals.bruto)}</span>
      </div>
    </div>

    <div class="meta-info">
      Voorstel referentie: ${escapeHtml(quote.nummer)}<br>
      Dit voorstel is geldig tot ${escapeHtml(geldig)}.<br>
      Tenzij anders overeengekomen hanteren wij een betalingstermijn van 14 dagen.
    </div>

    <div class="inner-footer">
      <span>Klarifai x ${escapeHtml(clientLabel)}</span>
      <span>Pagina 4</span>
    </div>
  </div>`;
}

export function buildScopePage(
  quote: QuoteWithRelations,
  _clientLabel: string,
): string {
  const inScope = renderScopeList(splitLines(quote.scope));
  const outScope = renderScopeList(splitLines(quote.buitenScope));

  return `<div class="a4-page a4-inner">
    <div class="section-label"><span class="num">[ 04 ]</span> SCOPE & VOLGENDE STAPPEN</div>
    <h2 class="main-heading">Wat wel en wat niet.</h2>

    <p class="intro-lead">
      Om verwachtingen te managen maken we vooraf expliciet wat binnen dit voorstel valt.
    </p>

    <div class="scope-grid">
      <div class="scope-col">
        <h3>In Scope</h3>
        <ul class="scope-list in">
            ${inScope}
        </ul>
      </div>
      <div class="scope-col">
        <h3>Buiten Scope</h3>
        <ul class="scope-list out">
            ${outScope}
        </ul>
      </div>
    </div>

    <div class="cta-block">
      <h3>Klaar om te starten?</h3>
      <p>Heb je nog vragen over dit voorstel of ben je akkoord?<br>Laat het ons weten via <strong>info@klarifai.nl</strong> of bel ons gerust.</p>
    </div>

    <div class="inner-footer">
      <span>Klarifai · Le Mairekade 77, 1013CB Amsterdam · KvK 95189335 · BTW NL005136262B35</span>
    </div>
  </div>`;
}
