/**
 * Display-layer finding calibration utilities.
 *
 * These functions are applied at render time (both PDF and interactive UI) to
 * correct severity labels, merge duplicates, and collapse low-signal transparency
 * findings for existing scan data that pre-dates scanner-level fixes.
 *
 * They are pure — they never mutate their inputs and have no side-effects.
 */

import { SEVERITY_RANK } from '@/lib/data';
import type { Finding, Severity } from '@/types';

// ── Path-family helpers (mirrors p1-06 scanner logic for display-layer dedup) ──

function getPathFamily(path: string): string {
  if (path.includes('.env')) return 'Environment config';
  if (path.includes('.git/')) return 'Git repository';
  if (path.includes('.svn/') || path.includes('.hg/') || path.includes('/CVS/'))
    return 'Version control';
  if (/\.(bak|old|swp)$/i.test(path)) return 'Backup file';
  return 'Sensitive file';
}

/**
 * Extracts the HTTP status codes from a P1-06 evidence string.
 * Handles both the single-path format "GET /path → HTTP 403" and
 * the multi-path format "/path (HTTP 403), /other (HTTP 403)".
 */
function extractStatusCodes(evidence: string): number[] {
  const matches = evidence.matchAll(/HTTP (\d{3})/g);
  return [...matches].map((m) => parseInt(m[1], 10));
}

/**
 * Returns true when the evidence string contains exclusively 403 or 401 status codes.
 * Used to identify old-format P1-06 CRITICAL findings that should be HIGH.
 *
 * Returns false if no HTTP status codes are found (codes.length === 0) as a
 * fail-safe: a finding with no parseable evidence should not be silently downgraded.
 */
function allStatusesAreBlocked(evidence: string): boolean {
  const codes = extractStatusCodes(evidence);
  return codes.length > 0 && codes.every((c) => c === 403 || c === 401);
}

// ── Known-safe third-party domains for P1-09 recalibration ──────────────────

const KNOWN_SAFE_THIRD_PARTY_DOMAINS = [
  'buttons.github.io',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
];

function isKnownSafeDomain(domain: string): boolean {
  return KNOWN_SAFE_THIRD_PARTY_DOMAINS.some(
    (safe) => domain === safe || domain.endsWith('.' + safe),
  );
}

// ── Band-summary extraction ──────────────────────────────────────────────────

export interface BandSummaryItem {
  metric: string;
  value: string;
  band: string;
  threshold: string;
}

const BAND_FINDING_RE =
  /^(LCP|FCP|TBT|INP|CLS|TTI|Speed Index|TTFB)\s+is\s+in\s+the\s+(\w+)\s+band/i;

function parseBandSummaryItem(finding: Finding): BandSummaryItem | null {
  const match = BAND_FINDING_RE.exec(finding.title);
  if (!match) return null;
  const metric = match[1].toUpperCase();
  const band = match[2];
  // Extract value and threshold from evidence: "LCP: 10.30s — Poor threshold: ≥ 4.0s"
  const valueMatch = finding.evidence.match(/:\s*([\d.]+s|[\d.]+ms)/);
  const thresholdMatch = finding.evidence.match(/threshold:\s*([^\n]+)/);
  return {
    metric,
    value: valueMatch?.[1] ?? '—',
    band,
    threshold: thresholdMatch?.[1]?.trim() ?? '—',
  };
}

// ── Main calibration function ────────────────────────────────────────────────

