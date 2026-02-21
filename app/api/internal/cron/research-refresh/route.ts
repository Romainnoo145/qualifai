import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { runResearchRefreshSweep } from '@/lib/research-refresh';

function isAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-cron-secret') ?? '';
  const expected = env.INTERNAL_CRON_SECRET ?? env.ADMIN_SECRET;
  return provided.length > 0 && provided === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized cron request' },
      { status: 401 },
    );
  }

  const payload = (await req.json().catch(() => ({}))) as {
    staleDays?: number;
    limit?: number;
    dryRun?: boolean;
  };

  const result = await runResearchRefreshSweep(prisma, {
    staleDays: payload.staleDays,
    limit: payload.limit,
    dryRun: payload.dryRun,
  });

  return NextResponse.json({
    success: true,
    ...result,
  });
}
