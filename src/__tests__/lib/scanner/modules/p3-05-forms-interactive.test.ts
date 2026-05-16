import { describe, it, expect } from 'vitest';
import { runFormsInteractiveModule } from '@/lib/scanner/modules/p3-05-forms-interactive';
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

describe('P3-05: Forms & Interactive Elements Module', () => {
  describe('No violations', () => {
    it('should return no findings when accessibilityViolations is empty', async () => {
      const findings = await runFormsInteractiveModule(makeMetrics());
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when accessibilityViolations is undefined', async () => {
      const findings = await runFormsInteractiveModule(
        makeMetrics({ accessibilityViolations: undefined as any }),
      );
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when violations do not match any watched audit ids', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'color-contrast', score: 0, title: '', description: '', items: [{}] },
        ],
      });
      const findings = await runFormsInteractiveModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when aria-allowed-attr audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runFormsInteractiveModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when aria-required-attr audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-required-attr', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runFormsInteractiveModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when aria-valid-attr audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-valid-attr', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runFormsInteractiveModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when meta-viewport score is exactly 1 (passing)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'meta-viewport', score: 1, title: '', description: '', items: [] },
        ],
      });
      const findings = await runFormsInteractiveModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when meta-viewport score is null (guard branch)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          // The module checks "score !== null && score < 1", so null → no finding
          { id: 'meta-viewport', score: null, title: '', description: '', items: [] },
        ],
      });
      const findings = await runFormsInteractiveModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Invalid ARIA attributes (aria-allowed-attr)', () => {
    it('should emit a MEDIUM finding when aria-allowed-attr audit has items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'aria-allowed-attr',
            score: 0,
            title: '',
            description: 'ARIA attrs must be allowed',
            items: [{ node: { selector: 'button[aria-owns]', snippet: '' } }],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-05');
      expect(findings[0].severity).toBe('MEDIUM');
      expect(findings[0].category).toBe('Accessibility');
    });

    it('should reference WCAG 4.1.2 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].location).toContain('4.1.2');
    });

    it('should include violation count in the title', async () => {
      const items = [{}, {}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].title).toContain('3 elements');
    });

    it('should use singular grammar for exactly 1 violation', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].title).toMatch(/1 element[^s]/);
    });

    it('should use audit description as explanation when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'aria-allowed-attr',
            score: 0,
            title: '',
            description: 'Custom ARIA description',
            items: [{}],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].explanation).toBe('Custom ARIA description');
    });

    it('should fall back to default explanation when description is empty', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      // Default explanation references ARIA attributes
      expect(findings[0].explanation).toContain('ARIA');
    });

    it('should populate fixManual with at least one entry', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect((findings[0].fixManual as string[]).length).toBeGreaterThan(0);
    });
  });

  describe('Missing required ARIA attributes (aria-required-attr)', () => {
    it('should emit a MEDIUM finding when aria-required-attr audit has items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'aria-required-attr',
            score: 0,
            title: '',
            description: 'Required ARIA attrs missing',
            items: [{ node: { selector: 'div[role="tab"]', snippet: '' } }],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-05');
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should reference WCAG 4.1.2 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-required-attr', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].location).toContain('4.1.2');
    });

    it('should include count in the title', async () => {
      const items = [{}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-required-attr', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].title).toContain('2 elements');
    });

    it('should use audit description as explanation when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'aria-required-attr',
            score: 0,
            title: '',
            description: 'Custom required attr description',
            items: [{}],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].explanation).toBe('Custom required attr description');
    });
  });

  describe('Invalid ARIA attribute values (aria-valid-attr)', () => {
    it('should emit a MEDIUM finding when aria-valid-attr audit has items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'aria-valid-attr',
            score: 0,
            title: '',
            description: 'ARIA values must be valid',
            items: [{ node: { selector: '[aria-expanded="yes"]', snippet: '' } }],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-05');
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should reference WCAG 4.1.2 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-valid-attr', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].location).toContain('4.1.2');
    });

    it('should include count in the title', async () => {
      const items = [{}, {}, {}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-valid-attr', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].title).toContain('4 elements');
    });

    it('should use audit description as explanation when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'aria-valid-attr',
            score: 0,
            title: '',
            description: 'Custom valid attr description',
            items: [{}],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].explanation).toBe('Custom valid attr description');
    });
  });

  describe('Mobile viewport violations (meta-viewport)', () => {
    it('should emit a MEDIUM finding when meta-viewport score is less than 1', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'meta-viewport',
            score: 0,
            title: '',
            description: 'Viewport blocks zoom',
            items: [],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-05');
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should reference WCAG 1.4.4 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'meta-viewport', score: 0, title: '', description: '', items: [] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].location).toContain('1.4.4');
    });

    it('should emit finding for a partial score (e.g., 0.5)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'meta-viewport', score: 0.5, title: '', description: '', items: [] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      // 0.5 < 1 so a finding is expected
      expect(findings).toHaveLength(1);
    });

    it('should use audit description as explanation when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'meta-viewport',
            score: 0,
            title: '',
            description: 'Custom viewport description',
            items: [],
          },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].explanation).toBe('Custom viewport description');
    });

    it('should fall back to default explanation mentioning zoom when description is empty', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'meta-viewport', score: 0, title: '', description: '', items: [] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings[0].explanation).toContain('zoom');
    });
  });

  describe('Multiple violations', () => {
    it('should emit one finding per audit type when multiple audits have violations', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items: [{}] },
          { id: 'aria-required-attr', score: 0, title: '', description: '', items: [{}] },
          { id: 'aria-valid-attr', score: 0, title: '', description: '', items: [{}] },
          { id: 'meta-viewport', score: 0, title: '', description: '', items: [] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings).toHaveLength(4);
      expect(findings.every((f) => f.moduleId === 'P3-05')).toBe(true);
    });

    it('should only emit findings for audits that truly have violations', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          // This one has items → finding emitted
          { id: 'aria-allowed-attr', score: 0, title: '', description: '', items: [{}] },
          // This one has empty items → no finding
          { id: 'aria-required-attr', score: 0, title: '', description: '', items: [] },
          // meta-viewport passes → no finding
          { id: 'meta-viewport', score: 1, title: '', description: '', items: [] },
        ],
      });

      const findings = await runFormsInteractiveModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].title).toContain('Invalid ARIA attributes');
    });
  });
});