/**
 * Applies display-layer severity calibration and deduplication to a raw findings
 * array from the database. Returns a new array — never mutates the input.
 *
 * Corrections applied:
 *  - P1-06 CRITICAL findings where all evidence statuses are 403/401 → downgrade
 *    to HIGH and group by path family (corrects the "publicly accessible" label for
 *    blocked paths)
 *  - Cross-module viewport duplicate (P2-06 + P3-05 same evidence) → keep MEDIUM
 *  - Cross-module security-header duplicate (P1-03 + P5-03, same header) → merge
 *  - P2-04 TBT duplicate of P2-01 TBT (identical metric in evidence) → suppress P2-04
 *  - P4-01 canonical URL returning 403: HIGH → MEDIUM
 *  - P4-03 missing structured data: MEDIUM → LOW
 *  - P2-08 missing sourcemaps suppressed when P1-02 already reports maps exposed
 *  - P1-09 first-party or well-known domains: MEDIUM → LOW
 *  - P4-06 /llms.txt: LOW → INFO
 *  - P5-04 Lighthouse a11y tier: LOW → INFO
 *
 * Architecture note — render-time calibration vs. DB truth:
 *  This function is the single calibration authority for all display consumers
 *  (PDF renderer, interactive report UI). The raw findings in the DB and the
 *  /api/v1/scans/:id/findings API endpoint remain uncalibrated — any new
 *  consumer of that API must call mergeAndCalibrateFindings before display.
 *  A future migration to push calibration to the API serialization layer
 *  (or persist corrected severities) would remove this divergence.
 */
