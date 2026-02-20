import { router } from '../trpc';
import { adminRouter } from './admin';
import { assetsRouter } from './assets';
import { callPrepRouter } from './call-prep';
import { campaignsRouter } from './campaigns';
import { contactsRouter } from './contacts';
import { hypothesesRouter } from './hypotheses';
import { outreachRouter } from './outreach';
import { proofRouter } from './proof';
import { researchRouter } from './research';
import { searchRouter } from './search';
import { sequencesRouter } from './sequences';
import { signalsRouter } from './signals';
import { useCasesRouter } from './use-cases';
import { wizardRouter } from './wizard';

export const appRouter = router({
  admin: adminRouter,
  assets: assetsRouter,
  callPrep: callPrepRouter,
  campaigns: campaignsRouter,
  contacts: contactsRouter,
  hypotheses: hypothesesRouter,
  outreach: outreachRouter,
  proof: proofRouter,
  research: researchRouter,
  search: searchRouter,
  sequences: sequencesRouter,
  signals: signalsRouter,
  useCases: useCasesRouter,
  wizard: wizardRouter,
});

export type AppRouter = typeof appRouter;
