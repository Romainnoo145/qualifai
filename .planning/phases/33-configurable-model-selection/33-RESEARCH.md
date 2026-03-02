# Phase 33: Configurable Model Selection - Research

**Researched:** 2026-03-02
**Domain:** Anthropic SDK integration / two-pass LLM chain-of-thought / TypeScript function extension
**Confidence:** HIGH

## Summary

Phase 33 extends `generateHypothesisDraftsAI` in `lib/workflow-engine.ts` with two orthogonal features: (1) a `hypothesisModel` parameter that selects Gemini Flash (default) or Claude Sonnet as the generation backend, and (2) a two-pass chain-of-thought structure that separates evidence analysis from hypothesis synthesis, observable in the raw model output. Both features apply to both Gemini and Claude paths.

The Anthropic SDK (`@anthropic-ai/sdk` ^0.73.0) is already installed in `package.json` and already mocked in `lib/workflow-engine.test.ts`. No new npm dependencies are required. The `ANTHROPIC_API_KEY` env var is already declared in `env.mjs` as optional. The Claude model to use is `claude-sonnet-4-5` (current in-support version per SDK type definitions). The plumbing path is: tRPC `startRun`/`retryRun` input schema gains `hypothesisModel?: 'gemini-flash' | 'claude-sonnet'` → `executeResearchRun` receives it → passes it to `generateHypothesisDraftsAI` → function branches by model.

The two-pass chain-of-thought is implemented in the prompt, not via separate API calls. Pass 1 asks the model to produce a `<reasoning>` XML block analyzing the evidence by tier. Pass 2 instructs the model to produce the hypothesis JSON array using that reasoning. The resulting raw model response contains a `<reasoning>...</reasoning>` block before the JSON array. This is the "observable reasoning section" referenced in success criterion 4. For Gemini, this is accomplished via a single prompt with structured XML instruction. For Claude, the native `thinking` feature (ThinkingConfigAdaptive) can be used as an alternative — but a prompt-driven XML `<reasoning>` block is more portable, testable, and consistent between both models. Using `thinking: { type: 'adaptive' }` for Claude is the SDK-native approach (verified: SDK exports `ThinkingConfigAdaptive` with `type: 'adaptive'`).

**Primary recommendation:** Add `hypothesisModel?: 'gemini-flash' | 'claude-sonnet'` to `generateHypothesisDraftsAI` signature and the tRPC input schemas. Implement Claude path using `Anthropic.messages.create()` with the same prompt structure as Gemini. Implement two-pass CoT via a structured XML prompt section (`<reasoning>` block before JSON output) applied to both models.

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                 | Research Support                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ANLYS-08 | Two-pass chain-of-thought reasoning separates evidence analysis from hypothesis synthesis                   | Prompt-driven: add `<reasoning>` block instruction before JSON output instruction; both Gemini and Claude paths use same prompt structure; reasoning observable in raw response before JSON array          |
| MODEL-01 | Hypothesis generation supports configurable model selection (Gemini Flash vs Claude) via optional parameter | `hypothesisModel?: 'gemini-flash' \| 'claude-sonnet'` parameter on `generateHypothesisDraftsAI`, `executeResearchRun`, and tRPC `startRun`/`retryRun` inputs; STATE.md: opt-in per-run, not global env var |

</phase_requirements>

## Standard Stack

### Core

| Library                 | Version | Purpose                          | Why Standard                                                                            |
| ----------------------- | ------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| `@anthropic-ai/sdk`     | ^0.73.0 | Claude Sonnet API calls          | Already installed; ANTHROPIC_API_KEY already in env.mjs; test mock already in test file |
| `@google/generative-ai` | ^0.24.1 | Gemini Flash API calls (default) | Already in use; unchanged from Phase 32                                                 |

### Supporting

| Library | Version | Purpose            | When to Use                            |
| ------- | ------- | ------------------ | -------------------------------------- |
| None    | —       | No new deps needed | All changes are TS logic + prompt text |

### Alternatives Considered

