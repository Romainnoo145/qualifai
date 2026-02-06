import { type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export const createTRPCContext = async (req: NextRequest) => {
  const adminToken = req.headers.get('x-admin-token');

  return {
    db: prisma,
    adminToken,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
