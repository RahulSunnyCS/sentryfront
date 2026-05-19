/**
 * Wave-2 🟡 a11y — Active-Test (DAST) page axe-core accessibility (T-10, R3).
 *
 * Covers the qa-checklist R3 case:
 *   "The active-test page has no axe-core WCAG A/AA violations in its stable
 *    state"
 *
 * The active-test page (src/app/[locale]/active-test/page.tsx) has TWO stable,
 * server-rendered states post-T-19, and a screen-reader user must be able to
 * operate BOTH, so this spec scans both:
 *
 *   1. BELOW-TIER (free) → the ActiveTestUpgradePrompt is rendered instead of
 *      the wizard. This is a static server-rendered <section> (no client
 *      hydration, no transitions) — a genuinely stable view.
 *   2. ENTITLED (one-shot) → <ActiveTestFlow> Step 1 ("What should we
 *      attack?") is rendered. Step 1 (the domain target form) is the stable
 *      asserted state — we do NOT advance the wizard (Steps 2–5 are
 *      transitional / network-driven and explicitly out of the "stable state"
 *      contract; the qa checklist requires axe to run post-stable-state, never
 *      mid-transition).
 *
 * Mirrors auth.a11y.spec.ts exactly (the established Wave-2 R3 pattern):
 *   • Ruleset pinned to WCAG 2.0 + 2.1, levels A + AA (withTags) — not axe's
 *     default best-practice superset, so the gate matches the QA contract.
 *   • Analysis SCOPED to the page <main> region (.include('main')) — the
 *     shared Nav/Footer chrome is covered by the landing a11y suite; this spec
 *     guards the active-test surface itself.
 *   • Run ONLY after the page reaches its STABLE asserted state: networkidle
 *     PLUS the state-defining element visibly rendered (the upgrade prompt for
 *     free, the Step 1 domain input for entitled).
 *   • Pre-existing color-contrast noise is the ONLY allow-listed rule, and it
 *     is LOGGED every run (console.warn with the offending nodes) — never
 *     silently disabled. Every OTHER WCAG A/AA violation fails the test.
 *
 * Tagging: @functional — an a11y regression at WCAG A/AA on the active-test
 * page is a real functional regression (a screen-reader user cannot start a
 * DAST scan, or cannot read why they are blocked) but is not the same class as
 * a total page blackout. This matches auth.a11y.spec.ts and the qa-checklist
 * tier for the active-test R3 case (🟡).
 *
 * Tier-isolation: /{locale}/active-test is a protected segment (anonymous
 * visitors are middleware-redirected to login), AND both states are
 * tier-sensitive. Each describe seeds its OWN dedicated unique-email user at
 * the required tier and tears it down in afterAll (TIER-ISOLATION RULE,
 * auth-seed.ts) — never a shared/global user.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  seedAuthUser,
  uniqueEmail,
  type SeededAuth,
  type StorageState,
} from './support/auth-seed';
import { ACTIVE_TEST_DOMAIN_INPUT, byTestId } from './support/selectors';

const ACTIVE_TEST_PATH = '/en/active-test';

// data-testid of the server-rendered upgrade prompt T-19 added in
// src/app/[locale]/active-test/page.tsx. Referenced inline ONLY because
// e2e/support/** (selectors.ts) is in this task's files_forbidden scope — the
// "no inline literals" architecture memo governs NEW testids the suite adds to
// product code; this one already ships from T-19 and the single-home file is
// out of scope for T-10 (a later task can centralise it in one edit).
const UPGRADE_PROMPT_TESTID = 'active-test-upgrade-prompt';

// The exact, documented allow-list — identical stance to auth.a11y.spec.ts /
// landing.a11y.spec.ts. ONLY pre-existing color-contrast noise is tolerated,
// and it is logged every run (runColorContrastAware below), never silently
// dropped, so a real contrast regression is still visible in the output.
const ALLOWLISTED_RULES = new Set<string>(['color-contrast']);

// Pin the ruleset to exactly WCAG 2.0/2.1 levels A + AA, as the QA checklist
// requires — NOT axe's default (which folds in best-practice rules that are
// not WCAG A/AA and would over-block).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Run axe scoped to <main>, pinned to WCAG A/AA, on a page already in its
 * stable asserted state. color-contrast violations are logged (never silently
 * disabled) and excluded from the failing set; every other WCAG A/AA
 * violation fails the test. Verbatim shape of auth.a11y.spec.ts's helper so
 * the two R3 specs stay consistent.
 */
