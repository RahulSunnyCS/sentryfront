# Token Usage Log

| Phase | Step | Agent | Model | Effort | Est. Tokens |
|---|---|---|---|---|---|
| Phase 0 | Triage | orchestrator | haiku | low | ~2k |
| Phase 0.5 | Grill-Me | orchestrator | sonnet | high | ~8k |
| Phase 0.7 | Opus Deep-Dive (all findings) | Explore | opus | max | ~64k |
| Phase 1 | Planning + Red Team | orchestrator | sonnet | high | ~15k |
| Phase 1 | QA Planner | orchestrator | sonnet | medium | ~5k |
| Phase 2 | Decomposition | orchestrator | sonnet | high | ~8k |
| Phase 3 | T-01: p1-06 status-aware severity + grouping | implementor | sonnet | high | ~12k |
| Phase 3 | T-02: p1-02 GA URL false positive suppression | implementor | sonnet | medium | ~6k |
| Phase 3 | T-03: p1-01 GA high-entropy downgrade | implementor | sonnet | medium | ~6k |
| Phase 3 | T-04: p1-13 security.txt exclusion | implementor | haiku | low | ~2k |
| Phase 3 | T-05: report-utils.ts calibration utility (new) | implementor | sonnet | high | ~15k |
| Phase 3 | T-06: print-report.tsx calibration + dedup + legend | implementor | sonnet | high | ~18k |
| Phase 3 | T-07: print.css compact styles | implementor | haiku | medium | ~3k |
| Phase 3 | T-08: report-view.tsx calibration pipeline | implementor | sonnet | high | ~12k |
| Phase 4 | Senior SW Engineer (sec+perf+arch) | senior-software-engineer | opus | high | ~132k |
| Phase 4.5 | Fix A1 (per-path grouping) + A2 (doc comment) | orchestrator | sonnet | high | ~6k |
| Phase 5 | Unit + Integration Tests (report-utils + p1-13) | test-writer | sonnet | medium | ~75k |
| Phase 5 | Docs (inline comments + progress update) | docs-writer | sonnet | medium | ~103k |
| Phase 5 | E2E Tests (report-calibration.spec.ts) | e2e-test-writer | sonnet | medium | ~93k |
| Phase 6 | Blast-Radius Validation + Automation Gate | orchestrator | haiku | low | ~3k |
