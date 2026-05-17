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
