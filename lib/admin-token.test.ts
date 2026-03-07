import { describe, expect, it } from 'vitest';
import { normalizeAdminToken } from './admin-token';

describe('normalizeAdminToken', () => {
  it('returns null for empty values', () => {
    expect(normalizeAdminToken(undefined)).toBeNull();
    expect(normalizeAdminToken(null)).toBeNull();
    expect(normalizeAdminToken('   ')).toBeNull();
  });

  it('trims plain token values', () => {
    expect(normalizeAdminToken('  abc123  ')).toBe('abc123');
  });

  it('strips bearer prefixes', () => {
    expect(normalizeAdminToken('Bearer abc123')).toBe('abc123');
    expect(normalizeAdminToken('bearer   abc123')).toBe('abc123');
  });

  it('strips surrounding quotes', () => {
    expect(normalizeAdminToken('"abc123"')).toBe('abc123');
    expect(normalizeAdminToken("'abc123'")).toBe('abc123');
  });

  it('handles bearer values that are wrapped in quotes', () => {
    expect(normalizeAdminToken('"Bearer abc123"')).toBe('abc123');
  });
});