async function expectNoWcagViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(WCAG_TAGS)
    .analyze();

  const allowlisted = results.violations.filter((v) => ALLOWLISTED_RULES.has(v.id));
  const failing = results.violations.filter((v) => !ALLOWLISTED_RULES.has(v.id));

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

/** storageState cookie for a seeded DB session (see auth-seed.ts contract). */
function sessionStorageState(sessionToken: string): StorageState {
  return {
    cookies: [
      {
        name: 'next-auth.session-token',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        expires: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  };
}

// ── State 1: BELOW-TIER (free) — the upgrade-prompt stable view ─────────────
test.describe('active-test a11y — free (upgrade-prompt) state', () => {
  let seeded: SeededAuth;

  test.beforeAll(async () => {
    seeded = await seedAuthUser({ email: uniqueEmail('active-a11y-free'), tier: 'free' });
  });

  test.afterAll(async () => {
    if (seeded) await seeded.cleanup();
  });

  test('@functional The active-test upgrade-prompt (free) has no WCAG A/AA axe violations', async ({
    browser,
    baseURL,
  }) => {
    // Build the authenticated context HERE — a file-level test.use() is
    // evaluated at collection time, before beforeAll, so the seeded token is
    // not yet known there (same rationale as auth.a11y.spec.ts).
    const context = await browser.newContext({
      baseURL: baseURL ?? 'http://localhost:3000',
      storageState: sessionStorageState(seeded.sessionToken),
    });
    const page = await context.newPage();
    try {
      await page.goto(ACTIVE_TEST_PATH);
      expect(page.url(), 'authenticated free user redirected to login').not.toMatch(/\/login/);
      await page.waitForLoadState('networkidle');
      // Stable asserted state: the server-rendered upgrade prompt is visible
      // (this view has no client hydration / transitions — it is stable as
      // soon as it is in the DOM).
      await expect(byTestId(page, UPGRADE_PROMPT_TESTID)).toBeVisible();

      await expectNoWcagViolations(page, '/en/active-test (free upgrade-prompt)');
    } finally {
      await context.close();
    }
  });
});

// ── State 2: ENTITLED (one-shot) — the DAST wizard Step 1 stable view ───────
test.describe('active-test a11y — entitled (DAST wizard) state', () => {
  let seeded: SeededAuth;

  test.beforeAll(async () => {
    // 'one-shot' is the minimum entitled tier (the gate threshold). One stable
    // entitled tier is sufficient for the a11y scan — the both-directions tier
    // *behaviour* is exhaustively asserted in active-test.spec.ts; this scan
    // only needs the wizard's stable rendered markup, which is identical for
    // every entitled tier.
    seeded = await seedAuthUser({ email: uniqueEmail('active-a11y-entitled'), tier: 'one-shot' });
  });

  test.afterAll(async () => {
    if (seeded) await seeded.cleanup();
  });

  test('@functional The active-test DAST wizard (entitled, Step 1) has no WCAG A/AA axe violations', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL: baseURL ?? 'http://localhost:3000',
      storageState: sessionStorageState(seeded.sessionToken),
    });
    const page = await context.newPage();
    try {
      await page.goto(ACTIVE_TEST_PATH);
      expect(page.url(), 'authenticated entitled user redirected to login').not.toMatch(
        /\/login/,
      );
      await page.waitForLoadState('networkidle');
      // Stable asserted state: ActiveTestFlow Step 1's domain input is visible
      // (React has hydrated and the wizard's initial step is rendered). We do
      // NOT advance to Steps 2–5 — those are network-driven transitional
      // states, explicitly outside the "stable state" the R3 contract scans.
      await expect(byTestId(page, ACTIVE_TEST_DOMAIN_INPUT)).toBeVisible();

      await expectNoWcagViolations(page, '/en/active-test (entitled wizard Step 1)');
    } finally {
      await context.close();
    }
  });
});
