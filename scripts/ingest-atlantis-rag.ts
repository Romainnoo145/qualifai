import 'dotenv/config';
import path from 'path';
import { promises as fs } from 'fs';
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { chunkMarkdownDocument } from '@/lib/rag/markdown-chunker';

type Args = {
  projectSlug: string;
  basePath: string;
  force: boolean;
  dryRun: boolean;
  limit: number | null;
};

type FrontmatterValue = string | string[];
type FrontmatterMap = Record<string, FrontmatterValue>;

type ParsedMarkdown = {
  frontmatter: FrontmatterMap;
  body: string;
};

type IngestionStats = {
  filesScanned: number;
  filesSkippedUnchanged: number;
  documentsUpserted: number;
  chunksUpserted: number;
  embeddingTokens: number;
  estimatedCostUsd: number;
};

type EmbeddingResponse = {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
};

const DEFAULT_PROJECT_SLUG = 'europes-gate';
const DEFAULT_BASE_PATH =
  '/home/klarifai/Documents/obsidian/Nexus-Point/10_The_Forge/atlantis/RAG-Volumes';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_PRICE_PER_1K = 0.00002;
const EMBEDDING_BATCH_SIZE = 50;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    projectSlug: DEFAULT_PROJECT_SLUG,
    basePath: process.env.ATLANTIS_RAG_VOLUMES_PATH ?? DEFAULT_BASE_PATH,
    force: false,
    dryRun: false,
    limit: null,
  };

  for (const token of argv) {
    if (token === '--force') {
      args.force = true;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token.startsWith('--project=')) {
      args.projectSlug =
        token.replace('--project=', '').trim() || args.projectSlug;
      continue;
    }
    if (token.startsWith('--path=')) {
      args.basePath = token.replace('--path=', '').trim() || args.basePath;
      continue;
    }
    if (token.startsWith('--limit=')) {
      const raw = token.replace('--limit=', '').trim();
      const value = Number(raw);
      args.limit =
        Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
      continue;
    }
  }

  return args;
}

async function listTextFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTextFilesRecursive(absolutePath)));
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext === '.md' || ext === '.markdown' || ext === '.txt') {
      files.push(absolutePath);
    }
  }

  return files;
}

function normalizeFrontmatterKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseFrontmatter(markdown: string): ParsedMarkdown {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: markdown };
  }

  const frontmatter: FrontmatterMap = {};
  let endIndex = -1;
  let currentKey: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '---') {
      endIndex = i;
      break;
    }

    const keyValue = line.match(/^\s*([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
    if (keyValue) {
      const rawKey = keyValue[1];
      if (!rawKey) continue;
      const key = normalizeFrontmatterKey(rawKey);
      const rawValue = stripWrappingQuotes(keyValue[2] ?? '');
      if (!rawValue) {
        frontmatter[key] = [];
      } else {
        frontmatter[key] = rawValue;
      }
      currentKey = key;
      continue;
    }

    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentKey) {
      const existing = frontmatter[currentKey];
      const rawListValue = listItem[1];
      if (!rawListValue) continue;
      const value = stripWrappingQuotes(rawListValue);
      if (Array.isArray(existing)) {
        existing.push(value);
      } else if (typeof existing === 'string' && existing.length > 0) {
        frontmatter[currentKey] = [existing, value];
      } else {
        frontmatter[currentKey] = [value];
      }
      continue;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: markdown };
  }

  return {
    frontmatter,
    body: lines.slice(endIndex + 1).join('\n'),
  };
}

function firstString(value: FrontmatterValue | undefined): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]?.trim()) return value[0].trim();
  return null;
}

function parseDocumentId(
  frontmatter: FrontmatterMap,
  relativePath: string,
): string {
  return (
    firstString(frontmatter.document_id) ??
    firstString(frontmatter.documentid) ??
    path.basename(relativePath, path.extname(relativePath))
  );
}

