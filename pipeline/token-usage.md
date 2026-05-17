# Pipeline Token Log

| Phase | Step | Agent | Model | Effort | Est. Tokens |
|---|---|---|---|---|---|
| Phase 0 | Triage + risk_manifest | orchestrator | haiku-equiv | low | ~3k |
| Phase 0.5 | Intent extraction (3 questions) | orchestrator | opus | low | ~2k |
| Phase 1 | Pre-plan research: performance subsystem map | Explore | sonnet | medium | ~12k |
| Phase 1 | Pre-plan research: downstream persistence/UI map | Explore | sonnet | medium | ~12k |
| Phase 1 | Red Team Sprint 1 | red-team | opus | max | ~55k |
| Phase 1 | Live PSI v5 capture attempt (quota-blocked) | orchestrator | n/a | low | ~1k |
| Phase 1 | Red Team Sprint 2 (revised plan) | red-team | opus | max | ~52k |
| Phase 1 | Red Team Sprint 3 (convergence check) | red-team | opus | max | ~48k |
| Phase 1 | QA Planner (tiered checklist) | qa-planner | sonnet | medium | ~78k |
| Phase 1 | Gate 1 round 1 (R1+R2 accepted) + form-factor Q | orchestrator | opus | low | ~2k |
| Phase 1 | Red Team — R1+R2 delta sprint | red-team | opus | max | ~54k |
| Phase 1 | QA Planner — R1+R2 delta refresh | qa-planner | sonnet | medium | ~30k |
| Phase 1 | Translator — updated Plan Report (re-plan r1) | translator | haiku | medium | ~8k |
| Phase 2 | Decomposition (10 task contracts) | orchestrator | opus | high | ~14k |
| Phase 3 | T-03: desktop opt-in feature flag | implementor | sonnet | high | ~14k |
| Phase 3 | T-01: PSI/CrUX + best-practices parser + fixture | implementor | sonnet | high | ~24k |
| Phase 3 | T-01 amendment: performanceScore ?? null | implementor | sonnet | high | ~13k |
| Phase 3 | T-05: i18n 13 keys × 5 catalogs | implementor | sonnet | high | ~24k |
| Phase 3 | T-04: in-memory PSI LRU cache | implementor | sonnet | high | ~22k |
| Phase 3 | T-02: P2-07/P2-08/P2-01 finding modules | implementor | sonnet | high | ~32k |
| Phase 3 | T-06: scoring hub + desktop + cache + UNAVAILABLE | implementor | sonnet | high | ~34k |
| Phase 3 | T-10: README performance section | implementor | sonnet | high | ~9k |
