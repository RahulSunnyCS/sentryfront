import { describe, it, expect } from 'vitest';
import { runColorContrastModule } from '@/lib/scanner/modules/p3-01-color-contrast';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';

/** Minimal valid LighthouseMetrics — only fields the module actually reads */
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

describe('P3-01: Color Contrast Module', () => {
  describe('No violations', () => {
    it('should return no findings when accessibilityViolations is empty', async () => {
      const metrics = makeMetrics({ accessibilityViolations: [] });
      const findings = await runColorContrastModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when accessibilityViolations is undefined/null-like', async () => {
      // Cast to satisfy TS — tests defensive guard in the module
      const metrics = makeMetrics({ accessibilityViolations: undefined as any });
      const findings = await runColorContrastModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when violations present but no color-contrast audit', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: 'Images have alt text', description: '', items: [] },
        ],
      });
      const findings = await runColorContrastModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when color-contrast audit has no items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items: [] },
        ],
      });
      const findings = await runColorContrastModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Severity thresholds', () => {
    it('should emit LOW severity for fewer than 5 violations', async () => {
      const items = Array.from({ length: 3 }, (_, i) => ({
        node: { selector: `.el-${i}`, snippet: `<span>text ${i}</span>` },
      }));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: 'desc', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('LOW');
    });

    it('should emit MEDIUM severity for 5–9 violations', async () => {
      const items = Array.from({ length: 7 }, (_, i) => ({
        node: { selector: `.el-${i}`, snippet: '' },
      }));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: 'desc', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should emit HIGH severity for 10 or more violations', async () => {
      const items = Array.from({ length: 12 }, (_, i) => ({
        node: { selector: `.el-${i}`, snippet: '' },
      }));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: 'desc', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('HIGH');
    });

    it('should use MEDIUM at exactly the boundary of 5 violations', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        node: { selector: `.el-${i}`, snippet: '' },
      }));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: 'desc', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should use HIGH at exactly the boundary of 10 violations', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        node: { selector: `.el-${i}`, snippet: '' },
      }));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: 'desc', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].severity).toBe('HIGH');
    });
  });

  describe('Finding shape', () => {
    it('should set the correct moduleId and category', async () => {
      const items = [{ node: { selector: 'p', snippet: '<p>text</p>' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: 'desc', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].moduleId).toBe('P3-01');
      expect(findings[0].category).toBe('Accessibility');
    });

    it('should include violation count in the title', async () => {
      const items = [{ node: { selector: 'p', snippet: '' } }, { node: { selector: 'span', snippet: '' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].title).toContain('2 elements');
    });

    it('should use singular grammar for exactly 1 violation', async () => {
      const items = [{ node: { selector: 'p', snippet: '' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      // Title uses "1 element" (no plural 's')
      expect(findings[0].title).toMatch(/1 element[^s]/);
    });

    it('should include element selectors in evidence text', async () => {
      const items = [{ node: { selector: '.low-contrast-text', snippet: '<p>hello</p>' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].evidence).toContain('.low-contrast-text');
    });

    it('should fall back to item.selector when node property is missing', async () => {
      // Some audits surface the selector directly on the item
      const items = [{ selector: '.fallback-selector', snippet: '' }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].evidence).toContain('.fallback-selector');
    });

    it('should truncate evidence to first 3 examples plus "and N more"', async () => {
      const items = Array.from({ length: 6 }, (_, i) => ({
        node: { selector: `.el-${i}`, snippet: '' },
      }));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].evidence).toContain('and 3 more elements');
    });

    it('should use the audit description as explanation when provided', async () => {
      const items = [{ node: { selector: 'p', snippet: '' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'color-contrast',
            score: 0,
            title: 'Contrast',
            description: 'Custom description from audit',
            items,
          },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].explanation).toBe('Custom description from audit');
    });

    it('should fall back to default explanation when description is empty', async () => {
      const items = [{ node: { selector: 'p', snippet: '' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      // The default explanation mentions WCAG
      expect(findings[0].explanation).toContain('WCAG');
    });

    it('should include WCAG location reference', async () => {
      const items = [{ node: { selector: 'p', snippet: '' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].location).toContain('1.4.3');
    });

    it('should populate fixManual with at least one item', async () => {
      const items = [{ node: { selector: 'p', snippet: '' } }];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items },
        ],
      });

      const findings = await runColorContrastModule(metrics);

      expect(findings[0].fixManual).toBeDefined();
      expect((findings[0].fixManual as string[]).length).toBeGreaterThan(0);
    });
  });
});
