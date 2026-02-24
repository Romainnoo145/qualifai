import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Dirent } from 'node:fs';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const MIN_FILE_SIZE_CHARS = 200;
const MAX_FILES = 120;
const MAX_FILES_PER_PROJECT = 18;
const MAX_CHARS_PER_FILE = 2000;
const BATCH_SIZE = 6;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.claude',
  '.pytest_cache',
  'pictures',
  'files',
  '_archive',
  '30_The_Archive',
  '40_AI_Instruction_Sets',
  '99_Inbox',
  '07_Intelligence_Delta',
  '20_Pattern_Library',
  '90_Archive',
]);

const HIGH_SIGNAL_FILENAMES = new Set([
  'business_intent.md',
  'user_workflows.md',
  'project_manifest.md',
  'readme.md',
  'services.md',
  'service_catalog.md',
  'client_offers.md',
  'case_studies.md',
]);

const HIGH_SIGNAL_PATH_HINTS = [
  '/00_context/',
  '/00_atlas/',
  '/projects/active/',
  '/docs/',
];

const EXCLUDED_PATH_HINTS = [
  '/00_atlas/projects/archived/',
  '/projects/archived/',
  '/02_sprints/',
  '/03_debt/',
  '/03_technical_debt/',
  '/04_security/',
  '/requirements/',
  '/brand-strategy/',
  '/rAG-volumes/'.toLowerCase(),
  '/session_log',
  '/phase_',
  '/completion_report',
  '/task_reality_check',
  '/.claude/commands/',
];

const BLOCKED_TITLE_HINTS = [
  'pattern',
  'audit',
  'checklist',
  'qa',
  'security',
  'roadmap',
  'manifest',
  'session log',
  'technical debt',
  'command',
  'migration wizard',
  'architecture',
];

const CLIENT_SIGNAL_TERMS = [
  'klant',
  'client',
  'bedrijf',
  'business',
  'automation',
  'workflow',
  'crm',
  'dashboard',
  'integratie',
  'integration',
  'marketing',
  'content',
  'sales',
  'lead',
];

const VALID_CATEGORIES = new Set([
  'automation',
  'content',
  'analytics',
  'crm',
  'integration',
  'design',
  'development',
]);

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
  const key = value.trim().toLowerCase();
  if (VALID_CATEGORIES.has(key)) return key;
  return 'automation';
}

