import { describe, expect, it } from 'vitest';
import { extractWebsiteEvidenceFromHtml } from '@/lib/web-evidence-adapter';

describe('web-evidence-adapter', () => {
  it('extracts workflow and stack clues from HTML', () => {
    const html = `
      <html>
        <head>
          <title>Installatiebedrijf Nova | Service en Onderhoud</title>
          <meta
            name="description"
            content="Snelle planning, duidelijke communicatie en vaste monteurs voor onderhoud en storingen."
          />
          <script src="/_next/static/chunks/main.js"></script>
        </head>
        <body>
          <h1>Onderhoud en storingen</h1>
          <p>Vraag direct een offerte aan via ons formulier.</p>
        </body>
      </html>
    `;

    const drafts = extractWebsiteEvidenceFromHtml({
      sourceUrl: 'https://example-installatie.nl',
      sourceType: 'WEBSITE',
      html,
    });

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts[0]?.workflowTag).toBe('planning');
    expect(drafts[0]?.snippet.toLowerCase()).toContain('planning');
    expect(
      drafts.some((draft) => draft.snippet.toLowerCase().includes('nextjs')),
    ).toBe(true);
  });
});
