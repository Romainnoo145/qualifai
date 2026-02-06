import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z.string().url(),
    ADMIN_SECRET: z.string().min(8),
    LUSHA_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    ADMIN_EMAIL: z.string().email(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
    LUSHA_API_KEY: process.env.LUSHA_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Skip validation during build (Vercel injects at runtime)
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
