# Context Pack — Security Module Improvement

Built after Gate 1. Consumed by Phase 3/4/5/6 agents. Orchestrator is the sole writer.

## Base Branch
`main` → feature branch: `claude/review-security-module-PR98q`

## Changed File List (grows as tasks complete)
*(empty at Phase 3 start — updated as tasks land)*

## Task Map

| File | Owned by |
|---|---|
| `src/lib/scanner/modules/p1-05-cookies.ts` | T-01 |
| `src/__tests__/lib/scanner/modules/p1-05-cookies.test.ts` | T-01 |
| `src/lib/scanner/modules/p1-03-headers.ts` | T-02 |
| `src/__tests__/lib/scanner/modules/p1-03-headers.test.ts` | T-02 |
| `src/lib/scanner/modules/p1-10-dns-email.ts` | T-03 |
| `src/__tests__/lib/scanner/modules/p1-10-dns-email.test.ts` | T-03 |
| `src/lib/scanner/modules/p1-19-dom-xss.ts` | T-04 (create) |
| `src/__tests__/lib/scanner/modules/p1-19-dom-xss.test.ts` | T-04 (create) |
| `src/lib/scanner/index.ts` | T-04 |
| `src/lib/data.ts` | T-04 |
| `src/lib/scanner/modules/p1-07-cors.ts` | T-05 |
| `src/__tests__/lib/scanner/modules/p1-07-cors.test.ts` | T-05 |

## Already-Implemented Manifest
*(empty at Phase 3 start)*

## Key Architecture Facts

- **Scanner module contract**: `export function runXxxModule(crawl: CrawlResult): RawFinding[]` (sync) or `Promise<RawFinding[]>` (async)
- **Group 1** (async/parallel): P1-01, P1-02, P1-06, P1-07, P1-10, P1-11, P1-12, P1-13, P1-14, P1-16 — plus runPerformanceModules, runAccessibilityModules, runSEOModules, runComplianceModules
- **Group 2** (sync): P1-03, P1-04, P1-05, P1-08, P1-09, P1-15, P1-17, P1-18 — T-04 (P1-19) joins here
- **Severity order**: CRITICAL (0) > HIGH (1) > MEDIUM (2) > LOW (3) > INFO (4)
- **RawFinding fields**: moduleId, severity, category, title, location, evidence, explanation, impact, fixManual[], fixAiPrompt, confidence? (optional), kevMatch?, epssPercentile?
- **ParsedCookie**: {name, value, domain, path, expires, httpOnly: boolean, secure: boolean, sameSite: string|null}
- **loadedChunkContents**: `Record<string, string> | undefined` — only present on headless Playwright path
- **EVIL_ORIGIN** (P1-07): `'https://evil.attacker.example'`
- **looksLikeSessionCookie**: in `src/lib/scanner/tools/cookies.ts` — matches names like sess, auth, token, sid, next-auth etc.
- **getTxtRecords**: existing helper in P1-10 module for DNS TXT lookups
- **checkSri()**: bespoke function pattern in P1-03 — model for checkCsp() and checkHsts()
- **Dispatch loop** in runHeadersModule: iterates HEADER_CHECKS table; bespoke functions called separately after the loop
- **Feature flags**: features.headerCoverageChecks gates the checkSri() call — CSP/HSTS checks are always-on (no flag needed)
- **Path alias**: `@/*` → `src/*`
- **Test setup**: vitest + happy-dom; mocks in vitest.setup.ts; 10s timeout

## Project Facts (from .claude/project/)

- Stack: Next.js 14 App Router, TypeScript strict, Prisma, NextAuth
- Scan timeout: 120s hard limit
- Scanner is passive (no active attacks on target sites)
- Groups run within the 120s budget; each module should be fast
- `npm run typecheck` (tsc --noEmit) must pass — not caught by `npm run test` alone
- `npm run test:corpus` is a CI gate — run it if any severity values change (none change in this task set)
