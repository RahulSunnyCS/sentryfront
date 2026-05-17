/**
 * Tests for performance-suggestions.ts — specifically the T-06 contract:
 *
 *   generateImprovementPlan receives a performanceScore that is ALREADY a 0-100 integer
 *   (converted once in performance.ts via Math.round(metrics.performanceScore * 100)).
 *   The generateAIPromptBundle helper must NOT apply a second *100 conversion; it must
 *   use the performanceScore parameter directly to show the correct value in the prompt.
 *
 * The redundant `Math.round(metrics.performanceScore * 100)` bug was fixed in T-06:
 *   - Before fix: metrics.performanceScore (0-1) was multiplied by 100 again inside
 *     generateAIPromptBundle, so a score of 0.85 would show as "8500/100" in the AI prompt.
 *   - After fix: the function uses the performanceScore parameter (already 0-100), so 0.85
 *     input to runPerformanceModules correctly produces a "85/100" prompt string.
 */

import { describe, it, expect } from 'vitest';
import { generateImprovementPlan } from '@/lib/scanner/performance-suggestions';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

/** Minimal LighthouseMetrics fixture for suggestions tests */
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
    bestPracticesScore: null,
    opportunities: [],
    accessibilityViolations: [],
    seoIssues: [],
    bestPracticesIssues: [],
    fieldData: null,
    originFieldData: null,
    ...overrides,
  };
}

describe('generateImprovementPlan — double-*100 bug removed', () => {
  it('uses the performanceScore parameter (0-100 integer) in the AI prompt, NOT metrics.performanceScore * 100', () => {
    // The caller (performance.ts) converts the 0-1 Lighthouse score to a 0-100 integer once,
    // then passes it as `performanceScore` to generateImprovementPlan.
    // generateImprovementPlan must forward that integer directly to generateAIPromptBundle.
    //
    // Bug scenario: if generateAIPromptBundle still did `Math.round(metrics.performanceScore * 100)`,
    // a metrics.performanceScore of 0.85 (0-1 range) × 100 = 85 — that would accidentally work
    // because the function receives the raw metrics object too. But the contract says: the single
    // *100 conversion happens ONLY in performance.ts. The suggestions function receives a
    // ready-made 0-100 integer and must use it verbatim.
    //
    // To isolate the bug: pass a metrics object with performanceScore = null (simulating the
    // UNAVAILABLE case or a metrics object where performanceScore is no longer meaningful to
    // re-multiply), while passing the already-converted integer to the parameter.
    // The OLD code would produce "0/100" (null → 0 via the ternary). The fixed code produces
    // the correct integer.
    const metrics = makeMetrics({ performanceScore: null }); // raw metrics: no score
    const plan = generateImprovementPlan([], metrics, 'B', 82); // 82 = already-converted integer

    // The AI prompt bundle should contain "82/100", not "0/100" (old broken behavior)
    expect(plan.aiPromptBundle).toContain('82/100');
    expect(plan.aiPromptBundle).not.toContain('0/100');
  });

  it('shows the correct score in the AI prompt when performanceScore is a typical value', () => {
    // Simulate the normal path: metrics has the 0-1 score, but the function
    // receives the already-converted 0-100 integer as the performanceScore param.
    // The prompt must show the 0-100 integer.
    const metrics = makeMetrics({ performanceScore: 0.75 }); // raw 0-1 value in metrics
    const plan = generateImprovementPlan([], metrics, 'C', 75); // 75 = already-converted integer

    // Must show "75/100" NOT "7500/100" (which would happen with double *100)
    expect(plan.aiPromptBundle).toContain('75/100');
    expect(plan.aiPromptBundle).not.toContain('7500/100');
  });

  it('plan overallScore reflects the 0-100 integer passed as performanceScore', () => {
    const metrics = makeMetrics({ performanceScore: 0.90 });
    const plan = generateImprovementPlan([], metrics, 'A', 90);
    // overallScore is the performanceScore param verbatim
    expect(plan.overallScore).toBe(90);
    expect(plan.overallGrade).toBe('A');
  });

  it('score 0 (genuine worst-site) is forwarded correctly without becoming null in the prompt', () => {
    // A genuine score of 0 (integer) must appear as "0/100" in the AI prompt,
    // not disappear or become an error. The falsy-check in the old code would
    // turn 0 into the fallback string "0" too, but via the wrong path.
    const metrics = makeMetrics({ performanceScore: 0 }); // 0-1 score
    const plan = generateImprovementPlan([], metrics, 'F', 0); // 0-100 integer

    // The prompt must show "0/100"
    expect(plan.aiPromptBundle).toContain('0/100');
  });

  it('summary text is appropriate for each score band', () => {
    const excellentPlan = generateImprovementPlan([], makeMetrics(), 'A', 95);
    expect(excellentPlan.summary).toMatch(/excellent/i);

    const goodPlan = generateImprovementPlan([], makeMetrics(), 'B', 80);
    expect(goodPlan.summary).toMatch(/good/i);

    const moderatePlan = generateImprovementPlan([], makeMetrics(), 'C', 60);
    expect(moderatePlan.summary).toMatch(/moderate/i);

    const poorPlan = generateImprovementPlan([], makeMetrics(), 'F', 30);
    expect(poorPlan.summary).toMatch(/needs attention/i);
  });
});
