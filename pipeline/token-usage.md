# Pipeline Token Log

| Phase | Step | Agent | Model | Effort | Est. Tokens |
|---|---|---|---|---|---|
| Phase 0 | Triage | orchestrator | haiku | low | ~3k |
| Phase 1 | Deep planning | orchestrator | opus | max | ~30k |
| Phase 1 | Constraint Round — pricing memo | pricing-reviewer | sonnet | low | ~42k |
| Phase 1 | Constraint Round — architecture memo | architecture-reviewer | sonnet | high | ~54k |
| Phase 1 | Red Team Sprint 1 (tri-stance) | red-team | opus | max | ~63k |
| Phase 1 | Red Team Sprint 2 (tri-stance) | red-team | opus | max | ~62k |
| Phase 1 | Red Team Sprint 3 (tri-stance) | red-team | opus | max | ~57k |
| Phase 1 | Red Team Sprint 4 (tri-stance) | red-team | opus | max | ~58k |
| Phase 1 | Red Team Sprint 5 (convergence) | red-team | opus | max | ~55k |
| Phase 1 | QA Planner | qa-planner | opus | high | ~25k |
| Phase 1 | Translator (Plan Report) | translator | haiku | medium | ~12k |
| Phase 1 | QA delta refresh (R3) | qa-planner | opus | high | ~25k |
| Phase 2 | Decomposition + cross-artifact check | orchestrator | opus | high | ~28k |
| Phase 3 | T-01: prod-guard fix | implementor | opus | high | ~38k |
| Phase 3 | T-02: recon + boot measurement | implementor | sonnet | high | ~30k |
| Phase 3 | T-03: globalSetup + config | implementor | sonnet | high | ~33k |
| Phase 3 | T-04: auth-seed helper | implementor | opus | high | ~34k |
| Phase 3 | T-05: db-seed helpers | implementor | sonnet | high | ~33k |
| Phase 3 | T-06: data-testid sweep | implementor | opus | high | ~75k |
| Phase 3 | T-07: PROBE spec | implementor | opus | high | ~40k |
| Phase 3 | T-17: locale-switch smoke | implementor | sonnet | high | ~26k |
| Phase 3 | T-18: fix pre-existing lint | implementor | sonnet | high | ~24k |
| Phase 3 | T-14: internal admin specs | implementor | opus | high | ~42k |
| Phase 3 | T-08: auth specs | implementor | opus | high | ~55k |
| Phase 3 | T-15: static-page smoke | implementor | sonnet | high | ~32k |
| Phase 3 | T-12: scan lifecycle specs | implementor | sonnet | high | ~38k |
| Phase 3 | T-13: report-pages specs | implementor | sonnet | high | ~46k |
| Phase 3 | T-11: dashboard specs | implementor | sonnet | high | ~38k |
| Phase 3 | T-19: active-test tier gate | implementor | opus | high | ~42k |
| Phase 3 | T-09: checkout split (vitest+e2e) | implementor | opus | high | ~52k |
| Phase 3 | T-10: active-test specs (post-T-19) | implementor | opus | high | ~50k |
| Phase 3 | T-16: coverage matrix | implementor | sonnet | high | ~60k |
| Phase 3 | T-20: mount real comps (menu+navbar) | implementor | opus | high | ~58k |
| Phase 4 | Pricing review | pricing-reviewer | sonnet | medium | ~22k |
| Phase 4 | Security audit | security-auditor | opus | max | ~48k |
| Phase 4 | Performance review | performance-reviewer | sonnet | high | ~30k |
| Phase 4 | Architecture review | architecture-reviewer | sonnet | high | ~38k |
| Phase 4 | Synthesis | orchestrator | opus | high | ~12k |
| Phase 4 | Translator (Synthesis) | translator | haiku | medium | ~10k |
| Phase 4.5 | FIX-A: payment-modal smoke + cookie dedup | implementor | sonnet | high | ~22k |
| Phase 4.5 | FIX-B: cookie dedup 3 specs | implementor | sonnet | high | ~20k |
| Phase 4.5 | FIX-C: de-price active-test metadata | implementor | sonnet | high | ~12k |
| Phase 4.5 | Scope-check + re-verify | orchestrator | haiku | low | ~3k |
| Phase 5 | Unit+Integration tests (T-19/T-20) | test-writer | opus | high | ~30k |
| Phase 5 | Docs | docs-writer | haiku | low | ~6k (no-op) |
| Phase 5 | E2E gap audit (+2 functional) | e2e-test-writer | sonnet | medium | ~25k |
| Phase 6 | Blast-radius validation | orchestrator | haiku | low | ~4k |
| Phase 6 | Vitest execution | orchestrator | haiku | low | ~2k |