function parseTitle(
  frontmatter: FrontmatterMap,
  body: string,
  relativePath: string,
): string {
  const fromFrontmatter = firstString(frontmatter.title);
  if (fromFrontmatter) return fromFrontmatter;

  const heading = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'));
  if (heading) {
    const normalized = heading.replace(/^#+\s*/, '').trim();
    if (normalized) return normalized;
  }

  return path.basename(relativePath, path.extname(relativePath));
}

function parseVolume(
  frontmatter: FrontmatterMap,
  relativePath: string,
): string | null {
  const fromFrontmatter =
    firstString(frontmatter.volume) ?? firstString(frontmatter.volume_name);
  if (fromFrontmatter) return fromFrontmatter;

  const match = relativePath.match(/(Volume-[^/\\]+)/i);
  if (!match) return null;
  return match[1] ?? null;
}

function inferSpvSlug(
  frontmatter: FrontmatterMap,
  relativePath: string,
  title: string,
  volume: string | null,
): string | null {
  const context = [
    firstString(frontmatter.entity) ?? '',
    firstString(frontmatter.document_id) ?? '',
    title,
    relativePath,
    volume ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const explicitMap: Array<{ needle: string; slug: string }> = [
    { needle: 'infraco', slug: 'infraco' },
    { needle: 'energyco', slug: 'energyco' },
    { needle: 'steelco', slug: 'steelco' },
    { needle: 'realestateco', slug: 'realestateco' },
    { needle: 'dataco', slug: 'dataco' },
    { needle: 'mobilityco', slug: 'mobilityco' },
    { needle: 'blueco', slug: 'blueco' },
    { needle: 'defenceco', slug: 'defenceco' },
  ];

  for (const candidate of explicitMap) {
    if (context.includes(candidate.needle)) return candidate.slug;
  }

  const normalizedVolume = (volume ?? '').toUpperCase();
  if (normalizedVolume.includes('VOLUME-II')) return 'infraco';
  if (normalizedVolume.includes('VOLUME-III')) {
    if (context.includes('steel')) return 'steelco';
    return 'energyco';
  }
  if (normalizedVolume.includes('VOLUME-IV')) return 'realestateco';
  if (normalizedVolume.includes('VOLUME-V')) return 'dataco';
  if (normalizedVolume.includes('VOLUME-VI')) return 'mobilityco';
  if (normalizedVolume.includes('VOLUME-VII')) return 'blueco';
  if (normalizedVolume.includes('VOLUME-VIII')) return 'defenceco';

  return null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

async function createEmbeddings(
  input: string[],
  openAiApiKey: string,
  model: string,
): Promise<number[][]> {
  if (input.length === 0) return [];

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenAI embeddings request failed (${response.status}): ${body}`,
    );
  }

  const payload = (await response.json()) as EmbeddingResponse;
  return payload.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.embedding);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const embeddingPricePer1K = Number(
    process.env.OPENAI_EMBEDDING_PRICE_PER_1K ?? DEFAULT_EMBEDDING_PRICE_PER_1K,
  );

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  const stats: IngestionStats = {
    filesScanned: 0,
    filesSkippedUnchanged: 0,
    documentsUpserted: 0,
    chunksUpserted: 0,
    embeddingTokens: 0,
    estimatedCostUsd: 0,
  };
  const errors: string[] = [];

  let runId: string | null = null;

  try {
    const project = await db.project.findUnique({
      where: { slug: args.projectSlug },
      select: { id: true, slug: true, name: true, projectType: true },
    });

    if (!project) {
      throw new Error(`Project not found: ${args.projectSlug}`);
    }
    if (project.projectType !== 'ATLANTIS') {
      throw new Error(
        `Project ${project.slug} is ${project.projectType}, expected ATLANTIS for this ingestion script`,
      );
    }

    const spvs = await db.sPV.findMany({
      where: { projectId: project.id },
      select: { id: true, slug: true },
    });
    const spvIdBySlug = new Map(spvs.map((spv) => [spv.slug, spv.id]));

    const allFiles = (await listTextFilesRecursive(args.basePath)).sort();
    const files = args.limit ? allFiles.slice(0, args.limit) : allFiles;
    stats.filesScanned = files.length;

    console.log(`Project: ${project.name} (${project.slug})`);
    console.log(`Path:    ${args.basePath}`);
    console.log(`Files:   ${files.length}${args.force ? ' (force mode)' : ''}`);
    if (args.dryRun) {
      console.log('Mode:    DRY RUN (no database writes, no API calls)');
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!args.dryRun && !openAiApiKey) {
      throw new Error('OPENAI_API_KEY is required for embeddings ingestion');
    }

    if (!args.dryRun) {
      runId = (
        await db.ragIngestionRun.create({
          data: {
            projectId: project.id,
            sourcePath: args.basePath,
            model: embeddingModel,
            status: 'RUNNING',
          },
          select: { id: true },
        })
      ).id;
    }

    for (const absolutePath of files) {
      const relativePath = path
        .relative(args.basePath, absolutePath)
        .split(path.sep)
        .join('/');

      try {
        const source = await fs.readFile(absolutePath, 'utf8');
        const sourceHash = sha256(source);
        const parsed = parseFrontmatter(source);
        const documentId = parseDocumentId(parsed.frontmatter, relativePath);
        const title = parseTitle(parsed.frontmatter, parsed.body, relativePath);
        const volume = parseVolume(parsed.frontmatter, relativePath);
        const spvSlug = inferSpvSlug(
          parsed.frontmatter,
          relativePath,
          title,
          volume,
        );
        const spvId = spvSlug ? (spvIdBySlug.get(spvSlug) ?? null) : null;

        const existing = await db.projectDocument.findUnique({
          where: {
            projectId_sourcePath: {
              projectId: project.id,
              sourcePath: relativePath,
            },
          },
          select: { id: true, sourceHash: true },
        });

        if (!args.force && existing && existing.sourceHash === sourceHash) {
          stats.filesSkippedUnchanged += 1;
          continue;
        }

        const chunks = chunkMarkdownDocument(parsed.body, { maxChars: 2200 });
        const tokenCount = chunks.reduce(
          (sum, chunk) => sum + chunk.tokenEstimate,
          0,
        );

        stats.embeddingTokens += tokenCount;
        stats.estimatedCostUsd =
          (stats.embeddingTokens / 1000) * embeddingPricePer1K;

        if (args.dryRun) {
          stats.documentsUpserted += 1;
          stats.chunksUpserted += chunks.length;
          continue;
        }

        const document = await db.projectDocument.upsert({
          where: {
            projectId_sourcePath: {
              projectId: project.id,
              sourcePath: relativePath,
            },
          },
          update: {
            sourceHash,
            documentId,
            title,
            volume,
            spvId,
            metadata: parsed.frontmatter,
            sectionCount: chunks.length,
            lastIngestedAt: new Date(),
          },
          create: {
            projectId: project.id,
            sourcePath: relativePath,
            sourceHash,
            documentId,
            title,
            volume,
            spvId,
            metadata: parsed.frontmatter,
            sectionCount: chunks.length,
            lastIngestedAt: new Date(),
          },
          select: { id: true },
        });

        await db.projectDocumentChunk.deleteMany({
          where: { projectDocumentId: document.id },
        });

        for (
          let offset = 0;
          offset < chunks.length;
          offset += EMBEDDING_BATCH_SIZE
        ) {
          const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
          const embeddings = await createEmbeddings(
            batch.map((item) => item.content),
            openAiApiKey!,
            embeddingModel,
          );

          for (let i = 0; i < batch.length; i++) {
            const chunk = batch[i]!;
            const embedding = embeddings[i];
            if (!embedding) {
              throw new Error(
                `Missing embedding for ${relativePath} chunk #${chunk.chunkIndex}`,
              );
            }
            if (embedding.length !== 1536) {
              throw new Error(
                `Expected 1536-dim embedding, received ${embedding.length} for ${relativePath} chunk #${chunk.chunkIndex}`,
              );
            }

            const chunkMetadata = {
              documentId,
              sectionHeader: chunk.sectionHeader,
              volume,
              spvSlug,
              sourcePath: relativePath,
              lineStart: chunk.lineStart,
              lineEnd: chunk.lineEnd,
              chunkType: chunk.chunkType,
            };

            const vectorLiteral = toVectorLiteral(embedding);
            await db.$executeRaw`
              INSERT INTO "ProjectDocumentChunk" (
                "id",
                "createdAt",
                "updatedAt",
                "projectDocumentId",
                "chunkIndex",
                "chunkType",
                "sectionHeader",
                "content",
                "tokenEstimate",
                "metadata",
                "embeddingModel",
                "embeddingDimensions",
                "embedding"
              ) VALUES (
                ${randomUUID()},
                NOW(),
                NOW(),
                ${document.id},
                ${chunk.chunkIndex},
                ${chunk.chunkType},
                ${chunk.sectionHeader},
                ${chunk.content},
                ${chunk.tokenEstimate},
                ${JSON.stringify(chunkMetadata)}::jsonb,
                ${embeddingModel},
                1536,
                ${vectorLiteral}::vector
              )
            `;
          }
        }

        stats.documentsUpserted += 1;
        stats.chunksUpserted += chunks.length;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error ?? 'Unknown error');
        errors.push(`${relativePath}: ${message}`);
      }
    }

    if (runId && !args.dryRun) {
      await db.ragIngestionRun.update({
        where: { id: runId },
        data: {
          filesScanned: stats.filesScanned,
          documentsUpserted: stats.documentsUpserted,
          chunksUpserted: stats.chunksUpserted,
          embeddingTokens: stats.embeddingTokens,
          estimatedCostUsd: stats.estimatedCostUsd,
          status: errors.length === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS',
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    }

    console.log('\nIngestion summary');
    console.log(`- Files scanned: ${stats.filesScanned}`);
    console.log(`- Files unchanged skipped: ${stats.filesSkippedUnchanged}`);
    console.log(`- Documents upserted: ${stats.documentsUpserted}`);
    console.log(`- Chunks upserted: ${stats.chunksUpserted}`);
    console.log(`- Embedding tokens (estimated): ${stats.embeddingTokens}`);
    console.log(
      `- Embedding cost estimate (USD): ${stats.estimatedCostUsd.toFixed(6)}`,
    );

    if (errors.length > 0) {
      console.log(`- Errors: ${errors.length}`);
      for (const error of errors.slice(0, 20)) {
        console.log(`  * ${error}`);
      }
      if (errors.length > 20) {
        console.log(`  ... and ${errors.length - 20} more`);
      }
    }

    if (errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (runId && !args.dryRun) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error');
      const runErrors = [...errors, `FATAL: ${message}`];
      await db.ragIngestionRun.update({
        where: { id: runId },
        data: {
          filesScanned: stats.filesScanned,
          documentsUpserted: stats.documentsUpserted,
          chunksUpserted: stats.chunksUpserted,
          embeddingTokens: stats.embeddingTokens,
          estimatedCostUsd: stats.estimatedCostUsd,
          status: 'FAILED',
          errors: runErrors,
        },
      });
    }
    throw error;
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