| Instead of                          | Could Use                               | Tradeoff                                                                                                            |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Prompt-driven `<reasoning>` block   | Claude `thinking: { type: 'adaptive' }` | Native thinking is Claude-only; prompt-driven XML works on both models; testable with same mock pattern             |
| Per-run `hypothesisModel` parameter | Global env var `HYPOTHESIS_MODEL`       | STATE.md locked decision: opt-in per-run; global var prevents per-run comparison                                    |
| `claude-sonnet-4-5`                 | `claude-3-7-sonnet-latest`              | `claude-3-7-sonnet-latest` is deprecated (EOL Feb 19, 2026); `claude-sonnet-4-5` is current; SDK type confirms both |

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure

All changes contained to:

```
lib/
└── workflow-engine.ts       # generateHypothesisDraftsAI — add hypothesisModel param, Claude path, CoT prompt
lib/
└── ai/constants.ts          # add CLAUDE_MODEL_SONNET constant
lib/
└── research-executor.ts     # pass hypothesisModel through to generateHypothesisDraftsAI
server/
└── routers/research.ts      # add hypothesisModel?: z.enum(['gemini-flash', 'claude-sonnet']).optional() to startRun + retryRun
lib/
└── workflow-engine.test.ts  # add MODEL-01 + ANLYS-08 test cases
```

### Pattern 1: Model Parameter Threading

**What:** Add `hypothesisModel?: 'gemini-flash' | 'claude-sonnet'` at every layer of the call chain. Omitting it defaults to `'gemini-flash'` (backward compatible).

**Call chain:**

```
tRPC startRun/retryRun (z.enum input)
  → executeResearchRun (input.hypothesisModel)
    → generateHypothesisDraftsAI (hypothesisModel = 'gemini-flash')
```

**Function signature update:**

```typescript
// Source: lib/workflow-engine.ts (extend existing function)
export async function generateHypothesisDraftsAI(
  evidence: AIEvidenceInput[],
  prospectContext: AIProspectContext,
  confirmedPainTags: string[] = [], // ANLYS-06 — from Phase 32
  hypothesisModel: 'gemini-flash' | 'claude-sonnet' = 'gemini-flash', // MODEL-01 — new
): Promise<HypothesisDraft[]>;
```

**tRPC schema update (both startRun and retryRun):**

```typescript
// Source: server/routers/research.ts
z.object({
  prospectId: z.string(),
  // ...existing fields...
  hypothesisModel: z.enum(['gemini-flash', 'claude-sonnet']).optional(),
});
```

**retryRun needs to also read hypothesisModel from inputSnapshot for consistency:**

```typescript
// server/routers/research.ts retryRun
const snapshot = existing.inputSnapshot as Record<string, unknown> | null;
const hypothesisModel =
  snapshot?.hypothesisModel === 'claude-sonnet'
    ? 'claude-sonnet'
    : 'gemini-flash';
```

**executeResearchRun signature update:**

```typescript
// lib/research-executor.ts
export async function executeResearchRun(
  db: PrismaClient,
  input: {
    prospectId: string;
    campaignId?: string;
    manualUrls: string[];
    existingRunId?: string;
    deepCrawl?: boolean;
    hypothesisModel?: 'gemini-flash' | 'claude-sonnet'; // new
  },
);
```

**inputSnapshot must persist hypothesisModel** so retryRun can read it back:

```typescript
// lib/research-executor.ts — when persisting inputSnapshot
inputSnapshot: toJson({
  manualUrls: input.manualUrls,
  deepCrawl: input.deepCrawl ?? false,
  hypothesisModel: input.hypothesisModel ?? 'gemini-flash', // persist for retryRun
  sourceSet,
});
```

### Pattern 2: Lazy Anthropic Client

**What:** Instantiate Anthropic client lazily (same pattern as existing `getGenAI()` for Gemini). Place in `workflow-engine.ts` alongside the existing `getGenAI()` function.

**Why:** Avoids accessing `env.ANTHROPIC_API_KEY` at module load time (breaks test isolation). The existing Gemini client uses this pattern.

**Example:**

```typescript
// Source: lib/workflow-engine.ts (follow existing getGenAI pattern at line 20-25)
import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}
```

**Constants file update:**

```typescript
// Source: lib/ai/constants.ts (extend with Claude model constant)
export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash' as const;
export const CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5' as const;
```

