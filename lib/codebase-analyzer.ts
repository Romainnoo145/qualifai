import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Dirent } from 'node:fs';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_CHARS_PER_FILE = 3000;
const MAX_API_FILES = 10;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
]);

const VALID_CATEGORIES = new Set([
  'automation',
  'content',
  'analytics',
  'crm',
  'integration',
  'design',
  'development',
]);

const BUSINESS_CONTEXT_PATTERN =
  /(^|\/)(BUSINESS_INTENT|USER_WORKFLOWS|DOMAIN_MODEL)\.md$/i;

const API_SURFACE_PATTERNS = [
  /(^|\/)app\/api\/.+\/route\.ts$/i,
  /(^|\/)server\/routers\/[^/]+\.ts$/i,
  /(^|\/)routes\/[^/]+\.py$/i,
  /(^|\/)api\/[^/]+\.py$/i,
];

type HighSignalFile = {
  relativePath: string;
  content: string;
};

export interface CodebaseUseCaseCandidate {
  title: string;
  summary: string;
  category: string;
  outcomes: string[];
  tags: string[];
  sourceRef: string;
}

export interface CodebaseAnalysisResult {
  candidates: CodebaseUseCaseCandidate[];
  filesAnalyzed: number;
  projectName: string;
  errors: string[];
}

let genaiClient: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not configured');
  }

  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(apiKey);
  }

  return genaiClient;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return normalizeTitle(value)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

function normalizeCategory(value: unknown): string {
  if (typeof value !== 'string') return 'automation';
  const normalized = value.trim().toLowerCase();
  if (VALID_CATEGORIES.has(normalized)) return normalized;
  return 'automation';
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function extractJsonArray(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // fall through
  }

  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];

  const slice = trimmed.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const filePath of paths) {
    const normalized = filePath.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(filePath);
  }
  return output;
}

function extractProjectNameFromToml(content: string): string | null {
  const match = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  if (!match?.[1]) return null;
  return match[1].trim() || null;
}

function parseProjectName(
  projectPath: string,
  files: HighSignalFile[],
): string {
  const fallback = path.basename(projectPath) || 'project';
  const packageJson = files.find(
    (file) => file.relativePath.toLowerCase() === 'package.json',
  );

  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson.content) as { name?: unknown };
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        return parsed.name.trim();
      }
    } catch {
      // ignore package parse errors
    }
  }

  const pyproject = files.find(
    (file) => file.relativePath.toLowerCase() === 'pyproject.toml',
  );
  if (pyproject) {
    const name = extractProjectNameFromToml(pyproject.content);
    if (name) return name;
  }

  const cargo = files.find(
    (file) => file.relativePath.toLowerCase() === 'cargo.toml',
  );
  if (cargo) {
    const name = extractProjectNameFromToml(cargo.content);
    if (name) return name;
  }

  return fallback;
}

async function collectAllFiles(
  basePath: string,
  currentPath = '',
): Promise<string[]> {
  const absolutePath = path.join(basePath, currentPath);
  let entries: Dirent<string>[];

  try {
    const result = await readdir(absolutePath, {
      withFileTypes: true,
      encoding: 'utf8',
    });
    entries = result as Dirent<string>[];
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = toPosixPath(path.join(currentPath, entry.name));

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const nested = await collectAllFiles(basePath, relativePath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

function findRootFile(
  allFiles: string[],
  filenameLower: string,
): string | undefined {
  return allFiles.find((filePath) => {
    if (filePath.includes('/')) return false;
    return filePath.toLowerCase() === filenameLower;
  });
}

function discoverHighSignalPaths(allFiles: string[]): string[] {
  const sortedFiles = [...allFiles].sort((a, b) => a.localeCompare(b));

  const selected: string[] = [];

  const rootManifestFiles = ['package.json', 'pyproject.toml', 'cargo.toml'];
  for (const manifest of rootManifestFiles) {
    const match = findRootFile(sortedFiles, manifest);
    if (match) selected.push(match);
  }

  const readme = findRootFile(sortedFiles, 'readme.md');
  if (readme) selected.push(readme);

  const contextFiles = sortedFiles.filter((filePath) =>
    BUSINESS_CONTEXT_PATTERN.test(filePath),
  );
  selected.push(...contextFiles);

  const apiFiles = sortedFiles
    .filter((filePath) =>
      API_SURFACE_PATTERNS.some((pattern) => pattern.test(filePath)),
    )
    .slice(0, MAX_API_FILES);
  selected.push(...apiFiles);

  const envExample = findRootFile(sortedFiles, '.env.example');
  if (envExample) selected.push(envExample);

  return dedupePaths(selected);
}

async function loadFiles(
  projectPath: string,
  relativePaths: string[],
  errors: string[],
): Promise<HighSignalFile[]> {
  const output: HighSignalFile[] = [];

  for (const relativePath of relativePaths) {
    try {
      const absolutePath = path.join(projectPath, relativePath);
      const raw = await readFile(absolutePath, 'utf-8');
      output.push({
        relativePath,
        content: raw.slice(0, MAX_CHARS_PER_FILE),
      });
    } catch {
      errors.push(`Failed to read file: ${relativePath}`);
    }
  }

  return output;
}

function normalizeCandidate(
  value: unknown,
  sourcePrefix: string,
  index: number,
): CodebaseUseCaseCandidate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (!title || !summary) return null;

  return {
    title,
    summary,
    category: normalizeCategory(raw.category),
    outcomes: uniqueStrings(raw.outcomes),
    tags: uniqueStrings(raw.tags),
    sourceRef: `${sourcePrefix}:${slugify(title) || `item-${index + 1}`}`,
  };
}

function dedupeCandidates(
  candidates: CodebaseUseCaseCandidate[],
): CodebaseUseCaseCandidate[] {
  const map = new Map<string, CodebaseUseCaseCandidate>();

  for (const candidate of candidates) {
    const key = normalizeTitle(candidate.title);
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, candidate);
      continue;
    }

    existing.tags = uniqueStrings([...existing.tags, ...candidate.tags]);
    existing.outcomes = uniqueStrings([
      ...existing.outcomes,
      ...candidate.outcomes,
    ]);
  }

  return Array.from(map.values());
}

