import { describe, it, expect } from 'vitest';
import { runScreenReaderModule } from '@/lib/scanner/modules/p3-03-screen-reader';
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

describe('P3-03: Screen Reader Module', () => {
  describe('No violations', () => {
    it('should return no findings when accessibilityViolations is empty', async () => {
      const findings = await runScreenReaderModule(makeMetrics());
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when accessibilityViolations is undefined', async () => {
      const findings = await runScreenReaderModule(
        makeMetrics({ accessibilityViolations: undefined as any }),
      );
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when violations do not match any watched audit ids', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'unrelated-audit', score: 0, title: '', description: '', items: [{}] },
        ],
      });
      const findings = await runScreenReaderModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when image-alt audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runScreenReaderModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Image alt text violations (image-alt)', () => {
    it('should emit a MEDIUM finding for fewer than 5 missing alt texts', async () => {
      const items = Array.from({ length: 3 }, () => ({}));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: 'Alt desc', items },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-03');
      expect(findings[0].severity).toBe('MEDIUM');
      expect(findings[0].category).toBe('Accessibility');
    });

    it('should emit a HIGH finding for 5 or more missing alt texts', async () => {
      const items = Array.from({ length: 5 }, () => ({}));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].severity).toBe('HIGH');
    });

    it('should include the violation count in the title', async () => {
      const items = [{}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].title).toContain('2 images');
    });

    it('should use singular grammar for exactly 1 image', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].title).toMatch(/1 image[^s]/);
    });

    it('should reference WCAG 1.1.1 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].location).toContain('1.1.1');
    });

    it('should use audit description when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: 'Custom img desc', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].explanation).toBe('Custom img desc');
    });
  });

  describe('Form label violations (label)', () => {
    it('should emit a HIGH finding when form inputs are missing labels', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'label',
            score: 0,
            title: '',
            description: 'Form inputs need labels',
            items: [{}],
          },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-03');
      expect(findings[0].severity).toBe('HIGH');
    });

    it('should always be HIGH regardless of violation count', async () => {
      const items = Array.from({ length: 20 }, () => ({}));
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'label', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].severity).toBe('HIGH');
    });

    it('should include count in the title', async () => {
      const items = [{}, {}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'label', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].title).toContain('3 inputs');
    });

    it('should reference WCAG 1.3.1 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'label', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].location).toContain('1.3.1');
    });
  });

  describe('Button name violations (button-name)', () => {
    it('should emit a MEDIUM finding when buttons are missing accessible names', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'button-name', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should include count in the title', async () => {
      const items = [{}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'button-name', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].title).toContain('2 buttons');
    });

    it('should return no finding when button-name audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'button-name', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runScreenReaderModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Link name violations (link-name)', () => {
    it('should emit a MEDIUM finding when links are missing accessible names', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'link-name', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should reference WCAG 4.1.2 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'link-name', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings[0].location).toContain('4.1.2');
    });

    it('should return no finding when link-name audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'link-name', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runScreenReaderModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Multiple violations', () => {
    it('should emit one finding per audit type when multiple audits have items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'image-alt', score: 0, title: '', description: '', items: [{}] },
          { id: 'label', score: 0, title: '', description: '', items: [{}] },
          { id: 'button-name', score: 0, title: '', description: '', items: [{}] },
          { id: 'link-name', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runScreenReaderModule(metrics);

      expect(findings).toHaveLength(4);
      expect(findings.every(f => f.moduleId === 'P3-03')).toBe(true);
    });
  });
});