### Pattern 3: Two-Pass Chain-of-Thought Prompt

**What:** The SAME prompt is used for both Gemini and Claude paths. It instructs the model to produce a `<reasoning>` XML block first (Pass 1: evidence analysis), then produce the JSON array (Pass 2: hypothesis synthesis). The model's raw output is the evidence for ANLYS-08 success criterion 4 ("reasoning section present before synthesis step").

**Why prompt-driven over Claude native thinking:** Claude's `thinking: { type: 'adaptive' }` produces ThinkingBlock objects visible only in the API response, not in the text content. Prompt-driven XML is visible in the text, parseable for tests, and identical behavior across both models.

**Prompt structure addition** (appended before the existing JSON output instruction):

```
Before generating hypotheses, produce a brief evidence analysis:

<reasoning>
Analyse each diagnostic signal:
1. Which evidence items are highest-quality (REVIEWS/CAREERS/LINKEDIN)?
2. Which pain tags are confirmed by multiple source types?
3. What does the hiring data reveal about operational gaps?
4. What website items to EXCLUDE from hypothesis derivation?
</reasoning>

After your <reasoning> block, output the JSON array (no markdown fences).
```

**JSON extraction must skip the reasoning block:**

```typescript
// Source: lib/workflow-engine.ts — update JSON extraction logic
// Old: const jsonMatch = text.match(/\[[\s\S]*\]/);
// New: strip reasoning block first, then extract JSON
const textWithoutReasoning = text.replace(
  /<reasoning>[\s\S]*?<\/reasoning>/g,
  '',
);
const jsonMatch = textWithoutReasoning.match(/\[[\s\S]*\]/);
```

**For Claude, the raw response text contains both the reasoning block AND the JSON array**, satisfying ANLYS-08 success criterion 4. For Gemini, same structure.

### Pattern 4: Claude API Call

**What:** Call `anthropic.messages.create()` with the same prompt, extract text from the first TextBlock in the response content array.

**Claude messages.create API pattern (verified from SDK source):**

```typescript
// Source: @anthropic-ai/sdk/src/resources/messages/messages.ts — create() method
import Anthropic from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages/messages';

const response = await getAnthropicClient().messages.create({
  model: CLAUDE_MODEL_SONNET,
  max_tokens: 4096,
  system:
    'You are analyzing external diagnostic signals to identify workflow pain hypotheses for a Dutch company. Klarifai is an AI/automation consultancy that could solve these pains.',
  messages: [{ role: 'user', content: prompt }],
});

// Extract text from response content (Claude returns content array of ContentBlock)
const textBlock = response.content.find(
  (b): b is TextBlock => b.type === 'text',
);
const text = textBlock?.text ?? '';
```

**Claude model string:** Use `'claude-sonnet-4-5'` (verified in SDK type `Model` union — `claude-sonnet-4-5` is listed; `claude-3-7-sonnet-latest` is deprecated EOL Feb 19, 2026 per SDK constants).

### Pattern 5: Unified JSON Extraction Post-CoT

**What:** Both Gemini and Claude paths call the same post-processing logic after getting the raw text response. Extract reasoning (for logging/tracing), strip it, then extract JSON array.

```typescript
// Unified extraction function usable by both paths
function extractHypothesisJson(rawText: string): {
  reasoning: string;
  jsonText: string;
} {
  const reasoningMatch = rawText.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reasoning = reasoningMatch?.[1]?.trim() ?? '';
  const textWithoutReasoning = rawText.replace(
    /<reasoning>[\s\S]*?<\/reasoning>/g,
    '',
  );
  const jsonMatch = textWithoutReasoning.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in AI response');
  return { reasoning, jsonText: jsonMatch[0] };
}
```

**Reasoning observability:** Log the reasoning to console for trace-level inspection:

```typescript
if (reasoning) {
  console.log(
    '[generateHypothesisDraftsAI] CoT reasoning block:',
    reasoning.slice(0, 300),
  );
}
```

### Pattern 6: Backward-Compatible Gemini Path

**What:** When `hypothesisModel === 'gemini-flash'` (default), use the existing Gemini path with only one addition: the CoT reasoning block in the prompt. All Phase 32 behavior is preserved.

