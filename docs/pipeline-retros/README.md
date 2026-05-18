# Pipeline Retrospectives

Durable record of Phase 7.4 Pipeline Retrospectives.

Each qualifying run (feature-full and above — see CLAUDE.md "Phase 7.4 —
Pipeline Retrospective") writes one file here named
`<date>-<slug>.md` containing the Opus synthesis of the three bias-divergent
retrospective-reviewer reports (conservative / medium / aggressive).

These files live **outside** `pipeline/` on purpose: `pipeline/` is deleted at
Gate-3 cleanup, but the cross-run learning about the pipeline itself must
survive. Recommendations here are **advisory** — any actual change to
`CLAUDE.md` or an agent file is made separately by a human, never auto-applied.
