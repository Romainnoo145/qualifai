import { describe, it, expect } from 'vitest';
import { prettifyDomainToName } from './company-name';

describe('prettifyDomainToName', () => {
  it('returns null for null/empty input', () => {
    expect(prettifyDomainToName(null)).toBeNull();
    expect(prettifyDomainToName(undefined)).toBeNull();
    expect(prettifyDomainToName('')).toBeNull();
    expect(prettifyDomainToName('   ')).toBeNull();
  });

  it('capitalizes a simple single-word domain', () => {
    expect(prettifyDomainToName('marfa.nl')).toBe('Marfa');
    expect(prettifyDomainToName('heijmans.nl')).toBe('Heijmans');
    expect(prettifyDomainToName('mujjo.com')).toBe('Mujjo');
  });

  it('splits hyphenated words and title-cases each', () => {
    expect(prettifyDomainToName('van-der-berg.nl')).toBe('Van Der Berg');
    // "abc" has a vowel so it falls through to title case — acceptable
    // for a best-effort fallback (real acronym wins via known list or
    // the all-consonant heuristic, not applicable here).
    expect(prettifyDomainToName('abc-consulting.com')).toBe('Abc Consulting');
  });

  it('uppercases short all-consonant segments as acronyms', () => {
    expect(prettifyDomainToName('stb-kozijnen.nl')).toBe('STB Kozijnen');
    expect(prettifyDomainToName('kpn.nl')).toBe('KPN');
    expect(prettifyDomainToName('nlkm-partners.nl')).toBe('Nlkm Partners');
  });

  it('uppercases known business suffixes', () => {
    expect(prettifyDomainToName('nedri-bv.nl')).toBe('Nedri BV');
    expect(prettifyDomainToName('acme-gmbh.de')).toBe('Acme GmbH');
  });

  it('strips protocol, www, and path', () => {
    expect(prettifyDomainToName('https://www.marfa.nl/contact')).toBe('Marfa');
    expect(prettifyDomainToName('http://stb-kozijnen.nl/over-ons')).toBe(
      'STB Kozijnen',
    );
  });

  it('handles multi-part TLDs like .co.uk and .com.au', () => {
    expect(prettifyDomainToName('acme.co.uk')).toBe('Acme');
    expect(prettifyDomainToName('example.com.au')).toBe('Example');
    expect(prettifyDomainToName('sub.example.co.uk')).toBe('Example');
  });

  it('returns a best-effort single word when no separators exist', () => {
    expect(prettifyDomainToName('deondernemer.nl')).toBe('Deondernemer');
  });

  it('ignores multiple hyphens', () => {
    expect(prettifyDomainToName('a--b---c.nl')).toBe('A B C');
  });
});