**Key change to Gemini path:** The same `<reasoning>` block instruction is added to the prompt. The Gemini JSON extraction logic changes from:

```typescript
// Old (Phase 32):
const jsonMatch = text.match(/\[[\s\S]*\]/);
```

to:

```typescript
// New (Phase 33):
const { reasoning, jsonText } = extractHypothesisJson(text);
const jsonMatch = jsonText;
```

This is the ONLY change to the Gemini path. All ANLYS-01 through ANLYS-07 prompt text remains identical.

### Anti-Patterns to Avoid

- **Using `claude-3-7-sonnet-latest`:** Deprecated, EOL February 19 2026. Use `claude-sonnet-4-5` instead.
- **Using `thinking: { type: 'enabled' }` for Claude:** SDK logs a deprecation warning — "Use `thinking.type=adaptive` instead." Only `adaptive` type is recommended per SDK source at line 84.
- **Separate API call for reasoning pass:** Making two API calls (one for analysis, one for synthesis) doubles latency and cost with no observable quality benefit over a structured single-call CoT prompt.
- **Global env var for model selection:** STATE.md locked decision: per-run opt-in only. Do not add a `HYPOTHESIS_MODEL` env var.
- **Accessing `env.ANTHROPIC_API_KEY` at module load time:** Breaks test isolation. Use lazy init pattern (same as existing `getGenAI()`).
- **Storing hypothesisModel only in tRPC input, not in inputSnapshot:** retryRun reads inputSnapshot to reconstruct parameters. Must persist `hypothesisModel` in inputSnapshot during startRun.
- **Different prompt structure for Claude vs Gemini:** Use the same prompt for both. The distinction between models is only at the API call layer, not the prompt layer. This guarantees ANLYS-08 (CoT) works for both.

## Don't Hand-Roll

| Problem                   | Don't Build                             | Use Instead                                        | Why                                                                         |
| ------------------------- | --------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| Structured output parsing | Custom JSON schema validator for Claude | Same `JSON.parse` + Zod slice as Gemini            | Claude returns same JSON structure; no new parsing infrastructure needed    |
| Anthropic auth            | Custom HTTP client for Claude API       | `@anthropic-ai/sdk` Anthropic class                | Already installed; handles auth, retries, timeouts                          |
| Reasoning extraction      | Complex XML parser                      | `text.match(/<reasoning>([\s\S]*?)<\/reasoning>/)` | Regex is sufficient; reasoning block is model-generated, predictable format |

**Key insight:** This phase is model-routing plumbing + one prompt addition. The output shape is identical between models — the same JSON extraction and mapping logic applies to both.

## Common Pitfalls

### Pitfall 1: Claude Returns No JSON When Reasoning Dominates

**What goes wrong:** Claude may produce a long `<reasoning>` block and then omit the JSON array, or embed the JSON inside the reasoning block instead of after it.

**Why it happens:** Claude's instruction-following is strong but the prompt must clearly separate "first do this, then output that." Ambiguous instruction ordering causes Claude to merge the two passes.

**How to avoid:** The CoT instruction must explicitly state: "After your `</reasoning>` closing tag, output ONLY the JSON array on a new line. No other text after the JSON." The `extractHypothesisJson` helper strips reasoning before JSON extraction, so partial compliance (reasoning present, JSON present) still works.

**Warning signs:** `jsonMatch` is null in `extractHypothesisJson` after stripping reasoning — triggers fallback path.

### Pitfall 2: Claude `content` Array TextBlock Extraction

**What goes wrong:** Claude's `messages.create()` response returns `content: ContentBlock[]`, not a simple string. If you do `response.content[0].text` directly, TypeScript errors because `ContentBlock` is a union type (`TextBlock | ThinkingBlock | ...`).

**Why it happens:** Unlike Gemini's `.response.text()` method, Anthropic SDK returns typed content blocks.

**How to avoid:** Use a type guard to find the first TextBlock:

```typescript
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages/messages';
const textBlock = response.content.find(
  (b): b is TextBlock => b.type === 'text',
);
const text = textBlock?.text ?? '';
if (!text) throw new Error('No text content in Claude response');
```

