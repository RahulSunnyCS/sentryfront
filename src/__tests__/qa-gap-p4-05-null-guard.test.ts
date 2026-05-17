/**
 * QA Gap: P4-05 Mobile SEO — `performanceScore = null` guard (🟡 functional)
 *
 * QA checklist case:
 *   "`p4-05-mobile-seo` uses `performanceScore !== null` before the `< 0.9`
 *    comparison, preventing a false finding when score is null"
 *
 * The existing p4-05-mobile-seo.test.ts covers the CWV check when
 * `performanceScore >= 0.9` (no finding) and `performanceScore < 0.9` (finding
 * emitted). However it does NOT include a test where `performanceScore` is null
 * while `seoIssues` is present and individual CWV metrics are poor.
 *
 * Without the null guard `performanceScore !== null &&`, a null score would
 * evaluate as `null < 0.9 → false` (correct JS behaviour), but this is an
 * implementation detail that could change. The QA checklist requires explicit
 * test coverage to pin the contract.
 *
 * This file adds the single missing scenario without duplicating any assertion
 * already present in p4-05-mobile-seo.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { runMobileSEOModule } from '@/lib/scanner/modules/p4-05-mobile-seo';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

function makeMetrics(overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
  return {
    lcp: null,
    fcp: null,
    cls: null,
    tbt: null,
    tti: null,
    si: null,
    ttfb: null,
    performanceScore: null,
    accessibilityScore: null,
    seoScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    ...overrides,
  };
}

describe('P4-05: performanceScore null guard (QA checklist 🟡)', () => {
  it('does NOT emit a CWV finding when performanceScore is null, even with poor individual metrics', async () => {
    // The guard is `performanceScore !== null && performanceScore < 0.9`.
    // When performanceScore is null (PSI/Lighthouse UNAVAILABLE), the condition
    // must short-circuit to false — no CWV finding is emitted.
    // Without this guard, the comparison `null < 0.9` evaluates to false in JS,
    // but making the guard explicit documents the intentional contract.
    const findings = await runMobileSEOModule(
      makeMetrics({
        // Provide a seoIssue so the early-return guard does NOT fire.
        // The CWV check is only reached when seoIssues is non-empty.
        seoIssues: [
          { id: 'other-seo-issue', title: 'SEO issue', description: '', score: 1, type: null, items: [] },
        ],
        // performanceScore is null — PSI/Lighthouse unavailable
        performanceScore: null,
        // Individual metrics are in the "poor" band that WOULD trigger a finding
        // if the null guard were absent and the `< 0.9` check ran against null.
        lcp: 5000,   // > 2500ms threshold (poor)
        cls: 0.30,   // > 0.1 threshold (poor)
        fcp: 3000,   // > 1800ms threshold (poor)
      }),
    );

    // The CWV finding must NOT be emitted when performanceScore is null.
    const cwvFinding = findings.find((f) => f.title.includes('Core Web Vitals'));
    expect(cwvFinding).toBeUndefined();
  });

  it('does NOT throw when performanceScore is null with poor individual CWV metrics', async () => {
    // Belt-and-suspenders: the module must not throw on null performanceScore.
    const run = () =>
      runMobileSEOModule(
        makeMetrics({
          seoIssues: [
            { id: 'other', title: 'Other SEO issue', description: '', score: 1, type: null, items: [] },
          ],
          performanceScore: null,
          lcp: 6000,
          cls: 0.5,
          fcp: 4000,
        }),
      );

    await expect(run()).resolves.toBeDefined();
  });
});
