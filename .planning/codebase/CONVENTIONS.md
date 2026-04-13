# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**

- kebab-case for all files: `reply-triage.ts`, `send-email.ts`, `quality-config.ts`
- Component files: `button.tsx`, `command-center.tsx` (kebab-case)
- Test files: `{module}.test.ts` or `{module}.test.tsx` (co-located with source)
- Schema files: `{domain}-schemas.ts` (e.g., `outreach-schemas.ts`)
- Feature directories use kebab-case: `prospects/`, `outreach/`, `use-cases/`

**Functions:**

- camelCase for all functions and methods
- Exported functions: descriptive, start with verb: `triageReplyText()`, `sendOutreachEmail()`, `scoreEvidenceBatch()`
- Private helper functions: same camelCase, often prefixed with underscore if only used internally
- React components: PascalCase export name (e.g., `export { Button }`) but file is kebab-case (`button.tsx`)

**Variables:**

- camelCase for all variables and constants
- UPPER_SNAKE_CASE for true constants (configuration values): `MIN_EVIDENCE_COUNT`, `AMBER_MIN_SOURCE_TYPES`, `FROM_EMAIL`
- Boolean variables: prefix with `is` or `has`: `isResearching`, `isLoading`, `hasError`
- Collections: plural names: `items`, `contacts`, `hypotheses`

**Types:**

- PascalCase for all types and interfaces
- Type files co-located: `interface SendOutreachOptions {}` defined in same file or `*-schemas.ts`
- Zod schema naming: schema export as `entitySchema`, inferred type as `Entity` (e.g., `heroContentSchema` → `type HeroContent`)
- Union types: use `|` syntax, not `Union<>`: `type ReplyIntent = 'interested' | 'later' | 'not_fit'`

## Code Style

**Formatting:**

- Prettier config: `.prettierrc` enforces:
  - 2-space indentation
  - Single quotes (not double)
  - Trailing commas on all multi-line structures
  - Line length: 80 characters
  - Semicolons required
  - Unix line endings (LF)

**Linting:**

- ESLint with Next.js + TypeScript presets
- Config: `eslint.config.mjs` (flat config format)
- Key rules:
  - `@typescript-eslint/no-explicit-any`: warn (not error) — allows `any` with review
  - `@typescript-eslint/no-unused-vars`: error with pattern exemption for `_` prefix (e.g., `_unused`, `_next`)
- Run: `npm run lint` (check), `npm run lint:fix` (auto-fix)

**TypeScript Mode:**

- Strict mode enabled: `"strict": true` in `tsconfig.json`
- Strict compiler options include:
  - `noUnusedLocals`, `noUnusedParameters`: errors on dead code
  - `noImplicitReturns`: all code paths must return
  - `noUncheckedIndexedAccess`: object indexing requires safe checks
  - `noImplicitOverride`: overriding methods must use `override` keyword
  - `noFallthroughCasesInSwitch`: switch cases must return or break
  - `forceConsistentCasingInFileNames`: prevents cross-platform path issues

## Import Organization

**Order:**

1. External packages (node_modules): `import { z } from 'zod'`, `import type { NextRequest }`
2. Type imports (when separate): `import type { SomeType } from '@/lib'`
3. Aliased internal imports: `import { utils } from '@/lib/utils'`, `import prisma from '@/lib/prisma'`
4. Relative imports (rare): `import { helper } from '../helper'`

**Path Aliases:**

- `@/*` maps to root: `@/lib`, `@/server`, `@/components`, `@/env.mjs`
- Always use `@/` alias over relative `../` paths
- Example: `import { triageReplyText } from '@/lib/outreach/reply-triage'`

**Import Style:**

- Named imports: `import { sendOutreachEmail } from '@/lib/outreach/send-email'`
- Default imports: `import prisma from '@/lib/prisma'` (singleton pattern)
- Type imports: `import type { SomeType } from '@/types'` when only importing types
- Mix in same statement: `import { z, type ZodError } from 'zod'`

## Error Handling

**Pattern:**

- Throw `Error` with descriptive message for validation/precondition failures
- Throw `TRPCError` (from `@trpc/server`) in tRPC procedures with code + message
- No bare `throw` statements — always include context
- Errors include actionable information: `throw new Error('Email subject is required')`

**Example from `send-email.ts`:**

```typescript
if (!subject.trim()) {
  throw new Error('Email subject is required');
}
if (contact.outreachStatus === 'OPTED_OUT') {
  throw new Error('Contact opted out from outreach');
}
```

**tRPC Error Example from `send-email.test.ts`:**

```typescript
throw new TRPCError({
  code: 'PRECONDITION_FAILED',
  message: 'Prospect quality gate is RED: insufficient evidence...',
});
```

**Try/Catch:**

- Use only when you can handle or provide context
- Example from `reply-workflow.ts`: catch external API errors, wrap with context
- Don't catch if parent already handles (avoid double-wrapping)

## Logging

**Framework:** console (no dedicated logging library)

**Patterns:**

- Minimal logging in production paths
- Use logging for debugging integrations (external APIs, Prisma queries)
- No structured logging format — plain strings
- Example: `console.log('Triage result:', result)` for debugging

