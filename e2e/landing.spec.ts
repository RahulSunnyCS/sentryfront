/**
 * Landing-page E2E tests — non-hermetic (real /api/v1/scans backend).
 *
 * Design notes:
 *  - NO page.route / request interception anywhere (Gate-1 decision D1).
 *    Real POSTs are observed with page.waitForRequest; they are never stubbed.
 *  - page.waitForRequest is set up BEFORE the submit click so the request
 *    cannot slip past before the listener is registered.
 *  - waitForURL uses a regex that matches only the path segment to avoid
 *    coupling the assertion to the query-string (?url=...) which is always
 *    present but irrelevant to the navigation assertion.
 *  - Console-error / pageerror listeners are registered before goto so that
 *    any error fired during the initial page load is captured.
 *  - The axe a11y test lives in landing.a11y.spec.ts to keep functional flow
 *    tests and accessibility tests in separate files (easier to tag and filter).
 */

import { test, expect } from '@playwright/test';
import { byTestId, HERO_URL_INPUT, HERO_SCAN_SUBMIT, FINAL_CTA_PRICING } from './support/selectors';

// AR-H1: Known-harmless console patterns filtered before asserting zero errors.
// Without this filter, React DevTools banners, Next.js Fast Refresh messages,
// and ResizeObserver loop warnings (which Chrome throttles harmlessly) all flip
// the flagship @critical test red on dev-mode noise — not real breakages.
// The pageerror (uncaught JS exception) check is intentionally kept strict and
// unfiltered; a real exception always means something broke.
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

// ── Test 1: @critical landing page renders ─────────────────────────────────
test('@critical landing page renders', async ({ page }) => {
  // Collect any console errors and uncaught page exceptions that occur
  // during the initial page load — before any interaction.
  // We attach the listeners BEFORE navigation so nothing is missed.
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

  await page.goto('/en');

  // The hero heading is rendered by HeroHeadlineAnim inside a <section
  // aria-labelledby="hero-heading">. The component ultimately renders an
  // element with id="hero-heading". We target it by id rather than text
  // because the copy is animated / locale-dependent.
  await expect(page.locator('#hero-heading')).toBeVisible();

  // Core interactive elements that must be present for the scan flow.
  await expect(byTestId(page, HERO_URL_INPUT)).toBeVisible();
  await expect(byTestId(page, HERO_SCAN_SUBMIT)).toBeVisible();

  // AR-L1: Scope the navigation locator to its accessible name so that
  // future nav landmarks (docs sidebar, breadcrumbs) don't cause a
  // strict-mode ambiguity. The Nav component sets aria-label={t('primary')}
  // which resolves to "Primary" in en.json — matched case-insensitively for
  // locale tolerance.
  await expect(page.getByRole('navigation', { name: /primary/i })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();

  // AR-H1: Filter known-harmless dev-mode console noise before asserting.
  // Any console.error not in BENIGN_CONSOLE is an unexpected breakage.
  const unexpectedConsoleErrors = consoleErrors.filter((msg) => !isBenignConsoleMessage(msg));
  expect(
    unexpectedConsoleErrors,
    `Unexpected console errors on /en: ${JSON.stringify(unexpectedConsoleErrors)}`,
  ).toEqual([]);

  // Uncaught JS exceptions are always unexpected — no filter applied.
  expect(pageErrors, `Unexpected page errors on /en: ${JSON.stringify(pageErrors)}`).toEqual([]);
});

// ── Test 2: @critical critical path starts a real scan ─────────────────────
test('@critical critical path starts a real scan', async ({ page }) => {
  await page.goto('/en');

  // Register the request watcher BEFORE triggering the submit so the
  // listener is in place before the fetch fires. The predicate matches any
  // POST to /api/v1/scans regardless of origin prefix.
  const reqPromise = page.waitForRequest(
    (r) => r.url().includes('/api/v1/scans') && r.method() === 'POST',
  );

  await byTestId(page, HERO_URL_INPUT).fill('https://example.com');
  await byTestId(page, HERO_SCAN_SUBMIT).click();

  // Await the real outgoing request — createScan() in lib/api.ts posts
  // { url } as JSON.
  const req = await reqPromise;
  expect(req.postDataJSON()).toMatchObject({ url: 'https://example.com' });

  // After the 201 response the client calls router.push('/scan/<id>?url=...')
  // which next-intl prefixes to '/en/scan/<id>'. The regex excludes the '?'
  // so it matches the path segment only, making the assertion stable
  // regardless of query-string changes.
  await page.waitForURL(/\/en\/scan\/[^/?]+/);
  // No assertions on destination page content (non-hermetic: scan is async).
});

// ── Test 3: @functional empty input defaults to example.com ────────────────
test('@functional empty input defaults to example.com', async ({ page }) => {
  await page.goto('/en');

  // Ensure the input is empty. fill('') clears the field.
  await byTestId(page, HERO_URL_INPUT).fill('');

  // Watcher before submit — same pattern as the critical path test.
  const reqPromise = page.waitForRequest(
    (r) => r.url().includes('/api/v1/scans') && r.method() === 'POST',
  );

  await byTestId(page, HERO_SCAN_SUBMIT).click();

  const req = await reqPromise;

  // landing-hero.tsx line 89: `const target = url.trim() || 'example.com'`
  // Empty / whitespace input is coerced to 'example.com' before the POST.
  expect(req.postDataJSON()).toMatchObject({ url: 'example.com' });

  await page.waitForURL(/\/en\/scan\/[^/?]+/);
});

// ── Test 4: @functional final CTA pricing link navigates to pricing ─────────
test('@functional final CTA pricing link navigates to pricing', async ({ page }) => {
  await page.goto('/en');

  // The FinalCTASection at the bottom of the page contains a Link with
  // data-testid="final-cta-pricing" pointing to /pricing (next-intl will
  // prefix it to /en/pricing).
  await byTestId(page, FINAL_CTA_PRICING).click();

  // Accept both /en/pricing and /en/pricing/ to be resilient to trailing
  // slash configuration differences.
  await expect(page).toHaveURL(/\/en\/pricing\/?$/);
});

// ── Test 5: @functional root redirects to localized landing ─────────────────
test('@functional root redirects to localized landing', async ({ page }) => {
  // next-intl is configured with localePrefix: 'always' and defaultLocale:
  // 'en', so / must redirect to /en (or /en/).
  await page.goto('/');

  await expect(page).toHaveURL(/\/en\/?$/);
});

// ── Test 6: @non-blocker weekly counter and FAQ ─────────────────────────────
test('@non-blocker weekly counter and FAQ open state', async ({ page }) => {
  await page.goto('/en');

  // The weekly-counter paragraph has aria-live="polite" and renders text
  // like "0 sites scanned this week" or "1,234 sites scanned this week".
  // We assert it contains at least one digit — the real
  // GET /api/v1/stats/scan-count is allowed to return 0.
  const counterParagraph = page.locator('[aria-live="polite"]');
  await expect(counterParagraph).toBeVisible();
  // Wait for the counter text to settle (useEffect fires after hydration).
  await expect(counterParagraph).toContainText(/\d/);

  // The FAQSection renders <details> elements; index 0 has the `open`
  // attribute hardcoded (`open={i === 0}` in landing-hero.tsx line 755).
  // We check the DOM attribute rather than rely on any visible-text
  // content so this stays locale-agnostic.
  const firstDetails = page.locator('#faq details').first();
  await expect(firstDetails).toHaveAttribute('open');
});
