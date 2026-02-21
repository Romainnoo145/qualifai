import { z } from 'zod';

export const outreachEmailSchema = z.object({
  subject: z.string(),
  bodyHtml: z.string(),
  bodyText: z.string(),
  personalizedOpener: z.string(),
  callToAction: z.string(),
});

export type OutreachEmail = z.infer<typeof outreachEmailSchema>;