**Warning signs:** TypeScript error TS2339 "property 'text' does not exist on type ContentBlock" or runtime crash on `response.content[0].text`.

### Pitfall 3: hypothesisModel Not Persisted to inputSnapshot

**What goes wrong:** `retryRun` re-reads `inputSnapshot` to reconstruct run parameters. If `hypothesisModel` is not persisted there, retrying a Claude-model run will silently use Gemini.

**Why it happens:** `startRun` receives `hypothesisModel` via tRPC input, but `retryRun` only reads from `inputSnapshot`. If `startRun` doesn't write it, `retryRun` loses it.

**How to avoid:** In `executeResearchRun`, always write `hypothesisModel: input.hypothesisModel ?? 'gemini-flash'` into the `inputSnapshot` JSON at the same place `deepCrawl` and `manualUrls` are written (lines 215-230 in research-executor.ts).

**Warning signs:** A retry of a Claude-model run produces Gemini-style output (shorter, different reasoning style).

### Pitfall 4: Test Mock Must Handle Both Models

**What goes wrong:** `workflow-engine.test.ts` already mocks `@anthropic-ai/sdk` with a rejected promise. When adding MODEL-01 tests that exercise the Claude path, the existing mock stub that rejects will cause all Claude tests to hit the fallback path instead of the happy path.

**Why it happens:** The existing Anthropic mock at line 13-19 of workflow-engine.test.ts uses `mockRejectedValue(new Error('test mock'))` — it's a stub for "not used, should fail." For MODEL-01 tests, it must return a mock Claude response.

**How to avoid:** Convert the module-level Anthropic mock to use `vi.fn()` (configurable), similar to the `mockGenerateContent` pattern already used for Gemini:

```typescript
// workflow-engine.test.ts — update existing Anthropic mock
let mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockAnthropicCreate };
  },
}));
```

Then configure `mockAnthropicCreate` per-test in beforeEach.

**Warning signs:** Claude path tests pass but always fall through to fallback (console.warn fires with "AI generation failed").

### Pitfall 5: Gemini ANLYS Tests Break Due to Reasoning Block in Text

**What goes wrong:** The 7 existing ANLYS tests (ANLYS-01 through ANLYS-07) check `lastCapturedPrompt` content. If the CoT instruction is added to the prompt, the `lastCapturedPrompt` assertions still pass (they check for substrings already present). However, the JSON extraction now runs `extractHypothesisJson` which strips a `<reasoning>` block. If the mock Gemini response does NOT contain a `<reasoning>` block, the extraction still works (the regex finds no match and returns empty reasoning, which is fine).

**How to avoid:** No change needed to the 7 existing ANLYS test response mocks — they don't include `<reasoning>` blocks and `extractHypothesisJson` handles that gracefully. The new MODEL-01 and ANLYS-08 tests are separate test cases.

**Warning signs:** Any of the 7 existing ANLYS tests change from GREEN to RED after Phase 33 changes.

### Pitfall 6: Claude Model Name Drift

**What goes wrong:** Using `'claude-sonnet'` as the enum value in the tRPC parameter but needing to map it to the actual Anthropic API model string `'claude-sonnet-4-5'`. Confusing the parameter enum with the API model string.

**How to avoid:** Clear separation:

- tRPC/function parameter: `'claude-sonnet'` (stable enum, version-independent)
- Constants file: `CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5'` (updatable in one place)
- API call: uses `CLAUDE_MODEL_SONNET` constant

```typescript
// lib/ai/constants.ts
export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash' as const;
export const CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5' as const;
```

**Warning signs:** Hardcoded `'claude-sonnet-4-5'` string appearing in workflow-engine.ts instead of the constant.

## Code Examples

Verified patterns from official sources:

### Anthropic messages.create() — minimal call

```typescript
// Source: @anthropic-ai/sdk/src/resources/messages/messages.ts (lines 50-56)
const message = await client.messages.create({
  max_tokens: 1024,
  messages: [{ content: 'Hello, world', role: 'user' }],
  model: 'claude-opus-4-6',
});
```

### TextBlock extraction from Claude response

