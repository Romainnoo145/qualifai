/**
 * Unit tests for createAndProcess Zod input schema validation (PARITY-10).
 * Tests the schema rules only — not the mutation handler (which requires full DB/ctx).
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the createAndProcess input schema so we can test it in isolation
const createAndProcessInput = z.object({
  domain: z.string().min(1),
  internalNotes: z.string().optional(),
  companyName: z.string().min(1).max(200).optional().nullable(),
  industry: z.string().min(1).max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  employeeRange: z
    .enum([
      '1-10',
      '11-50',
      '51-200',
      '201-500',
      '501-1000',
      '1001-5000',
      '5001+',
    ])
    .optional()
    .nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

describe('createAndProcess Zod input schema', () => {
  it('Test 1: accepts domain + optional enrichment fields', () => {
    const result = createAndProcessInput.safeParse({
      domain: 'marfa.nl',
      companyName: 'Marfa Design Studio',
      city: 'Amsterdam',
      country: 'Nederland',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyName).toBe('Marfa Design Studio');
      expect(result.data.city).toBe('Amsterdam');
      expect(result.data.country).toBe('Nederland');
    }
  });

  it('Test 2: accepts domain-only (all optional fields absent)', () => {
    const result = createAndProcessInput.safeParse({ domain: 'marfa.nl' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyName).toBeUndefined();
    }
  });

  it('Test 4: accepts valid employeeRange enum value', () => {
    const result = createAndProcessInput.safeParse({
      domain: 'x.nl',
      employeeRange: '51-200',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeRange).toBe('51-200');
    }
  });

  it('Test 5: rejects invalid employeeRange value (enum check)', () => {
    const result = createAndProcessInput.safeParse({
      domain: 'x.nl',
      employeeRange: 'invalid-value',
    });
    expect(result.success).toBe(false);
  });

  it('Test 6: rejects description longer than 500 chars', () => {
    const result = createAndProcessInput.safeParse({
      domain: 'x.nl',
      description: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 7 valid employeeRange enum values', () => {
    const validValues = [
      '1-10',
      '11-50',
      '51-200',
      '201-500',
      '501-1000',
      '1001-5000',
      '5001+',
    ] as const;
    for (const v of validValues) {
      const result = createAndProcessInput.safeParse({
        domain: 'x.nl',
        employeeRange: v,
      });
      expect(result.success, `Expected ${v} to be valid`).toBe(true);
    }
  });

  it('accepts null for optional fields', () => {
    const result = createAndProcessInput.safeParse({
      domain: 'x.nl',
      companyName: null,
      industry: null,
      description: null,
      employeeRange: null,
      city: null,
      country: null,
    });
    expect(result.success).toBe(true);
  });
});