## Comments

**When to Comment:**

- Complex algorithms or non-obvious logic
- Debt/FIXME markers: `// DEBT-03: E2E send test exercising the tRPC quality gate path`
- Explain "why", not "what" (code shows the what)

**JSDoc/TSDoc:**

- Used for public functions and complex modules
- Example from `evidence-scorer.ts`:

```typescript
/**
 * Score evidence items for workflow/automation relevance using Gemini Flash.
 *
 * Each item is rated on two dimensions:
 * - relevance (0.0-1.0): How useful for identifying workflow/automation pain?
 * - depth (0.0-1.0): How specific/detailed is the content?
 *
 * Final confidence = sourceWeight * 0.30 + relevance * 0.45 + depth * 0.25
 *
 * Cost: ~$0.0004 per run (1-2 Gemini Flash calls). Negligible.
 */
export async function scoreEvidenceBatch(
  items: EvidenceToScore[],
  prospectContext: { companyName: string | null; industry: string | null },
): Promise<ScoredEvidence[]>;
```

## Function Design

**Size:**

- Keep functions under 100 lines
- Break into smaller helpers if more complex
- Example: `reply-triage.ts` has main function `triageReplyText()` with private helpers `normalizeText()`, `countMatches()`, `inferDeferDays()`

**Parameters:**

- Max 3-4 parameters — use object destructuring for more
- Example: `function sendOutreachEmail(options: SendOutreachOptions)`
- Type the parameter object explicitly: `interface SendOutreachOptions { contactId: string; to: string; ... }`

**Return Values:**

- Explicit return type annotation (never inferred)
- Example: `function triageReplyText(...): ReplyTriageResult`
- Always return early from guard clauses
- Example from `reply-triage.ts`:

```typescript
if (stopHits > 0) {
  return {
    intent: 'stop',
    confidence: Math.min(0.75 + stopHits * 0.08, 0.98),
    reasons: ['Detected unsubscribe / do-not-contact language'],
    suggestedAction: 'suppress_contact',
  };
}
```

## Module Design

**Exports:**

- Named exports for multiple items: `export function sendEmail()`, `export type SendOptions`
- Default exports rare — use only for singletons (e.g., Prisma client)
- Example from `reply-triage.ts`:

```typescript
export type ReplyIntent = '...';
export interface ReplyTriageResult { ... }
export function triageReplyText(...) { ... }
```

**Barrel Files:**

- Index files (`index.ts`) are used minimally
- Prefer direct imports: `import { triageReplyText } from '@/lib/outreach/reply-triage'`
- Example: `server/routers/_app.ts` aggregates all router imports

## Async/Await

**Pattern:**

- All async operations use async/await (no Promise chaining)
- Async functions explicitly marked: `async function sendOutreachEmail(...)`
- Await all Promises before returning or destructuring
- Example from `contacts.ts`:

```typescript
const prospect = await ctx.db.prospect.findUniqueOrThrow({
  where: { id: input.prospectId },
});
```

**Concurrent Operations:**

- Use `Promise.all()` for independent async operations
- Example from `send-email.test.ts`:

```typescript
$transaction: vi
  .fn()
  .mockImplementation(async (ops: Promise<unknown>[]) => {
    return Promise.all(ops);
  }),
```

## Zod Validation

**Pattern:**

- Define schema at module level: `export const heroContentSchema = z.object({ ... })`
- Infer type from schema: `export type HeroContent = z.infer<typeof heroContentSchema>`
- Call `.parse()` for strict validation that throws
- Example from `schemas.ts`:

```typescript
export const heroContentSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  stats: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      icon: z.string(),
    }),
  ),
  industryInsight: z.string(),
});

export type HeroContent = z.infer<typeof heroContentSchema>;
```

**In tRPC Procedures:**

- Zod schemas for input validation in tRPC `.input()` method
- Example from `contacts.ts`:

```typescript
.input(
  z.object({
    prospectId: z.string(),
    seniorities: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).default(25),
  }),
)
```

## Environment Variables

**Access Pattern:**

- Import from `env.mjs`: `import { env } from '@/env.mjs'`
- Use imported `env` object: `env.RESEND_API_KEY`, `env.NEXT_PUBLIC_APP_URL`
- Never access `process.env` directly — use `env` for type safety
- Definition in `env.mjs` with Zod validation on all vars
- Example from `send-email.ts`:

```typescript
import { env } from '@/env.mjs';
const resend = new Resend(env.RESEND_API_KEY);
const APP_URL = env.NEXT_PUBLIC_APP_URL ?? 'https://qualifai.klarifai.nl';
```

## React Components

**File Structure:**

- `'use client'` at top for client-side components
- Import hooks and utilities after directive
- Component definition below imports
- Example from `button.tsx`:

```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'yellow';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    // implementation
  },
);

Button.displayName = 'Button';
export { Button };
```

**Props Pattern:**

- Interface extending HTML attributes: `interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`
- Destructure with defaults: `{ isLoading = false, variant = 'primary' }`
- Spread remaining props: `{...props}`

---

_Convention analysis: 2026-04-13_