export function mergeAndCalibrateFindings(findings: Finding[]): Finding[] {
  const result: Finding[] = [];

  // ── Step 1: P1-06 severity correction + path family grouping ──────────────

  const p106 = findings.filter((f) => f.module === 'P1-06');
  const nonP106 = findings.filter((f) => f.module !== 'P1-06');

  // Findings where ALL evidence statuses are 403/401 AND severity is CRITICAL:
  // these were emitted by the old scanner logic. Downgrade + group by family.
  const legacyCriticalBlocked = p106.filter(
    (f) => f.severity === 'CRITICAL' && allStatusesAreBlocked(f.evidence),
  );
  const otherP106 = p106.filter((f) => !legacyCriticalBlocked.includes(f));

  // Group legacy CRITICAL blocked findings by path family.
  // Each path within a finding's location is classified individually so that a
  // finding whose location is already a comma-joined string (edge case: partially
  // pre-grouped legacy data) is correctly split across families rather than
  // bucketed entirely under whichever family matches the first substring.
  // We use two separate maps (familyPathMap + familyRepMap) instead of a single
  // Map<family, { paths, representative }> to avoid comparing Finding objects for
  // deduplication — path strings are the source of truth, and any Finding from
  // the group can represent the metadata (id, module) for the combined finding.
  const familyPathMap = new Map<string, string[]>();
  const familyRepMap = new Map<string, Finding>();
  for (const f of legacyCriticalBlocked) {
    const rawPaths = (f.location || '')
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const paths = rawPaths.length > 0 ? rawPaths : [f.title];
    for (const path of paths) {
      const family = getPathFamily(path);
      if (!familyPathMap.has(family)) {
        familyPathMap.set(family, []);
        familyRepMap.set(family, f); // first finding for this family = representative
      }
      familyPathMap.get(family)!.push(path);
    }
  }

  for (const [family, paths] of familyPathMap) {
    const count = paths.length;
    const representative = familyRepMap.get(family)!; // for id + module fields
    result.push({
      ...representative,
      id: `${representative.id}-grouped`, // stable synthetic id for React keys
      severity: 'HIGH',
      title: `${count} ${family} path${count > 1 ? 's' : ''} confirmed (server returns 403 — use 404 instead)`,
      location: paths.join(', '),
      evidence: paths.map((p) => `GET ${p} → HTTP 403`).join('\n'),
      explanation:
        `${count === 1 ? 'This path exists' : `${count} paths exist`} on the server but access is blocked (HTTP 403). ` +
        'The file contents are not readable. However, returning 403 instead of 404 confirms ' +
        `${count === 1 ? 'this path exists' : 'these paths exist'}, which is useful reconnaissance for an attacker. ` +
        'Return 404 for all of these paths.',
      impact:
        'Path existence confirmed — an attacker knows exactly which sensitive files to target if the server\'s access control is misconfigured.',
      fixManual: [
        `Return 404 (not 403) for: ${paths.join(', ')}`,
        'Configure your hosting platform to deny-list these paths with a 404 response',
        'For Vercel: add a block rule in vercel.json or middleware',
        'Verify with: curl -I <your-site>/<path> (should return 404)',
      ],
      fixAiPrompt: `Block these sensitive paths on my site and return 404 instead of 403: ${paths.join(', ')}. Show me how to configure this for Vercel / nginx / Next.js middleware.`,
    });
  }

  // Pass through non-legacy P1-06 findings unchanged.
  result.push(...otherP106);

  // ── Step 2: P2-04 TBT duplicate of P2-01 ─────────────────────────────────

  const hasTbtP201 = nonP106.some(
    (f) =>
      f.module === 'P2-01' &&
      f.evidence.toLowerCase().includes('blocking time') &&
      (f.severity === 'HIGH' || f.severity === 'MEDIUM'),
  );

  let workingFindings = [...nonP106];

  if (hasTbtP201) {
    // P2-04 finding that is purely about TBT (its evidence contains "Total Blocking Time")
    // duplicates the P2-01 TBT finding — suppress it.
    workingFindings = workingFindings.filter(
      (f) =>
        !(
          f.module === 'P2-04' &&
          f.evidence.toLowerCase().includes('blocking time') &&
          !f.evidence.toLowerCase().includes('tti') &&
          !f.evidence.toLowerCase().includes('time to interactive')
        ),
    );
  }

  // ── Step 3: Cross-module viewport dedup (P2-06 vs P3-05) ─────────────────

  const viewportP206 = workingFindings.filter(
    (f) => f.module === 'P2-06' && /maximum.scale|user.scalable/i.test(f.evidence),
  );
  const viewportP305 = workingFindings.filter(
    (f) => f.module === 'P3-05' && /maximum.scale|user.scalable/i.test(f.evidence),
  );

  if (viewportP206.length > 0 && viewportP305.length > 0) {
    // Keep only the higher-severity finding (P3-05 MEDIUM > P2-06 LOW).
    // If both are the same severity, keep P3-05 (accessibility context is richer).
    workingFindings = workingFindings.filter(
      (f) => !viewportP206.some((v) => v.id === f.id),
    );
  }

  // ── Step 4: P1-03 vs P5-03 security-header dedup ─────────────────────────

  // Both P1-03 and P5-03 may emit a "missing CSP" finding and similarly for
  // Referrer-Policy and Permissions-Policy. Keep the one with higher severity.
  const DEDUP_HEADERS = [
    'content-security-policy',
    'csp',
    'referrer-policy',
    'permissions-policy',
  ];

  for (const header of DEDUP_HEADERS) {
    const p103 = workingFindings.filter(
      (f) => f.module === 'P1-03' && f.title.toLowerCase().includes(header),
    );
    const p503 = workingFindings.filter(
      (f) => f.module === 'P5-03' && f.title.toLowerCase().includes(header),
    );

    if (p103.length > 0 && p503.length > 0) {
      // Determine which module's findings have the higher severity.
      // Match on substring (header) rather than structured field comparison because
      // P1-03 uses exact header names ("Content-Security-Policy") while P5-03
      // may use abbreviations ("CSP") or vice versa. Substring match is robust to
      // wording variations without false negatives.
      const maxP103 = Math.min(...p103.map((f) => SEVERITY_RANK[f.severity])); // min rank = highest sev
      const maxP503 = Math.min(...p503.map((f) => SEVERITY_RANK[f.severity]));

      if (maxP103 <= maxP503) {
        // P1-03 is same or higher severity — suppress P5-03 duplicates.
        workingFindings = workingFindings.filter(
          (f) => !p503.some((d) => d.id === f.id),
        );
      } else {
        // P5-03 is higher severity — suppress P1-03 duplicates.
        workingFindings = workingFindings.filter(
          (f) => !p103.some((d) => d.id === f.id),
        );
      }
    }
  }

  // ── Step 5: Point-severity recalibrations ─────────────────────────────────

  workingFindings = workingFindings.map((f): Finding => {
    // P4-01 canonical URL at HTTP 403: SEO impact, not data exposure → MEDIUM
    if (
      f.module === 'P4-01' &&
      f.severity === 'HIGH' &&
      /canonical.*403|403.*canonical/i.test(f.evidence)
    ) {
      return { ...f, severity: 'MEDIUM' };
    }

    // P4-03 missing structured data: no exploitability → LOW
    if (
      f.module === 'P4-03' &&
      f.severity === 'MEDIUM' &&
      /structured data|json.ld|schema\.org/i.test(f.title)
    ) {
      return { ...f, severity: 'LOW' };
    }

    // P1-09 unrecognized scripts: first-party subdomain or well-known CDN → LOW
    if (f.module === 'P1-09' && f.severity === 'MEDIUM') {
      const domainInEvidence = f.evidence.match(/https?:\/\/([^/\s]+)/)?.[1];
      const locationDomain = f.location.match(/https?:\/\/([^/\s]+)/)?.[1] ?? f.location;

      if (
        (domainInEvidence && isKnownSafeDomain(domainInEvidence)) ||
        (locationDomain && isKnownSafeDomain(locationDomain))
      ) {
        return {
          ...f,
          severity: 'LOW',
          explanation:
            f.explanation +
            ' This domain is a well-known CDN or hosting asset — risk is low.',
        };
      }

      // If the target scan URL's apex domain matches the script domain → first-party
      // (This path requires the scan URL context, not available here; handled where
      //  the calibration is called with scanData context — leave MEDIUM otherwise.)
    }

    // P4-06 /llms.txt: scanner says "opportunity gap, not a defect" → INFO
    if (f.module === 'P4-06' && f.severity === 'LOW') {
      return { ...f, severity: 'INFO' };
    }

    // P5-04 Lighthouse a11y tier: transparency only → INFO
    if (f.module === 'P5-04' && (f.severity === 'LOW' || f.severity === 'MEDIUM')) {
      return { ...f, severity: 'INFO' };
    }

    return f;
  });

  // ── Step 6: P2-08 vs P1-02 contradiction ─────────────────────────────────

  const hasExposedSourcemaps = workingFindings.some(
    (f) => f.module === 'P1-02' && /HTTP 200/.test(f.evidence),
  );
  if (hasExposedSourcemaps) {
    // P2-08 "missing sourcemaps" score conflicts with P1-02 "exposed sourcemaps" —
    // P1-02 is ground truth (it fetched the file); suppress P2-08.
    workingFindings = workingFindings.filter((f) => f.module !== 'P2-08');
  }

  // Combine calibrated P1-06 + calibrated non-P1-06
  return [...result, ...workingFindings];
}

/**
 * Extracts "X is in the Poor band" INFO findings from P2-01 and returns them
 * as structured BandSummaryItem[] for rendering in the exec summary as a compact
 * callout instead of individual finding cards.
 *
 * Returns the filtered findings array (band cards removed) and the summary items.
 */
export function compressInfoBandFindings(findings: Finding[]): {
  findings: Finding[];
  bandSummary: BandSummaryItem[] | null;
} {
  const bandItems: BandSummaryItem[] = [];
  const remaining: Finding[] = [];

  for (const f of findings) {
    if (f.module === 'P2-01' && f.severity === 'INFO' && BAND_FINDING_RE.test(f.title)) {
      const item = parseBandSummaryItem(f);
      if (item) {
        bandItems.push(item);
        continue; // remove from findings, collect for summary
      }
    }
    remaining.push(f);
  }

  return {
    findings: remaining,
    bandSummary: bandItems.length > 0 ? bandItems : null,
  };
}

/**
 * Rebuilds the severity summary counts from a (calibrated) findings array.
 * Use this instead of scanData.summary when the findings have been processed
 * by mergeAndCalibrateFindings() to keep pill counts consistent with cards.
 */
export function buildSummaryFromFindings(
  findings: Finding[],
): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  return counts;
}
