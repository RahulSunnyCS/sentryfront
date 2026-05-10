import { describe, it, expect } from 'vitest';
import { runJavaScriptPerformanceModule } from '@/lib/scanner/modules/p2-04-javascript-performance';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

describe('P2-04: JavaScript Performance Module', () => {
  describe('Total Blocking Time (TBT) detection', () => {
    it('should detect high TBT (excessive blocking)', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 800, // > 600ms = MEDIUM
        ttfb: 500,
        performanceScore: 0.6,
        opportunities: [],
      };

      const findings = runJavaScriptPerformanceModule(metrics);

      const tbtFinding = findings.find(f => f.title.includes('JavaScript execution time'));
      expect(tbtFinding).toBeDefined();
      expect(tbtFinding?.severity).toBe('MEDIUM');
      expect(tbtFinding?.evidence).toContain('800ms');
    });

    it('should not flag when TBT is good', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150, // < 200ms = GOOD
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runJavaScriptPerformanceModule(metrics);

      const tbtFinding = findings.find(f => f.title.includes('JavaScript execution time'));
      expect(tbtFinding).toBeUndefined();
    });
  });

  describe('Time to Interactive (TTI)', () => {
    it('should detect slow TTI', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        tti: 6000, // > 5000ms
        ttfb: 500,
        performanceScore: 0.7,
        opportunities: [],
      };

      const findings = runJavaScriptPerformanceModule(metrics);

      const ttiFinding = findings.find(f => f.title.includes('Time to Interactive'));
      expect(ttiFinding).toBeDefined();
      expect(ttiFinding?.severity).toBe('MEDIUM');
      expect(ttiFinding?.evidence).toContain('6.0s');
    });

    it('should not flag when TTI is fast', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        tti: 3000, // < 5000ms
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runJavaScriptPerformanceModule(metrics);

      const ttiFinding = findings.find(f => f.title.includes('Time to Interactive'));
      expect(ttiFinding).toBeUndefined();
    });
  });

  describe('Multiple JavaScript performance issues', () => {
    it('should detect both TBT and TTI issues', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 800, // High TBT
        tti: 6000, // Slow TTI
        ttfb: 500,
        performanceScore: 0.5,
        opportunities: [],
      };

      const findings = runJavaScriptPerformanceModule(metrics);

      expect(findings.length).toBeGreaterThanOrEqual(2);
      expect(findings.some(f => f.title.includes('JavaScript execution time'))).toBe(true);
      expect(findings.some(f => f.title.includes('Time to Interactive'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty opportunities', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 1.0,
        opportunities: [],
      };

      const findings = runJavaScriptPerformanceModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should include actionable recommendations', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 700, // High TBT generates findings
        tti: 6000,
        ttfb: 500,
        performanceScore: 0.6,
        opportunities: [],
      };

      const findings = runJavaScriptPerformanceModule(metrics);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].fixManual).toBeDefined();
      expect(findings[0].fixManual.length).toBeGreaterThan(0);
      expect(findings[0].fixAiPrompt).toBeDefined();
    });
  });
});
