import { describe, expect, it } from 'vitest';
import { chunkMarkdownDocument } from '@/lib/rag/markdown-chunker';

describe('chunkMarkdownDocument', () => {
  it('keeps section hierarchy in chunk headers', () => {
    const markdown = `# Root\n\nIntro text for root.\n\n## Ops\n\nOperational text.\n\n### Intake\n\nDetailed intake flow.`;

    const chunks = chunkMarkdownDocument(markdown, { maxChars: 500 });

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0]?.sectionHeader).toBe('Root');
    expect(chunks[1]?.sectionHeader).toBe('Root > Ops');
    expect(chunks[2]?.sectionHeader).toBe('Root > Ops > Intake');
  });

  it('preserves markdown tables as atomic chunks', () => {
    const markdown = `## Metrics\n\n| Metric | Value |\n| --- | ---: |\n| CAPEX | 14.7B |\n| CO2 | -178MT |\n\nAfter table explanation.`;

    const chunks = chunkMarkdownDocument(markdown, { maxChars: 60 });
    const tableChunks = chunks.filter((chunk) => chunk.chunkType === 'TABLE');

    expect(tableChunks).toHaveLength(1);
    expect(tableChunks[0]?.content).toContain('| Metric | Value |');
    expect(tableChunks[0]?.content).toContain('| CO2 | -178MT |');

    const tableLineCount = tableChunks[0]!.content.split('\n').length;
    expect(tableLineCount).toBe(4);
  });

  it('splits large prose chunks by size while keeping order', () => {
    const paragraphA =
      'Atlantis logistics corridor alignment requires synchronized permits, utility relocation, and phased commissioning across terminals.';
    const paragraphB =
      'Cross-border scheduling bottlenecks can cascade into contractor idle time, delayed onboarding, and avoidable rework in later stages.';

    const markdown = `# Long\n\n${paragraphA}\n\n${paragraphB}`;

    const chunks = chunkMarkdownDocument(markdown, { maxChars: 120 });
    const textChunks = chunks.filter((chunk) => chunk.chunkType === 'TEXT');

    expect(textChunks.length).toBeGreaterThan(1);
    expect(textChunks[0]!.content).toContain('Atlantis logistics corridor');

    for (const chunk of textChunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(140);
    }
  });
});
