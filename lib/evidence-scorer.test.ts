import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  RELEVANCE_THRESHOLDS,
  DEFAULT_RELEVANCE_THRESHOLD,
} from './evidence-scorer';

// --- RELEVANCE_THRESHOLDS constant tests ---

describe('RELEVANCE_THRESHOLDS', () => {
  it('WEBSITE threshold is 0.25', () => {
    expect(RELEVANCE_THRESHOLDS['WEBSITE']).toBe(0.25);
  });

  it('REGISTRY threshold is 0.25', () => {
    expect(RELEVANCE_THRESHOLDS['REGISTRY']).toBe(0.25);
  });

  it('MANUAL_URL threshold is 0.25', () => {
    expect(RELEVANCE_THRESHOLDS['MANUAL_URL']).toBe(0.25);
  });

  it('DOCS threshold is 0.25', () => {
    expect(RELEVANCE_THRESHOLDS['DOCS']).toBe(0.25);
  });

  it('HELP_CENTER threshold is 0.25', () => {
    expect(RELEVANCE_THRESHOLDS['HELP_CENTER']).toBe(0.25);
  });

  it('REVIEWS threshold is 0.45', () => {
    expect(RELEVANCE_THRESHOLDS['REVIEWS']).toBe(0.45);
  });

  it('CAREERS threshold is 0.45', () => {
    expect(RELEVANCE_THRESHOLDS['CAREERS']).toBe(0.45);
  });

  it('JOB_BOARD threshold is 0.45', () => {
    expect(RELEVANCE_THRESHOLDS['JOB_BOARD']).toBe(0.45);
  });

  it('LINKEDIN threshold is 0.35', () => {
    expect(RELEVANCE_THRESHOLDS['LINKEDIN']).toBe(0.35);
  });

  it('NEWS threshold is 0.35', () => {
    expect(RELEVANCE_THRESHOLDS['NEWS']).toBe(0.35);
  });
});

// --- DEFAULT_RELEVANCE_THRESHOLD constant test ---

describe('DEFAULT_RELEVANCE_THRESHOLD', () => {
  it('is 0.3', () => {
    expect(DEFAULT_RELEVANCE_THRESHOLD).toBe(0.3);
  });
});

// --- scoreBatch prompt contains Dutch calibration examples ---
// These tests verify the source file directly to avoid complex mock setup
// while still ensuring the Dutch prompt text is present.

describe('evidence-scorer.ts source contains Dutch calibration text', () => {
  const srcPath = join(__dirname, 'evidence-scorer.ts');
  const src = readFileSync(srcPath, 'utf-8');

  it('source file contains "Dutch" keyword', () => {
    expect(src).toMatch(/Dutch/);
  });

  it('source file contains "Nederlands" keyword', () => {
    expect(src).toMatch(/Nederlands/);
  });

  it('source file contains "facturen handmatig" Dutch example', () => {
    expect(src).toContain('facturen handmatig');
  });

  it('source file contains low-relevance Dutch counter-example', () => {
    expect(src).toContain('KvK nummer');
  });
});
