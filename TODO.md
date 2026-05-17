# TODO — Compliance Module (P5-01…P5-06)

Mirror of pipeline/tasks/. Orchestrator is the sole writer. Lane: feature-full · Risk: HIGH.

## Phase 2 — Task contracts (awaiting go-ahead)

| Task | Title | Depends on |
|---|---|---|
| T-01 | Foundation: types, `complianceScanning` flag, SCAN_MODULES metadata | — |
| T-02 | P5-01 Cookie Consent signal module | T-01 |
| T-03 | P5-02 Privacy Policy presence module | T-01 |
| T-04 | P5-03 Data-protection-relevant headers (no regulatory verbs — R2) | T-01 |
| T-05 | P5-04 WCAG attestation signal (fail-closed on a11y) | T-01 |
| T-06 | P5-05 Third-party data sharing (reuses p1-09 classifier) | T-01 |
| T-07 | P5-06 User rights affordances | T-01 |
| T-08 | Compliance orchestrator (compliance.ts) | T-01..T-07 |
| T-09 | Scanner integration (index.ts) — flag-gated, no-op when off | T-08 |
| T-10 | Report UI: compliance section (non-numeric, disclaimered, PDF + i18n) | T-01, T-09 |
| T-11 | R1 doc honesty edit — strike audit/due-diligence marketing | — |

Waves: [T-01, T-11] → [T-02..T-07 parallel] → [T-08] → [T-09] → [T-10].
