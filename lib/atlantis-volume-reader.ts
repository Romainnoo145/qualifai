import { promises as fs } from 'fs';
import path from 'path';

export type AtlantisUseCaseCandidate = {
  sourceRef: string;
  title: string;
  summary: string;
  category: string;
  outcomes: string[];
  tags: string[];
  externalUrl: string | null;
};

export type AtlantisScanResult = {
  candidates: AtlantisUseCaseCandidate[];
  filesScanned: number;
  errors: string[];
};

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (TEXT_EXTENSIONS.has(ext)) files.push(fullPath);
  }

  return files;
}

function toTitleFromPath(relativePath: string): string {
  const base = path.basename(relativePath, path.extname(relativePath));
  return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractHeading(content: string): string | null {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      const heading = trimmed.replace(/^#+\s*/, '').trim();
      if (heading.length > 0) return heading;
    }
  }
  return null;
}

function extractSummary(content: string): string | null {
  const lines = content.split(/\r?\n/);
  const chunks: string[] = [];
  let inCodeFence = false;
  let inFrontmatter = false;
  let frontmatterHandled = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!frontmatterHandled && line === '---') {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) frontmatterHandled = true;
      continue;
    }
    if (inFrontmatter) continue;

    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    if (/^[-*_]{3,}$/.test(line)) continue;
    if (
      !line ||
      line.startsWith('#') ||
      line.startsWith('|') ||
      line.startsWith('>') ||
      /^[-*+]\s+/.test(line) ||
      /^\d+\.\s+/.test(line)
    ) {
      continue;
    }

    chunks.push(line);
    if (chunks.join(' ').length >= 320) break;
  }

  if (chunks.length === 0) return null;
  return chunks.join(' ').replace(/\s+/g, ' ').slice(0, 320).trim();
}

function buildTags(relativePath: string, title: string): string[] {
  const directoryTags = path
    .dirname(relativePath)
    .split(path.sep)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .filter(Boolean);

  const titleTags = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 4)
    .slice(0, 5);

  const tags = [...directoryTags, ...titleTags];
  return [...new Set(tags)].slice(0, 12);
}

export async function scanAtlantisVolumesForUseCases(
  basePath: string,
): Promise<AtlantisScanResult> {
  const errors: string[] = [];

  let files: string[] = [];
  try {
    files = await listFilesRecursive(basePath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    return {
      candidates: [],
      filesScanned: 0,
      errors: [`Could not scan Atlantis volumes directory: ${message}`],
    };
  }

  const candidates: AtlantisUseCaseCandidate[] = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(basePath, absolutePath);

    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      const heading = extractHeading(content);
      const title = heading ?? toTitleFromPath(relativePath);
      const summary =
        extractSummary(content) ??
        `Atlantis volume excerpt from ${relativePath}. Use this source for partnership-specific opportunity framing.`;

      candidates.push({
        sourceRef: `atlantis-volume:${relativePath.replaceAll('\\', '/')}`,
        title,
        summary,
        category: 'partnership',
        outcomes: [],
        tags: buildTags(relativePath, title),
        externalUrl: null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error');
      errors.push(`${relativePath}: ${message}`);
    }
  }

  return {
    candidates,
    filesScanned: files.length,
    errors,
  };
}
