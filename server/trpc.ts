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

export const prospectProcedure = t.procedure.use(
  async ({ ctx, getRawInput, next }) => {
    const rawInput = await getRawInput();
    const input = rawInput as Record<string, unknown>;
    const slug = input.slug;
    if (typeof slug !== 'string') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'slug is required',
      });
    }
    const prospect = await ctx.db.prospect.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (
      !prospect ||
      !['READY', 'SENT', 'VIEWED', 'ENGAGED', 'CONVERTED'].includes(
        prospect.status,
      )
    ) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Prospect not found or not publicly accessible',
      });
    }
    return next({ ctx: { ...ctx, prospectId: prospect.id } });
  },
);