```typescript
// Source: @anthropic-ai/sdk/src/resources/messages/messages.ts — ContentBlock union type
// ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | ...
// TextBlock.type === 'text', TextBlock.text === string
const textBlock = response.content.find(
  (b): b is TextBlock => b.type === 'text',
);
const text = textBlock?.text ?? '';
```

### Claude model constant — verified against SDK Model type

```typescript
// Verified: 'claude-sonnet-4-5' is listed in SDK Model union type (line 658)
// Verified: 'claude-3-7-sonnet-latest' is DEPRECATED (EOL Feb 19 2026, line 694)
export const CLAUDE_MODEL_SONNET = 'claude-sonnet-4-5' as const;
```

### Existing lazy Anthropic mock in test file (lines 13-19)

```typescript
// Source: lib/workflow-engine.test.ts (current state — must be updated to vi.fn())
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn().mockRejectedValue(new Error('test mock')),
    };
  },
}));
```

### Updated test mock (configurable per test)

```typescript
// Update for Phase 33 — make Anthropic mock configurable like Gemini mock
let mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockAnthropicCreate };
  },
}));

// Helper: Claude response factory (matches Anthropic Message shape)
const makeClaudeHypothesisResponse = (
  items: Array<{ title: string; problemStatement: string }>,
) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: `<reasoning>\nAnalysis: REVIEWS source shows direct pain.\n</reasoning>\n${JSON.stringify(
        items.map((item) => ({
          title: item.title,
          problemStatement: item.problemStatement,
          assumptions: ['Assumption 1'],
          validationQuestions: ['Question 1?'],
          workflowTag: 'planning',
          confidenceScore: 0.85,
          evidenceRefs: ['https://reviews.example.com/company-a'],
        })),
      )}`,
    },
  ],
  model: 'claude-sonnet-4-5',
  stop_reason: 'end_turn',
  usage: { input_tokens: 100, output_tokens: 200 },
});
```

### extractHypothesisJson helper pattern

```typescript
// Shared extraction utility — both Gemini and Claude paths use this
function extractHypothesisJson(rawText: string): {
  reasoning: string;
  jsonText: string;
} {
  const reasoningMatch = rawText.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reasoning = reasoningMatch?.[1]?.trim() ?? '';
  const textWithoutReasoning = rawText.replace(
    /<reasoning>[\s\S]*?<\/reasoning>/g,
    '',
  );
  const jsonMatch = textWithoutReasoning.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in AI response');
  return { reasoning, jsonText: jsonMatch[0] };
}
```

### CoT prompt addition (appended to existing prompt, before JSON output instruction)

```
Before generating the hypothesis JSON, produce a brief evidence analysis in this exact format:

<reasoning>
1. Top diagnostic signals (REVIEWS/CAREERS/LINKEDIN): [list the 2-3 most relevant items]
2. Confirmed pain areas: [list tags confirmed by multiple source types]
3. Website items to exclude: [list any WEBSITE-sourced items that could trigger parroting]
</reasoning>

After the closing </reasoning> tag, output ONLY the JSON array. No other text.
```

## State of the Art

| Old Approach                       | Current Approach                 | When Changed | Impact                                                  |
| ---------------------------------- | -------------------------------- | ------------ | ------------------------------------------------------- |
| Gemini Flash only, no model choice | Gemini default + Claude opt-in   | Phase 33     | Admin can select model per run; comparison possible     |
| Single-pass prompt → JSON          | Two-pass CoT → reasoning + JSON  | Phase 33     | Reasoning observable; separates analysis from synthesis |
| `GEMINI_MODEL_FLASH` constant only | + `CLAUDE_MODEL_SONNET` constant | Phase 33     | Both model strings managed centrally in constants.ts    |

**Model availability (verified in SDK):**

- `claude-sonnet-4-5` — current, in-support
- `claude-sonnet-4-5-20250929` — timestamped version of same
- `claude-3-7-sonnet-latest` — DEPRECATED, EOL Feb 19 2026 (do not use)
- `claude-sonnet-4-20250514` — also listed; use `claude-sonnet-4-5` for latest

**Deprecated/outdated:**

- `thinking: { type: 'enabled' }` for any model: SDK warns "deprecated, use `type: 'adaptive'` instead"
- `claude-3-7-sonnet-latest`: EOL February 19, 2026 (already past)

