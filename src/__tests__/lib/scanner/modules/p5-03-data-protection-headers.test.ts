/**
 * Unit tests for P5-03 — Data-protection-relevant headers.
 *
 * Covers: happy path (all headers strong → no findings), edge cases (missing
 * headers, weak values, case-insensitive lookup, oversized header clipped),
 * and the mandatory invariants:
 *  - INVARIANT #1: no outbound network (pure function over crawl.headers)
 *  - INVARIANT #4: no numeric score / no attestation vocabulary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runDataProtectionHeadersModule } from '@/lib/scanner/modules/p5-03-data-protection-headers';
import { makeCrawl, makeCtx, assertNoAttestationLanguage } from './p5-test-helpers';

const STRONG_HEADERS: Record<string, string> = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy': "default-src 'self'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'x-content-type-options': 'nosniff',
};

describe('P5-03 data-protection headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits no findings when every relevant header is present and strong', () => {
    const findings = runDataProtectionHeadersModule(
      makeCrawl({ headers: { ...STRONG_HEADERS } }),
      makeCtx(),
    );
    expect(findings).toEqual([]);
  });

  it('emits a finding per absent header (empty headers)', () => {
    const findings = runDataProtectionHeadersModule(
      makeCrawl({ headers: {} }),
      makeCtx(),
    );
    expect(findings).toHaveLength(5);
    for (const f of findings) {
      expect(f.moduleId).toBe('P5-03');
      expect(f.title.toLowerCase()).toContain('not set');
      assertNoAttestationLanguage(f);
    }
  });

  it('flags a weak HSTS max-age (< one year) as a weak finding, not absent', () => {
    const findings = runDataProtectionHeadersModule(
      makeCrawl({
        headers: { ...STRONG_HEADERS, 'strict-transport-security': 'max-age=3600' },
      }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('shorter than one year');
    expect(findings[0].severity).toBe('MEDIUM');
  });

  it('flags a weak Referrer-Policy that discloses the full URL', () => {
    const findings = runDataProtectionHeadersModule(
      makeCrawl({
        headers: { ...STRONG_HEADERS, 'referrer-policy': 'unsafe-url' },
      }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].title.toLowerCase()).toContain('referrer-policy');
  });

  it('flags a wildcarded sensitive Permissions-Policy directive', () => {
    const findings = runDataProtectionHeadersModule(
      makeCrawl({
        headers: { ...STRONG_HEADERS, 'permissions-policy': 'geolocation=*' },
      }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].title.toLowerCase()).toContain('permissions-policy');
  });

  it('performs case-insensitive header lookup (mixed-case key)', () => {
    const { 'strict-transport-security': _omit, ...rest } = STRONG_HEADERS;
    const findings = runDataProtectionHeadersModule(
      makeCrawl({
        headers: {
          ...rest,
          // Only an upper-cased variant is present — must still be found.
          'Strict-Transport-Security': 'max-age=31536000',
        },
      }),
      makeCtx(),
    );
    // present via mixed-case key and strong → no finding for HSTS
    expect(findings).toEqual([]);
  });

  it('treats an empty-string header value as absent', () => {
    const findings = runDataProtectionHeadersModule(
      makeCrawl({
        headers: { ...STRONG_HEADERS, 'content-security-policy': '' },
      }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('Content-Security-Policy');
  });

  it('clips an oversized header value in evidence (no inflation)', () => {
    const longValue = 'max-age=10; ' + 'a'.repeat(500);
    const findings = runDataProtectionHeadersModule(
      makeCrawl({
        headers: { ...STRONG_HEADERS, 'strict-transport-security': longValue },
      }),
      makeCtx(),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].evidence.length).toBeLessThan(longValue.length);
    expect(findings[0].evidence).toContain('…');
  });

  describe('INVARIANT #1 — no outbound network', () => {
    it('does not call global fetch', () => {
      runDataProtectionHeadersModule(makeCrawl({ headers: {} }), makeCtx());
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
