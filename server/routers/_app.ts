import { router } from '../trpc';
import { adminRouter } from './admin';
import { assetsRouter } from './assets';
import { callPrepRouter } from './call-prep';
import { campaignsRouter } from './campaigns';
import { contactsRouter } from './contacts';
import { engagementRouter } from './engagement';
import { hypothesesRouter } from './hypotheses';
import { outreachRouter } from './outreach';
import { projectsRouter } from './projects';
import { proofRouter } from './proof';
import { quotesRouter } from './quotes';
import { researchRouter } from './research';
import { searchRouter } from './search';
import { sequencesRouter } from './sequences';
import { useCasesRouter } from './use-cases';
import { wizardRouter } from './wizard';

export const appRouter = router({
  admin: adminRouter,
  assets: assetsRouter,
  callPrep: callPrepRouter,
  campaigns: campaignsRouter,
  contacts: contactsRouter,
  engagement: engagementRouter,
  hypotheses: hypothesesRouter,
  outreach: outreachRouter,
  projects: projectsRouter,
  proof: proofRouter,
  quotes: quotesRouter,
  research: researchRouter,
  search: searchRouter,
  sequences: sequencesRouter,
  useCases: useCasesRouter,
  wizard: wizardRouter,
});

export type AppRouter = typeof appRouter;
