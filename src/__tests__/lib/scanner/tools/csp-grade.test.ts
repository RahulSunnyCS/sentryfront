import { describe, it, expect } from 'vitest';
import { gradeCsp, buildReportOnlyStarter } from '@/lib/scanner/tools/csp-grade';

describe('gradeCsp', () => {
  it('flags unsafe-inline in an enforcing script-src as HIGH', () => {
    const { issues } = gradeCsp("script-src 'unsafe-inline' *");
    const high = issues.filter((i) => i.severity === 'HIGH');
    expect(high.length).toBeGreaterThan(0);
    // SCRIPT_UNSAFE_INLINE === 301 in csp_evaluator's Type enum.
    expect(issues.some((i) => i.type === 301 && i.severity === 'HIGH')).toBe(true);
  });

  it('flags unsafe-eval as HIGH (Type-aware mapping overrides engine MEDIUM_MAYBE)', () => {
    const { issues } = gradeCsp("script-src 'unsafe-eval'");
    expect(issues.some((i) => i.type === 302 && i.severity === 'HIGH')).toBe(true);
  });

  it('downgrades a missing object-src directive to LOW (plan table, not engine HIGH)', () => {
    const { issues } = gradeCsp("script-src 'unsafe-eval'");
    // MISSING_DIRECTIVES === 300; engine rates it HIGH, our rubric says LOW.
    const missing = issues.find((i) => i.type === 300);
    expect(missing?.severity).toBe('LOW');
  });

  it('rates a broad wildcard as MEDIUM, never HIGH', () => {
    const { issues } = gradeCsp('default-src *');
    const wildcard = issues.find((i) => i.type === 304);
    expect(wildcard?.severity).toBe('MEDIUM');
    expect(issues.some((i) => i.severity === 'HIGH')).toBe(false);
  });

  it('emits no issues for a strong nonce + strict-dynamic policy', () => {
    const { issues } = gradeCsp(
      "script-src 'nonce-aaaaaaaaaaaaaaaaaaaa' 'strict-dynamic'; object-src 'none'; base-uri 'none'",
    );
    expect(issues).toHaveLength(0);
  });

  it('is deterministic and de-duplicates by type+directive, capped', () => {
    const a = gradeCsp("script-src 'unsafe-inline' 'unsafe-eval' http: https: data: *");
    const b = gradeCsp("script-src 'unsafe-inline' 'unsafe-eval' http: https: data: *");
    expect(a).toEqual(b);
    expect(a.issues.length).toBeLessThanOrEqual(8);
    const keys = a.issues.map((i) => `${i.type}|${i.directive}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never throws on a malformed policy', () => {
    expect(() => gradeCsp(';;; not-a-directive ???')).not.toThrow();
  });
});

describe('buildReportOnlyStarter', () => {
  it('contains no unsafe-* and no wildcard, locks object-src/base-uri', () => {
    const p = buildReportOnlyStarter(['https://cdn.example.com']);
    expect(p).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(p).not.toContain(' *');
    expect(p).toContain("object-src 'none'");
    expect(p).toContain("base-uri 'self'");
  });

  it('includes only valid observed origins, de-duplicated and sorted', () => {
    const p = buildReportOnlyStarter([
      'https://b.example.com',
      'https://a.example.com',
      'https://b.example.com/',
      'not-a-url',
      "'unsafe-inline'",
    ]);
    expect(p).toContain('https://a.example.com');
    expect(p).toContain('https://b.example.com');
    expect(p).not.toContain('not-a-url');
    expect(p).not.toContain("'unsafe-inline'");
    const scriptSrc = p.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(scriptSrc.indexOf('a.example.com')).toBeLessThan(scriptSrc.indexOf('b.example.com'));
  });

  it('is valid with zero observed origins (self only)', () => {
    const p = buildReportOnlyStarter([]);
    expect(p).toContain("default-src 'self'");
    expect(p).toContain("script-src 'self'");
    expect(p).not.toContain('  ');
  });
});
