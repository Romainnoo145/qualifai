import { router } from '../trpc';
import { adminRouter } from './admin';
import { wizardRouter } from './wizard';

export const appRouter = router({
  admin: adminRouter,
  wizard: wizardRouter,
});

export type AppRouter = typeof appRouter;
