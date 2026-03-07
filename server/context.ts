import { type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizeAdminToken } from '@/lib/admin-token';

export const createTRPCContext = async (req: NextRequest) => {
  const adminToken = normalizeAdminToken(req.headers.get('x-admin-token'));

  return {
    db: prisma,
    adminToken,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
