import { initTRPC, TRPCError } from '@trpc/server';
import { type TRPCContext } from './context';
import { env } from '@/env.mjs';

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (ctx.adminToken !== env.ADMIN_SECRET) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid admin token',
    });
  }
  return next({ ctx });
});
