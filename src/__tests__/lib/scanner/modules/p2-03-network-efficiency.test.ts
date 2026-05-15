import { describe, it, expect } from 'vitest';
import { runNetworkEfficiencyModule } from '@/lib/scanner/modules/p2-03-network-efficiency';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

describe('P2-03: Network Efficiency Module', () => {
  describe('Text compression', () => {
    it('should detect missing text compression', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.7,
        opportunities: [
          {
            id: 'uses-text-compression',
            title: 'Enable text compression',
            description: 'Text resources should be compressed with gzip or brotli',
            overallSavingsBytes: 320 * 1024, // 320 KB savings
            overallSavingsMs: 800,
          },
        ],
      };

      const findings = runNetworkEfficiencyModule(metrics);

      const compressionFinding = findings.find(f => f.title.includes('text compression'));
      expect(compressionFinding).toBeDefined();
      expect(compressionFinding?.severity).toBe('LOW'); // < 500 KB = LOW
      expect(compressionFinding?.evidence).toContain('320 KB');
      expect(compressionFinding?.fixManual.some(fix => fix.includes('gzip') || fix.includes('brotli'))).toBe(true);
    });

    it('should not flag when compression is enabled', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runNetworkEfficiencyModule(metrics);

      const compressionFinding = findings.find(f => f.title.includes('text compression'));
      expect(compressionFinding).toBeUndefined();
    });
  });

  describe('Cache policies', () => {
    it('should detect inefficient cache policies', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.7,
        opportunities: [
          {
            id: 'uses-long-cache-ttl',
            title: 'Serve static assets with an efficient cache policy',
            description: 'Static resources should have long cache TTL',
            overallSavingsBytes: 1200 * 1024,
            overallSavingsMs: 2000,
          },
        ],
      };

      const findings = runNetworkEfficiencyModule(metrics);

      const cacheFinding = findings.find(f => f.title.includes('cache policy'));
      expect(cacheFinding).toBeDefined();
      expect(cacheFinding?.severity).toBe('LOW');
      expect(cacheFinding?.evidence).toContain('1200 KB');
    });

    it('should not flag when cache policies are efficient', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.9,
        opportunities: [],
      };

      const findings = runNetworkEfficiencyModule(metrics);

      const cacheFinding = findings.find(f => f.title.includes('cache policy'));
      expect(cacheFinding).toBeUndefined();
    });
  });

  describe('Multiple network efficiency issues', () => {
    it('should detect both compression and cache policy issues', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 0.6,
        opportunities: [
          {
            id: 'uses-text-compression',
            title: 'Enable text compression',
            description: 'Text resources should be compressed',
            overallSavingsBytes: 500 * 1024,
            overallSavingsMs: 1200,
          },
          {
            id: 'uses-long-cache-ttl',
            title: 'Serve static assets with an efficient cache policy',
            description: 'Static resources should have long cache TTL',
            overallSavingsBytes: 800 * 1024,
            overallSavingsMs: 1500,
          },
        ],
      };

      const findings = runNetworkEfficiencyModule(metrics);

      expect(findings.length).toBe(2);
      expect(findings.some(f => f.title.includes('text compression'))).toBe(true);
      expect(findings.some(f => f.title.includes('cache policy'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty opportunities gracefully', () => {
      const metrics: LighthouseMetrics = {
        lcp: 2000,
        fcp: 1000,
        cls: 0.05,
        tbt: 150,
        ttfb: 500,
        performanceScore: 1.0,
        opportunities: [],
      };

      const findings = runNetworkEfficiencyModule(metrics);

      expect(findings).toHaveLength(0);
    });

    it('should ignore non-network opportunities', () => {
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
            description: 'Other optimization',
            overallSavingsBytes: 500 * 1024,
            overallSavingsMs: 1000,
          },
        ],
      };

      const findings = runNetworkEfficiencyModule(metrics);

      expect(findings).toHaveLength(0);
    });
  });
});