function hasAnyHint(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

function getProjectKey(relativePath: string): string {
  const normalized = relativePath.toLowerCase();
  const forgeMatch = normalized.match(/^10_the_forge\/([^/]+)\//);
  if (forgeMatch?.[1]) return `forge:${forgeMatch[1]}`;

  const activeMatch = normalized.match(
    /^00_atlas\/projects\/active\/([^/]+)\.md$/,
  );
  if (activeMatch?.[1]) return `active:${activeMatch[1]}`;

  return 'other';
}

function isExcludedPath(relativePath: string): boolean {
  const lowered = `/${relativePath.toLowerCase()}`;
  if (hasAnyHint(lowered, EXCLUDED_PATH_HINTS)) return true;
  return false;
}

function isHighSignalFile(relativePath: string): boolean {
  const lowered = relativePath.toLowerCase();
  const basename = path.basename(lowered);
  if (HIGH_SIGNAL_FILENAMES.has(basename)) return true;
  return hasAnyHint(`/${lowered}`, HIGH_SIGNAL_PATH_HINTS);
}

function isLikelyClientFacingCandidate(
  candidate: VaultUseCaseCandidate,
): boolean {
  const title = candidate.title.toLowerCase();
  const summary = candidate.summary.toLowerCase();
  const joined = `${title} ${summary} ${candidate.tags.join(' ').toLowerCase()}`;

  if (BLOCKED_TITLE_HINTS.some((hint) => title.includes(hint))) return false;
  if (summary.includes('internal') && !summary.includes('client')) return false;

  const hasClientSignal = CLIENT_SIGNAL_TERMS.some((term) =>
    joined.includes(term),
  );
  return hasClientSignal;
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

type VaultFile = {
  relativePath: string;
  content: string;
  priorityScore: number;
  projectKey: string;
};

export type VaultUseCaseCandidate = {
  title: string;
  summary: string;
  category: string;
  outcomes: string[];
  tags: string[];
  sourceRef: string;
};

export interface VaultScanResult {
  candidates: VaultUseCaseCandidate[];
  filesScanned: number;
  errors: string[];
}

async function collectMarkdownFiles(
  vaultPath: string,
  currentRelativePath = '',
): Promise<VaultFile[]> {
  const currentPath = path.join(vaultPath, currentRelativePath);
  const files: VaultFile[] = [];
  let entries: Dirent<string>[];

  try {
    const result = await readdir(currentPath, {
      withFileTypes: true,
      encoding: 'utf8',
    });
    entries = result as Dirent<string>[];
  } catch {
    return [];
  }

  for (const entry of entries) {
    const relativePath = path.join(currentRelativePath, entry.name);
    const loweredRelativePath = relativePath
      .split(path.sep)
      .join('/')
      .toLowerCase();

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const nested = await collectMarkdownFiles(vaultPath, relativePath);
      files.push(...nested);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
    if (isExcludedPath(loweredRelativePath)) continue;
    if (!isHighSignalFile(loweredRelativePath)) continue;

    let content: string;
    try {
      content = await readFile(path.join(vaultPath, relativePath), 'utf-8');
    } catch {
      continue;
    }

    const trimmed = content.trim();
    if (trimmed.length < MIN_FILE_SIZE_CHARS) continue;

    const normalizedRelPath = relativePath.split(path.sep).join('/');
    const lowerRelPath = normalizedRelPath.toLowerCase();
    let priorityScore = 0;
    if (lowerRelPath.endsWith('/business_intent.md')) priorityScore += 8;
    if (lowerRelPath.endsWith('/user_workflows.md')) priorityScore += 6;
    if (lowerRelPath.endsWith('/project_manifest.md')) priorityScore += 5;
    if (lowerRelPath.endsWith('/readme.md')) priorityScore += 4;
    if (lowerRelPath.includes('/00_context/')) priorityScore += 3;
    if (lowerRelPath.includes('/00_atlas/')) priorityScore += 2;
    if (lowerRelPath.includes('/projects/active/')) priorityScore += 2;

    files.push({
      relativePath: normalizedRelPath,
      content: trimmed.slice(0, MAX_CHARS_PER_FILE),
      priorityScore,
      projectKey: getProjectKey(normalizedRelPath),
    });
  }

  return files;
}

function selectBalancedFiles(files: VaultFile[], limit: number): VaultFile[] {
  const groups = new Map<string, VaultFile[]>();
  for (const file of files) {
    const list = groups.get(file.projectKey) ?? [];
    list.push(file);
    groups.set(file.projectKey, list);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  const selected: VaultFile[] = [];
  const perProjectCount = new Map<string, number>();
  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  let madeProgress = true;
  while (selected.length < limit && madeProgress) {
    madeProgress = false;
    for (const key of keys) {
      if (selected.length >= limit) break;
      const list = groups.get(key);
      if (!list || list.length === 0) continue;

      const currentCount = perProjectCount.get(key) ?? 0;
      if (currentCount >= MAX_FILES_PER_PROJECT) continue;

      const next = list.shift();
      if (!next) continue;
      selected.push(next);
      perProjectCount.set(key, currentCount + 1);
      madeProgress = true;
    }
  }

  return selected;
}

function chunkFiles(files: VaultFile[], chunkSize: number): VaultFile[][] {
  const output: VaultFile[][] = [];
  for (let i = 0; i < files.length; i += chunkSize) {
    output.push(files.slice(i, i + chunkSize));
  }
  return output;
}

function findSourceFile(
  sourceFile: unknown,
  batchFiles: VaultFile[],
): string | null {
  if (typeof sourceFile !== 'string' || !sourceFile.trim()) return null;
  const normalizedInput = sourceFile
    .trim()
    .split(path.sep)
    .join('/')
    .toLowerCase();

  const exact = batchFiles.find(
    (file) => file.relativePath.toLowerCase() === normalizedInput,
  );
  if (exact) return exact.relativePath;

  const basenameMatch = batchFiles.find((file) =>
    file.relativePath.toLowerCase().endsWith(normalizedInput),
  );
  if (basenameMatch) return basenameMatch.relativePath;

  return null;
}

function normalizeCandidate(
  item: unknown,
  batchFiles: VaultFile[],
  batchIndex: number,
  itemIndex: number,
): VaultUseCaseCandidate | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const raw = item as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';

  if (!title || !summary) return null;

  const sourceFile = findSourceFile(raw.sourceFile, batchFiles);
  const sourceFileKey =
    sourceFile ?? `batch-${batchIndex + 1}-item-${itemIndex + 1}`;
  const sourceRef = `vault:${sourceFileKey}:${slugify(title) || `item-${itemIndex + 1}`}`;

  return {
    title,
    summary,
    category: normalizeCategory(raw.category),
    outcomes: uniqueStrings(raw.outcomes),
    tags: uniqueStrings(raw.tags),
    sourceRef,
  };
}

async function extractBatchCandidates(
  batch: VaultFile[],
  batchIndex: number,
): Promise<VaultUseCaseCandidate[]> {
  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });
  const context = batch
    .map((file) => `FILE: ${file.relativePath}\n---\n${file.content}\n`)
    .join('\n');

  const response = await model.generateContent(`
You are extracting Klarifai client-facing services from Obsidian notes.

Only extract paid, client-facing SERVICES Klarifai (or project owner) delivers to customers.
Do not include: internal tooling, coding standards, architecture docs, sprint logs, audits, QA commands, migration plans, pattern library entries, or security checklists.
Focus on concrete offerings that can be sold: implementation, automation, integrations, dashboards, workflows, marketing/sales systems, managed services.

Return ONLY a JSON array in this exact shape:
[
  {
    "title": "service name",
    "summary": "2-3 sentence explanation of what it does and the client problem it solves",
    "category": "automation|content|analytics|crm|integration|design|development",
    "outcomes": ["measurable outcome"],
    "tags": ["keyword"],
    "sourceFile": "exact file path from FILE: labels"
  }
]

If no client-facing services are present, return [].

Notes:
${context}
`);

  const text = response.response.text();
  const rawItems = extractJsonArray(text);

  const candidates: VaultUseCaseCandidate[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const normalized = normalizeCandidate(rawItems[i], batch, batchIndex, i);
    if (normalized) candidates.push(normalized);
  }

  return candidates;
}

function dedupeCandidates(
  candidates: VaultUseCaseCandidate[],
): VaultUseCaseCandidate[] {
  const map = new Map<string, VaultUseCaseCandidate>();

  for (const candidate of candidates) {
    if (!isLikelyClientFacingCandidate(candidate)) continue;
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

export async function scanVaultForUseCases(
  vaultPath: string,
): Promise<VaultScanResult> {
  const errors: string[] = [];
  const trimmedPath = vaultPath.trim();

  if (!trimmedPath) {
    return {
      candidates: [],
      filesScanned: 0,
      errors: ['Vault path is empty'],
    };
  }

  try {
    await access(trimmedPath);
  } catch {
    return {
      candidates: [],
      filesScanned: 0,
      errors: [
        `Vault path does not exist or is not accessible: ${trimmedPath}`,
      ],
    };
  }

  const files = await collectMarkdownFiles(trimmedPath);
  const sortedFiles = files
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return a.relativePath.localeCompare(b.relativePath);
    })
    .slice(0, MAX_FILES * 3);
  const selectedFiles = selectBalancedFiles(sortedFiles, MAX_FILES);

  if (selectedFiles.length === 0) {
    return {
      candidates: [],
      filesScanned: 0,
      errors: ['No high-signal markdown files found in the vault path'],
    };
  }

  const batches = chunkFiles(selectedFiles, BATCH_SIZE);
  const allCandidates: VaultUseCaseCandidate[] = [];

  for (let i = 0; i < batches.length; i++) {
    try {
      const candidates = await extractBatchCandidates(batches[i]!, i);
      allCandidates.push(...candidates);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown extraction error';
      errors.push(`Batch ${i + 1} failed: ${message}`);
    }
  }

  return {
    candidates: dedupeCandidates(allCandidates),
    filesScanned: selectedFiles.length,
    errors,
  };
}
