# QA Checklist — Report Quality: Severity Calibration, Deduplication & Page Reduction

Generated from the approved plan (feature-fast lane — Critical + Functional tiers only).

---

## 🔴 Critical (must pass at Automation Gate to unblock Gate 2)

### C1 — P1-06 HTTP 403 finding is NOT CRITICAL and does NOT say "publicly accessible"
**Setup:** A scan whose P1-06 findings have CRITICAL severity and evidence "GET /.env → HTTP 403".
**Expected:** After `mergeAndCalibrateFindings()`, the finding severity is HIGH, and the title does NOT contain the word "publicly accessible".
**Test surface:** Unit test on `mergeAndCalibrateFindings` in report-utils.ts.

### C2 — P1-06 .env family at 403 → single HIGH grouped finding with all paths
**Setup:** Two legacy CRITICAL P1-06 findings, both for .env-family paths (/.env, /.env.local), both with HTTP 403 evidence.
**Expected:** After calibration, exactly ONE HIGH finding is emitted that contains both paths in its location/evidence. No CRITICAL findings remain for those paths.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### C3 — Score display must not exceed 100
**Setup:** `scanData.score = 321` (real-world bug value from Nike report).
**Expected:** `clampedScore = Math.min(100, 321) === 100`. The exec summary text reads "Grade (100/100)", not "Grade (321/100)".
**Test surface:** Unit test on `Math.min(100, scanData.score)` logic; visual check on PDF exec summary page.

---

## 🟡 Functional (CONDITIONAL PASS if any fail at Gate 2)

### F1 — P1-06 .git/* family at 403 → single HIGH grouped finding
**Setup:** Three CRITICAL P1-06 findings for .git-family paths (/.git/config, /.git/HEAD, /.git/COMMIT_EDITMSG), all HTTP 403 evidence.
**Expected:** After calibration, exactly ONE HIGH finding covering all three git paths.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F2 — Mixed-family paths are NOT mis-bucketed into one group
**Setup:** A legacy CRITICAL P1-06 finding whose location is already "/.env, /.git/config" (comma-joined).
**Expected:** After calibration, two separate HIGH findings are produced — one for "Environment config" (/.env), one for "Git repository" (/.git/config).
**Test surface:** Unit test on `mergeAndCalibrateFindings` (A1 regression test).

### F3 — Viewport duplicate suppressed (P2-06 vs P3-05)
**Setup:** Findings array with both a P2-06 finding and P3-05 finding whose evidence contains "maximum-scale".
**Expected:** After calibration, only the P3-05 MEDIUM finding remains; P2-06 is removed.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F4 — TBT reported only once (P2-04 suppressed when P2-01 TBT exists)
**Setup:** Findings array with a P2-01 MEDIUM finding whose evidence includes "blocking time" AND a P2-04 finding whose evidence includes "blocking time" (and no TTI reference).
**Expected:** After calibration, the P2-04 finding is absent; P2-01 remains.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F5 — security.txt HTTP 200 NOT flagged as "dev interface" by P1-13
**Setup:** Probe P1-13's `ALLOWED_PATHS` set.
**Expected:** `ALLOWED_PATHS.has('/.well-known/security.txt')` is true (the path is excluded). Unit check that a mock finding for security.txt 200 from P1-13 is excluded.
**Test surface:** Unit test on p1-13-dev-interfaces module.

### F6 — Band summary callout appears when INFO P2-01 band findings exist
**Setup:** Findings array with a P2-01 INFO finding titled "LCP is in the Poor band" and evidence "LCP: 10.30s — Poor threshold: ≥ 4.0s".
**Expected:** `compressInfoBandFindings()` returns `bandSummary` array with one item: `{ metric: 'LCP', value: '10.30s', band: 'Poor', threshold: '≥ 4.0s' }` and the finding is removed from the findings array.
**Test surface:** Unit test on `compressInfoBandFindings`.

### F7 — Google Analytics .map URL NOT reported as sourcemap exposure
**Setup:** In p1-02-sourcemaps module, a candidate URL on `www.googletagmanager.com`.
**Expected:** The URL is skipped and no P1-02 finding is emitted for it.
**Test surface:** Unit test on p1-02-sourcemaps module using a mocked GA URL.

### F8 — P4-01 canonical URL returning 403 shows MEDIUM (not HIGH)
**Setup:** A P4-01 finding with severity HIGH and evidence containing "canonical" and "403".
**Expected:** After calibration, severity is MEDIUM.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F9 — P4-03 missing structured data shows LOW (not MEDIUM)
**Setup:** A P4-03 finding with severity MEDIUM and title containing "structured data".
**Expected:** After calibration, severity is LOW.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F10 — P2-08 "missing sourcemaps" suppressed when P1-02 reports exposed sourcemaps
**Setup:** Findings array with a P1-02 finding whose evidence contains "HTTP 200" AND a P2-08 finding.
**Expected:** After calibration, no P2-08 finding remains.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F11 — P1-09 well-known CDN domain shows LOW (not MEDIUM)
**Setup:** A P1-09 MEDIUM finding whose evidence contains "https://buttons.github.io/".
**Expected:** After calibration, severity is LOW.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F12 — P4-06 /llms.txt shows INFO (not LOW)
**Setup:** A P4-06 LOW finding.
**Expected:** After calibration, severity is INFO.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F13 — P5-04 Lighthouse a11y tier shows INFO (not LOW)
**Setup:** A P5-04 LOW finding.
**Expected:** After calibration, severity is INFO.
**Test surface:** Unit test on `mergeAndCalibrateFindings`.

### F14 — buildSummaryFromFindings reflects calibrated counts
**Setup:** A calibrated findings array with 1 HIGH, 2 MEDIUM, 1 LOW.
**Expected:** `buildSummaryFromFindings()` returns `{ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 1, INFO: 0 }`.
**Test surface:** Unit test on `buildSummaryFromFindings`.

---

## 🟢 Non-blocker (logged only, no gate impact)

### N1 — PDF page count ≤ 30 for a Nike-like scan
**Note:** Cannot be verified programmatically without a real browser print. Manual check: open the print route for a scan with ~50 findings and count pages. Target ≤ 30 (from 44).

### N2 — PDF page count ≤ 22 for an OWASP-like scan
**Note:** Manual check: open the print route for a scan with ~34 findings and count pages. Target ≤ 22 (from 33).
