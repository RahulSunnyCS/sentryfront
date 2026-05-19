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
