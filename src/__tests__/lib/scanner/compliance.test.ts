/**
 * Unit tests for the compliance orchestrator (compliance.ts).
 *
 * Focus is the mandatory invariants the orchestrator owns:
 *  - INVARIANT #1: no outbound network across the whole P5 pipeline
 *  - INVARIANT #5: frameworkSummary contains NO numeric field (status union only)
 *  - INVARIANT #6: orchestrator isolation — one throwing module does not lose
 *    the others' findings, and the failure is logged via logger
 *  - INVARIANT #4: no attestation vocabulary / numeric score in any finding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// logger is imported by compliance.ts and is NOT globally mocked — mock here so
// we can assert the isolation path logs the error (INVARIANT #6).
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock one sub-module (P5-04) so we can force it to throw for the isolation test.
vi.mock('@/lib/scanner/modules/p5-04-wcag-attestation', () => ({
  runWcagAttestationModule: vi.fn(() => {
    throw new Error('boom — simulated P5-04 failure');
  }),
}));

import { runComplianceModules } from '@/lib/scanner/modules/compliance';
import { logger } from '@/lib/logger';
import { makeCrawl, makeCtx, assertNoAttestationLanguage } from './modules/p5-test-helpers';

const RICH_HTML =
  '<html><body>' +
  '<a href="/login">Log in</a><input type="password" />' +
  '<footer><a href="/privacy-policy">Privacy Policy</a></footer>' +
  '<button>Delete my account</button><button>Download my data</button>' +
  '<a href="/x">Do Not Sell My Personal Information</a>' +
  '</body></html>';

describe('compliance orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('INVARIANT #6 — orchestrator isolation', () => {
    it('still returns the other modules findings when P5-04 throws', async () => {
      const result = await runComplianceModules(
        makeCrawl({
          renderMode: 'headless',
          renderedHtml: RICH_HTML,
          cleanedHtml: RICH_HTML,
        }),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'lab' }),
      );
      // findings array exists and is not empty despite the P5-04 throw
      expect(Array.isArray(result.findings)).toBe(true);
      // No finding came from the throwing module
      expect(result.findings.some((f) => f.moduleId === 'P5-04')).toBe(false);
      // Other modules still contributed (e.g. headers, third-party)
      expect(result.findings.length).toBeGreaterThan(0);
    });

    it('logs the failure via logger.error', async () => {
      await runComplianceModules(
        makeCrawl({ renderMode: 'headless', renderedHtml: RICH_HTML, cleanedHtml: RICH_HTML }),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'lab' }),
      );
      expect(logger.error).toHaveBeenCalled();
      const call = (logger.error as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(call[0])).toContain('P5-04');
    });
  });

  describe('INVARIANT #5 — non-numeric framework summary', () => {
    it('produces only string status values, no numeric/score fields anywhere', async () => {
      const result = await runComplianceModules(
        makeCrawl({ renderMode: 'headless', renderedHtml: RICH_HTML, cleanedHtml: RICH_HTML }),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'lab' }),
      );
      expect(Array.isArray(result.frameworkSummary)).toBe(true);
      for (const entry of result.frameworkSummary) {
        expect(typeof entry.framework).toBe('string');
        // entry has exactly framework + signals — no score/count/percentage key
        expect(Object.keys(entry).sort()).toEqual(['framework', 'signals']);
        for (const sig of entry.signals) {
          expect(typeof sig.label).toBe('string');
          expect(['observed', 'not-observed', 'not-evaluated']).toContain(
            sig.status,
          );
          // status must NOT be numeric and there must be no numeric extra key
          expect(typeof sig.status).not.toBe('number');
          expect(Object.keys(sig).sort()).toEqual(['label', 'status']);
        }
      }
      // Deep scan: no value anywhere in the summary is a number.
      const seen = new Set<unknown>();
      const assertNoNumbers = (v: unknown): void => {
        if (v === null || typeof v !== 'object') {
          expect(typeof v).not.toBe('number');
          return;
        }
        if (seen.has(v)) return;
        seen.add(v);
        for (const child of Object.values(v as Record<string, unknown>)) {
          assertNoNumbers(child);
        }
      };
      assertNoNumbers(result.frameworkSummary);
    });

    it('includes all three frameworks in stable order even on a thin crawl', async () => {
      const result = await runComplianceModules(
        makeCrawl({ renderMode: 'fetch-only', html: '' }),
        makeCtx(),
      );
      const names = result.frameworkSummary.map((e) => e.framework);
      expect(names).toEqual(['GDPR', 'CCPA', 'WCAG / Accessibility']);
    });
  });

  describe('INVARIANT #4 — no attestation language in aggregated findings', () => {
    it('every produced finding is free of verdict/score vocabulary', async () => {
      const result = await runComplianceModules(
        makeCrawl({ renderMode: 'headless', renderedHtml: RICH_HTML, cleanedHtml: RICH_HTML }),
        makeCtx({ accessibilityScore: 75, accessibilityScoreSource: 'lab' }),
      );
      for (const f of result.findings) {
        if (f.moduleId === 'P5-04') {
          // P5-04 signal-path explanation legitimately contains the word
          // "attestation" inside a negating disclaimer ("cannot be used as a
          // compliance attestation"). Assert the claim-bearing fields are clean
          // and the explanation only ever uses it in the disclaiming form.
          assertNoAttestationLanguage({
            ...f,
            explanation: '',
            evidence: f.title,
            impact: f.title,
          });
          const ex = f.explanation.toLowerCase();
          for (const w of ['certified', 'guarantee', 'is compliant', 'are compliant']) {
            expect(ex).not.toContain(w);
          }
          if (ex.includes('attestation')) {
            expect(ex).toMatch(/cannot be used as a compliance attestation/);
          }
          continue;
        }
        assertNoAttestationLanguage(f);
      }
    });
  });

  describe('INVARIANT #1 — no outbound network', () => {
    it('does not call global fetch across the whole pipeline', async () => {
      await runComplianceModules(
        makeCrawl({ renderMode: 'headless', renderedHtml: RICH_HTML, cleanedHtml: RICH_HTML }),
        makeCtx({ accessibilityScore: 95, accessibilityScoreSource: 'lab' }),
      );
      await runComplianceModules(
        makeCrawl({ renderMode: 'fetch-only', html: '' }),
        makeCtx(),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
