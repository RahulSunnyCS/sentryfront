import { describe, it, expect } from 'vitest';
import { runKeyboardNavigationModule } from '@/lib/scanner/modules/p3-02-keyboard-navigation';
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

describe('P3-02: Keyboard Navigation Module', () => {
  describe('No violations', () => {
    it('should return no findings when accessibilityViolations is empty', async () => {
      const findings = await runKeyboardNavigationModule(makeMetrics());
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when accessibilityViolations is undefined', async () => {
      const findings = await runKeyboardNavigationModule(
        makeMetrics({ accessibilityViolations: undefined as any }),
      );
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when violations do not include tabindex or duplicate-id audits', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: 'Contrast', description: '', items: [{}] },
        ],
      });
      const findings = await runKeyboardNavigationModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when tabindex audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'tabindex', score: 0, title: 'Tabindex', description: '', items: [] },
        ],
      });
      const findings = await runKeyboardNavigationModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when duplicate-id audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'duplicate-id', score: 0, title: 'Duplicate IDs', description: '', items: [] },
        ],
      });
      const findings = await runKeyboardNavigationModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Tabindex violations', () => {
    it('should emit a finding when tabindex audit has items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'tabindex',
            score: 0,
            title: 'Tabindex',
            description: 'Tabindex values > 0',
            items: [{ node: { selector: 'div[tabindex="5"]', snippet: '' } }],
          },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-02');
      expect(findings[0].severity).toBe('MEDIUM');
      expect(findings[0].category).toBe('Accessibility');
    });

    it('should mention the violation count in the title', async () => {
      const items = [{}, {}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'tabindex', score: 0, title: 'Tabindex', description: '', items },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings[0].title).toContain('3 elements');
    });

    it('should use singular grammar for exactly 1 tabindex violation', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'tabindex',
            score: 0,
            title: 'Tabindex',
            description: '',
            items: [{ node: { selector: 'button', snippet: '' } }],
          },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings[0].title).toMatch(/1 element[^s]/);
    });

    it('should reference WCAG 2.4.3 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'tabindex', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings[0].location).toContain('2.4.3');
    });

    it('should use the audit description as explanation when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'tabindex',
            score: 0,
            title: '',
            description: 'Custom tabindex description',
            items: [{}],
          },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings[0].explanation).toBe('Custom tabindex description');
    });

    it('should populate fixManual with at least one entry', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'tabindex', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect((findings[0].fixManual as string[]).length).toBeGreaterThan(0);
    });
  });

  describe('Duplicate ID violations', () => {
    it('should emit a finding for duplicate-id audit', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'duplicate-id',
            score: 0,
            title: 'Duplicate IDs',
            description: 'IDs must be unique',
            items: [{ node: { selector: '#main', snippet: '' } }],
          },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-02');
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should also match duplicate-id-active audit id', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'duplicate-id-active',
            score: 0,
            title: 'Duplicate active IDs',
            description: '',
            items: [{ node: { selector: '#btn', snippet: '' } }],
          },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].title).toContain('Duplicate IDs');
    });

    it('should include count in the duplicate-id finding title', async () => {
      const items = [{}, {}, {}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'duplicate-id', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings[0].title).toContain('4 occurrences');
    });

    it('should reference WCAG 4.1.1 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'duplicate-id', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings[0].location).toContain('4.1.1');
    });
  });

  describe('Multiple violations', () => {
    it('should emit two findings when both tabindex and duplicate-id audits have items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'tabindex', score: 0, title: '', description: '', items: [{}] },
          { id: 'duplicate-id', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runKeyboardNavigationModule(metrics);

      expect(findings).toHaveLength(2);
      expect(findings.every(f => f.moduleId === 'P3-02')).toBe(true);
    });
  });
});
