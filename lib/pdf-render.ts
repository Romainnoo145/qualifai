const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN_X = 42;
const PAGE_MARGIN_TOP = 795;
const FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const MAX_LINES_PER_PAGE = 50;
const MAX_LINE_CHARS = 96;

function sanitizePdfText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\r/g, '')
    .trimEnd();
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(line: string): string[] {
  if (line.length <= MAX_LINE_CHARS) return [line];
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current.length > 0 ? `${current} ${word}` : word;
    if (next.length <= MAX_LINE_CHARS) {
      current = next;
      continue;
    }
    if (current.length > 0) chunks.push(current);
    current = word;
  }
  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [''];
}

function splitIntoPages(text: string): string[][] {
  const normalized = sanitizePdfText(text);
  const rawLines = normalized.split('\n');
  const wrappedLines = rawLines.flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [''];
    return wrapLine(trimmed);
  });

  const lines = wrappedLines.slice(0, MAX_LINES_PER_PAGE * 10);
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += MAX_LINES_PER_PAGE) {
    pages.push(lines.slice(index, index + MAX_LINES_PER_PAGE));
  }
  return pages.length > 0 ? pages : [['Workflow Loss Map']];
}

function createContentStream(lines: string[]): string {
  const escapedLines = lines.map((line) => `(${escapePdfText(line)}) Tj`);
  return `BT
/F1 ${FONT_SIZE} Tf
${LINE_HEIGHT} TL
${PAGE_MARGIN_X} ${PAGE_MARGIN_TOP} Td
${escapedLines.join('\nT*\n')}
ET`;
}

export function renderPlainTextPdf(text: string): Buffer {
  const pages = splitIntoPages(text);
  const fontObjectNumber = 3 + pages.length * 2;
  const objectCount = fontObjectNumber;
  const objects: string[] = [];

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  const pageRefs = pages
    .map((_, pageIndex) => `${3 + pageIndex * 2} 0 R`)
    .join(' ');
  objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;

  for (const [pageIndex, lines] of pages.entries()) {
    const pageObjectNumber = 3 + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const content = createContentStream(lines);
    const contentLength = Buffer.byteLength(content, 'utf8');

    objects[pageObjectNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] = `<< /Length ${contentLength} >>
stream
${content}
endstream`;
  }

  objects[fontObjectNumber] =
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber] ?? ''}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref
0 ${objectCount + 1}
0000000000 65535 f 
`;
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    const offset = String(offsets[objectNumber] ?? 0).padStart(10, '0');
    pdf += `${offset} 00000 n \n`;
  }
  pdf += `trailer
<< /Size ${objectCount + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

  return Buffer.from(pdf, 'utf8');
}
