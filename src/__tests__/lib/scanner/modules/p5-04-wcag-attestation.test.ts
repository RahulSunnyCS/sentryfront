/**
 * Unit tests for P5-04 — WCAG Attestation Signal.
 *
 * Covers: happy path (usable score → signal tier), edge cases (score tiers),
 * and the mandatory invariants:
 *  - INVARIANT #1: no outbound network (pure function)
 *  - INVARIANT #2: fail-closed — undefined / 0 / 'unavailable' source →
 *    "unavailable" INFO (never a 0/100 verdict finding)
 *  - INVARIANT #3: C1 PII/token leak fixed — a11y statement href stripped
 *  - INVARIANT #4: no numeric score / no attestation vocabulary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runWcagAttestationModule } from '@/lib/scanner/modules/p5-04-wcag-attestation';
import type { RawFinding } from '@/lib/scanner/types';
import { makeCrawl, makeCtx, assertNoAttestationLanguage } from './p5-test-helpers';

/**
 * P5-04 signal-path carve-out:
 *
 * The shared assertNoAttestationLanguage() oracle forbids the word
 * "attestation" anywhere in a finding. The P5-04 signal-path explanation
 * legitimately contains it inside a *negating disclaimer* ("...cannot be used
 * as a compliance attestation..."), which is the claim-SAFE behaviour the
 * feature requires (it explicitly denies making an attestation). Applying the
 * full oracle to that explanation would wrongly fail a correct disclaimer.
 *
 * So for the signal path we assert the invariant on the claim-bearing fields
 * (title, evidence, impact) and separately assert the explanation only ever
 * uses "attestation" in the negated, disclaiming form — never as a positive
 * verdict. Title/evidence/impact must still be fully clean.
 */
function assertSignalPathClaimSafe(f: RawFinding): void {
  for (const field of [f.title, f.evidence, f.impact]) {
    assertNoAttestationLanguage({ ...f, explanation: '', title: field, evidence: field, impact: field });
  }
  // No numeric score / percentage anywhere, including the explanation.
  for (const raw of [f.title, f.evidence, f.explanation, f.impact]) {
    expect(raw).not.toMatch(/\b\d{1,3}\s*\/\s*\d{1,3}\b/);
    expect(raw).not.toMatch(/\b\d{1,3}\s*%/);
    expect(raw).not.toMatch(/\bscore\s*[:=]\s*\d/i);
  }
  // The only attestation/verdict word permitted is "attestation" and only in
  // the explicit negating disclaimer — never "is compliant"/"certified"/etc.
  const ex = f.explanation.toLowerCase();
  for (const w of ['certified', 'guarantee', 'is compliant', 'are compliant', 'fully compliant', 'non-compliant']) {
    expect(ex).not.toContain(w);
  }
  if (ex.includes('attestation')) {
    expect(ex).toMatch(/cannot be used as a compliance attestation/);
  }
}

describe('P5-04 WCAG attestation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fail-closed (INVARIANT #2)', () => {
    it('emits a single "unavailable" INFO when accessibilityScore is undefined', () => {
      const findings = runWcagAttestationModule(makeCrawl(), makeCtx());
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('unavailable');
      assertNoAttestationLanguage(findings[0]);
    });

    it('emits "unavailable" INFO (never a 0/100 finding) when score is 0', () => {
      const findings = runWcagAttestationModule(
        makeCrawl(),
        makeCtx({ accessibilityScore: 0, accessibilityScoreSource: 'lab' }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('unavailable');
      // must not present 0 as a verdict
      expect(findings[0].severity).not.toBe('MEDIUM');
      assertNoAttestationLanguage(findings[0]);
    });

    it('emits "unavailable" INFO when scoreSource is "unavailable" even with a number', () => {
      const findings = runWcagAttestationModule(
        makeCrawl(),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'unavailable' }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title.toLowerCase()).toContain('unavailable');
    });
  });

  describe('signal path — usable score', () => {
    it('emits an INFO signal for a high score tier (>=90)', () => {
      const findings = runWcagAttestationModule(
        makeCrawl(),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'lab' }),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('INFO');
      expect(findings[0].title).toContain('score tier');
      assertSignalPathClaimSafe(findings[0]);
    });

    it('emits LOW for a moderate tier (70-89)', () => {
      const findings = runWcagAttestationModule(
        makeCrawl(),
        makeCtx({ accessibilityScore: 75, accessibilityScoreSource: 'lab' }),
      );
      expect(findings[0].severity).toBe('LOW');
      assertSignalPathClaimSafe(findings[0]);
    });

    it('emits MEDIUM for a low tier (<70) but never a numeric percentage', () => {
      const findings = runWcagAttestationModule(
        makeCrawl(),
        makeCtx({ accessibilityScore: 40, accessibilityScoreSource: 'lab' }),
      );
      expect(findings[0].severity).toBe('MEDIUM');
      assertSignalPathClaimSafe(findings[0]);
    });
  });

  describe('INVARIANT #3 — C1 PII/token leak fixed (a11y statement href)', () => {
    it('strips query, email, token and fragment from the detected statement href', () => {
      const href = '/accessibility?email=a@b.com&token=secret123#frag';
      const html = `<html><body><a href="${href}">Accessibility Statement</a></body></html>`;
      const findings = runWcagAttestationModule(
        makeCrawl({ cleanedHtml: html, finalUrl: 'https://site.example/' }),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'lab' }),
      );
      const f = findings[0];
      const blob = `${f.evidence}\n${f.location}`;
      expect(blob).toContain('/accessibility');
      expect(blob).not.toContain('a@b.com');
      expect(blob).not.toContain('secret123');
      expect(blob).not.toContain('token=');
      expect(blob).not.toContain('email=');
      expect(blob).not.toContain('#frag');
    });
  });

  describe('INVARIANT #1 — no outbound network', () => {
    it('does not call global fetch on any path', () => {
      runWcagAttestationModule(makeCrawl(), makeCtx());
      runWcagAttestationModule(
        makeCrawl({ cleanedHtml: '<a href="/accessibility">A11y</a>' }),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'lab' }),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
