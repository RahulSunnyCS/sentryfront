/**
 * Phase 3.3 — exploit-intel severity rubric.
 *
 * Combines CVSS base score, CISA KEV membership, and FIRST.org EPSS
 * percentile into a single Severity bucket. The rubric is "Conservative
 * fallback": EPSS downgrades require positive evidence (a real
 * `epssPercentile < threshold`). Missing EPSS data preserves the
 * CVSS-only bucket, so a FIRST.org outage doesn't surprise-downgrade
 * production findings.
 *
 * KEV match short-circuits to CRITICAL — if CISA has flagged the CVE as
 * actively exploited, every other consideration is moot.
 *
 * See docs/core/SEVERITY_RUBRIC.md for the published rubric.
 */
import type { Severity } from '../types';
import { loadKevSet } from './kev';
import { getEpss } from './epss';

export interface SeverityInput {
  /** Max CVSS base score across all CVEs for this finding. Null if no CVE supplied one. */
  cvssBase: number | null;
  /** True iff any CVE for this finding is in the CISA KEV catalog. */
  kevMatch: boolean;
  /** Max EPSS percentile (0-100) across CVEs. Null if no CVE had EPSS data. */
  epssPercentile: number | null;
}

/**
 * Pure, table-driven rubric. No network, no async. Unit-tested in
 * isolation; the orchestration `resolveSeverity` below is what fans out
 * to KEV+EPSS and then calls this.
 */
export function assignSeverityFromIntel(input: SeverityInput): Severity {
  const { cvssBase, kevMatch, epssPercentile } = input;

  // 1. KEV match → CRITICAL, period.
  if (kevMatch) return 'CRITICAL';

  if (cvssBase === null) return 'LOW';

  // 2. CVSS-critical bucket. EPSS escalates within the bucket; conservative
  //    fallback preserves CRITICAL when EPSS is unknown.
  if (cvssBase >= 9.0) {
    if (epssPercentile === null) return 'CRITICAL';
    if (epssPercentile >= 90) return 'CRITICAL';
    if (epssPercentile >= 50) return 'HIGH';
    return 'MEDIUM';
  }

  // 3. CVSS-high bucket. EPSS >=50 keeps HIGH; positive-low EPSS downgrades
  //    to MEDIUM; missing EPSS preserves HIGH.
  if (cvssBase >= 7.0) {
    if (epssPercentile === null) return 'HIGH';
    if (epssPercentile >= 50) return 'HIGH';
    return 'MEDIUM';
  }

  // 4. CVSS-medium bucket. No EPSS-driven downgrade — already at MEDIUM.
  if (cvssBase >= 4.0) return 'MEDIUM';

  return 'LOW';
}

export interface ResolveSeverityInput {
  /** CVE IDs collected from OSV aliases (preferred) or raw OSV IDs. */
  cveIds: string[];
  /** Parallel-extracted CVSS base scores; may be shorter than cveIds if some CVEs had no CVSS. */
  cvssScores: number[];
}

export interface ResolveSeverityResult {
  severity: Severity;
  kevMatch: boolean;
  epssPercentile: number | null;
}

/**
 * Orchestration: fan out to KEV (one set load, cached) and EPSS (one
 * lookup per CVE, cached), reduce to (kevMatch, maxEpssPercentile,
 * maxCvss), then call the pure rubric.
 *
 * Errors inside the KEV/EPSS clients are already swallowed at that
 * layer — they return empty Set / null respectively, which the rubric
 * handles via the conservative-fallback branch.
 */
export async function resolveSeverity(
  input: ResolveSeverityInput,
): Promise<ResolveSeverityResult> {
  const { cveIds, cvssScores } = input;

  const cvssBase = cvssScores.length > 0 ? Math.max(...cvssScores) : null;

  // Only consider real CVE IDs for KEV (CISA only tracks CVE-* identifiers).
  const cveOnly = cveIds.filter((id) => id.toUpperCase().startsWith('CVE-'));

  if (cveOnly.length === 0) {
    return {
      severity: assignSeverityFromIntel({ cvssBase, kevMatch: false, epssPercentile: null }),
      kevMatch: false,
      epssPercentile: null,
    };
  }

  const [kevSet, epssRecords] = await Promise.all([
    loadKevSet(),
    Promise.all(cveOnly.map((id) => getEpss(id))),
  ]);

  const kevMatch = cveOnly.some((id) => kevSet.has(id.toUpperCase()));

  const percentiles = epssRecords
    .map((r) => r?.percentile)
    .filter((p): p is number => typeof p === 'number');
  const epssPercentile = percentiles.length > 0 ? Math.max(...percentiles) : null;

  return {
    severity: assignSeverityFromIntel({ cvssBase, kevMatch, epssPercentile }),
    kevMatch,
    epssPercentile,
  };
}
