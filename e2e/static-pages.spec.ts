/**
 * Static-page smoke tests — Wave 3 @non-blocker batch.
 *
 * Covers (one test per page — mechanical batch):
 *   legal/contact, legal/privacy, legal/terms,
 *   docs, demo/accessibility, demo/performance, demo/seo,
 *   error.tsx (partial — see inline note), not-found.tsx.
 *
 * Pattern for every case:
 *   1. Register console-error + pageerror listeners BEFORE navigation.
 *   2. Navigate to the page (en locale).
 *   3. Assert HTTP 200 (via page.goto() return value).
 *   4. Assert a primary heading (h1) is visible.
 *   5. Assert zero uncaught pageerror and zero non-benign console errors.
 *
 * No auth, no DB seed required — all pages are public/static.
 * All tests tagged @non-blocker per pipeline/qa-checklist.md.
 *
 * Design notes:
 *  - BENIGN_CONSOLE is replicated inline (contract requirement — no import from
 *    landing.spec.ts). This keeps the file self-contained and avoids coupling
 *    two independent spec files through a support module that does not exist yet.
 *  - isBenignConsoleMessage is a simple includes-loop — identical logic to
 *    landing.spec.ts so reviewers can compare them without cross-file navigation.
 *  - Page-error (uncaught JS exception) listener is intentionally kept strict
 *    and unfiltered. Any pageerror is a real breakage, not dev-mode noise.
 *  - HTTP status is captured from the Response returned by page.goto(). If
 *    goto() follows a redirect (e.g. not-found → /) the returned status is the
 *    final response's status; we assert 200 in both cases.
 *  - error.tsx is a React Error Boundary: it only renders when a component
 *    throws. There is no navigable URL for it, and triggering an app-level
 *    error from the test harness would require modifying source (forbidden).
 *    The test is marked test.fixme with a documented reason — the file IS
 *    asserted to exist in the coverage matrix; the runtime trigger is partial.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Benign console filter (replicated inline — do NOT import from landing.spec.ts) ──
//
// AR-H1: Known-harmless console patterns filtered before asserting zero errors.
// Rationale mirrors landing.spec.ts AR-H1: React DevTools banners, Next.js Fast
// Refresh messages, and ResizeObserver loop warnings all fire in dev mode and
// are not real breakages. Replicating this constant keeps each spec self-contained.
const BENIGN_CONSOLE = [
  '[Fast Refresh]',
  'ResizeObserver loop',
  'Download the React DevTools',
  // React dev-mode warnings use console.error but are not runtime errors.
  'Warning:',
];

function isBenignConsoleMessage(text: string): boolean {
  return BENIGN_CONSOLE.some((pattern) => text.includes(pattern));
}

// ── Helper: collect console errors + page errors and navigate ─────────────────
//
// Returns the final HTTP response status from page.goto() so each test can
// assert 200 inline. Listeners are attached BEFORE navigation so no early-load
// error slips past.
async function smokeGoto(
  page: Page,
  url: string,
): Promise<{
  status: number | null;
  consoleErrors: string[];
  pageErrors: string[];
}> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // pageerror fires for uncaught JS exceptions — always a real breakage.
  // This check is intentionally unfiltered (AR-H1: pageerror stays strict).
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  const response = await page.goto(url);
  const status = response?.status() ?? null;

  return { status, consoleErrors, pageErrors };
}

// ── Helper: assert zero non-benign console errors and zero pageerrors ─────────
function assertNoErrors(
  url: string,
  consoleErrors: string[],
  pageErrors: string[],
): void {
  const unexpected = consoleErrors.filter((msg) => !isBenignConsoleMessage(msg));
  expect(
    unexpected,
    `Unexpected console errors on ${url}: ${JSON.stringify(unexpected)}`,
  ).toEqual([]);

  expect(
    pageErrors,
    `Unexpected page errors on ${url}: ${JSON.stringify(pageErrors)}`,
  ).toEqual([]);
}

// ── legal/contact ─────────────────────────────────────────────────────────────

test('@non-blocker legal/contact page renders', async ({ page }) => {
  const url = '/en/legal/contact';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  // HTTP 200 — the page is statically generated and publicly accessible.
  expect(status).toBe(200);

  // A primary heading must be visible. The ContactPage renders an <h1> with
  // the 'legal.contactTitle' translation key (en: "Contact Us").
  await expect(page.locator('h1').first()).toBeVisible();

  assertNoErrors(url, consoleErrors, pageErrors);
});

// ── legal/privacy ─────────────────────────────────────────────────────────────

test('@non-blocker legal/privacy page renders', async ({ page }) => {
  const url = '/en/legal/privacy';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  expect(status).toBe(200);

  // PrivacyPage renders an <h1> with the 'legal.privacyTitle' translation key.
  await expect(page.locator('h1').first()).toBeVisible();

  assertNoErrors(url, consoleErrors, pageErrors);
});

// ── legal/terms ───────────────────────────────────────────────────────────────

test('@non-blocker legal/terms page renders', async ({ page }) => {
  const url = '/en/legal/terms';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  expect(status).toBe(200);

  // TermsPage renders an <h1> with the 'legal.termsTitle' translation key.
  await expect(page.locator('h1').first()).toBeVisible();

  assertNoErrors(url, consoleErrors, pageErrors);
});

// ── docs ──────────────────────────────────────────────────────────────────────

test('@non-blocker docs page renders', async ({ page }) => {
  const url = '/en/docs';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  expect(status).toBe(200);

  // DocsLayout renders an <h1 className="text-h2"> with the 'docs.heroTitle'
  // translation key inside a <header> element. The client component hydrates
  // after navigation; the h1 is present in SSR output too.
  await expect(page.locator('h1').first()).toBeVisible();

  assertNoErrors(url, consoleErrors, pageErrors);
});

// ── demo/accessibility ────────────────────────────────────────────────────────

test('@non-blocker demo/accessibility page renders', async ({ page }) => {
  const url = '/en/demo/accessibility';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  expect(status).toBe(200);

  // AccessibilityDemoPage renders <h1>Accessibility Scanning Demo</h1>.
  // The text is hardcoded (not i18n-translated), so exact matching is stable.
  await expect(page.locator('h1').first()).toBeVisible();

  assertNoErrors(url, consoleErrors, pageErrors);
});

// ── demo/performance ──────────────────────────────────────────────────────────

test('@non-blocker demo/performance page renders', async ({ page }) => {
  const url = '/en/demo/performance';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  expect(status).toBe(200);

  // PerformanceDemoPage renders <h1>File-Specific Performance Suggestions</h1>.
  // Hardcoded copy — asserting h1 visibility is locale-agnostic.
  await expect(page.locator('h1').first()).toBeVisible();

  assertNoErrors(url, consoleErrors, pageErrors);
});

// ── demo/seo ──────────────────────────────────────────────────────────────────

test('@non-blocker demo/seo page renders', async ({ page }) => {
  const url = '/en/demo/seo';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  expect(status).toBe(200);

  // SEO demo page renders <h1 className="text-4xl font-bold mb-2">SEO Scanning Demo</h1>.
  await expect(page.locator('h1').first()).toBeVisible();

  assertNoErrors(url, consoleErrors, pageErrors);
});

// ── error.tsx ─────────────────────────────────────────────────────────────────
//
// Automation: PARTIAL — error.tsx is a Next.js React Error Boundary (`'use client'`).
// It renders only when a component in the [locale] segment throws an unhandled
// error at runtime. There is no navigable URL for it, and triggering an app-level
// error from the test harness would require modifying source files (forbidden by
// this task's files_forbidden constraint) or injecting a special error-trigger
// route (not present in this codebase).
//
// Coverage note: the component is captured in the coverage matrix (static-pages
// smoke batch per qa-checklist.md 🟢 "not-found and error pages render their
// states"). The runtime-trigger half is bounded partial coverage (R8 pattern:
// documented, not silently omitted). A full behavioral test would need a
// dedicated error-trigger page or a test-only route.
test.fixme(
  '@non-blocker error.tsx renders a recoverable error state (PARTIAL — no navigable URL; see inline note)',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async ({ page }) => {
    // To implement the full version: add a route (e.g. /en/test/throw-error)
    // that throws in its Server Component, then navigate to it and assert:
    //   - h1 "Something went wrong" is visible
    //   - "Try again" button is present
    //   - No stack trace leaked in the rendered output
    //   - No uncaught pageerror (the error boundary caught it)
    // Until a test-trigger route exists this test remains fixme/partial.
  },
);

// ── not-found.tsx ─────────────────────────────────────────────────────────────
//
// The [locale]/not-found.tsx calls redirect('/') which next-intl rewrites to
// redirect('/en'). Visiting any non-existent [locale] path exercises this:
// Next.js calls not-found.tsx → redirect('/') → lands on /en (HTTP 200).
// We assert the redirect resolves cleanly (200) and the landing h1 is present.
//
// The not-found component itself has no renderable content (it immediately
// redirects), so asserting the resulting page renders correctly is the correct
// and complete smoke test for this component.

test('@non-blocker not-found.tsx redirects cleanly to the landing page', async ({ page }) => {
  // A clearly non-existent path under /en — this is guaranteed to 404 in
  // Next.js and trigger the [locale]/not-found.tsx redirect chain.
  const url = '/en/this-route-does-not-exist-smoke-test';
  const { status, consoleErrors, pageErrors } = await smokeGoto(page, url);

  // After the redirect chain (not-found.tsx → redirect('/') → /en),
  // the final response is the landing page at 200.
  expect(status).toBe(200);

  // The landing page is now rendered — its primary heading must be visible.
  // We use a broad "heading at level 1" locator rather than coupling to the
  // exact animated hero copy (which may be locale/animation-state dependent).
  await expect(page.locator('h1').first()).toBeVisible();

  // After the redirect the URL must be /en or /en/ — confirm not-found logic ran.
  await expect(page).toHaveURL(/\/en\/?$/);

  assertNoErrors(url, consoleErrors, pageErrors);
});
