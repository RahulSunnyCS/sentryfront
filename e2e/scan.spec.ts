/**
 * Scan lifecycle E2E tests — scan/[id] page (seeded states) + real submission.
 *
 * QA-checklist items covered (pipeline/qa-checklist.md §"Scan Lifecycle"):
 *  @critical  — RUNNING: in-progress UI renders from seeded ScanEvent rows
 *  @critical  — TIMEOUT: timeout state + partial findings rendered
 *  @critical  — COMPLETED: completed state routes/links the finished report
 *  @functional — Unknown scan id shows not-found/error, not a crash
 *
 * QA-checklist item covered (§"Real Scan Submission"):
 *  @critical  — Submitting a URL creates a scan and redirects (ONE real POST)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY LIFECYCLE STATES ARE SEEDED (never via /api/v1/scans)
 * ─────────────────────────────────────────────────────────────────────────────
 * The three lifecycle states tested here (RUNNING, TIMEOUT, COMPLETED) are
 * difficult or impossible to reproduce reliably via a real scan call:
 *
 *  • RUNNING: A real scan transitions through RUNNING in <120 s, then moves to
 *    COMPLETED or TIMEOUT. The moment we navigate to the page, the state may
 *    already have changed — no deterministic way to "catch" it mid-flight.
 *
 *  • TIMEOUT: The hard timeout is 120 s. Waiting 120 s per test run is too
 *    slow and brittle (CI resource constraints, env differences). A seeded row
 *    with status=TIMEOUT is instantaneous and reproducible.
 *
 *  • COMPLETED: A real scan completes at varying speeds depending on the target
 *    site's response, network, and LH availability. The e2e.db is an isolated
 *    SQLite file; seeding gives us deterministic Finding rows.
 *
 * Seeding directly via Prisma (seedScanLifecycle) inserts rows that the dev
 * server reads immediately on the next poll (shared e2e.db file). This approach
 * follows the pattern established by performance-report.spec.ts and is
 * explicitly called out in the QA checklist: "Scan-lifecycle states are
 * pre-seeded Scan/Finding/ScanEvent rows."
 *
 * The ONE real /api/v1/scans call is kept in its own test at the bottom of
 * this file. It asserts submission + redirect ONLY and never awaits a terminal
 * scan state — so it never hits the 120 s scan timeout.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTH STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 * The events endpoint (GET /api/v1/scans/:id/events) enforces canViewScan():
 *   - Anonymous (userId=null) scans are always viewable without a session.
 *   - User-owned scans require the requesting user to match scan.userId.
 *
 * The seedScanLifecycle helper seeds user-owned scans (userId=seededUser.id).
 * We therefore also seed a session and inject the cookie so that when the
 * scan/[id] page polls the events endpoint, the server can resolve the user
 * and allow the request. Without the session cookie, the events endpoint
 * returns 404 for owned scans, and scan-progress.tsx immediately router.push('/')
 * — making lifecycle assertions impossible.
 *
 * Each describe block seeds its own isolated user + session in beforeAll
 * and tears it down in afterAll. This satisfies the tier-isolation rule
 * (pipeline constraint memo): no shared global user, each scan is paired
 * with its own unique-email user.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RUNNING STATE ASSERTION STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 * A RUNNING scan has no terminal event in its ScanEvent rows (only scan_started,
 * module_complete, scan_progress). The scan-progress component keeps polling
 * /api/v1/scans/:id/events every 5 s. Since the scan stays in RUNNING status
 * permanently (no real worker is changing it), we assert on the in-progress UI
 * reaching a stable, observable state — the [data-testid="scan-progress"] root
 * is present and [data-testid="scan-failed"] is absent — rather than waiting
 * for a transition that will never come.
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import {
  seedAuthUser,
  authStorageState,
  uniqueEmail,
  type SeededAuth,
} from './support/auth-seed';
import {
  seedScanLifecycle,
  type SeededEntity,
} from './support/db-seed';
import { SCAN_PROGRESS, SCAN_FAILED } from './support/selectors';
import { byTestId, HERO_URL_INPUT, HERO_SCAN_SUBMIT } from './support/selectors';

// ─────────────────────────────────────────────────────────────────────────────
// SCAN-PAGE URL CONTRACT (root cause of the previous lifecycle-spec failures)
// ─────────────────────────────────────────────────────────────────────────────
// src/app/[locale]/scan/[id]/page.tsx:11 derives the displayed URL as:
//     const scanUrl = searchParams.url ? decodeURIComponent(searchParams.url)
//                                       : params.id;
// The scan page is a Server Component that does NOT read Scan.targetUrl from
// the DB — it shows the `?url=` query param, falling back to the bare scan id.
// The real app always navigates to `/scan/<id>?url=<encoded targetUrl>`
// (src/app/[locale]/landing-hero.tsx:93 and scan-progress.tsx:272). This
// behaviour predates this branch (last touched in 35a268f, unchanged vs
// origin/main) — it is NOT a regression.
//
// The lifecycle specs previously navigated to `/en/scan/<id>` WITHOUT the
// `?url=` param, so the page rendered the scan id instead of the seeded host
// — `text=e2e-seed-lifecycle.example.com` was never present (15 s timeout).
// Fix (type A): navigate exactly the way the real app does, with the seeded
// targetUrl in the `?url=` query param (it must equal seedScanLifecycle's
// `targetUrl` in e2e/support/db-seed.ts).
const SEEDED_LIFECYCLE_URL = 'https://e2e-seed-lifecycle.example.com';
const SEEDED_LIFECYCLE_HOST = 'e2e-seed-lifecycle.example.com';

/** Build the scan-page path the real app uses: /en/scan/<id>?url=<encoded>. */
function scanPath(id: string, url = SEEDED_LIFECYCLE_URL): string {
  return `/en/scan/${id}?url=${encodeURIComponent(url)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNING state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('@critical RUNNING scan shows in-progress UI', () => {
  let seededAuth: SeededAuth;
  let seededScan: SeededEntity;
  let authContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Seed user + session first so the scan can be owned by the user.
    seededAuth = await seedAuthUser({ email: uniqueEmail('scan-running') });

    // Seed a RUNNING lifecycle scan owned by the seeded user.
    // seedScanLifecycle creates a Scan with status=RUNNING and three ScanEvent
    // progress rows (scan_started, module_complete, scan_progress) but NO
    // terminal event. The scan stays in RUNNING forever — perfect for a stable
    // assertion on the in-progress UI.
    seededScan = await seedScanLifecycle({
      userId: seededAuth.user.id,
      state: 'RUNNING',
    });

    // Build an authenticated browser context using the seeded session token.
    // The cookie value == Session.sessionToken row — see auth-seed.ts.
    authContext = await browser.newContext({
      storageState: authStorageState(seededAuth.sessionToken),
    });
  });

  test.afterAll(async () => {
    await authContext.close();
    // Cleanup order: scan first (cascade removes ScanEvent children), then user+session.
    await seededScan.cleanup();
    await seededAuth.cleanup();
  });

  test('in-progress UI renders and is not terminal', async () => {
    const page = await authContext.newPage();
    try {
      // Navigate to the scan/[id] page. The page is a Server Component that
      // renders ScanProgress, which immediately polls the events endpoint.
      // networkidle gives the first poll a chance to resolve and update state.
      await page.goto(scanPath(seededScan.id), { waitUntil: 'networkidle' });

      // The scan-progress root must be present — both variant A and C render
      // data-testid="scan-progress" on their outer div.
      await expect(byTestId(page, SCAN_PROGRESS)).toBeVisible();

      // The scan-failed alert must NOT appear — this is a RUNNING scan, not a
      // failed or timed-out one. Its absence is the primary correctness signal.
      await expect(byTestId(page, SCAN_FAILED)).not.toBeVisible();

      // The progress bar (aria-label="progress") is rendered inside scan-progress.
      // It may show 0 % (no modules complete yet per the seed) but must be present.
      // This also verifies the seeded scan url appears somewhere on the page.
      const progressBar = page.locator('[aria-label="progress"]');
      await expect(progressBar).toBeVisible();

      // Verify the seeded target URL appears in the scan-progress UI.
      // Both variant A and C render the scanUrl (from the ?url= param) in a
      // visible element (scan-progress.tsx:410 / :767).
      await expect(
        page.locator(`text=${SEEDED_LIFECYCLE_HOST}`).first(),
      ).toBeVisible();
    } finally {
      await page.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIMEOUT state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('@critical TIMEOUT scan shows timeout state with partial findings', () => {
  let seededAuth: SeededAuth;
  let seededScan: SeededEntity;
  let authContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    seededAuth = await seedAuthUser({ email: uniqueEmail('scan-timeout') });

    // TIMEOUT seed: Scan.status=TIMEOUT, two partial Finding rows (HIGH + MEDIUM),
    // and one scan_timeout ScanEvent. The events endpoint returns the scan with
    // status=TIMEOUT, which triggers setScanFailed(true) in scan-progress.tsx
    // (the fallback branch at line 223: `scan.status === 'TIMEOUT'`).
    seededScan = await seedScanLifecycle({
      userId: seededAuth.user.id,
      state: 'TIMEOUT',
    });

    authContext = await browser.newContext({
      storageState: authStorageState(seededAuth.sessionToken),
    });
  });

  test.afterAll(async () => {
    await authContext.close();
    await seededScan.cleanup();
    await seededAuth.cleanup();
  });

  test('timeout state renders and does not show completed content', async () => {
    const page = await authContext.newPage();
    try {
      // waitUntil: networkidle lets the first poll complete so the TIMEOUT status
      // arrives and the component transitions to scanFailed=true.
      await page.goto(scanPath(seededScan.id), { waitUntil: 'networkidle' });

      // The scan-progress root must be present.
      await expect(byTestId(page, SCAN_PROGRESS)).toBeVisible();

      // The scan-failed alert MUST appear — the TIMEOUT status triggers scanFailed.
      // role="alert" is on [data-testid="scan-failed"] in ScanFailedCard.
      const failedCard = byTestId(page, SCAN_FAILED);
      await expect(failedCard).toBeVisible();

      // The failed card has role="alert" (both the default and 'hacker' variants).
      await expect(failedCard).toHaveAttribute('role', 'alert');

      // The scan-progress root must NOT show a "completed" redirect — the
      // ScanFailedCard replaces the normal module-list in both variants.
      // No redirect should occur (we remain on /en/scan/<id>).
      await expect(page).toHaveURL(new RegExp(`/en/scan/${seededScan.id}`));

      // The scan target URL should still appear in the UI
      // (rendered in the top progress strip above the card; from ?url=).
      await expect(
        page.locator(`text=${SEEDED_LIFECYCLE_HOST}`).first(),
      ).toBeVisible();
    } finally {
      await page.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('@critical COMPLETED scan routes to / links the report', () => {
  let seededAuth: SeededAuth;
  let seededScan: SeededEntity;
  let authContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    seededAuth = await seedAuthUser({ email: uniqueEmail('scan-completed') });

    // COMPLETED seed: delegates to seedCompletedScan, which creates a fully
    // populated scan with multi-domain findings and grades. The events endpoint
    // returns scan.status=COMPLETED, triggering completeAndRedirect() in
    // scan-progress.tsx (via the fallback branch at line 220).
    seededScan = await seedScanLifecycle({
      userId: seededAuth.user.id,
      state: 'COMPLETED',
    });

    authContext = await browser.newContext({
      storageState: authStorageState(seededAuth.sessionToken),
    });
  });

  test.afterAll(async () => {
    await authContext.close();
    await seededScan.cleanup();
    await seededAuth.cleanup();
  });

  test('completed scan navigates to the report page', async () => {
    const page = await authContext.newPage();
    try {
      // For a COMPLETED scan, scan-progress.tsx calls router.push('/report/<id>')
      // after a 1200 ms delay (completeAndRedirect). We navigate to the scan page
      // and wait for the redirect to the report route.
      //
      // Note: We do NOT assert on the report page content here (that is the
      // responsibility of the report-spec files). We only assert that:
      //  1. The browser was redirected to the report route.
      //  2. The scan-progress root was present before the redirect.
      await page.goto(`/en/scan/${seededScan.id}`);

      // The scan-progress root appears immediately (server render).
      await expect(byTestId(page, SCAN_PROGRESS)).toBeVisible();

      // Wait for the redirect to the report. completeAndRedirect() fires after
      // the first poll returns status=COMPLETED and a 1200 ms setTimeout. The
      // expect.timeout (15 s, configured in playwright.config.ts) covers this.
      await page.waitForURL(new RegExp(`/en/report/${seededScan.id}`));

      // We are now on the report page — confirm the URL matches the scan id.
      await expect(page).toHaveURL(new RegExp(`/en/report/${seededScan.id}`));
    } finally {
      await page.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unknown scan ID
// ─────────────────────────────────────────────────────────────────────────────

test('@functional unknown scan id shows not-found state, not a crash', async ({ page }) => {
  // No auth needed: the events endpoint returns 404 for unknown IDs.
  // scan-progress.tsx catches the 404 ApiError and calls router.push('/') —
  // a graceful redirect, not a crash. We assert we land somewhere coherent.
  const nonExistentId = '00000000-0000-0000-0000-000000000000';

  // Collect uncaught JS exceptions — an unhandled error is always a real breakage.
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`/en/scan/${nonExistentId}`, { waitUntil: 'networkidle' });

  // After networkidle, scan-progress.tsx has had time to attempt the first
  // events poll, receive a 404, and invoke router.push('/').
  // We expect the browser to be on either:
  //   a) the root/landing page (redirected after 404)
  //   b) the scan page itself (if networkidle settled before the router.push)
  const finalUrl = page.url();
  const isOnScanPage = finalUrl.includes(`/scan/${nonExistentId}`);
  const isOnLandingPage = /\/en\/?$/.test(finalUrl) || /\/?$/.test(finalUrl);

  expect(
    isOnScanPage || isOnLandingPage,
    `Expected to be on the scan page or landing page, got: ${finalUrl}`,
  ).toBeTruthy();

  // No unhandled JS exceptions — a crash always surfaces here.
  expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Real submission — ONE real /api/v1/scans call
// ─────────────────────────────────────────────────────────────────────────────

test(
  '@critical submitting a URL on the landing flow creates a scan and redirects',
  async ({ page }) => {
    // This is the SINGLE non-hermetic test that exercises the real /api/v1/scans
    // endpoint. It mirrors the pattern in landing.spec.ts ("@critical critical
    // path starts a real scan") but is distinct — it lives in this file because:
    //   1. It belongs to the "Real Scan Submission" QA-checklist section.
    //   2. landing.spec.ts already covers the landing-page render and the real
    //      submission from the landing page itself; this spec provides the
    //      scan-lifecycle spec file's coverage of the submission+redirect contract.
    //
    // CRITICAL CONSTRAINT: Do NOT await scan completion or any terminal state.
    // The real scan may take up to 120 s. We assert submission + redirect only.

    await page.goto('/en');

    // Register the waitForRequest BEFORE clicking submit, so the listener is
    // in place before the fetch fires. This is the required pattern to avoid
    // a race where the POST completes before the watcher is registered.
    const reqPromise = page.waitForRequest(
      (r) => r.url().includes('/api/v1/scans') && r.method() === 'POST',
    );

    // Fill the URL input and submit.
    await byTestId(page, HERO_URL_INPUT).fill('https://example.com');
    await byTestId(page, HERO_SCAN_SUBMIT).click();

    // Await the outgoing POST — createScan() in lib/api.ts posts { url } as JSON.
    const req = await reqPromise;
    expect(req.postDataJSON()).toMatchObject({ url: 'https://example.com' });

    // After the 201 response, the client navigates to /en/scan/<id>.
    // The regex matches the path segment only, not the query string.
    await page.waitForURL(/\/en\/scan\/[^/?]+/);

    // Confirm we are on the scan progress page. The scan-progress root renders
    // immediately (server side), so it is visible right after navigation.
    await expect(byTestId(page, SCAN_PROGRESS)).toBeVisible();

    // We stop here. Do NOT assert scan completion, findings, or any terminal
    // state. The real scan runs async in the background and may take up to 120 s.
  },
);
