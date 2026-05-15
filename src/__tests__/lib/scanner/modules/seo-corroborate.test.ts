import { describe, it, expect } from 'vitest';
import {
  corroborate,
  type SourceObservation,
} from '@/lib/scanner/modules/seo-corroborate';

const obs = (
  source: SourceObservation['source'],
  failed: boolean,
): SourceObservation => ({ source, failed });

describe('seo-corroborate', () => {
  it('no observations → INFO/low (caller should not emit)', () => {
    expect(corroborate([], 'HIGH')).toEqual({ severity: 'INFO', confidence: 'low' });
  });

  it('observations present but none failing → INFO/low', () => {
    expect(
      corroborate([obs('lighthouse', false), obs('cheerio', false)], 'HIGH'),
    ).toEqual({ severity: 'INFO', confidence: 'low' });
  });

  it('≥2 sources agree it failed → base severity, high confidence', () => {
    expect(
      corroborate([obs('lighthouse', true), obs('cheerio', true)], 'HIGH'),
    ).toEqual({ severity: 'HIGH', confidence: 'high' });
    expect(
      corroborate(
        [obs('cheerio', true), obs('direct-fetch', true), obs('w3c-nu', true)],
        'MEDIUM',
      ),
    ).toEqual({ severity: 'MEDIUM', confidence: 'high' });
  });

  it('single uncontradicted source → downgraded severity, medium confidence', () => {
    expect(corroborate([obs('cheerio', true)], 'HIGH')).toEqual({
      severity: 'MEDIUM',
      confidence: 'medium',
    });
    expect(corroborate([obs('direct-fetch', true)], 'MEDIUM')).toEqual({
      severity: 'LOW',
      confidence: 'medium',
    });
    expect(corroborate([obs('cheerio', true)], 'LOW')).toEqual({
      severity: 'LOW',
      confidence: 'medium',
    });
  });

  it('disagreement (1 of several flags it) → downgraded severity, low confidence', () => {
    expect(
      corroborate([obs('lighthouse', true), obs('cheerio', false)], 'HIGH'),
    ).toEqual({ severity: 'MEDIUM', confidence: 'low' });
    expect(
      corroborate(
        [obs('cheerio', true), obs('direct-fetch', false), obs('w3c-nu', false)],
        'MEDIUM',
      ),
    ).toEqual({ severity: 'LOW', confidence: 'low' });
  });

  it('LOW base severity floors at LOW on downgrade', () => {
    expect(corroborate([obs('cheerio', true)], 'LOW')).toEqual({
      severity: 'LOW',
      confidence: 'medium',
    });
    expect(
      corroborate([obs('cheerio', true), obs('direct-fetch', false)], 'LOW'),
    ).toEqual({ severity: 'LOW', confidence: 'low' });
  });
});
