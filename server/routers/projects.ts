import { anyAdminProcedure, projectAdminProcedure, router } from '../trpc';

export const projectsRouter = router({
  list: anyAdminProcedure.query(async ({ ctx }) => {
    const scopedSlug = ctx.allowedProjectSlug ?? 'klarifai';
    const projects = await ctx.db.project.findMany({
      where: { slug: scopedSlug },
      orderBy: [{ projectType: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        projectType: true,
        brandName: true,
      },
    });

    const activeProjectSlug = projects[0]?.slug ?? scopedSlug;

    return { projects, activeProjectSlug, scopeLocked: true };
  }),

  listSpvsForActiveProject: projectAdminProcedure.query(async ({ ctx }) => {
    const spvs = await ctx.db.sPV.findMany({
      where: {
        projectId: ctx.projectId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        code: true,
        name: true,
      },
    });

    return {
      project: ctx.activeProject,
      spvs,
    };
  }),
});
