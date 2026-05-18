# VibeSafe — Security Module Improvement

Auto-generated from pipeline/tasks/. Orchestrator is the sole writer.

## Status: Phase 3 — Implementation

| Task | Title | Status |
|---|---|---|
| T-01 | P1-05: Add HttpOnly flag check for session cookies | ⏳ In Progress |
| T-02 | P1-03: CSP strictness parser + HSTS parameter validation | ⏳ In Progress |
| T-03 | P1-10: DKIM best-effort check (INFO, inconclusive framing) | ⏳ In Progress |
| T-04 | NEW P1-19: DOM-based XSS surface detection module | ⏳ In Progress |
| T-05 | P1-07: Add OPTIONS preflight depth to CORS check | ⏳ In Progress |

## File Ownership (no cross-task writes)

| Task | Files |
|---|---|
| T-01 | `p1-05-cookies.ts`, its test |
| T-02 | `p1-03-headers.ts`, its test |
| T-03 | `p1-10-dns-email.ts`, its test |
| T-04 | `p1-19-dom-xss.ts` (new), its test, `scanner/index.ts`, `src/lib/data.ts` |
| T-05 | `p1-07-cors.ts`, its test |
