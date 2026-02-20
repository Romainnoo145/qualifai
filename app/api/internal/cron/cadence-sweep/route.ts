import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { env } from '@/env.mjs';
import { processDueCadenceSteps } from '@/lib/cadence/engine';

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

  const result = await processDueCadenceSteps(prisma);
  return NextResponse.json({ success: true, ...result });
}
