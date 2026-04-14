import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// NO vi.mock('node:timers/promises', ...) — global setTimeout is handled by vi.useFakeTimers()

import { callGeminiWithRetry } from './master-analyzer';
import type {
  GenerativeModel,
  GenerateContentResult,
} from '@google/generative-ai';

function makeModel(
  impl: () => Promise<GenerateContentResult>,
): GenerativeModel {
  return { generateContent: vi.fn(impl) } as unknown as GenerativeModel;
}

const OK_RESULT = {
  response: { text: () => '{"ok":true}' },
} as unknown as GenerateContentResult;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('callGeminiWithRetry', () => {
  it('returns immediately when primary succeeds on first attempt', async () => {
    const model = makeModel(async () => OK_RESULT);
    const promise = callGeminiWithRetry(model, 'prompt', {
      modelName: 'gemini-2.5-pro',
    });
    await vi.runAllTimersAsync();
    const envelope = await promise;
    expect(envelope.result).toBe(OK_RESULT);
    expect(envelope.fallbackUsed).toBe(false);
    expect(envelope.modelUsed).toBe('gemini-2.5-pro');
    expect(envelope.attempts).toBe(1);
    expect(model.generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 Service Unavailable and succeeds on attempt 2', async () => {
    let calls = 0;
    const model = makeModel(async () => {
      calls += 1;
      if (calls === 1) throw new Error('503 Service Unavailable');
      return OK_RESULT;
    });
    const promise = callGeminiWithRetry(model, 'prompt', {
      modelName: 'gemini-2.5-pro',
    });
    await vi.runAllTimersAsync();
    const envelope = await promise;
    expect(envelope.result).toBe(OK_RESULT);
    expect(envelope.fallbackUsed).toBe(false);
    expect(envelope.modelUsed).toBe('gemini-2.5-pro');
    expect(envelope.attempts).toBe(2);
    expect(model.generateContent).toHaveBeenCalledTimes(2);
  });

  it('falls back to flash after 3 primary 503s and returns fallbackUsed=true', async () => {
    const primary = makeModel(async () => {
      throw new Error('503 Service Unavailable');
    });
    const fallback = makeModel(async () => OK_RESULT);
    const promise = callGeminiWithRetry(primary, 'prompt', {
      modelName: 'gemini-2.5-pro',
      fallbackModel: fallback,
      fallbackModelName: 'gemini-2.5-flash',
    });
    await vi.runAllTimersAsync();
    const envelope = await promise;
    expect(envelope.result).toBe(OK_RESULT);
    expect(envelope.fallbackUsed).toBe(true);
    expect(envelope.modelUsed).toBe('gemini-2.5-flash');
    expect(primary.generateContent).toHaveBeenCalledTimes(3);
    expect(fallback.generateContent).toHaveBeenCalledTimes(1);
  });

  it('throws with "Failed after" when primary + fallback both exhausted', async () => {
    const primary = makeModel(async () => {
      throw new Error('503 Service Unavailable');
    });
    const fallback = makeModel(async () => {
      throw new Error('503 Service Unavailable');
    });
    const expectation = expect(
      callGeminiWithRetry(primary, 'prompt', {
        modelName: 'gemini-2.5-pro',
        fallbackModel: fallback,
        fallbackModelName: 'gemini-2.5-flash',
      }),
    ).rejects.toThrow(/Failed after/);
    await vi.runAllTimersAsync();
    await expectation;
  });

  it('bubbles non-retryable errors immediately without retry', async () => {
    const model = makeModel(async () => {
      throw new Error('400 Bad Request: invalid prompt');
    });
    await expect(
      callGeminiWithRetry(model, 'prompt', { modelName: 'gemini-2.5-pro' }),
    ).rejects.toThrow(/Bad Request/);
    expect(model.generateContent).toHaveBeenCalledTimes(1);
  });

  it('treats "quota" errors as retryable', async () => {
    let calls = 0;
    const model = makeModel(async () => {
      calls += 1;
      if (calls < 3) throw new Error('quota exhausted for project');
      return OK_RESULT;
    });
    const promise = callGeminiWithRetry(model, 'prompt', {
      modelName: 'gemini-2.5-pro',
    });
    await vi.runAllTimersAsync();
    const envelope = await promise;
    expect(envelope.result).toBe(OK_RESULT);
    expect(envelope.attempts).toBe(3);
    expect(model.generateContent).toHaveBeenCalledTimes(3);
  });

  it('logs "Falling back" when fallback triggers', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const primary = makeModel(async () => {
      throw new Error('503');
    });
    const fallback = makeModel(async () => OK_RESULT);
    const promise = callGeminiWithRetry(primary, 'prompt', {
      modelName: 'gemini-2.5-pro',
      fallbackModel: fallback,
      fallbackModelName: 'gemini-2.5-flash',
    });
    await vi.runAllTimersAsync();
    await promise;
    const messages = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(messages).toMatch(/Falling back to gemini-2\.5-flash after/);
    warnSpy.mockRestore();
  });
});
