import { initTRPC, TRPCError } from '@trpc/server';
import { type TRPCContext } from './context';
import { KLARIFAI_PROJECT_SLUG, resolveAdminProjectScope } from './admin-auth';
import { PUBLIC_VISIBLE_STATUSES } from '@/lib/constants/prospect-statuses';

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  const scope = resolveAdminProjectScope(ctx.adminToken);
  if (scope) {
    return next({
      ctx: {
        ...ctx,
        ...scope,
      },
    });
  }

  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Invalid admin token',
  });
});

export const projectAdminProcedure = adminProcedure.use(
  async ({ ctx, next }) => {
    const scopedProjectSlug = ctx.allowedProjectSlug ?? KLARIFAI_PROJECT_SLUG;

    const project = await ctx.db.project.findUnique({
      where: { slug: scopedProjectSlug },
      select: { id: true, slug: true, name: true, projectType: true },
    });

    if (!project) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown project scope: ${scopedProjectSlug}`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        projectId: project.id,
        activeProject: project,
      },
    });
  },
);

export const anyAdminProcedure = adminProcedure;

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
      !(PUBLIC_VISIBLE_STATUSES as readonly string[]).includes(prospect.status)
    ) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Prospect not found or not publicly accessible',
      });
    }
    return next({ ctx: { ...ctx, prospectId: prospect.id } });
  },
);
