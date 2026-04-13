# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Runner:**

- Vitest 4.0.18
- Config: `vitest.config.ts`
- Test environment: jsdom (browser DOM simulation)
- Globals enabled: `describe`, `it`, `expect`, `beforeEach`, `afterEach` (no need to import)

**Assertion Library:**

- Vitest built-in assertions (compatible with Jest)
- Testing Library React: `@testing-library/react` for component testing
- Testing Library DOM matchers: `@testing-library/jest-dom/vitest`

**Run Commands:**

```bash
npm run test              # Run all unit tests (vitest)
npm run test:ui          # Watch mode with UI dashboard
npm run test:coverage    # Generate coverage report (outputs to terminal + HTML)
npm run test:e2e         # Playwright e2e tests (baseURL http://localhost:3000)
npm run test:e2e:ui      # Playwright UI mode (debug, inspect, rerun)
```

## Test File Organization

**Location:**

- Co-located with source: `{module}.test.ts` in same directory as source file
- Example: `lib/outreach/reply-triage.ts` → `lib/outreach/reply-triage.test.ts`
- E2E tests (empty): `e2e/` directory — currently not populated

**Naming:**

- `*.test.ts` or `*.test.tsx` suffix
- Module tests match source filename: `reply-triage.test.ts` tests `reply-triage.ts`

**Structure by Type:**

```
lib/outreach/
├── reply-triage.ts
├── reply-triage.test.ts      # Unit test for pure function
├── send-email.ts
├── send-email.test.ts        # Integration test with mocks
├── quality.ts
└── quality.test.ts           # Unit test for scoring functions
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, expect, it } from 'vitest';
import { triageReplyText } from '@/lib/outreach/reply-triage';

describe('reply triage', () => {
  it('classifies stop intent', () => {
    const result = triageReplyText({
      bodyText: 'Please unsubscribe me and do not contact again.',
    });
    expect(result.intent).toBe('stop');
    expect(result.suggestedAction).toBe('suppress_contact');
  });

  it('classifies later intent with defer days', () => {
    const result = triageReplyText({
      bodyText: 'Nu niet, kom hier volgende maand op terug.',
    });
    expect(result.intent).toBe('later');
    expect(result.deferDays).toBe(30);
  });
});
```

**Patterns:**

- One `describe()` per module/feature
- One `it()` per discrete behavior
- Arrange-Act-Assert structure (no explicit sections, natural flow)
- Test names start with lowercase verb: `it('classifies stop intent')`
- Shared setup: `beforeEach()` for common test data

**Setup Example from `send-email.test.ts`:**

```typescript
describe('outreach.sendEmail — quality gate via tRPC', () => {
  let mockDb: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      contact: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(MOCK_CONTACT),
        update: vi.fn().mockResolvedValue(MOCK_CONTACT),
      },
      outreachLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-001' }),
      },
      // ... other mocks
    };
  });

  it('GREEN gate: allows send and calls sendOutreachEmail', async () => {
    // test body
  });
});
```

## Mocking

**Framework:** Vitest's built-in `vi` (compatible with Jest)

**Module Mocks (hoisted):**

- Must be declared BEFORE importing the module under test
- Use `vi.mock()` at top of file (before imports)
- Example from `send-email.test.ts`:

```typescript
vi.mock('@/env.mjs', () => ({
  env: {
    ADMIN_SECRET: 'test-secret',
    RESEND_API_KEY: 'test-resend-key',
    ADMIN_EMAIL: 'admin@example.com',
    NEXT_PUBLIC_APP_URL: 'https://qualifai.example.com',
  },
}));

vi.mock('@/lib/outreach/send-email', () => ({
  sendOutreachEmail: vi
    .fn()
    .mockResolvedValue({ success: true, logId: 'mock-log-id' }),
}));

// Only THEN import the module under test
import { appRouter } from '@/server/routers/_app';
```

**Function Mocks:**

```typescript
mockDb.contact.findUniqueOrThrow = vi.fn().mockResolvedValue(MOCK_CONTACT);
```

