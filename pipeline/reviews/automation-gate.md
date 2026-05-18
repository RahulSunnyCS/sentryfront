AUTOMATION GATE RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Command : npx playwright test e2e/report-calibration.spec.ts
Result  : PASS

| Test | Tag | Classification | Outcome |
|---|---|---|---|
| C1: P1-06 CRITICAL at HTTP 403 → HIGH, no "publicly accessible" | @critical | DIRECT | ✅ PASS |
| C2: two .env-family CRITICAL P1-06 → ONE grouped HIGH | @critical | DIRECT | ✅ PASS |
| C3: Math.min(100, 321) === 100 score clamp | @critical | DIRECT | ✅ PASS |
| F2: comma-joined mixed-family location → two separate HIGH findings (A1 regression) | @functional | DIRECT | ✅ PASS |
| F6: compressInfoBandFindings extracts LCP band finding into bandSummary | @functional | DIRECT | ✅ PASS |
| F14: buildSummaryFromFindings counts severity tiers correctly | @functional | DIRECT | ✅ PASS |
| N1: print page score ≤ 100 when server available | @non-blocker | EXTERNAL | ⏭ SKIPPED (no running server) |

@critical failures  : 0 → Automation Gate: PASS
@functional failures: 0 → Automation Gate: PASS
@non-blocker skipped: 1 → N1 (server-dependent, EXTERNAL — not counted as failure)

Unit suite: 1745 / 1745 passing (107 test files, 1 skipped file pre-existing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