## Open Questions

1. **Should the CoT `<reasoning>` block be stored in the DB?**
   - What we know: The reasoning is currently only logged via `console.log`. There is no `reasoning` field in the `WorkflowHypothesis` Prisma schema.
   - What's unclear: Whether ANLYS-08 ("reasoning section present in raw model output before synthesis step") requires DB persistence or just console observability.
   - Recommendation: No DB schema change. Console log is sufficient for "observable." Adding a DB field is out of scope and risks schema migration overhead. The success criterion says "observable in raw model output" — console log satisfies this.

2. **Should retryRun expose hypothesisModel in tRPC input or always read from snapshot?**
   - What we know: `retryRun` currently re-reads `deepCrawl` from `inputSnapshot` (not from tRPC input). Consistent pattern would do the same for `hypothesisModel`.
   - What's unclear: Whether the user might want to retry with a different model than the original run.
   - Recommendation: retryRun reads `hypothesisModel` from `inputSnapshot` only (consistent with `deepCrawl` pattern). If the user wants to try a different model, they start a new run. This keeps retryRun's contract simple.

3. **Do both Gemini and Claude need the same CoT prompt instruction, or only Claude?**
   - What we know: ANLYS-08 says "two-pass chain-of-thought reasoning separates evidence analysis from hypothesis synthesis" — it does not specify which model. Success criterion 4 says "reasoning section present in raw model output before synthesis step."
   - Recommendation: Apply CoT to both models. This ensures all research runs have the reasoning trace, regardless of which model is selected. The prompt change is additive and does not break any existing ANLYS-01 through ANLYS-07 tests.

## Sources

### Primary (HIGH confidence)

- Codebase read: `lib/workflow-engine.ts` lines 616-865 — `generateHypothesisDraftsAI` full Phase 32 implementation (function signature, Gemini client pattern, JSON extraction, fallback)
- Codebase read: `lib/workflow-engine.ts` lines 19-26 — lazy `getGenAI()` pattern to replicate for Anthropic client
- Codebase read: `lib/ai/constants.ts` — `GEMINI_MODEL_FLASH` pattern to extend with `CLAUDE_MODEL_SONNET`
- Codebase read: `lib/workflow-engine.test.ts` lines 1-56 — existing Anthropic mock structure (must upgrade to configurable vi.fn())
- Codebase read: `server/routers/research.ts` — `startRun` (lines 22-39) and `retryRun` (lines 41-67) full implementations; `inputSnapshot` read pattern
- Codebase read: `lib/research-executor.ts` lines 101-130 — `executeResearchRun` signature and `inputSnapshot` write location
- Codebase read: `env.mjs` lines 17, 65 — `ANTHROPIC_API_KEY: z.string().min(1).optional()` already declared
- Codebase read: `package.json` — `"@anthropic-ai/sdk": "^0.73.0"` confirmed installed
- SDK read: `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` — `Model` type union (lines 645-667), `ThinkingConfigAdaptive` (line 929-931), `DEPRECATED_MODELS` (lines 682-698), `TextBlock` interface (lines 913-918), `create()` method signature (lines 58-104)
- Codebase read: `.planning/STATE.md` — locked decisions: "Gemini Flash remains default; Claude Sonnet as opt-in per-run (not global env var)", "No new npm dependencies"

### Secondary (MEDIUM confidence)

- Codebase read: `lib/workflow-engine.ts` lines 1-18 — import block; Anthropic not yet imported in production code
- Codebase read: `lib/ai/generate-wizard.ts` — Gemini lazy init pattern (reference for how generate-outreach.ts does it too)

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — `@anthropic-ai/sdk` installed, env var declared, mock in test file; SDK source read directly
- Architecture: HIGH — all call sites read, threading pattern clear, `inputSnapshot` persistence pattern established from `deepCrawl` precedent
- Pitfalls: HIGH — derived from SDK source, existing test file structure, and `retryRun` code pattern
- Model selection: HIGH — verified against SDK `Model` type union; `claude-3-7-sonnet-latest` deprecation confirmed in SDK constants

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable — Anthropic model availability may shift, but `claude-sonnet-4-5` is current and non-deprecated)