**Clearing Mocks:**

- `vi.clearAllMocks()` in `beforeEach()` — reset call counts and implementations
- Example:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // setup fresh mocks for this test
});
```

**Assert Mock Calls:**

```typescript
expect(sendOutreachEmail).toHaveBeenCalledOnce();
expect(sendOutreachEmail).toHaveBeenCalledWith(
  expect.objectContaining({
    contactId: 'contact-001',
    to: 'jan.de.vries@acme.nl',
    subject: 'AI kan uw planning automatiseren',
  }),
);
expect(sendOutreachEmail).not.toHaveBeenCalled();
```

**What to Mock:**

- External services (Resend, Google AI, Apollo, etc.)
- Database operations (Prisma) — use factory functions for realistic test data
- Expensive operations (API calls, file I/O)
- Environment variables via `vi.mock('@/env.mjs')`

**What NOT to Mock:**

- Pure functions (validation, transformers, parsers) — test real logic
- Small utilities (`cn()`, `normalizeText()`) — test with real implementation
- Schemas (Zod) — let validation run
- Error scenarios — exercise actual error paths

## Fixtures and Factories

**Test Data:**

```typescript
// Shared mock contact for reuse across tests
const MOCK_CONTACT = {
  id: 'contact-001',
  prospectId: 'prospect-001',
  primaryEmail: 'jan.de.vries@acme.nl',
  firstName: 'Jan',
  lastName: 'de Vries',
  jobTitle: 'Directeur',
  seniority: 'C-Level',
  department: 'Directie',
  primaryPhone: '+31 6 12345678',
  linkedinUrl: 'https://linkedin.com/in/jandevries',
  outreachStatus: 'NONE',
};

// Variants for different test scenarios
const GREEN_GATE_SUMMARY = {
  gate: {
    evidenceCount: 10,
    sourceTypeCount: 4,
    averageConfidence: 0.72,
  },
};

const RED_GATE_SUMMARY = {
  gate: {
    evidenceCount: 1,
    sourceTypeCount: 0,
    averageConfidence: 0.0,
  },
};
```

**Location:**

- At top of test file, after imports and before suite
- Grouped by entity/scenario for readability
- Exported if used across multiple test files (not common)

## Setup and Teardown

**Global Setup (`vitest.setup.ts`):**

```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup(); // Clear React component state after each test
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js config
vi.mock('next/config', () => ({
  default: () => ({
    publicRuntimeConfig: {},
    serverRuntimeConfig: {},
  }),
}));
```

**Per-Test Setup:**

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Reset test-specific state
});
```

## Coverage

**Requirements:**

- No hard threshold enforced (coverage optional)
- Focus on critical paths: validation, quality gates, error handling

**View Coverage:**

```bash
npm run test:coverage
# Output to terminal + HTML report (open in browser)
```

**Excluded from Coverage:**

- Test files (`*.test.ts`)
- Setup files (`vitest.setup.ts`)
- Mock directories (`**/mocks`)
- Node modules, dist, `.next`

