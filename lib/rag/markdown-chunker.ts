export type MarkdownChunkType = 'TEXT' | 'TABLE';

export type MarkdownChunk = {
  chunkIndex: number;
  chunkType: MarkdownChunkType;
  sectionHeader: string | null;
  content: string;
  tokenEstimate: number;
  lineStart: number;
  lineEnd: number;
};

export type ChunkMarkdownOptions = {
  maxChars?: number;
};

type IndexedLine = {
  text: string;
  lineNumber: number;
};

type Paragraph = {
  text: string;
  lineStart: number;
  lineEnd: number;
};

const DEFAULT_MAX_CHARS = 2200;

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function stripFrontmatter(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return markdown;

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return markdown;
  return lines.slice(end + 1).join('\n');
}

function isHeadingLine(line: string): { level: number; title: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  const hashes = match[1];
  const title = match[2];
  if (!hashes || !title) return null;
  return {
    level: hashes.length,
    title: title.trim(),
  };
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  return /^\|?\s*[:\-\s|]+\|?\s*$/.test(trimmed);
}

function isLikelyTableRow(line: string): boolean {
  return line.includes('|');
}

function isTableStart(line: string, nextLine: string | undefined): boolean {
  if (!isLikelyTableRow(line)) return false;
  if (!nextLine) return false;
  return isTableSeparatorLine(nextLine);
}

function pushChunk(
  chunks: MarkdownChunk[],
  chunkType: MarkdownChunkType,
  sectionHeader: string | null,
  content: string,
  lineStart: number,
  lineEnd: number,
) {
  const trimmed = content.trim();
  if (!trimmed) return;

  chunks.push({
    chunkIndex: chunks.length,
    chunkType,
    sectionHeader,
    content: trimmed,
    tokenEstimate: estimateTokens(trimmed),
    lineStart,
    lineEnd,
  });
}

function splitLongParagraph(
  paragraph: Paragraph,
  maxChars: number,
): Paragraph[] {
  if (paragraph.text.length <= maxChars) return [paragraph];

  const parts: Paragraph[] = [];
  const sentences = paragraph.text.split(/(?<=[.!?])\s+/);

  let buffer = '';
  for (const sentence of sentences) {
    const next = buffer ? `${buffer} ${sentence}` : sentence;
    if (next.length <= maxChars) {
      buffer = next;
      continue;
    }

    if (buffer) {
      parts.push({
        text: buffer.trim(),
        lineStart: paragraph.lineStart,
        lineEnd: paragraph.lineEnd,
      });
      buffer = sentence;
      continue;
    }

    // Single sentence still too long: hard split by words
    const words = sentence.split(/\s+/);
    let wordBuffer = '';
    for (const word of words) {
      const wordNext = wordBuffer ? `${wordBuffer} ${word}` : word;
      if (wordNext.length <= maxChars) {
        wordBuffer = wordNext;
        continue;
      }
      if (wordBuffer) {
        parts.push({
          text: wordBuffer,
          lineStart: paragraph.lineStart,
          lineEnd: paragraph.lineEnd,
        });
      }
      wordBuffer = word;
    }
    if (wordBuffer) {
      parts.push({
        text: wordBuffer,
        lineStart: paragraph.lineStart,
        lineEnd: paragraph.lineEnd,
      });
      wordBuffer = '';
    }
    buffer = '';
  }

  if (buffer.trim()) {
    parts.push({
      text: buffer.trim(),
      lineStart: paragraph.lineStart,
      lineEnd: paragraph.lineEnd,
    });
  }

  return parts;
}

function paragraphize(lines: IndexedLine[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: IndexedLine[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const text = current
      .map((line) => line.text)
      .join('\n')
      .trim();
    if (text) {
      paragraphs.push({
        text,
        lineStart: current[0]!.lineNumber,
        lineEnd: current[current.length - 1]!.lineNumber,
      });
    }
    current = [];
  };

  for (const line of lines) {
    if (!line.text.trim()) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();

  return paragraphs;
}

function pushTextChunks(
  chunks: MarkdownChunk[],
  sectionHeader: string | null,
  textLines: IndexedLine[],
  maxChars: number,
) {
  if (textLines.length === 0) return;

  const paragraphs = paragraphize(textLines).flatMap((paragraph) =>
    splitLongParagraph(paragraph, maxChars),
  );

  let bufferText = '';
  let bufferStart = 0;
  let bufferEnd = 0;

  const flush = () => {
    if (!bufferText.trim()) return;
    pushChunk(
      chunks,
      'TEXT',
      sectionHeader,
      bufferText,
      bufferStart,
      bufferEnd,
    );
    bufferText = '';
    bufferStart = 0;
    bufferEnd = 0;
  };

  for (const paragraph of paragraphs) {
    if (!bufferText) {
      bufferText = paragraph.text;
      bufferStart = paragraph.lineStart;
      bufferEnd = paragraph.lineEnd;
      continue;
    }

    const candidate = `${bufferText}\n\n${paragraph.text}`;
    if (candidate.length <= maxChars) {
      bufferText = candidate;
      bufferEnd = paragraph.lineEnd;
      continue;
    }

    flush();
    bufferText = paragraph.text;
    bufferStart = paragraph.lineStart;
    bufferEnd = paragraph.lineEnd;
  }

  flush();
}

function sectionHeaderFromStack(stack: Array<string | null>): string | null {
  const labels = stack.filter((value): value is string => Boolean(value));
  if (labels.length === 0) return null;
  return labels.join(' > ');
}

export function chunkMarkdownDocument(
  markdown: string,
  options?: ChunkMarkdownOptions,
): MarkdownChunk[] {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const stripped = stripFrontmatter(markdown);
  const lines = stripped.split(/\r?\n/);

  const chunks: MarkdownChunk[] = [];
  const headingStack: Array<string | null> = [
    null,
    null,
    null,
    null,
    null,
    null,
  ];
  let currentSectionHeader: string | null = null;
  let textLines: IndexedLine[] = [];

  const flushText = () => {
    if (textLines.length === 0) return;
    pushTextChunks(chunks, currentSectionHeader, textLines, maxChars);
    textLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i] ?? '';
    const line = rawLine;
    const lineNumber = i + 1;
    const heading = isHeadingLine(line.trim());

    if (heading) {
      flushText();
      headingStack[heading.level - 1] = heading.title;
      for (let j = heading.level; j < headingStack.length; j++) {
        headingStack[j] = null;
      }
      currentSectionHeader = sectionHeaderFromStack(headingStack);
      i += 1;
      continue;
    }

    const nextLine = lines[i + 1];
    if (isTableStart(line, nextLine)) {
      flushText();

      const tableLines: string[] = [line];
      const tableStart = lineNumber;
      let j = i + 1;

      while (j < lines.length) {
        const candidate = lines[j] ?? '';
        const trimmed = candidate.trim();
        if (!trimmed) break;
        if (isLikelyTableRow(candidate) || isTableSeparatorLine(candidate)) {
          tableLines.push(candidate);
          j += 1;
          continue;
        }
        break;
      }

      const tableEnd = i + tableLines.length;
      pushChunk(
        chunks,
        'TABLE',
        currentSectionHeader,
        tableLines.join('\n'),
        tableStart,
        tableEnd,
      );

      i = j;
      continue;
    }

    textLines.push({ text: line, lineNumber });
    i += 1;
  }

  flushText();
  return chunks;
}
