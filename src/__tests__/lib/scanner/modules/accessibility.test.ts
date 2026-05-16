import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock runLighthouse before importing the module under test so the mock is
// in place when the module's top-level imports are resolved.
vi.mock('@/lib/scanner/lighthouse', () => ({
  runLighthouse: vi.fn(),
}));

// Mock all five P3 sub-modules so this test covers only the orchestrator logic.
vi.mock('@/lib/scanner/modules/p3-01-color-contrast', () => ({
  runColorContrastModule: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/p3-02-keyboard-navigation', () => ({
  runKeyboardNavigationModule: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/p3-03-screen-reader', () => ({
  runScreenReaderModule: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/p3-04-semantic-html', () => ({
  runSemanticHTMLModule: vi.fn(),
}));
vi.mock('@/lib/scanner/modules/p3-05-forms-interactive', () => ({
  runFormsInteractiveModule: vi.fn(),
}));

// Mock the logger so no Sentry side-effects fire during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { runAccessibilityModules } from '@/lib/scanner/modules/accessibility';
import { runLighthouse } from '@/lib/scanner/lighthouse';
import { runColorContrastModule } from '@/lib/scanner/modules/p3-01-color-contrast';
import { runKeyboardNavigationModule } from '@/lib/scanner/modules/p3-02-keyboard-navigation';
import { runScreenReaderModule } from '@/lib/scanner/modules/p3-03-screen-reader';
import { runSemanticHTMLModule } from '@/lib/scanner/modules/p3-04-semantic-html';
import { runFormsInteractiveModule } from '@/lib/scanner/modules/p3-05-forms-interactive';
import type { LighthouseMetrics } from '@/lib/scanner/lighthouse';
import type { RawFinding } from '@/lib/scanner/types';

const TARGET_URL = 'https://example.com';

