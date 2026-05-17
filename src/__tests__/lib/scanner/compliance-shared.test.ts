/**
 * Unit tests for compliance-shared.ts — the single source of truth for the
 * fail-closed keyword list, the deriveComplianceStatus rule, and the framework
 * routing constants.
 *
 * MANDATORY INVARIANT #5: every branch of deriveComplianceStatus is table-tested:
 *   - INFO + fail-closed keyword                 → 'not-evaluated'
 *   - INFO without a fail-closed keyword         → 'observed'
 *   - LOW / MEDIUM / HIGH / CRITICAL             → 'not-observed'
 */

import { describe, it, expect } from 'vitest';
import {
  deriveComplianceStatus,
  FAIL_CLOSED_KEYWORDS,
  MODULE_FRAMEWORKS,
  FRAMEWORK_ORDER,
} from '@/lib/scanner/compliance-shared';
import type { Severity } from '@/lib/scanner/types';

describe('compliance-shared — FAIL_CLOSED_KEYWORDS', () => {
  it('contains the exact conservative keyword set the P5 modules emit', () => {
    expect([...FAIL_CLOSED_KEYWORDS]).toEqual([
      'not evaluated',
      'unavailable',
      'not applicable',
    ]);
  });
});

describe('compliance-shared — deriveComplianceStatus (every branch)', () => {
  // Each row: severity, title, expected status, why
  const cases: Array<{
    severity: Severity;
    title: string;
    expected: 'observed' | 'not-observed' | 'not-evaluated';
  }> = [
    // INFO + each fail-closed keyword → not-evaluated
    {
      severity: 'INFO',
      title: 'Cookie consent signal not evaluated (no rendered DOM)',
      expected: 'not-evaluated',
    },
    {
      severity: 'INFO',
      title: 'WCAG signal unavailable (accessibility scan did not produce a usable score)',
      expected: 'not-evaluated',
    },
    {
      severity: 'INFO',
      title: 'User-rights affordances: not applicable (no account surface observed)',
      expected: 'not-evaluated',
    },
    // case-insensitivity of the keyword match
    {
      severity: 'INFO',
      title: 'SIGNAL NOT EVALUATED for this page',
      expected: 'not-evaluated',
    },
    // INFO without any fail-closed keyword → observed (positive signal)
    {
      severity: 'INFO',
      title: 'Consent mechanism observed: OneTrust',
      expected: 'observed',
    },
    {
      severity: 'INFO',
      title: 'Privacy policy link observed',
      expected: 'observed',
    },
    {
      severity: 'INFO',
      title: 'No third-party data processors observed',
      expected: 'observed',
    },
    // Negative severities always → not-observed regardless of title text
    { severity: 'LOW', title: 'No privacy policy link detected', expected: 'not-observed' },
    { severity: 'MEDIUM', title: 'Non-essential cookies observed', expected: 'not-observed' },
    { severity: 'HIGH', title: 'something bad', expected: 'not-observed' },
    { severity: 'CRITICAL', title: 'something critical', expected: 'not-observed' },
    // A negative severity whose title contains a fail-closed keyword still maps
    // to not-observed — the keyword path is INFO-only by design.
    {
      severity: 'LOW',
      title: 'feature unavailable on this page',
      expected: 'not-observed',
    },
  ];

  it.each(cases)(
    'severity=$severity title="$title" → $expected',
    ({ severity, title, expected }) => {
      expect(deriveComplianceStatus({ severity, title })).toBe(expected);
    },
  );
});

describe('compliance-shared — framework routing constants', () => {
  it('maps every P5 module id to at least one framework', () => {
    for (const id of ['P5-01', 'P5-02', 'P5-03', 'P5-04', 'P5-05', 'P5-06']) {
      expect(MODULE_FRAMEWORKS[id]?.length).toBeGreaterThan(0);
    }
  });

  it('routes P5-04 to WCAG / Accessibility only (not GDPR/CCPA)', () => {
    expect(MODULE_FRAMEWORKS['P5-04']).toEqual(['WCAG / Accessibility']);
  });

  it('declares a stable framework display order', () => {
    expect([...FRAMEWORK_ORDER]).toEqual(['GDPR', 'CCPA', 'WCAG / Accessibility']);
  });

  it('every framework referenced by a module appears in FRAMEWORK_ORDER', () => {
    const referenced = new Set(Object.values(MODULE_FRAMEWORKS).flat());
    for (const fw of referenced) {
      expect(FRAMEWORK_ORDER).toContain(fw);
    }
  });
});
