/**
 * Wave-2 🟡 a11y — Checkout pricing + success axe-core accessibility (T-09, R3).
 *
 * Covers the qa-checklist R3 case:
 *   • "The checkout/pricing and checkout/success pages have no axe-core WCAG
 *      A/AA violations in their stable state"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAYER NOTE (why the bypass tier-mutation 🔴 cases are NOT here)
 * ─────────────────────────────────────────────────────────────────────────────
 * This file only does accessibility scans of the two genuinely-reachable
 * pages (/en/pricing and /en/checkout/success). The PAYMENT_TEST_FLOW bypass
 * tier-mutation @critical outcomes are asserted at the Vitest integration
 * layer (src/app/api/v1/checkout/__tests__/payment-test-flow-outcomes.test.ts),
 * NOT in any E2E spec, because a process-level env var cannot be set per-test
 * on the single shared `npm run dev` server playwright.config.ts launches
 * (the constraint memo / Phase-1 C4 decision forbid setting it globally) —
 * the exact same per-spec-env-on-a-shared-server impossibility T-01 resolved
 * by moving its assertions to Vitest. checkout/success here is reached the
 * genuinely-reachable way: a direct visit with ?test=true&tier=<t> (the page
 * renders purely from searchParams), so no server-side bypass is needed.
 *
 * Mirrors auth.a11y.spec.ts (the established R3 pattern in this suite):
 *   • Ruleset pinned to WCAG 2.0 + 2.1, levels A + AA
 *     (withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])) — not axe's
 *     default best-practice superset, so the gate matches the QA contract.
 *   • Analysis SCOPED to the page <main> region (.include('main')) — shared
 *     Nav/Footer chrome is covered by the landing a11y suite; this spec guards
 *     the checkout surface itself.
 *   • Run ONLY after the page reaches its STABLE asserted state: networkidle
 *     PLUS the page's "done rendering" landmark control is visible. Running
 *     axe before hydration produces false positives (the QA "Fail if axe runs
 *     before the stable state" clause).
 *   • Pre-existing color-contrast noise is the ONLY allow-listed rule and it
 *     is LOGGED every run (console.warn with the offending nodes) — never
 *     silently disabled. Every other WCAG A/AA violation fails.
 *
 * Tagging: @functional — matches auth.a11y.spec.ts and the qa-checklist tier
 * for the R3 checkout case (an a11y regression on the pricing/success surface
 * is a real functional regression, but not a total page blackout).
 *
 * Neither page requires authentication: /en/pricing is public and
 * /en/checkout/success renders from searchParams alone — so this spec needs
 * NO seeded user (the TIER-ISOLATION RULE only binds tier-sensitive specs).
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PRICING_CARD, CHECKOUT_SUCCESS, byTestId } from './support/selectors';

// The exact, documented allow-list. ONLY pre-existing color-contrast noise is
// tolerated (the same pragmatic stance landing.a11y.spec.ts / auth.a11y.spec.ts
// take). It is never silently dropped — expectNoWcagViolations() logs every
// allow-listed finding with its nodes so a real contrast regression is still
// visible in the run output.
const ALLOWLISTED_RULES = new Set<string>(['color-contrast']);

// Pin the ruleset to exactly WCAG 2.0/2.1 levels A + AA, as the QA checklist
// requires — NOT axe's default (which folds in best-practice rules that are
// not WCAG A/AA and would over-block).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Run axe scoped to <main>, pinned to WCAG A/AA, on a page already in its
 * stable asserted state. color-contrast violations are logged (never silently
 * disabled) and excluded from the failing set; every other WCAG A/AA
 * violation fails the test. Identical contract to auth.a11y.spec.ts.
 */
async function expectNoWcagViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    // Scope to the page main region — shared Nav/Footer chrome is covered by
    // the landing a11y suite; this spec guards the checkout surface itself.
    .include('main')
    .withTags(WCAG_TAGS)
    .analyze();

  const allowlisted = results.violations.filter((v) => ALLOWLISTED_RULES.has(v.id));
  const failing = results.violations.filter((v) => !ALLOWLISTED_RULES.has(v.id));

  // LOG every allow-listed finding — the QA contract is explicit that the
  // color-contrast allow-list must be logged, never silently disabled. Keeps a
  // real contrast regression visible in the run output even though it does not
  // fail the gate.
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

// ── Pricing (public — no seed) ──────────────────────────────────────────────
test('@functional The pricing page has no WCAG A/AA axe violations in its stable state', async ({
  page,
}) => {
  await page.goto('/en/pricing');
  // Stable asserted state: networkidle + all three pricing-cards visibly
  // rendered (the server-rendered tier grid is fully present).
  await page.waitForLoadState('networkidle');
  await expect(byTestId(page, PRICING_CARD).first()).toBeVisible();
  await expect(byTestId(page, PRICING_CARD)).toHaveCount(3);

  await expectNoWcagViolations(page, '/en/pricing');
});

// ── checkout/success (renders from searchParams — no seed, no bypass) ────────
test('@functional The checkout/success page has no WCAG A/AA axe violations in its stable state', async ({
  page,
}) => {
  // Reached the genuinely-reachable way: a direct visit with the exact query
  // the test bypass would redirect to. The page renders purely from
  // searchParams, so this reproduces the post-upgrade confirmation surface
  // without needing the server-side bypass to have executed.
  await page.goto('/en/checkout/success?test=true&tier=pro');
  await page.waitForLoadState('networkidle');
  // Stable asserted state: the confirmation card is rendered.
  await expect(byTestId(page, CHECKOUT_SUCCESS)).toBeVisible();

  await expectNoWcagViolations(page, '/en/checkout/success');
});
