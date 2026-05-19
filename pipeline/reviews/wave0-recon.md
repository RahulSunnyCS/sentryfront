# Wave-0 Reconciliation Audit + Boot Measurement

**Task:** T-02  
**Date:** 2026-05-19  
**Scope:** Read-only investigation. No source/config/test files modified.

---

## (a) Per-spec globalSetup safety verdict

The proposed globalSetup will: delete the `e2e.db*` glob, run `prisma db push`
(which recreates the schema on a fresh e2e.db), then truncate every table before
each spec (or before the suite start). Below is the verdict for each of the 6
existing specs.

### 1. `e2e/landing.spec.ts` — SAFE

**Why:** All 5 tests interact with the *live running server* via a real browser.
They POST to `/api/v1/scans`, observe the outgoing HTTP request and the resulting
redirect, and check static UI elements. None of the tests read pre-existing rows
from the database. `scan.create` called by the POST will write into the freshly
truncated e2e.db, but the test only asserts the redirect URL (not any prior
row's content). A globalSetup that starts with a clean schema cannot break these
tests.

**Persistent cross-spec rows depended on?** No.

### 2. `e2e/landing.a11y.spec.ts` — SAFE

**Why:** Single test that runs the axe engine against the rendered `/en` page.
Requires only a running server, not any database rows. The test has no DB
dependency whatsoever — it reads no scan data.

**Persistent cross-spec rows depended on?** No.

### 3. `e2e/performance-report.spec.ts` — SAFE (with per-test seed/cleanup already present)

**Why:** Every runnable test in this spec explicitly calls a seed helper (from
`e2e/support/perf-db-seed.ts`) inside a `try/finally` block, inserts exactly
one Scan row, and calls `cleanup()` (which deletes that row) in the `finally`
block. There is no test that reads rows it did not itself insert. The seed
helpers point Prisma at the same e2e.db the dev server uses (via
`DEV_DATABASE_URL`). A clean e2e.db at globalSetup time gives each test the
empty slate it already assumes — the seed inserts its row, the test runs, the
cleanup removes it.

`xss-01` is the one outlier that constructs its own inline `PrismaClient`
rather than using the seed helpers, but it follows the identical pattern:
create in `try`, delete in `finally`.

**Persistent cross-spec rows depended on?** No. All DB state is per-test,
created and deleted within the same test.

### 4. `e2e/compliance-report.spec.ts` — SAFE (env-gated for P5-populated tests)

**Why:** The demo-route group navigates to `/en/report/demo` which uses a
hard-coded demo fixture (BAD_SCAN) — no database row required. The
P5-populated group is guarded by:

```ts
const COMPLIANCE_SCAN_ID = process.env.COMPLIANCE_SCAN_ID;
const P5_REPORT = COMPLIANCE_SCAN_ID ? `/en/report/${COMPLIANCE_SCAN_ID}` : null;
```

and `test.skip(true, ...)` in `beforeEach` if the env var is absent. In the
standard e2e webServer.env, `COMPLIANCE_SCAN_ID` is not set, so the whole
P5 group is skipped automatically. A clean e2e.db has no impact on the demo
group and the P5 group simply skips.

**Persistent cross-spec rows depended on?** No. Demo route needs no DB. P5
group is env-gated skip in a standard run.

### 5. `e2e/report-calibration.spec.ts` — SAFE (pure function tests; no server needed)

**Why:** This spec explicitly documents that it imports pure functions
(`mergeAndCalibrateFindings`, `compressInfoBandFindings`,
`buildSummaryFromFindings`) from `@/lib/report-utils` directly into the
Playwright Node.js process via esbuild/tsconfig alias. **No browser is
launched, no dev server is contacted, no database is touched.** The functions
are called with in-process test data.

The one server-dependent test (`N1`) is wrapped in:

```ts
const _n1ShouldRun = Boolean(_n1BaseUrl && _n1ReportId);
test.skip(!_n1ShouldRun, '...');
```

Since neither `BASE_URL` nor `REPORT_ID_FOR_N1` is in the standard e2e env,
N1 is always skipped in the normal suite run.

A globalSetup that wipes and recreates e2e.db has zero effect on this spec.

**Persistent cross-spec rows depended on?** No. No DB interaction at all in
the pure-function path.

### 6. `e2e/security-modules.spec.ts` — SAFE (pure function tests; no server needed)

**Why:** Identical architecture to report-calibration. The spec imports scanner
module functions (`runCookiesModule`, `runHeadersModule`, `runDomXssModule`)
directly into the Playwright Node.js process and passes synthetic `CrawlResult`
objects. No browser, no dev server, no database.

DNS-dependent tests (T-03 P1-10, T-05 P1-07) are all `test.skip()` with
documented reasons. The skip runs unconditionally, not on an env-var gate —
so they never touch the network.

A globalSetup wipe has zero effect on this spec.

**Persistent cross-spec rows depended on?** No.

---

### Summary table

| Spec | Needs running server | Needs DB rows | Reads pre-existing rows | Safe after globalSetup wipe? |
|---|---|---|---|---|
| landing.spec.ts | YES | YES (via real POST) | No | **YES** |
| landing.a11y.spec.ts | YES | No | No | **YES** |
| performance-report.spec.ts | YES | YES (per-test seed) | No | **YES** |
| compliance-report.spec.ts | YES (demo group) | No (demo) / skipped | No | **YES** |
| report-calibration.spec.ts | No (pure fns) | No | No | **YES** |
| security-modules.spec.ts | No (pure fns) | No | No | **YES** |

**No spec depends on persistent cross-spec e2e.db rows.** The globalSetup
wipe is safe for all 6.

---

## (b) Empirical dev-server boot measurement

**Command:** `npm run dev` (expands to:
`node scripts/db-config.js development && prisma generate && prisma db push && next dev`)

**Exact env vars used:**
```
DEV_DATABASE_URL=file:./e2e.db
NEXTAUTH_SECRET=e2e-dummy-secret-not-for-production
NEXTAUTH_URL=http://localhost:3000
AUTH_PROVIDER=nextauth
RATE_LIMIT_PER_HOUR=100000
ADMIN_EMAILS=e2e-admin@vibesafe.test
```

**Method:** Python `time.monotonic()` from `subprocess.Popen` call to first
successful HTTP response at `http://localhost:3000/`, polling every 1 second.
A 307 redirect (next-intl redirecting `/` to `/en`) counts as "server ready".

**Results:**

| Run | .next cache state | e2e.db state | Time to first HTTP response |
|---|---|---|---|
| Warm (cache present) | Present (full .next/) | Absent → created by db push | **9 562 ms** |
| Cold (cache deleted) | Absent | Absent → created by db push | **10 307 ms** |

Boot log milestones (from warm run, which is representative of CI after a build step):
- `db-config.js development` rewrite: immediate
- `prisma generate`: ~166 ms
- `prisma db push` (creates e2e.db fresh): ~196 ms
- Next.js "Ready in 1308ms" message: ~1.3 s after `next dev` starts
- First HTTP 200/307 at localhost:3000: **~9.6 s total from process start**

**Note on `ADMIN_EMAILS`:** The current `playwright.config.ts` `webServer.env`
does not include `ADMIN_EMAILS`. The task spec includes it in the measurement
env; it was passed in this measurement. T-03 should add it to `webServer.env`
when wiring the globalSetup so that admin-user seeding in later wave specs
works correctly.

**Error log:** None. Server started cleanly in both runs.

---

## (c) Recommended `webServer.timeout` for T-03

**Measured cold-start:** ~10 307 ms  
**Safety margin (×3):** ~30 921 ms (~31 s)

The current `playwright.config.ts` already sets `timeout: 180_000` (3 minutes),
which comfortably covers the measured cold boot. There is no need to change it.

For T-03 to be explicit: **use `timeout: 60_000`** (60 seconds) as the declared
value, representing ~6× the measured cold-start time. This gives a substantial
safety margin for CI machines that may be slower than this sandbox (which runs
on a fast local SSD with pre-warmed node_modules). If CI experience shows boots
exceeding 60 s, escalate to `120_000` (the existing comment-implied value) or
the conservative fallback of `180_000`.

**If the server cannot bind in a different sandbox/CI environment**, the
recommended conservative fallback is **`600_000`** (10 minutes) per the task
contract — this covers even extremely slow cold starts on resource-constrained
CI runners.

**Recommendation for T-03:** set `webServer.timeout: 60_000` with a comment
that CI machines may need up to `180_000`. Keep the existing `180_000` if T-03
prefers to leave the current value unchanged (it is already safe).

---

## (d) `prisma/schema.prisma` datasource — SQLite at rest

**schema.prisma lines 11–14 (verbatim):**
```
datasource db {
  provider = "sqlite"
  url      = env("DEV_DATABASE_URL")
}
```

**db-config.js development branch output (lines 107–114, verbatim):**
```
datasource db {
  provider = "sqlite"
  url      = env("DEV_DATABASE_URL")
}
```

**Verdict:** Byte-identical. The committed `schema.prisma` is in the SQLite
state. `npm run dev` calls `db-config.js development` which rewrites the same
content (no-op on a fresh checkout), runs `prisma generate`, and `prisma db push`.

This was further confirmed empirically: both measurement runs showed
`prisma db push` succeeding with `SQLite database "e2e.db" at "file:./e2e.db"`
and `Your database is now in sync with your Prisma schema` — proving the schema
is valid SQLite at rest.

---

## (e) Blockers

**No hard blockers.** The globalSetup approach is safe for all 6 specs.

**One minor gap to address in T-03 (not a blocker):** The current
`playwright.config.ts` `webServer.env` does not include `ADMIN_EMAILS`. This is
fine for the existing 6 specs (none seed admin users), but T-03's globalSetup
should add it to `webServer.env` when introducing admin-user seeding for future
wave specs. The measurement confirmed it does not affect server boot.

**No server bind errors, port conflicts, or missing env var failures were
observed** in either the warm or cold boot measurement.

---

## Plain-English Summary

The dev server boots cleanly with the exact e2e webServer env vars, taking
**~10 seconds cold** (no `.next` cache) and **~9.5 seconds warm** (cache
present). The recommended `webServer.timeout` for T-03 is **60 000 ms**
(~6× the cold-boot measurement), with a fallback to the existing `180 000` if
CI machines prove slower; the conservative 600 000 ms fallback is available
if the server cannot bind at all in sandbox. All 6 existing specs are safe
under a globalSetup that wipes `e2e.db*` and runs `prisma db push` before the
suite: none depend on persistent cross-spec rows (landing/security submit real
scans that they observe in-flight; performance seeds and cleans up per-test;
compliance uses a demo route or env-gated skip; calibration and security-modules
are pure-function tests that never touch the database). The `prisma/schema.prisma`
datasource block is confirmed byte-identical to `db-config.js`'s development
output (`provider = "sqlite"`, `url = env("DEV_DATABASE_URL")`). No blockers
to surface.
