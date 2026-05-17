# SECURITY AUDIT REPORT — Phase 4

**Feature:** Realistic performance scoring + free passive data (CrUX + best-practices) + PSI cache + optional desktop
**Reviewer:** security-auditor (Opus, max effort)
**Review surface:** `git diff 20bc428..HEAD -- 'src/**'` (37 files; behaviour-bearing source enumerated in the task)
**Risk level:** MEDIUM (no auth / PII / payment); attacker-chosen scanned URL is the primary trust boundary
**Date:** 2026-05-17

---

## Scope & threat model

The attacker controls the **scanned site**. Their influence reaches our system only indirectly: the scanned URL is sent to Google PSI v5; Google returns a JSON document whose `loadingExperience` / `originLoadingExperience` (CrUX) blocks and `lighthouseResult.audits` (best-practices titles/descriptions/displayValue) partially reflect attacker-controlled page content. The audit traces that data end-to-end: **scanned site → PSI → `lighthouse.ts` parse → P2-07/P2-08 `RawFinding` text → `scan-worker` `JSON.stringify` → DB JSON column → `/api/v1/scans/[id]` `JSON.parse` + `normalizePerformanceMetrics` → React render (`performance-section.tsx` / `core-web-vitals.tsx`) and the PDF/print path**.

---

## FINDINGS

### 🟢 Low

---

**FINDING: CrUX persisted-shape vs. render-shape mismatch (defence-in-depth observation, not exploitable)**
Severity: 🟢 Low (security) — note: this is a *functional* defect with a security-relevant silver lining; flagged for the architecture/performance reviewers as the owning concern.
File and line: `src/lib/scanner/lighthouse.ts:194-203` (parser output shape) vs. `src/components/core-web-vitals.tsx:270-276` (render input shape); persisted by `src/lib/scanner/index.ts:266` and `src/lib/scan-worker.ts:163`.
What it is: `parseCrUXBlock` emits `CrUXFieldData = { overallCategory, lcp, inp, cls, fcp, ttfb }` where each metric is `{ percentile, category, distributions }`. The render component reads `metrics.fieldData?.metrics?.['LARGEST_CONTENTFUL_PAINT_MS']` — a `.metrics` sub-object keyed by raw CrUX metric names that the live parser **never produces**. Consequently, for a scan run through the live pipeline, the per-metric CrUX field cards (`FieldMetricCard`, which renders the attacker-influenced `category` string) **never render** — `hasFieldData` is false because `fieldData.metrics` is `undefined`. The per-metric `category` XSS sink is therefore unreachable on the live path; it is only reachable for a persisted blob that happens to already be in the `{ metrics: { LARGEST_CONTENTFUL_PAINT_MS: {...} } }` shape (e.g. the `new-code-partial-blob.json` test fixture).
Why it matters: Security-wise this *reduces* attack surface (the per-metric category sink is dead on the live path). It is reported as Low because (a) the headline `overallCategory` chip path **is** reachable and is separately confirmed safe below, and (b) it is surfaced so the orchestrator does not mistake "tests pass" for "CrUX field cards work". From a pure security standpoint there is no exploit.
How to fix it: Functional fix owned by performance/architecture review — reconcile the parser output shape with the consumer (`core-web-vitals.tsx`) and `types/index.ts` `CrUXFieldData`. No security change required. Whichever shape wins, the existing `capString()` + React-text rendering keeps it XSS-safe (verified below for both shapes).

---

**FINDING: Non-numeric hostile `percentile` would render as `"NaN"` / throw-free but ugly (resilience, not a vulnerability)**
Severity: 🟢 Low
File and line: `src/lib/scanner/lighthouse.ts:180` (`(raw.percentile as number) / 100`), consumed at `src/lib/scanner/modules/p2-07-real-user-field.ts:53` (`metric.percentile.toFixed(3)` / `Math.round(metric.percentile)`) and `src/components/core-web-vitals.tsx:60-105` (`(v/1000).toFixed(2)` etc.).
What it is: `parseMetric` guards `percentile` only against `undefined`/`null`, then unconditionally treats it as `number`. Google is the proximate source and returns integers, so a malformed type requires Google itself to be compromised or MITM'd (TLS-protected). If `percentile` were a string/object: `Number / 100` → `NaN`; `(NaN).toFixed(3)` → `"NaN"` (does not throw); `Math.round(NaN)` → `NaN` → `"NaN"`. No crash, no injection — `"NaN"` is rendered as inert React text. CLS `÷100` on a non-number yields `NaN`, same benign outcome.
Why it matters: Not exploitable (trusted TLS source; fail-safe degrades to inert text, never throws, never injects). Listed for completeness and because a cheap type guard would harden the trust boundary.
How to fix it: In `parseMetric`, add `if (typeof raw.percentile !== 'number' || !Number.isFinite(raw.percentile)) return null;` before use. Defence-in-depth only; not required for sign-off.