**Config in `vitest.config.ts`:**

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: [
    '**/*.test.{ts,tsx}',
    '**/vitest.setup.ts',
    '**/mocks',
    'node_modules',
    '.next',
    'dist',
  ],
},
```

## Test Types

**Unit Tests:**

- Test single function/module in isolation
- Mock external dependencies
- Fast (milliseconds)
- Example: `reply-triage.test.ts` tests `triageReplyText()` with various inputs

**Integration Tests:**

- Test module + its dependencies working together
- Mock external services (Prisma, APIs)
- Verify workflows and data flow
- Example: `send-email.test.ts` tests tRPC procedure with mocked DB and Resend

**E2E Tests:**

- Browser automation via Playwright (not currently implemented)
- Config: `playwright.config.ts`
- Location: `e2e/` directory (currently empty)
- Setup: Playwright automatically starts dev server on port 3000
- Supported browsers: Chromium, Firefox, WebKit

## Common Patterns

**Testing Async Functions:**

```typescript
it('classifies later intent with defer days', async () => {
  const result = await triageReplyText({
    bodyText: 'Nu niet, kom hier volgende maand op terug.',
  });
  expect(result.intent).toBe('later');
  expect(result.deferDays).toBe(30);
});
```

- Mark test as `async`
- `await` the async operation
- Assert results after awaiting

**Testing Errors:**

```typescript
it('blocks opted-out contacts', () => {
  const score = scoreContactForOutreach({
    firstName: 'Pat',
    lastName: 'Optout',
    primaryEmail: 'pat@acme.nl',
    outreachStatus: 'OPTED_OUT',
  });

  expect(score.status).toBe('blocked');
  expect(score.reasons.some((reason) => reason.includes('opted out'))).toBe(
    true,
  );
});
```

- Don't throw in assertions — check error result/status instead
- For thrown errors, use `expect(() => fn()).toThrow()`

**Testing with tRPC:**

```typescript
it('GREEN gate: allows send and calls sendOutreachEmail', async () => {
  const caller = appRouter.createCaller({
    db: mockDb as never,
    adminToken: 'test-secret',
  });

  const result = await caller.outreach.sendEmail(SEND_INPUT);

  expect(result).toEqual({ success: true, logId: 'mock-log-id' });
  expect(sendOutreachEmail).toHaveBeenCalledOnce();
});
```

- Create caller with mocked context
- Call procedure as if from client
- Assert result and side effects

**Testing Error Conditions:**

```typescript
it('RED gate: rejects with PRECONDITION_FAILED', async () => {
  (mockDb.researchRun as Record<string, unknown>).findFirst = vi
    .fn()
    .mockResolvedValue({
      summary: RED_GATE_SUMMARY,
      qualityApproved: null,
    });

  const caller = appRouter.createCaller({
    db: mockDb as never,
    adminToken: 'test-secret',
  });

  await expect(caller.outreach.sendEmail(SEND_INPUT)).rejects.toThrow(
    TRPCError,
  );

  // Verify specific error code
  let thrownError: TRPCError | undefined;
  try {
    await caller.outreach.sendEmail(SEND_INPUT);
  } catch (error) {
    thrownError = error as TRPCError;
  }
  expect(thrownError?.code).toBe('PRECONDITION_FAILED');
});
```

- Use `expect(...).rejects.toThrow()` for Promise rejections
- Catch to inspect error properties
- Assert error codes and messages

## Test Coverage by Module

**Current Coverage (205 test files detected):**

**High Coverage:**

- `lib/outreach/reply-triage.test.ts` — 4 tests covering all intents
- `lib/outreach/quality.test.ts` — 5 tests covering scoring logic
- `lib/outreach/inbound-adapters.test.ts` — 4 tests covering payload normalization
- `lib/outreach/send-email.test.ts` — Quality gate integration tests (2+ scenarios)
- `lib/admin-token.test.ts` — Token validation
- `lib/cadence/engine.test.ts` — Cadence evaluation
- `lib/enrichment/*.test.ts` — Multiple coverage for enrichment pipelines
- `lib/partnership/trigger-generator.test.ts` — Trigger generation logic

**Areas to Test:**

- Quote/QuoteLine schemas (new feature — Phase 1)
- Quote generation and validation
- Cross-module integration with existing outreach flow

## Test Execution

**Watch Mode:**

```bash
npm run test:ui
# Opens Vitest UI dashboard at http://localhost:51204
# Shows all tests, filter, debug, re-run on file change
```

**Single File:**

```bash
npm run test -- lib/outreach/reply-triage.test.ts
```

**Pattern Filter:**

```bash
npm run test -- --grep "classifies"
# Runs tests matching regex "classifies"
```

**Debugging:**

- Use `test.only()` to run single test
- Use `test.skip()` to skip tests
- Open Vitest UI for interactive debugging
- Use `vi.mock()` to isolate test failures

---

_Testing analysis: 2026-04-13_
