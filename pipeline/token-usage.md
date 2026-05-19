# Pipeline Token Usage

| Phase | Step | Agent | Model | Effort | Est. Tokens |
|---|---|---|---|---|---|
| Phase 0 | Triage | orchestrator | haiku | low | ~2k |
| Phase 1 | Planning + Red Team Sprint 1 | orchestrator + red-team | opus | high | ~35k |
| Phase 1 | QA Planner | orchestrator | sonnet | medium | ~5k |
| Phase 1 | Bounded delta re-plan (R1+R2 → T-04) | orchestrator | opus | high | ~6k |
| Phase 3 | T-01: Sentry wiring | implementor | sonnet | high | ~62k |
| Phase 3 | T-02: scan spans | implementor | sonnet | high | ~66k |
| Phase 3 | T-03: scan counter | implementor | sonnet | medium | ~51k |
| Phase 3 | T-04: observability docs | docs-writer | haiku | medium | ~94k |
| Phase 5/6 | Blast-Radius Validation | orchestrator | haiku | low | ~3k |
| Phase 4 | Consolidated Specialist Review | senior-software-engineer | opus | high | ~65k |
| Phase 4 | Synthesis + Gate 2 Translator | orchestrator + translator | opus + haiku | high + medium | ~80k |
| Phase 4.5 | Fix: beforeSend URL scrub | implementor | sonnet | high | ~44k |
| Phase 5 | Unit tests (redactUrls, counter, health) | test-writer | sonnet | medium | ~63k |
| Phase 6 | Automation Gate | orchestrator | haiku | low | ~3k |
