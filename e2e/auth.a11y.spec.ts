/**
 * Wave-2 🔴 a11y — Authentication pages axe-core accessibility (T-08, R3).
 *
 * Covers the QA-checklist R3 cases:
 *   • "The login page has no axe-core WCAG A/AA accessibility violations in
 *      its stable state"
 *   • "The signup and verify pages have no axe-core WCAG A/AA violations in
 *      their stable state"
 *
 * Mirrors landing.a11y.spec.ts (separate file from the functional flow specs
 * so a11y can be tagged/filtered independently) but applies the stronger
 * contract the QA checklist mandates for the 🔴 auth pages:
 *
 *   • Ruleset pinned to WCAG 2.0 + 2.1, levels A + AA
 *     (withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])) — not axe's
 *     default "best-practice" superset, so the gate matches the QA contract.
 *   • Analysis SCOPED to the page <main> region (.include('main')) — the
 *     Nav/Footer chrome is shared and tested via the landing suite; this spec
 *     guards the auth surface itself.
 *   • Run ONLY after the page reaches its STABLE asserted state: networkidle
 *     PLUS the form/control the page is "done" rendering is visible. Running
 *     axe before hydration produces false positives (the QA "Fail if axe runs
 *     before the stable state" clause).
 *   • Pre-existing color-contrast noise is the ONLY allow-listed rule, and it
 *     is LOGGED (console.warn with the offending nodes) every run — never
 *     silently disabled. Any color-contrast finding is surfaced in output so a
 *     real regression is still visible; it just does not fail the gate. EVERY
 *     OTHER WCAG A/AA violation fails.
 *
 * Tagging: @functional — an a11y regression at WCAG A/AA on an auth page is a
 * real functional regression (a screen-reader user cannot sign in) but is not
 * the same class as a total page blackout, matching landing.a11y.spec.ts and
 * the qa-checklist tier for these R3 cases.
 *
 * The verify page here is the domain-ownership /verify page (the QA "verify"
 * R3 target): it requires an authenticated session, so this spec seeds its
 * OWN dedicated unique-email user and tears it down in afterAll
 * (TIER-ISOLATION RULE, auth-seed.ts). login + signup are unauthenticated and
 * need no seed.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuthUser, uniqueEmail, authStorageState, type SeededAuth } from './support/auth-seed';
import {
  LOGIN_FORM,
  LOGIN_SUBMIT,
  SIGNUP_FORM,
  SIGNUP_SUBMIT,
  VERIFY_DOMAIN_FORM,
  VERIFY_DOMAIN_SUBMIT,
  byTestId,
} from './support/selectors';

// The exact, documented allow-list. ONLY pre-existing color-contrast noise is
// tolerated (the same pragmatic stance landing.a11y.spec.ts takes on
// minor/moderate). It is never silently dropped — runColorContrastAware()
// logs every allow-listed finding with its nodes so a real contrast
// regression is still visible in the run output.
const ALLOWLISTED_RULES = new Set<string>(['color-contrast']);

// Pin the ruleset to exactly WCAG 2.0/2.1 levels A + AA, as the QA checklist
// requires — NOT axe's default (which folds in best-practice rules that are
// not WCAG A/AA and would over-block).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Run axe scoped to <main>, pinned to WCAG A/AA, on a page already in its
 * stable asserted state. color-contrast violations are logged (never silently
 * disabled) and excluded from the failing set; every other WCAG A/AA
 * violation fails the test.
 */
