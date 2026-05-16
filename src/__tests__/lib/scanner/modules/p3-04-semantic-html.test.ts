import { describe, it, expect } from 'vitest';
import { runSemanticHTMLModule } from '@/lib/scanner/modules/p3-04-semantic-html';
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

describe('P3-04: Semantic HTML Module', () => {
  describe('No violations', () => {
    it('should return no findings when accessibilityViolations is empty', async () => {
      const findings = await runSemanticHTMLModule(makeMetrics());
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when accessibilityViolations is undefined', async () => {
      const findings = await runSemanticHTMLModule(
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
      const findings = await runSemanticHTMLModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when heading-order audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runSemanticHTMLModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when list audit has empty items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'list', score: 0, title: '', description: '', items: [] },
        ],
      });
      const findings = await runSemanticHTMLModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when document-title score is exactly 1 (passing)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          // score === 1 means passing — the module checks score < 1
          { id: 'document-title', score: 1, title: '', description: '', items: [] },
        ],
      });
      const findings = await runSemanticHTMLModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when document-title score is null (guard branch)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          // The module checks "score !== null && score < 1", so null → no finding
          { id: 'document-title', score: null, title: '', description: '', items: [] },
        ],
      });
      const findings = await runSemanticHTMLModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when html-has-lang score is exactly 1 (passing)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'html-has-lang', score: 1, title: '', description: '', items: [] },
        ],
      });
      const findings = await runSemanticHTMLModule(metrics);
      expect(findings).toHaveLength(0);
    });

    it('should return no findings when html-has-lang score is null (guard branch)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'html-has-lang', score: null, title: '', description: '', items: [] },
        ],
      });
      const findings = await runSemanticHTMLModule(metrics);
      expect(findings).toHaveLength(0);
    });
  });

  describe('Heading order violations (heading-order)', () => {
    it('should emit a MEDIUM finding when heading-order audit has items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'heading-order',
            score: 0,
            title: 'Heading order',
            description: 'Heading levels skip',
            items: [{ node: { selector: 'h3', snippet: '<h3>Subtitle</h3>' } }],
          },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-04');
      expect(findings[0].severity).toBe('MEDIUM');
      expect(findings[0].category).toBe('Accessibility');
    });

    it('should reference WCAG 1.3.1 and 2.4.6 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].location).toContain('1.3.1');
      expect(findings[0].location).toContain('2.4.6');
    });

    it('should mention the violation location count in the evidence', async () => {
      const items = [{}, {}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].evidence).toContain('3 locations');
    });

    it('should use singular grammar for exactly 1 location', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      // "1 location" not "1 locations" — string ends after "location" so use \b
      expect(findings[0].evidence).toMatch(/1 location\b(?!s)/);
    });

    it('should use audit description as explanation when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'heading-order',
            score: 0,
            title: '',
            description: 'Custom heading description',
            items: [{}],
          },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].explanation).toBe('Custom heading description');
    });

    it('should fall back to default explanation when description is empty', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      // Default explanation mentions headings and screen readers
      expect(findings[0].explanation).toContain('heading');
    });

    it('should populate fixManual with at least one entry', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect((findings[0].fixManual as string[]).length).toBeGreaterThan(0);
    });
  });

  describe('Document title violations (document-title)', () => {
    it('should emit a HIGH finding when document-title score is less than 1', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'document-title', score: 0, title: '', description: 'Title desc', items: [] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-04');
      expect(findings[0].severity).toBe('HIGH');
    });

    it('should reference WCAG 2.4.2 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'document-title', score: 0, title: '', description: '', items: [] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].location).toContain('2.4.2');
    });

    it('should use audit description when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'document-title',
            score: 0,
            title: '',
            description: 'Custom title description',
            items: [],
          },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].explanation).toBe('Custom title description');
    });

    it('should emit finding when score is 0.5 (partial failure)', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'document-title', score: 0.5, title: '', description: '', items: [] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      // score 0.5 < 1, so a finding is emitted
      expect(findings).toHaveLength(1);
    });
  });

  describe('HTML lang violations (html-has-lang)', () => {
    it('should emit a MEDIUM finding when html-has-lang score is less than 1', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'html-has-lang', score: 0, title: '', description: 'Lang desc', items: [] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-04');
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('should reference WCAG 3.1.1 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'html-has-lang', score: 0, title: '', description: '', items: [] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].location).toContain('3.1.1');
    });

    it('should use audit description when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'html-has-lang',
            score: 0,
            title: '',
            description: 'Custom lang description',
            items: [],
          },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].explanation).toBe('Custom lang description');
    });

    it('should fall back to default explanation mentioning lang attribute when description is empty', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'html-has-lang', score: 0, title: '', description: '', items: [] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].explanation).toContain('lang');
    });
  });

  describe('List markup violations (list)', () => {
    it('should emit a LOW finding when list audit has items', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'list',
            score: 0,
            title: '',
            description: 'List markup',
            items: [{ node: { selector: 'div.list', snippet: '<div>item</div>' } }],
          },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].moduleId).toBe('P3-04');
      expect(findings[0].severity).toBe('LOW');
      expect(findings[0].category).toBe('Accessibility');
    });

    it('should reference WCAG 1.3.1 in the location field', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'list', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].location).toContain('1.3.1');
    });

    it('should include violation count in the title', async () => {
      const items = [{}, {}, {}];
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'list', score: 0, title: '', description: '', items },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].title).toContain('3 lists');
    });

    it('should use singular grammar for exactly 1 list violation', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'list', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].title).toMatch(/1 list[^s]/);
    });

    it('should use audit description as explanation when provided', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          {
            id: 'list',
            score: 0,
            title: '',
            description: 'Custom list description',
            items: [{}],
          },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings[0].explanation).toBe('Custom list description');
    });
  });

  describe('Multiple violations', () => {
    it('should emit one finding per audit type when multiple audits have violations', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items: [{}] },
          { id: 'document-title', score: 0, title: '', description: '', items: [] },
          { id: 'html-has-lang', score: 0, title: '', description: '', items: [] },
          { id: 'list', score: 0, title: '', description: '', items: [{}] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings).toHaveLength(4);
      expect(findings.every((f) => f.moduleId === 'P3-04')).toBe(true);
    });

    it('should emit only relevant findings and skip audits with no violations', async () => {
      const metrics = makeMetrics({
        accessibilityViolations: [
          { id: 'heading-order', score: 0, title: '', description: '', items: [{}] },
          // document-title score is 1, so no finding
          { id: 'document-title', score: 1, title: '', description: '', items: [] },
          // html-has-lang score is null, so no finding
          { id: 'html-has-lang', score: null, title: '', description: '', items: [] },
          // list has no items, so no finding
          { id: 'list', score: 0, title: '', description: '', items: [] },
        ],
      });

      const findings = await runSemanticHTMLModule(metrics);

      expect(findings).toHaveLength(1);
      expect(findings[0].title).toContain('Heading');
    });
  });
});
