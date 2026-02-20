import type { PrismaClient } from '@prisma/client';

export function toReadableSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

export async function generateUniqueReadableSlug(
  db: PrismaClient,
  companyName: string,
): Promise<string> {
  const base = toReadableSlug(companyName);
  if (!base)
    return (
      companyName.slice(0, 8).toLowerCase().replace(/\s/g, '-') || 'prospect'
    );
  let candidate = base;
  let i = 2;
  while (await db.prospect.findUnique({ where: { readableSlug: candidate } })) {
    candidate = `${base}-${i}`;
    i++;
  }
  return candidate;
}
