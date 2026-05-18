# QA Checklist — Security Module Improvement (Rev 2: R1 + R2 added)

Generated: Phase 1, post-recommendation delta re-plan
Lane: feature-full | Risk: HIGH
Tasks: T-01 (HttpOnly), T-02 (CSP+HSTS), T-03 (DKIM), T-04 (DOM XSS P1-19), T-05 (CORS OPTIONS P1-07)
Note: Severity recalibrations dropped per Gate 1 decision — X-Frame-Options, SRI, SPF ~all, DMARC p=none stay LOW.

---

## 🔴 Critical — Blocks Gate 2

### T-01: P1-05 HttpOnly
| ID | Test Case | Expected |
|---|---|---|
| C-01 | Session cookie present WITHOUT HttpOnly flag | Finding severity=HIGH |
| C-02 | Session cookie present WITH HttpOnly flag | No finding emitted |
| C-03 | Non-session cookie (name: "theme") missing HttpOnly | No finding emitted |

### T-02: P1-03 CSP Strictness + HSTS
| ID | Test Case | Expected |
|---|---|---|
| C-04 | `CSP: script-src 'unsafe-inline'` | Finding severity=HIGH |
| C-05 | `CSP: default-src 'unsafe-eval'` | Finding severity=HIGH |
| C-06 | `CSP: script-src *` (bare wildcard) | Finding severity=HIGH |
| C-07 | `CSP: script-src 'nonce-abc123'` (nonce-only) | NO HIGH finding — safe |
| C-08 | `CSP: script-src 'nonce-abc123' 'unsafe-inline'` (nonce neutralises unsafe-inline) | NO HIGH finding |
| C-09 | `CSP: script-src *.googleapis.com` (scoped wildcard) | NO HIGH finding |
| C-10 | `CSP: script-src 'strict-dynamic' 'unsafe-inline'` | NO HIGH finding |
| C-11 | `HSTS: max-age=3600` (well below threshold) | Finding severity=LOW |
| C-12 | X-Frame-Options absent | Finding severity=LOW (unchanged — no recalibration) |
| C-13 | SRI missing on cross-origin scripts | Finding severity=LOW (unchanged — no recalibration) |

### T-03: P1-10 DKIM
| ID | Test Case | Expected |
|---|---|---|
| C-14 | SPF uses `~all` | Finding severity=LOW (unchanged — no recalibration) |
| C-15 | DMARC `p=none` | Finding severity=LOW (unchanged — no recalibration) |

### T-04: P1-19 DOM XSS (NEW MODULE — R1)
| ID | Test Case | Expected |
|---|---|---|
| C-16 | `document.write(location.` found in loadedChunkContents | Finding severity=HIGH, confidence=low |
| C-17 | `eval(location.hash` found in loadedChunkContents | Finding severity=HIGH, confidence=low |
| C-18 | No `loadedChunkContents` (static-fetch fallback path) | No finding, no error — graceful no-op |
| C-19 | Generic `document.write(varName)` with no location source | NO finding — not a confirmed sink+source |

### T-05: P1-07 CORS OPTIONS (R2)
| ID | Test Case | Expected |
|---|---|---|
| C-20 | OPTIONS returns `Access-Control-Allow-Origin: https://evil.attacker.example` with credentials | Finding severity=CRITICAL (reflected origin + creds) |
| C-21 | GET probe already found CRITICAL CORS → OPTIONS probe | OPTIONS probe skipped (avoid redundant request) |

---

## 🟡 Functional — CONDITIONAL PASS if failing at Gate 2

### T-02: P1-03
| ID | Test Case | Expected |
|---|---|---|
| F-01 | `Content-Security-Policy-Report-Only: default-src *` (not enforced) | Finding severity=INFO, text notes "report-only" |
| F-02 | `HSTS: max-age=31536000` but missing `includeSubDomains` | Finding severity=INFO |
| F-03 | `HSTS: max-age=31536000; includeSubDomains` (correct) | NO finding |
| F-04 | `CSP: script-src http:` (bare HTTP scheme) | Finding severity=HIGH |
| F-05 | `CSP: script-src 'sha256-abc123'` (hash-only, no unsafe-inline) | NO finding |

### T-03: P1-10
| ID | Test Case | Expected |
|---|---|---|
| F-06 | DKIM common selector resolves (e.g. google._domainkey) | No finding — DKIM confirmed |
| F-07 | No common DKIM selector resolves | Finding severity=INFO, text says "inconclusive — does not confirm DKIM absent" |
| F-08 | DNS error during DKIM lookup | Graceful handling — treated as inconclusive, no exception |

### T-04: P1-19
| ID | Test Case | Expected |
|---|---|---|
| F-09 | `innerHTML = location.hash` in bundle content | Finding severity=HIGH, confidence=low |
| F-10 | Vendor/framework bundle chunk with `location.href` used in navigation (not a sink) | NO false-positive finding |

### Regression (all tasks)
| ID | Test Case | Expected |
|---|---|---|
| F-11 | All 5 modified/created modules pass full pre-existing unit test suite | Test suite green, no regressions |
| F-12 | P1-05 Secure flag missing → HIGH (unchanged, regression guard) | HIGH finding |
| F-13 | CSP absent → MEDIUM (unchanged, regression guard) | MEDIUM finding |

---

## Notes

- C-07 through C-10 are **false-positive guards** — the single highest-priority correctness requirement for the CSP parser. A CSP parser that flags these is wrong.
- C-18: R1 (DOM XSS) must be a byte-identical no-op when `loadedChunkContents` is absent — same pattern as P1-17 and P1-18.
- F-07: DKIM "inconclusive" text is critical — must NOT say "missing" or "not configured".
- No corpus baseline impact from severity recalibration (recalibration dropped per Gate 1 decision).