---

**FINDING: `parseAudit` items (`item.url`) flow into AI-prompt text uncapped**
Severity: 🟢 Low
File and line: `src/lib/scanner/performance-suggestions.ts:54-67` (`formatAuditFiles` → `item.url` interpolated into `aiPrompt`/`description`), reached via `/api/v1/scans/[id]/performance-suggestions`.
What it is: `formatAuditFiles` interpolates `item.url` (from Lighthouse audit `items`, ultimately from the scanned page's resource URLs) into suggestion `aiPrompt` strings with no length cap (only a 5-item `slice`). This is pre-existing code, lightly touched by this feature (the `×100` removal at the old `:260` was the only behavioural edit here, and it is correct). The values are returned as JSON and rendered by `AIImprovementSuggestions` as React text (escaped). Not new to this delivery and not rendered via any HTML sink.
Why it matters: No XSS (React-escaped). The only residual is prompt-size / minor payload padding in the AI bundle — low impact, pre-existing, out of this feature's literal scope.
How to fix it: Optional follow-up — apply a per-URL length clamp in `formatAuditFiles` consistent with the `MAX_TEXT_LEN` discipline the new modules adopt. Not a blocker.

---

## Confirmation of Red Team mitigations (progress.md) — security-relevant items

Each security-relevant mitigation from `pipeline/progress.md` is stated **CONFIRMED** or **NOT CONFIRMED** with file:line evidence.

| # | Mitigation (from progress.md) | Status | Evidence |
|---|---|---|---|
| 1 | New CrUX/best-practices strings length-capped before render | **CONFIRMED** | `p2-07-real-user-field.ts:34-39` (`MAX_TEXT_LEN=200`, `clamp`, applied at `:70` `buildEvidence`); `p2-08-best-practices.ts:29-35` (`MAX_TEXT_LEN=300`, `clamp` on title/description/displayValue/id at `:59-89`); `performance-section.tsx:27-37` (`MAX_STRING_LEN=64` `capString` on grade/category at `:121,264,288,352`); `core-web-vitals.tsx:21-31,226,253` (`capString` on `category` before render) |
| 2 | React auto-escape only; **no `dangerouslySetInnerHTML`** in report or PDF/print path | **CONFIRMED** | `git diff 20bc428..HEAD` contains zero `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function` outside comments & XSS test assertions; `performance-section.tsx`, `core-web-vitals.tsx`, `print-report.tsx` all render via JSX text children only |
| 3 | Explicit XSS test exists | **CONFIRMED** | `performance-section.test.tsx:759-829`: `<script>alert(1)</script>` in `overallCategory` and `javascript:alert(1)` in `bestPracticesGrade` → asserts no `<script>` in `innerHTML`, `querySelectorAll('script')` length 0, no `href="javascript:`; P2-08 length-cap tests `p2-08-best-practices.test.ts:244-261`; all 106 related tests pass |
| 4 | No `dangerouslySetInnerHTML` in Playwright/PDF path; PDF only renders scalar score | **CONFIRMED** | `print/page.tsx:93,186` passes only `scan.performanceScore ?? null` (scalar); `print-report.tsx:440` `performanceScore !== null && <ScoreBar score={performanceScore} />` (numeric only); the new CrUX/best-practices/desktop string fields are **never** read by the print path — it is **not** a new XSS sink |
| 5 | Per-URL cache key ⇒ no cross-URL poisoning; cache holds parsed metrics, not the API key | **CONFIRMED** | `psi-cache.ts:127-138` key = `` `${normalizedUrl}::${strategy}` `` only; value type `LighthouseMetrics` (`:62-65`) — no API key, no session/user data; `MAX_KEY_LENGTH=2048` rejection at `:132-136` |
| 6 | Hard 200-entry LRU cap (memory-DoS guard) actually enforced | **CONFIRMED** | `psi-cache.ts:36,183-188` evicts at `store.size >= MAX_ENTRIES`; test `psi-cache.test.ts:230-235` inserts 10 000 distinct keys, asserts `cacheSize() === 200`; over-long key not stored (`:550` functional test) |
| 7 | Only successful responses cached; UNAVAILABLE/4xx/5xx/timeout never cached | **CONFIRMED** | `performance.ts:273` `isCacheable: (v) => v.performanceScore !== null`; `psi-cache.ts:176-177,257-268` null/predicate-fail → no store; `lighthouse.ts:303,312,538,545` all failure paths return `emptyMetrics` (`performanceScore: null`) |
| 8 | Cache fail-soft: any get/set error → live PSI, never throw | **CONFIRMED** | `psi-cache.ts:149-165` (`get` try/catch → null), `:178-192` (`set` try/catch swallow), `:235-274` (`getOrFetch` fetcher always invoked on miss/error; predicate throw → uncacheable); `performance.ts:278-288` outer try/catch → `emptyMetrics` |
| 9 | Force-refresh (explicit re-scan) bypasses cache | **CONFIRMED (code path present)** | `psi-cache.ts:202,243` `bypass` skips read, still writes; `performance.ts:304,315,334` `bypassCache` threaded to `fetchPsi`. NB: progress.md notes wiring the *user* re-scan signal into `bypassCache` is a downstream concern — the security-relevant property (a bypass path exists and is correct) is satisfied |
| 10 | No new SSRF / egress; same single PSI call; target URL validated upstream | **CONFIRMED** | Diff adds **zero** new `fetch`/`http`/`net`/`dns`/`child_process`/`exec` primitives (non-test); the only outbound is the pre-existing `fetch(apiUrl)` at `lighthouse.ts:278`; `validateAndNormalize` (`url-validator.ts`: blocks `169.254.169.254`, RFC-1918, etc.) runs at `app/api/v1/scans/route.ts:97` before the `Scan` row is created, so `runLighthouse` only ever receives a validated URL |
| 11 | `PAGESPEED_API_KEY` never logged or stored in cache | **CONFIRMED** | Key used only at `lighthouse.ts:261-262` (`params.append('key', …)`); never in any `logger.*` call (`:240,289,302,308-311,492,510,516,532,541` log `url`/status/`!!PAGESPEED_API_KEY` boolean only — never the key or `apiUrl`); cache value is `LighthouseMetrics`, never the request URL |
| 12 | PSI failure → explicit UNAVAILABLE (grade 'N/A', score null), never F/0; non-empty blob persisted with `scoreSource:'unavailable'` | **CONFIRMED** | `performance.ts:155-180,419-464` UNAVAILABLE → `{score:null,grade:'N/A',scoreSource:'unavailable'}`; `scan-worker.ts:151,161,342,349-351` blob built whenever `scoreSource !== undefined`, persisted via `'performanceScore' in scannerResult` (null passes), blob always non-empty; round-trip test `scan-worker.test.ts:400-442` |
| 13 | No provider internals / stack traces leaked to the client | **CONFIRMED** | `app/api/v1/scans/[id]/route.ts:36-40` corrupt-JSON → `logger.warn` server-side + `parsedPerformanceMetrics = null` (no 500, no error body); `lighthouse.ts` errors logged server-side, client receives only normalised metrics or `scoreSource:'unavailable'`; `performance-suggestions/route.ts:45-54` returns generic `"No performance data available"` (no internals) |
| 14 | Timeout budget bounded well under SCAN_TIMEOUT (no DoS via long PSI) | **CONFIRMED** | `lighthouse.ts:27,31` `PAGESPEED_TIMEOUT_MS=45000`, `MAX_RETRIES=0`; desktop = 2 sequential calls = 90 000 ms < 120 000 ms `SCAN_TIMEOUT_MS` (`performance.ts:48` `PSI_TIMEOUT_MS` exported for the timing-bound test); desktop skipped entirely when mobile UNAVAILABLE (`performance.ts:325-329`) |
| 15 | API route changes expose nothing unauth'd that wasn't before | **CONFIRMED** | `app/api/v1/scans/[id]/route.ts:16-19` retains `getCurrentUser()` + `canViewScan` gate (404 on deny — no existence leak); the change only *parses/normalises* an already-returned column; `performance-suggestions/route.ts` auth posture unchanged (the only edit is the `== null` zero-vs-null guard at `:45-49`, which does not broaden exposure) |

**All 15 security-relevant Red Team mitigations: CONFIRMED.** No mitigation is NOT CONFIRMED.

---

## Detailed XSS chain verdict (the headline concern)

**Full chain traced and CONFIRMED SAFE:**

1. **Parse** — `lighthouse.ts:161-204` `parseCrUXBlock`: every field access guarded (`!block || typeof block !== 'object'`, per-metric `!raw || typeof raw !== 'object'`, `category` falsy-guarded). Tolerant of missing `loadingExperience`/`INP`/best-practices audits without throwing. CLS `÷100` applied (`:180,200`); INP never substituted with FID (`:198`); `overall_category` forwarded verbatim, no self-bucketing.
2. **No prototype pollution** — the parser only *reads* attacker keys (`block.overall_category`, `m?.LARGEST_CONTENTFUL_PAINT_MS`, etc.) and constructs **fresh object literals** (`{ percentile, category, distributions }`, `{ overallCategory, lcp, … }`). There is **no** `Object.assign(target, attackerObj)`, no computed-key write from attacker input, no recursive merge. A hostile `__proto__`/`constructor` key in the PSI JSON is never used as an assignment target → **no prototype pollution**. `JSON.parse` in the API route (`route.ts:34`) does not pollute (spec-safe).
3. **Length-capped** — `RawFinding` text is clamped at the module boundary (P2-07 `MAX_TEXT_LEN=200`, P2-08 `MAX_TEXT_LEN=300`); UI re-caps grade/category at `MAX_STRING_LEN=64`. An attacker cannot persist a megabyte string (QA 🔴 case satisfied; P2-08 cap tests pass).
4. **Render** — `performance-section.tsx` and `core-web-vitals.tsx` render every untrusted value as **JSX text children** (`{capString(...)}`, `{t(...)}`). `t()` strings come from the i18n catalog (not site data). `overallCategory` is used only as a **colour-map key** (`VERDICT_CHIP_COLORS[capString(overallCategory)]`) and an i18n-key selector (`getRealUserVerdictKey` returns one of three fixed literals or `null`) — the raw value is never rendered as the chip label. React auto-escapes all text children. **No `dangerouslySetInnerHTML` anywhere in the chain.** XSS test `performance-section.test.tsx:759-829` proves `<script>` and `javascript:` payloads are inert.
5. **PDF/print path** — **NOT a new XSS sink.** `print/page.tsx` + `print-report.tsx` consume only the scalar numeric `performanceScore` (guarded `!== null`, rendered inside `ScoreBar` width math). They never read `performanceMetrics`, `fieldData`, `bestPracticesGrade`, CrUX `category`, or `desktop`. Pre-existing finding text in the PDF (`finding.title`/`evidence`) is React-text-escaped as before; P2-07/P2-08 findings would appear there only as escaped inert text. **Definitive: the new attacker-influenced fields never reach the PDF.**

**Persistence round-trip safety:** `normalizePerformanceMetrics` (`scan-worker.ts:89-131`) is pure, defaults missing `scoreSource` safely (pre-change → `'lab'`; partial w/ fieldData but no scoreSource → `'unavailable'`, never a misleading 'lab'; corrupt value → `'unavailable'`), and never executes persisted content. A crafted persisted blob can at worst place inert text/`NaN` into JSX text — no code path interprets it as HTML/JS. Corrupt JSON → `null` + server-side warn, no 500, no leak.

---

## SUMMARY

```
Critical: 0
High    : 0
Medium  : 0
Low     : 3
```

🔴 Critical : **0**
🟡 Medium   : **0**
🟢 Low      : **3**

**Overall verdict: PASS**

Rationale: The attacker-influenced XSS chain (CrUX `overall_category`/`category`, best-practices titles/descriptions/displayValue, field values) is comprehensively defended by (a) module-boundary length caps, (b) exclusive React auto-escaped JSX text rendering with zero `dangerouslySetInnerHTML`, and (c) a PDF/print path that only ever touches the scalar numeric score. Untrusted parsing is throw-free and constructs only fresh object literals (no prototype pollution, no type-confusion crash). No new outbound request, no SSRF surface, the target URL is validated upstream, and `PAGESPEED_API_KEY` is never logged or cached. The memory-DoS LRU cap (200) is hard-enforced and tested at 10 000 keys. All 15 security-relevant Red Team mitigations are CONFIRMED with file:line evidence. The three Low findings are defence-in-depth / resilience hardening and one functional-shape mismatch (owned by performance/architecture review) — none is exploitable and none blocks sign-off. No Critical or High issues.