async function extractCandidatesWithGemini(
  files: HighSignalFile[],
  sourcePrefix: string,
): Promise<CodebaseUseCaseCandidate[]> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const assembledContent = files
    .map((file) => `FILE: ${file.relativePath}\n---\n${file.content}\n`)
    .join('\n');

  const response = await model.generateContent(`
Analyze this project codebase and extract the distinct SERVICE CAPABILITIES it delivers to end users or clients. This is a Klarifai project — focus on what business value it provides.

For each capability, provide:
- title: Short service name (e.g. "AI Content Generation", "Social Media Scheduling")
- summary: 2-3 sentence description of what this capability does and what problem it solves for clients
- category: One of: automation, content, analytics, crm, integration, design, development
- outcomes: Array of measurable business outcomes this capability delivers
- tags: Relevant keywords for matching against prospect pain points

Return ONLY a JSON array. If this codebase has no client-facing capabilities, return [].

Project files:
${assembledContent}
`);

  const text = response.response.text();
  const rawItems = extractJsonArray(text);
  const candidates: CodebaseUseCaseCandidate[] = [];

  for (let index = 0; index < rawItems.length; index++) {
    const normalized = normalizeCandidate(rawItems[index], sourcePrefix, index);
    if (normalized) candidates.push(normalized);
  }

  return dedupeCandidates(candidates);
}

export async function analyzeCodebase(
  projectPath: string,
): Promise<CodebaseAnalysisResult> {
  const errors: string[] = [];
  const trimmedPath = projectPath.trim();
  const fallbackProjectName = path.basename(trimmedPath) || 'project';

  if (!trimmedPath) {
    return {
      candidates: [],
      filesAnalyzed: 0,
      projectName: fallbackProjectName,
      errors: ['Project path is empty'],
    };
  }

  try {
    await access(trimmedPath);
  } catch {
    return {
      candidates: [],
      filesAnalyzed: 0,
      projectName: fallbackProjectName,
      errors: [
        `Project path does not exist or is not accessible: ${trimmedPath}`,
      ],
    };
  }

  const allFiles = await collectAllFiles(trimmedPath);
  const selectedPaths = discoverHighSignalPaths(allFiles);

  if (selectedPaths.length === 0) {
    return {
      candidates: [],
      filesAnalyzed: 0,
      projectName: fallbackProjectName,
      errors: ['No high-signal files found in project path'],
    };
  }

  const files = await loadFiles(trimmedPath, selectedPaths, errors);
  const projectName = parseProjectName(trimmedPath, files);
  const sourcePrefix = `codebase:${slugify(projectName) || 'project'}`;

  if (files.length === 0) {
    return {
      candidates: [],
      filesAnalyzed: 0,
      projectName,
      errors:
        errors.length > 0 ? errors : ['No readable high-signal files found'],
    };
  }

  let candidates: CodebaseUseCaseCandidate[] = [];
  try {
    candidates = await extractCandidatesWithGemini(files, sourcePrefix);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown Gemini extraction error';
    errors.push(`Gemini extraction failed: ${message}`);
  }

  return {
    candidates,
    filesAnalyzed: files.length,
    projectName,
    errors,
  };
}
