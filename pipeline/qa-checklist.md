# QA Checklist — Security Module Improvement

Generated: Phase 1, post-Red-Team revision
Lane: feature-full | Risk: HIGH | Tasks: T-01, T-02, T-03

---

## 🔴 Critical — Blocks Gate 2

| ID | Test Case | Module | Expected |
|---|---|---|---|
| C-01 | Session cookie present WITHOUT HttpOnly flag | P1-05 | Finding severity=HIGH |
| C-02 | Session cookie present WITH HttpOnly flag | P1-05 | No finding emitted |
| C-03 | Non-session cookie (name: "theme") missing HttpOnly | P1-05 | No finding emitted |
| C-04 | `CSP: script-src 'unsafe-inline'` | P1-03 | Finding severity=HIGH, not MEDIUM |
| C-05 | `CSP: default-src 'unsafe-eval'` | P1-03 | Finding severity=HIGH |
| C-06 | `CSP: script-src *` (bare wildcard) | P1-03 | Finding severity=HIGH |
| C-07 | `CSP: script-src 'nonce-abc123'` (nonce-only) | P1-03 | NO HIGH finding — this is safe |
| C-08 | `CSP: script-src 'nonce-abc123' 'unsafe-inline'` (nonce present neutralizes unsafe-inline per CSP2) | P1-03 | NO HIGH finding — unsafe-inline is neutralized |
| C-09 | `CSP: script-src *.googleapis.com` (scoped wildcard) | P1-03 | NO HIGH finding — scoped wildcard ≠ bare * |
| C-10 | `CSP: script-src 'strict-dynamic' 'unsafe-inline'` | P1-03 | NO HIGH finding — strict-dynamic neutralizes unsafe-inline in CSP3 |
| C-11 | `HSTS: max-age=3600` (well below threshold) | P1-03 | Finding severity=LOW with weak-value message |
| C-12 | X-Frame-Options header absent | P1-03 | Finding severity=MEDIUM (previously LOW — regression check) |
| C-13 | SRI missing on cross-origin `<script src>` | P1-03 | Finding severity=MEDIUM (previously LOW — regression check) |
| C-14 | SPF record uses `~all` (soft fail) | P1-10 | Finding severity=MEDIUM (previously LOW — regression check) |
| C-15 | DMARC record uses `p=none` | P1-10 | Finding severity=MEDIUM (previously LOW — regression check) |

## 🟡 Functional — CONDITIONAL PASS if failing at Gate 2

| ID | Test Case | Module | Expected |
|---|---|---|---|
| F-01 | `Content-Security-Policy-Report-Only: default-src *` (report-only, not enforced) | P1-03 | Finding severity=INFO with note "report-only policy" |
| F-02 | `HSTS: max-age=31536000` but missing `includeSubDomains` | P1-03 | Finding severity=INFO |
| F-03 | `HSTS: max-age=31536000; includeSubDomains` (correct) | P1-03 | NO finding emitted |
| F-04 | DKIM common selector found (e.g. google._domainkey resolves) | P1-10 | NO finding emitted |
| F-05 | DKIM: no common selector resolves | P1-10 | Finding severity=LOW/INFO with text stating "inconclusive, not confirmed absent" |
| F-06 | CSP: bare HTTP scheme as a source (`script-src http:`) | P1-03 | Finding severity=HIGH |
| F-07 | `CSP: script-src 'sha256-abc123'` (hash, no unsafe-inline) | P1-03 | NO HIGH finding |
| F-08 | Multiple simultaneous session cookies — some missing HttpOnly, some not | P1-05 | Finding lists only the non-HttpOnly session cookies |
| F-09 | All modified modules pass their complete pre-existing unit test suite | all | Test suite green, no regressions |
| F-10 | Corpus baseline updated for recalibrated severities | P1-03/P1-10 | `npm run test:corpus` passes |

## 🟢 Non-blocker — Logged, no gate impact

| ID | Test Case | Module | Expected |
|---|---|---|---|
| N-01 | CSP absent → MEDIUM (existing behaviour unchanged) | P1-03 | MEDIUM finding — regression guard |
| N-02 | HSTS absent → MEDIUM (existing behaviour unchanged) | P1-03 | MEDIUM finding — regression guard |
| N-03 | Secure flag missing on session cookie → HIGH (unchanged) | P1-05 | HIGH finding — regression guard |
| N-04 | SameSite missing on session cookie → MEDIUM (unchanged) | P1-05 | MEDIUM finding — regression guard |
| N-05 | SPF missing → MEDIUM (unchanged) | P1-10 | MEDIUM finding — regression guard |
| N-06 | DMARC missing → MEDIUM (unchanged) | P1-10 | MEDIUM finding — regression guard |
| N-07 | CSP parser handles empty string without exception | P1-03 | No error, no finding |
| N-08 | CSP parser handles malformed directive without exception | P1-03 | No error; silently skip malformed directive |
| N-09 | DKIM DNS error (timeout/NXDOMAIN) handled gracefully | P1-10 | No exception; treated as inconclusive |
| N-10 | `__Secure-next-auth.session-token` known gap | P1-05 | Pre-existing; document as known limitation, no new failure |

---

## Notes

- C-07 through C-10 are the *false-positive guards* — the most important acceptance criteria for CSP strictness. A CSP parser that flags these is wrong and will cause mass false alarms on modern, correctly-configured sites.
- F-05 wording is critical: DKIM finding must say "inconclusive" not "missing".
- F-10: run `npm run test:corpus` in CI to catch grade-computation regressions from severity recalibration.