/** Build a complete LighthouseMetrics object with sensible defaults */
function makeLighthouseMetrics(overrides: Partial<LighthouseMetrics> = {}): LighthouseMetrics {
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

/** Minimal stub RawFinding for use in mock return values */
function makeFinding(moduleId: string): RawFinding {
  return {
    moduleId,
    severity: 'LOW',
    category: 'Accessibility',
    title: `Finding from ${moduleId}`,
    location: 'Test',
    evidence: 'Test evidence',
    explanation: 'Test explanation',
    impact: 'Test impact',
    fixManual: [],
    fixAiPrompt: '',
  };
}

describe('Accessibility Orchestrator (accessibility.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all sub-modules return empty findings
    (runColorContrastModule as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (runKeyboardNavigationModule as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (runScreenReaderModule as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (runSemanticHTMLModule as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (runFormsInteractiveModule as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  describe('Happy path — no violations', () => {
    it('should return empty findings array when all sub-modules return no findings', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeLighthouseMetrics({ accessibilityScore: 1.0 }),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.findings).toHaveLength(0);
    });

    it('should return the metrics object from runLighthouse', async () => {
      const metrics = makeLighthouseMetrics({ accessibilityScore: 0.97 });
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(metrics);

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.metrics).toEqual(metrics);
    });

    it('should call runLighthouse with the provided URL', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(makeLighthouseMetrics());

      await runAccessibilityModules(TARGET_URL);

      expect(runLighthouse).toHaveBeenCalledWith(TARGET_URL);
    });

    it('should call all five P3 sub-modules', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(makeLighthouseMetrics());

      await runAccessibilityModules(TARGET_URL);

      expect(runColorContrastModule).toHaveBeenCalledOnce();
      expect(runKeyboardNavigationModule).toHaveBeenCalledOnce();
      expect(runScreenReaderModule).toHaveBeenCalledOnce();
      expect(runSemanticHTMLModule).toHaveBeenCalledOnce();
      expect(runFormsInteractiveModule).toHaveBeenCalledOnce();
    });
  });

  describe('Findings aggregation', () => {
    it('should merge findings from all sub-modules into a single array', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(makeLighthouseMetrics());
      (runColorContrastModule as ReturnType<typeof vi.fn>).mockResolvedValue([makeFinding('P3-01')]);
      (runKeyboardNavigationModule as ReturnType<typeof vi.fn>).mockResolvedValue([makeFinding('P3-02')]);
      (runScreenReaderModule as ReturnType<typeof vi.fn>).mockResolvedValue([makeFinding('P3-03'), makeFinding('P3-03')]);
      (runSemanticHTMLModule as ReturnType<typeof vi.fn>).mockResolvedValue([makeFinding('P3-04')]);
      (runFormsInteractiveModule as ReturnType<typeof vi.fn>).mockResolvedValue([makeFinding('P3-05')]);

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.findings).toHaveLength(6);
      // All findings are present in merge order
      const moduleIds = result.findings.map((f) => f.moduleId);
      expect(moduleIds).toContain('P3-01');
      expect(moduleIds).toContain('P3-02');
      expect(moduleIds).toContain('P3-03');
      expect(moduleIds).toContain('P3-04');
      expect(moduleIds).toContain('P3-05');
    });
  });

  describe('Grade calculation (calculateAccessibilityGrade)', () => {
    it.each([
      // [accessibilityScore, expectedGrade, description]
      [1.0,   'A', 'score 100 → A'],
      [0.95,  'A', 'score 95 → A'],
      [0.94,  'B', 'score 94 → B'],
      [0.85,  'B', 'score 85 → B'],
      [0.84,  'C', 'score 84 → C'],
      [0.70,  'C', 'score 70 → C'],
      [0.69,  'D', 'score 69 → D'],
      [0.50,  'D', 'score 50 → D'],
      [0.49,  'F', 'score 49 → F'],
      [0.0,   'F', 'score 0 → F'],
      [null,  'F', 'null score → F'],
    ])('should return grade %s for score %s (%s)', async (score, expectedGrade) => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeLighthouseMetrics({ accessibilityScore: score }),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.accessibilityGrade).toBe(expectedGrade);
    });
  });

  describe('Accessibility score calculation', () => {
    it('should convert Lighthouse 0–1 score to 0–100 integer', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeLighthouseMetrics({ accessibilityScore: 0.87 }),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      // Math.round(0.87 * 100) = 87
      expect(result.accessibilityScore).toBe(87);
    });

    it('should return 0 when accessibilityScore is null', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeLighthouseMetrics({ accessibilityScore: null }),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.accessibilityScore).toBe(0);
    });

    it('should return 100 for a perfect score', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeLighthouseMetrics({ accessibilityScore: 1.0 }),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.accessibilityScore).toBe(100);
    });
  });

  describe('Error path — runLighthouse throws', () => {
    it('should return an empty findings array when runLighthouse throws', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Lighthouse failed'),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.findings).toHaveLength(0);
    });

    it('should return grade F when runLighthouse throws', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Lighthouse failed'),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.accessibilityGrade).toBe('F');
    });

    it('should return accessibilityScore 0 when runLighthouse throws', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Lighthouse failed'),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.accessibilityScore).toBe(0);
    });

    it('should return a fully null metrics object when runLighthouse throws', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Lighthouse failed'),
      );

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result.metrics.accessibilityScore).toBeNull();
      expect(result.metrics.accessibilityViolations).toHaveLength(0);
    });

    it('should not propagate the error to the caller', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Lighthouse failed'),
      );

      // The function must resolve, not reject
      await expect(runAccessibilityModules(TARGET_URL)).resolves.toBeDefined();
    });

    it('should not call any P3 sub-modules when runLighthouse throws', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Lighthouse failed'),
      );

      await runAccessibilityModules(TARGET_URL);

      // Sub-modules are inside the try block; they must not run if Lighthouse fails
      expect(runColorContrastModule).not.toHaveBeenCalled();
      expect(runKeyboardNavigationModule).not.toHaveBeenCalled();
      expect(runScreenReaderModule).not.toHaveBeenCalled();
      expect(runSemanticHTMLModule).not.toHaveBeenCalled();
      expect(runFormsInteractiveModule).not.toHaveBeenCalled();
    });
  });

  describe('Return type shape', () => {
    it('should always return an object with findings, metrics, accessibilityGrade, and accessibilityScore', async () => {
      (runLighthouse as ReturnType<typeof vi.fn>).mockResolvedValue(makeLighthouseMetrics());

      const result = await runAccessibilityModules(TARGET_URL);

      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('accessibilityGrade');
      expect(result).toHaveProperty('accessibilityScore');
    });
  });
});
