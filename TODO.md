# TODO — Realistic Performance Scoring + Free Passive Data (CrUX + Best-Practices) + Cache + Desktop

> Single-writer mirror maintained by the Lead Orchestrator. Source of truth:
> `pipeline/tasks/T-XX.json`. Agents read this, never write it.

**Branch:** claude/enhance-passive-scanning-eBoYx · **Lane:** feature-full · **Risk:** MEDIUM
**Status:** Phase 2 complete — awaiting user "proceed with implementation?" before Phase 3

## Task contracts

| ID | Title | Depends on | Owns (files_to_modify/create) |
|---|---|---|---|
| T-01 | PSI/CrUX parser + best-practices + types + fixture + 45s/0 timeout | — | `lighthouse.ts`, new `__tests__/fixtures/psi-v5-sample.json` |
| T-02 | New modules P2-07 (real-user), P2-08 (best-practices), P2-01 transparency INFO | T-01 | new `p2-07-*.ts`, `p2-08-*.ts`, mod `p2-01-core-web-vitals.ts` |
| T-03 | Desktop opt-in feature flag (default OFF) | — | `features.ts`, `.env.example` |
| T-04 | Short-TTL in-memory PSI LRU cache (fail-soft, success-only, 200-cap, 5-min) | T-01 | new `scanner/psi-cache.ts` + its test |
| T-05 | i18n key manifest + 5 catalogs | — | `messages/{en,hi,ml,es,de}.json` |
| T-06 | Scoring rework + aggregator + desktop orchestration + UNAVAILABLE | T-01,T-02,T-03,T-04 | `modules/performance.ts`, `performance-suggestions.ts` |
| T-07 | Null/0-safety for real performanceScore consumers | T-06 | `performance-suggestions/route.ts`, `performance-section.tsx` |
| T-08 | Persistence threading + ScannerResult/PerformanceData types + API pass-through | T-06 | `scan-worker.ts`, `scanner/index.ts`, `scans/[id]/route.ts`, `types/index.ts` |
| T-09 | Report UI: lab/real-user/best-practices/desktop/UNAVAILABLE + XSS-safe render | T-08,T-05 | `performance-section.tsx`, `core-web-vitals.tsx`, `report-view.tsx` |
| T-10 | README performance section update | T-06 | `README.md` |

> Note: T-07 and T-09 both list `performance-section.tsx`. They are NOT
> parallel — T-09 depends (transitively) on T-07's contract via T-06/T-08
> ordering; the orchestrator runs T-07 before T-09 so there is no concurrent
> shared-file write. (Flagged for Phase 3 scheduling.)

## Phase 3 execution waves (no concurrent shared-file writes within a wave)

- **Wave A** (no deps): T-01 ✅, T-03 ✅, T-05 ✅  — DONE
- **Wave B** (deps in A): T-02, T-04  — parallel (next)
- **Wave C**: T-06  — single (integration hub)
- **Wave D** (deps T-06): T-07, T-08, T-10  — parallel (distinct files)
- **Wave E**: T-09  — after T-07 (shared `performance-section.tsx`) and T-08/T-05

## Pipeline phases

- [x] Phase 0 / 0.5 / 1 — Triage, intent, plan (Red Team converged, Gate 1 APPROVED)
- [x] Phase 2 — Decomposition (10 task contracts)
- [ ] Phase 3 — Parallel implementation (awaiting user go-ahead)
- [ ] Phase 4 — Security + performance + architecture review → Human Gate 2
- [ ] Phase 5 — Tests + docs + E2E
- [ ] Phase 6 — Test execution + blast-radius + regression triage
- [ ] Phase 7 — Final review + epic doc → Human Gate 3
