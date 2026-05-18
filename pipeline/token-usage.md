# Pipeline Token Usage

| Phase | Step | Agent | Model | Effort | Est. Tokens |
|---|---|---|---|---|---|
| Phase 0 | Triage | orchestrator | haiku | low | ~2k |
| Phase 0 | Repo Exploration (Explore ×2) | Explore | sonnet | medium | ~20k |
| Phase 1 | Planning + Red Team (×3 sprints) | orchestrator + red-team | opus | max | ~60k |
| Phase 1 | QA Planner | qa-planner | sonnet | medium | ~8k |
| Phase 1 | Translator (Gate 1 report) | translator | haiku | medium | ~3k |
| Phase 2 | Decomposition (T-01…T-05) | orchestrator | opus | high | ~15k |
| Phase 3 | T-01: HttpOnly cookie check | implementor | sonnet | high | ~12k |
| Phase 3 | T-02: CSP strictness + HSTS | implementor | sonnet | high | ~15k |
| Phase 3 | T-03: DKIM probe + apex fix | implementor | sonnet | high | ~12k |
| Phase 3 | T-04: DOM XSS module (P1-19) | implementor | sonnet | high | ~18k |
| Phase 3 | T-05: CORS OPTIONS probe | implementor | sonnet | high | ~14k |
| Phase 4 | Senior SW Engineer review | senior-software-engineer | opus | high | ~35k |
| Phase 4 | Security Auditor deep-dive | security-auditor | opus | max | ~55k |
| Phase 4.5 | M4 fix: PSL-aware apex extraction | implementor | sonnet | high | ~8k |
| Phase 5 | Unit test writer (P1-03 gaps) | test-writer | sonnet | medium | ~12k |
| Phase 5 | Integration test writer | test-writer | sonnet | medium | ~10k |
| Phase 5 | Docs writer | docs-writer | haiku | low | ~5k |
| Phase 5 | E2E test writer | e2e-test-writer | sonnet | medium | ~10k |
| Phase 6 | Blast-radius + Automation Gate | orchestrator | haiku | low | ~4k |
| Phase 7 | Epic Doc Writer | epic-doc-writer | sonnet | medium | ~87k |
| Phase 7 | Final Review + Gate 3 | orchestrator | opus | high | ~20k |