async function expectNoWcagViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    // Scope to the page main region — shared Nav/Footer chrome is covered by
    // the landing a11y suite; this spec guards the auth surface itself.
    .include('main')
    .withTags(WCAG_TAGS)
    .analyze();

  const allowlisted = results.violations.filter((v) => ALLOWLISTED_RULES.has(v.id));
  const failing = results.violations.filter((v) => !ALLOWLISTED_RULES.has(v.id));

  // LOG every allow-listed finding — the QA contract is explicit that the
  // color-contrast allow-list must be logged, never silently disabled. This
  // keeps a real contrast regression visible in the run output even though it
  // does not fail the gate.
  if (allowlisted.length > 0) {
    const summary = allowlisted
      .map((v) => {
        const nodes = v.nodes
          .slice(0, 5)
          .map((n) => n.target.join(', '))
          .join(' | ');
        return `  [allow-listed] ${v.id} (${v.impact ?? 'n/a'}): ${v.description} — nodes: ${nodes}`;
      })
      .join('\n');
    // eslint-disable-next-line no-console
    console.warn(
      `[a11y allow-list] ${label}: ${allowlisted.length} pre-existing ` +
        `color-contrast finding(s) tolerated but NOT silenced:\n${summary}`,
    );
  }

  const failSummary = failing
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(', '))
        .join(' | ');
      return `[${v.impact ?? 'n/a'}] ${v.id}: ${v.description} — nodes: ${nodes}`;
    })
    .join('\n');

  expect(
    failing,
    `${label}: ${failing.length} WCAG A/AA violation(s) not on the documented ` +
      `color-contrast allow-list:\n${failSummary}`,
  ).toHaveLength(0);
}

// ── Login (unauthenticated — no seed) ───────────────────────────────────────
test('@functional The login page has no WCAG A/AA axe violations in its stable state', async ({
  page,
}) => {
  await page.goto('/en/login');
  // Stable asserted state: networkidle + the credentials form AND its submit
  // visibly rendered (the Suspense fallback has resolved and React hydrated).
  await page.waitForLoadState('networkidle');
  await expect(byTestId(page, LOGIN_FORM)).toBeVisible();
  await expect(byTestId(page, LOGIN_SUBMIT)).toBeVisible();

  await expectNoWcagViolations(page, '/en/login');
});

// ── Signup (unauthenticated — no seed) ──────────────────────────────────────
test('@functional The signup page has no WCAG A/AA axe violations in its stable state', async ({
  page,
}) => {
  await page.goto('/en/signup');
  await page.waitForLoadState('networkidle');
  await expect(byTestId(page, SIGNUP_FORM)).toBeVisible();
  await expect(byTestId(page, SIGNUP_SUBMIT)).toBeVisible();

  await expectNoWcagViolations(page, '/en/signup');
});

// ── Verify (domain-ownership page — requires an authenticated session) ──────
test.describe('verify page a11y', () => {
  // /{locale}/verify redirects unauthenticated requests to /login, so this
  // case seeds its OWN dedicated unique-email user (TIER-ISOLATION RULE) and
  // tears it down in afterAll. With no ?domain= the page renders the stable
  // DomainEntry form (the stable asserted state for the R3 scan).
  let seeded: SeededAuth;

  test.beforeAll(async () => {
    seeded = await seedAuthUser({ email: uniqueEmail('verify-a11y'), emailVerified: true });
  });

  test.afterAll(async () => {
    if (seeded) await seeded.cleanup();
  });

  test('@functional The domain-verify page has no WCAG A/AA axe violations in its stable state', async ({
    browser,
    baseURL,
  }) => {
    // Build the authenticated context HERE with authStorageState() — the
    // single-home cookie constructor from auth-seed.ts. A file-level
    // test.use({ storageState }) is evaluated at collection time, before
    // beforeAll, so the token is not yet known there (same rationale as
    // probe.spec.ts). browser.newContext() accepts the StorageState return
    // value directly, so no inline cookie literal is needed.
    const context = await browser.newContext({
      baseURL: baseURL ?? 'http://localhost:3000',
      storageState: authStorageState(seeded.sessionToken),
    });
    const page = await context.newPage();
    try {
      await page.goto('/en/verify');
      expect(page.url(), 'Authenticated /verify redirected to login.').not.toMatch(/\/login/);
      await page.waitForLoadState('networkidle');
      // Stable asserted state: the domain-entry form + its submit are visible.
      await expect(byTestId(page, VERIFY_DOMAIN_FORM)).toBeVisible();
      await expect(byTestId(page, VERIFY_DOMAIN_SUBMIT)).toBeVisible();

      await expectNoWcagViolations(page, '/en/verify');
    } finally {
      await context.close();
    }
  });
});
