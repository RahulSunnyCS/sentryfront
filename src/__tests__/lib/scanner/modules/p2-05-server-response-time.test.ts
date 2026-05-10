import { describe, it, expect } from 'vitest';
import { runServerResponseTimeModule } from '@/lib/scanner/modules/p2-05-server-response-time';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

describe('P2-05: Server Response Time Module', () => {
  describe('Time to First Byte (TTFB)', () => {
    it('should detect poor TTFB (> 1800ms)', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 2500, // POOR (> 1800ms)
        performanceScore: 0.5,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].title).toContain('Time to First Byte');
      expect(findings[0].evidence).toContain('2500ms');
      expect(findings[0].evidence).toContain('target: < 800ms');
    });

    it('should detect moderate TTFB (800-1800ms)', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 1200, // NEEDS IMPROVEMENT (800-1800ms)
        performanceScore: 0.7,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
      expect(findings[0].title).toContain('Time to First Byte');
      expect(findings[0].evidence).toContain('1200ms');
    });

    it('should not flag good TTFB (< 800ms)', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 600, // GOOD (< 800ms)
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should handle boundary value at 800ms', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 800, // Exactly at threshold
        performanceScore: 0.8,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      // At boundary (>= 800), should flag
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should handle null TTFB gracefully', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: null,
        performanceScore: 0.8,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should include optimization recommendations', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 2000,
        performanceScore: 0.5,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      expect(findings[0].fixManual).toBeDefined();
      expect(findings[0].fixManual.length).toBeGreaterThan(0);
      expect(findings[0].fixManual.some(fix => fix.includes('CDN'))).toBe(true);
      expect(findings[0].fixManual.some(fix => fix.includes('cache') || fix.includes('caching'))).toBe(true);
    });

    it('should include AI prompt for fixing TTFB', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 1500,
        performanceScore: 0.6,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      expect(findings[0].fixAiPrompt).toBeDefined();
      expect(findings[0].fixAiPrompt).toContain('1500ms');
      expect(findings[0].fixAiPrompt).toContain('800ms');
    });
  });

  describe('Impact and explanation', () => {
    it('should explain why TTFB matters', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 2000,
        performanceScore: 0.5,
        opportunities: [],
      };

      const findings = runServerResponseTimeModule(metrics);

      expect(findings[0].explanation).toBeDefined();
      expect(findings[0].explanation.length).toBeGreaterThan(0);
      expect(findings[0].impact).toBeDefined();
      expect(findings[0].impact).toContain('delays');
    });
  });
});
