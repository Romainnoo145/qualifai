import { createHash, createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/env.mjs';
import { renderPlainTextPdf } from '@/lib/pdf-render';

interface PersistLossMapPdfInput {
  lossMapId: string;
  version: number;
  companyName: string;
  markdown: string;
}

export interface PersistLossMapPdfResult {
  pdfUrl: string | null;
  storageMode: 's3' | 'volume' | 'inline';
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function buildObjectKey(input: PersistLossMapPdfInput): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const companySlug = slugify(input.companyName || 'workflow-loss-map');
  return `workflow-loss-maps/${year}/${month}/${companySlug}-v${input.version}-${input.lossMapId}.pdf`;
}

function encodePathSegments(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function awsSigningKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function amzTimestamp(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function defaultS3Endpoint(region: string): string {
  return `https://s3.${region}.amazonaws.com`;
}

function hasS3Config(): boolean {
  return Boolean(
    env.PDF_STORAGE_BUCKET &&
    env.PDF_STORAGE_REGION &&
    env.PDF_STORAGE_ACCESS_KEY &&
    env.PDF_STORAGE_SECRET_KEY,
  );
}

function toPublicUrl(endpoint: string, key: string): string {
  if (env.PDF_STORAGE_PUBLIC_BASE_URL) {
    return `${env.PDF_STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  const bucket = env.PDF_STORAGE_BUCKET!;
  return `${cleanEndpoint}/${bucket}/${key}`;
}

async function uploadToS3(key: string, buffer: Buffer): Promise<string> {
  const bucket = env.PDF_STORAGE_BUCKET!;
  const region = env.PDF_STORAGE_REGION!;
  const accessKey = env.PDF_STORAGE_ACCESS_KEY!;
  const secretKey = env.PDF_STORAGE_SECRET_KEY!;
  const sessionToken = env.PDF_STORAGE_SESSION_TOKEN;
  const endpoint = env.PDF_STORAGE_ENDPOINT ?? defaultS3Endpoint(region);
  const url = new URL(
    `${endpoint.replace(/\/$/, '')}/${bucket}/${encodePathSegments(key)}`,
  );
  const host = url.host;

  const now = new Date();
  const { amzDate, dateStamp } = amzTimestamp(now);
  const payloadHash = sha256Hex(buffer);
  const canonicalHeaders =
    `content-type:application/pdf\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n` +
    (sessionToken ? `x-amz-security-token:${sessionToken}\n` : '');
  const signedHeaders = sessionToken
    ? 'content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token'
    : 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
  const signingKey = awsSigningKey(secretKey, dateStamp, region);
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/pdf',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}),
      Authorization: authorization,
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`S3 upload failed (${response.status}): ${body}`);
  }

  return toPublicUrl(endpoint, key);
}

async function writeToVolume(key: string, buffer: Buffer): Promise<string> {
  const basePath = env.PDF_STORAGE_VOLUME_PATH ?? '/tmp/qualifai-pdfs';
  const filePath = path.join(basePath, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return `file://${filePath}`;
}

export async function persistWorkflowLossMapPdf(
  input: PersistLossMapPdfInput,
): Promise<PersistLossMapPdfResult> {
  const key = buildObjectKey(input);
  const pdfBuffer = renderPlainTextPdf(input.markdown);

  if (hasS3Config()) {
    try {
      const publicUrl = await uploadToS3(key, pdfBuffer);
      return { pdfUrl: publicUrl, storageMode: 's3' };
    } catch (error) {
      console.error(
        'pdf storage s3 upload failed; falling back to volume',
        error,
      );
    }
  }

  try {
    const fileUrl = await writeToVolume(key, pdfBuffer);
    return { pdfUrl: fileUrl, storageMode: 'volume' };
  } catch (error) {
    console.error(
      'pdf storage volume write failed; using inline fallback',
      error,
    );
    return { pdfUrl: null, storageMode: 'inline' };
  }
}
