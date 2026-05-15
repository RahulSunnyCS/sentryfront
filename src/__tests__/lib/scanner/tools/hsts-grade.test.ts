import { describe, it, expect } from 'vitest';
import { gradeHsts } from '@/lib/scanner/tools/hsts-grade';

describe('gradeHsts', () => {
  it('emits no issues for a strong, preload-eligible policy', () => {
    const { issues } = gradeHsts('max-age=31536000; includeSubDomains; preload');
    expect(issues).toHaveLength(0);
  });

  it('flags a short max-age as LOW', () => {
    const { issues } = gradeHsts('max-age=86400; includeSubDomains; preload');
    expect(issues.some((i) => i.code === 'HSTS_SHORT_MAX_AGE' && i.severity === 'LOW')).toBe(true);
    // Short max-age also disqualifies preload.
    expect(issues.some((i) => i.code === 'HSTS_NOT_PRELOAD_ELIGIBLE' && i.severity === 'INFO')).toBe(true);
  });

  it('flags missing includeSubDomains as LOW', () => {
    const { issues } = gradeHsts('max-age=31536000; preload');
    expect(issues.some((i) => i.code === 'HSTS_NO_SUBDOMAINS' && i.severity === 'LOW')).toBe(true);
    expect(issues.some((i) => i.code === 'HSTS_SHORT_MAX_AGE')).toBe(false);
  });

  it('flags a long, sub-domained policy without preload as preload-ineligible (INFO)', () => {
    const { issues } = gradeHsts('max-age=31536000; includeSubDomains');
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('HSTS_NOT_PRELOAD_ELIGIBLE');
    expect(issues[0].severity).toBe('INFO');
  });

  it('treats max-age=0 (disabled) as short + no subdomains + not preload', () => {
    const { issues } = gradeHsts('max-age=0');
    expect(issues.map((i) => i.code).sort()).toEqual(
      ['HSTS_NOT_PRELOAD_ELIGIBLE', 'HSTS_NO_SUBDOMAINS', 'HSTS_SHORT_MAX_AGE'].sort(),
    );
  });

  it('parses case-insensitively and tolerates spacing/quotes', () => {
    const { issues } = gradeHsts('MAX-AGE = "31536000"; IncludeSubDomains; Preload');
    expect(issues).toHaveLength(0);
  });

  it('handles a garbage value without throwing (treated as no max-age)', () => {
    expect(() => gradeHsts('garbage')).not.toThrow();
    const { issues } = gradeHsts('garbage');
    expect(issues.some((i) => i.code === 'HSTS_SHORT_MAX_AGE')).toBe(true);
  });
});
