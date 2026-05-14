import { describe, it, expect } from 'vitest';
import { assignSeverityFromIntel } from '@/lib/scanner/tools/severity-rubric';

describe('assignSeverityFromIntel — conservative-fallback rubric', () => {
  describe('KEV short-circuit', () => {
    it('KEV match → CRITICAL regardless of CVSS', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 5.0, kevMatch: true, epssPercentile: null }),
      ).toBe('CRITICAL');
    });

    it('KEV match → CRITICAL even when CVSS is null', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: null, kevMatch: true, epssPercentile: null }),
      ).toBe('CRITICAL');
    });

    it('KEV match → CRITICAL even when EPSS is low', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 3.0, kevMatch: true, epssPercentile: 5 }),
      ).toBe('CRITICAL');
    });
  });

  describe('CVSS-critical bucket (>=9.0)', () => {
    it('CVSS 9.5 + EPSS unknown → CRITICAL (conservative fallback)', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 9.5, kevMatch: false, epssPercentile: null }),
      ).toBe('CRITICAL');
    });

    it('CVSS 9.5 + EPSS 95 → CRITICAL', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 9.5, kevMatch: false, epssPercentile: 95 }),
      ).toBe('CRITICAL');
    });

    it('CVSS 9.5 + EPSS 60 → HIGH (one bucket down)', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 9.5, kevMatch: false, epssPercentile: 60 }),
      ).toBe('HIGH');
    });

    it('CVSS 9.5 + EPSS 10 → MEDIUM (positive low-exploit evidence)', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 9.5, kevMatch: false, epssPercentile: 10 }),
      ).toBe('MEDIUM');
    });
  });

  describe('CVSS-high bucket (7.0–8.9)', () => {
    it('CVSS 7.5 + EPSS unknown → HIGH (conservative fallback)', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 7.5, kevMatch: false, epssPercentile: null }),
      ).toBe('HIGH');
    });

    it('CVSS 7.5 + EPSS 60 → HIGH', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 7.5, kevMatch: false, epssPercentile: 60 }),
      ).toBe('HIGH');
    });

    it('CVSS 7.5 + EPSS 30 → MEDIUM (deliberate downgrade)', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 7.5, kevMatch: false, epssPercentile: 30 }),
      ).toBe('MEDIUM');
    });

    it('CVSS 7.0 boundary + EPSS 50 boundary → HIGH', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 7.0, kevMatch: false, epssPercentile: 50 }),
      ).toBe('HIGH');
    });
  });

  describe('CVSS-medium bucket (4.0–6.9)', () => {
    it('CVSS 6.1 + EPSS unknown → MEDIUM', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 6.1, kevMatch: false, epssPercentile: null }),
      ).toBe('MEDIUM');
    });

    it('CVSS 5.4 + EPSS 95 → MEDIUM (no EPSS-driven escalation outside KEV)', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 5.4, kevMatch: false, epssPercentile: 95 }),
      ).toBe('MEDIUM');
    });

    it('CVSS 4.0 boundary → MEDIUM', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 4.0, kevMatch: false, epssPercentile: null }),
      ).toBe('MEDIUM');
    });
  });

  describe('CVSS-low bucket (<4.0)', () => {
    it('CVSS 3.9 → LOW', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 3.9, kevMatch: false, epssPercentile: null }),
      ).toBe('LOW');
    });
  });

  describe('CVSS-null', () => {
    it('CVSS null + no KEV → LOW', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: null, kevMatch: false, epssPercentile: null }),
      ).toBe('LOW');
    });

    it('CVSS null + EPSS 99 (no KEV) → LOW (EPSS alone does not escalate)', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: null, kevMatch: false, epssPercentile: 99 }),
      ).toBe('LOW');
    });
  });

  describe('EPSS=0 boundary (distinct from null)', () => {
    it('CVSS 7.5 + EPSS 0 (positive zero, not null) → MEDIUM', () => {
      expect(
        assignSeverityFromIntel({ cvssBase: 7.5, kevMatch: false, epssPercentile: 0 }),
      ).toBe('MEDIUM');
    });
  });
});
