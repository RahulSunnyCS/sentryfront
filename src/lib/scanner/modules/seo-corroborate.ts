/**
 * Phase 3.11 — cross-source corroboration for SEO depth findings.
 *
 * The same check is evaluated against several independent sources
 * (Lighthouse audit, our cheerio parse of the rendered HTML, a direct fetch
 * of the supporting file, the W3C Nu validator). Each source either agrees
 * the check failed (`failed: true`) or observed no problem (`failed: false`).
 * A source that could not run — PageSpeed API down, W3C Nu unreachable, no
 * rendered HTML — is simply omitted from `observations`, lowering the source
 * count rather than throwing.
 *
 * `'high'` confidence (emit at the check's base severity) requires ≥2 sources
 * agreeing the check failed. A single uncontradicted source → MEDIUM /
 * `'medium'`. Disagreement (one of several sources flags it) → downgraded
 * severity / `'low'`. Pure function, no I/O.
 */

import type { Severity } from '../types';

export type CorroborationSource = 'lighthouse' | 'cheerio' | 'direct-fetch' | 'w3c-nu';

export interface SourceObservation {
  source: CorroborationSource;
  failed: boolean;
}

export interface CorroborationResult {
  severity: Severity;
  confidence: 'high' | 'medium' | 'low';
}

function downgrade(severity: 'HIGH' | 'MEDIUM' | 'LOW'): Severity {
  if (severity === 'HIGH') return 'MEDIUM';
  if (severity === 'MEDIUM') return 'LOW';
  return 'LOW';
}

export function corroborate(
  observations: SourceObservation[],
  baseSeverity: 'HIGH' | 'MEDIUM' | 'LOW',
): CorroborationResult {
  const total = observations.length;
  const failing = observations.filter((o) => o.failed).length;

  // Nothing observed, or no source flags the check — caller should not emit a
  // finding; INFO/low is a safe sentinel if it does.
  if (total === 0 || failing === 0) {
    return { severity: 'INFO', confidence: 'low' };
  }

  // ≥2 independent sources agree → trustworthy, full severity.
  if (failing >= 2) {
    return { severity: baseSeverity, confidence: 'high' };
  }

  // Exactly one source, and it flagged it: no corroboration available, but no
  // contradiction either.
  if (failing === 1 && total === 1) {
    return { severity: downgrade(baseSeverity), confidence: 'medium' };
  }

  // One of several sources flagged it while another did not → disagreement.
  return { severity: downgrade(baseSeverity), confidence: 'low' };
}
