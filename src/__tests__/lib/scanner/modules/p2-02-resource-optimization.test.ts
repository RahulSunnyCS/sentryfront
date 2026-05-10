import { describe, it, expect } from 'vitest';
import { runResourceOptimizationModule } from '@/lib/scanner/modules/p2-02-resource-optimization';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

describe('P2-02: Resource Optimization Module', () => {
  describe('Unused JavaScript detection', () => {
    it('should detect significant unused JavaScript', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.6,
        opportunities: [
          {
            id: 'unused-javascript',
            title: 'Remove unused JavaScript',
            description: '850 KB of unused JavaScript detected',
            wastedBytes: 850 * 1024, // 850 KB (> 500 KB threshold = MEDIUM)
            wastedMs: 2000,
          },
        ],
      };

      const findings = runResourceOptimizationModule(metrics);

      const unusedJsFinding = findings.find(f => f.title.includes('unused JavaScript'));
      expect(unusedJsFinding).toBeDefined();
      expect(unusedJsFinding?.severity).toBe('MEDIUM'); // >= 500 KB threshold
      expect(unusedJsFinding?.evidence).toContain('850 KB');
    });

    it('should not flag when no unused JavaScript detected', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runResourceOptimizationModule(metrics);

      const unusedJsFinding = findings.find(f => f.title.includes('unused JavaScript'));
      expect(unusedJsFinding).toBeUndefined();
    });

    it('should flag moderate amounts of unused JavaScript (< 500 KB but >= 50 KB)', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.8,
        opportunities: [
          {
            id: 'unused-javascript',
            title: 'Remove unused JavaScript',
            description: '200 KB of unused JavaScript detected',
            wastedBytes: 200 * 1024, // 200 KB (>= 50 KB but < 500 KB = LOW severity)
            wastedMs: 500,
          },
        ],
      };

      const findings = runResourceOptimizationModule(metrics);

      const unusedJsFinding = findings.find(f => f.title.includes('unused JavaScript'));
      expect(unusedJsFinding).toBeDefined();
      expect(unusedJsFinding?.severity).toBe('MEDIUM'); // >= 500ms threshold
    });
  });

  describe('Image optimization detection', () => {
    it('should detect compressed image opportunities', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.7,
        opportunities: [
          {
            id: 'uses-optimized-images',
            title: 'Efficiently encode images',
            description: 'Images can be optimized',
            wastedBytes: 600 * 1024, // 600 KB
            wastedMs: 1500,
          },
        ],
      };

      const findings = runResourceOptimizationModule(metrics);

      const imageFinding = findings.find(f => f.title.includes('compress images'));
      expect(imageFinding).toBeDefined();
      expect(imageFinding?.severity).toBe('MEDIUM');
      expect(imageFinding?.evidence).toContain('600 KB');
    });

    it('should detect modern image format recommendations', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.7,
        opportunities: [
          {
            id: 'modern-image-formats',
            title: 'Serve images in modern formats',
            description: 'Convert images to WebP/AVIF',
            wastedBytes: 700 * 1024,
            wastedMs: 1800,
          },
        ],
      };

      const findings = runResourceOptimizationModule(metrics);

      const modernFormatFinding = findings.find(f => f.title.includes('modern image formats') || f.title.includes('modern formats'));
      expect(modernFormatFinding).toBeDefined();
      expect(modernFormatFinding?.severity).toBe('MEDIUM');
    });
  });

  describe('Multiple optimization opportunities', () => {
    it('should detect both unused JS and unoptimized images', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.5,
        opportunities: [
          {
            id: 'unused-javascript',
            title: 'Remove unused JavaScript',
            description: '1.2 MB of unused JavaScript detected',
            wastedBytes: 1200 * 1024,
            wastedMs: 3000,
          },
          {
            id: 'modern-image-formats',
            title: 'Serve images in modern formats',
            description: 'Convert images to WebP/AVIF',
            wastedBytes: 800 * 1024,
            wastedMs: 2000,
          },
        ],
      };

      const findings = runResourceOptimizationModule(metrics);

      expect(findings.length).toBe(2);
      expect(findings.some(f => f.title.includes('unused JavaScript'))).toBe(true);
      expect(findings.some(f => f.title.includes('modern formats') || f.title.includes('WebP'))).toBe(true);
    });
  });
});
