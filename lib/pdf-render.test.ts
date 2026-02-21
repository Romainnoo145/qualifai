import { describe, expect, it } from 'vitest';
import { renderPlainTextPdf } from '@/lib/pdf-render';

describe('pdf-render', () => {
  it('renders a valid PDF buffer from markdown/plain text', () => {
    const buffer = renderPlainTextPdf(
      '# Workflow Loss Map\n\n- bottleneck A\n- bottleneck B',
    );
    const header = buffer.subarray(0, 8).toString('utf8');

    expect(buffer.byteLength).toBeGreaterThan(100);
    expect(header.startsWith('%PDF-1.4')).toBe(true);
  });
});
