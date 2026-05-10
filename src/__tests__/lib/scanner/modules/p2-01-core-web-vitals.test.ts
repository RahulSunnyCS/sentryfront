import { describe, it, expect } from 'vitest';
import { runCoreWebVitalsModule } from '@/lib/scanner/modules/p2-01-core-web-vitals';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

describe('P2-01: Core Web Vitals Module', () => {
  describe('Largest Contentful Paint (LCP)', () => {
    it('should detect slow LCP (POOR)', () => {
      const metrics: LighthouseMetrics = {
        lcp: 4500, // > 4000ms = POOR
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.5,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      expect(findings.length).toBeGreaterThan(0);
      const lcpFinding = findings.find(f => f.title.includes('Largest Contentful Paint'));
      expect(lcpFinding).toBeDefined();
      expect(lcpFinding?.severity).toBe('HIGH');
      expect(lcpFinding?.evidence).toContain('4.50s');
    });

    it('should detect moderate LCP (NEEDS IMPROVEMENT)', () => {
      const metrics: LighthouseMetrics = {
        lcp: 3000, // 2000-4000ms = NEEDS IMPROVEMENT
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.7,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const lcpFinding = findings.find(f => f.title.includes('Largest Contentful Paint'));
      expect(lcpFinding).toBeDefined();
      expect(lcpFinding?.severity).toBe('MEDIUM');
    });

    it('should not flag good LCP', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1800, // < 2000ms = GOOD
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const lcpFinding = findings.find(f => f.title.includes('Largest Contentful Paint'));
      expect(lcpFinding).toBeUndefined();
    });

    it('should handle null LCP', () => {
      const metrics: LighthouseMetrics = {
        lcp: null,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.8,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const lcpFinding = findings.find(f => f.title.includes('Largest Contentful Paint'));
      expect(lcpFinding).toBeUndefined();
    });
  });

  describe('Cumulative Layout Shift (CLS)', () => {
    it('should detect poor CLS', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1500,
        fcp: 1000,
        cls: 0.30, // > 0.25 = POOR
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.5,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const clsFinding = findings.find(f => f.title.includes('Cumulative Layout Shift'));
      expect(clsFinding).toBeDefined();
      expect(clsFinding?.severity).toBe('MEDIUM'); // CLS uses MEDIUM for poor, not HIGH
      expect(clsFinding?.evidence).toContain('0.300');
    });

    it('should detect moderate CLS', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1500,
        fcp: 1000,
        cls: 0.15, // 0.08-0.25 = NEEDS IMPROVEMENT
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.7,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const clsFinding = findings.find(f => f.title.includes('Cumulative Layout Shift'));
      expect(clsFinding).toBeDefined();
      expect(clsFinding?.severity).toBe('LOW'); // Moderate CLS uses LOW severity
    });

    it('should not flag good CLS', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1500,
        fcp: 1000,
        cls: 0.05, // < 0.08 = GOOD
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const clsFinding = findings.find(f => f.title.includes('Cumulative Layout Shift'));
      expect(clsFinding).toBeUndefined();
    });
  });

  describe('First Contentful Paint (FCP)', () => {
    it('should detect slow FCP', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1500,
        fcp: 3500, // > 3000ms = POOR
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.6,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const fcpFinding = findings.find(f => f.title.includes('First Contentful Paint'));
      expect(fcpFinding).toBeDefined();
      expect(fcpFinding?.severity).toBe('MEDIUM');
    });
  });

  describe('Total Blocking Time (TBT)', () => {
    it('should detect high TBT', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1500,
        fcp: 1000,
        cls: 0.05,
        tbt: 800, // > 600ms = POOR
        ttfb: 500,
        performanceScore: 0.5,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const tbtFinding = findings.find(f => f.title.includes('Total Blocking Time'));
      expect(tbtFinding).toBeDefined();
      expect(tbtFinding?.severity).toBe('MEDIUM');
      expect(tbtFinding?.evidence).toContain('800ms');
    });

    it('should not flag good TBT', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1500,
        fcp: 1000,
        cls: 0.05,
        tbt: 150, // < 200ms = GOOD
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      const tbtFinding = findings.find(f => f.title.includes('Total Blocking Time'));
      expect(tbtFinding).toBeUndefined();
    });
  });

  describe('Multiple metrics failing', () => {
    it('should detect multiple Core Web Vitals failures', () => {
      const metrics: LighthouseMetrics = {
        lcp: 5000, // POOR
        fcp: 3500, // POOR
        cls: 0.30, // POOR
        tbt: 800,  // POOR
        ttfb: 500,
        performanceScore: 0.3,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      expect(findings.length).toBeGreaterThanOrEqual(4);
      expect(findings.some(f => f.title.includes('Largest Contentful Paint'))).toBe(true);
      expect(findings.some(f => f.title.includes('Cumulative Layout Shift'))).toBe(true);
      expect(findings.some(f => f.title.includes('First Contentful Paint'))).toBe(true);
      expect(findings.some(f => f.title.includes('Total Blocking Time'))).toBe(true);
    });
  });

  describe('All metrics passing', () => {
    it('should return no findings when all metrics are good', () => {
      const metrics: LighthouseMetrics = {
        lcp: 1800,  // GOOD
        fcp: 1200,  // GOOD
        cls: 0.05,  // GOOD
        tbt: 150,   // GOOD
        ttfb: 600,
        performanceScore: 0.95,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle all null metrics gracefully', () => {
      const metrics: LighthouseMetrics = {
        lcp: null,
        fcp: null,
        cls: null,
        tbt: null,
        ttfb: null,
        performanceScore: null,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should handle boundary values correctly', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000, // Exactly at GOOD threshold
        fcp: 1500, // Exactly at GOOD threshold
        cls: 0.08, // Exactly at GOOD threshold
        tbt: 200,  // Exactly at GOOD threshold
        ttfb: 500,
        performanceScore: 0.8,
        opportunities: [],
      };

      const findings = runCoreWebVitalsModule(metrics);

      // At boundary, should be flagged as needing improvement
      expect(findings.length).toBeGreaterThan(0);
    });
  });
});
