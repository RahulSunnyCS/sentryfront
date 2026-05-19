/**
 * Wave-2 🔴/🟡 — Checkout & Pricing functional E2E (T-09).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAYER SPLIT — which qa-checklist "Payments — Checkout" case is asserted WHERE
 * ─────────────────────────────────────────────────────────────────────────────
 * The qa-checklist 🔴 @critical PAYMENT_TEST_FLOW bypass *tier-mutation*
 * outcomes (one-shot +1 / pro +5 one-time / studio subscription +0 / unauth
 * → 401) are NOT in this file. They are asserted at the Vitest integration
 * layer in src/app/api/v1/checkout/__tests__/payment-test-flow-outcomes.test.ts.
 *
 * WHY: those outcomes require `PAYMENT_TEST_FLOW=true` set IN THE SERVER
 * PROCESS for that one request. The Playwright suite runs a SINGLE shared
 * `npm run dev` server (playwright.config.ts `webServer`, non-hermetic by
 * design). A process-level env var cannot be toggled per-test on one shared
 * long-lived server, and the Phase-1 constraint memo / the C4 decision
 * explicitly forbid setting PAYMENT_TEST_FLOW globally on it (that would put
 * every tier-sensitive spec AND the T-01 production-guard regression under a
 * tier-mutating bypass). This is the exact same per-spec-env-on-a-shared-server
 * impossibility T-01 already resolved by asserting at the Vitest layer — this
 * file follows that established, accepted precedent and covers ONLY what is
 * genuinely reachable against the real running server.
 *
 * This file therefore asserts:
 *   • 🟡 "The pricing page renders all tier cards and their CTAs" — reachable:
 *     /en/pricing is a public page. Tier NAMES + features + a checkout-button
 *     CTA per card. NEVER any dollar amount (May-2026 pricing pivot).
 *   • 🟡 "The checkout/success page renders an entitlement confirmation" —
 *     reachable: checkout/success renders purely from searchParams
 *     (?test=true&tier=<t>), so a direct visit reproduces the post-bypass
 *     confirmation WITHOUT needing the server-side bypass to have run.
 *   • 🔴 "When payments are disabled the checkout route returns 404 gracefully
 *     ... surfaced gracefully in the UI (not a crash)" — reachable: with NO
 *     PAYMENT_TEST_FLOW and Stripe unconfigured (the running dev server's real
 *     state), an authenticated checkout POST hits the route's payments-disabled
 *     404 branch. We drive it through the real checkout-button UI and assert
 *     the UI degrades gracefully (no white screen / no uncaught pageerror, the
 *     confirm control recovers) rather than crashing.
 *
 * Tier-isolation: the payments-disabled case needs an authenticated session,
 * so it seeds its OWN dedicated unique-email user via auth-seed and tears it
 * down in afterAll (TIER-ISOLATION RULE, auth-seed.ts) — never a shared user.
 * The pricing + success cases are unauthenticated and need no seed.
 */

import { test, expect } from '@playwright/test';
import { seedAuthUser, uniqueEmail, type SeededAuth } from './support/auth-seed';
import {
  PRICING_CARD,
  CHECKOUT_BUTTON,
  CHECKOUT_MODAL,
  CHECKOUT_CONFIRM,
  CHECKOUT_SUCCESS,
  byTestId,
} from './support/selectors';

// next-intl renders pricing copy from messages/en.json. We assert on the
// stable, locale-independent STRUCTURE (one pricing-card per tier, each with a
// checkout-button) rather than translated marketing strings, mirroring the
// structural style of landing.spec.ts. The three product tiers map to the
// pricing page's three PricingCard ids (verify / activePack / monitor →
// one-shot / pro / studio).
const EXPECTED_PRICING_CARDS = 3;

// A dollar/price regex used ONLY to PROVE we are not surfacing amounts in the
// asserted region (May-2026 pivot: pricing is in flux, dollar amounts must not
// be asserted as correct). NOTE: this is a negative guard on the card CTA
// label, not an assertion that amounts are absent from the whole page (the
// page still renders $0 placeholders + JSON-LD); we only assert the CTA
// behaviour, never an amount.
const DOLLAR_AMOUNT = /\$\s?\d/;

// ── 🟡 Pricing page renders all tier cards + CTAs ────────────────────────────
test('@functional The pricing page renders all tier cards and their checkout CTAs', async ({
  page,
}) => {
  const resp = await page.goto('/en/pricing');
  expect(resp?.status(), 'pricing page did not return 200').toBe(200);
  await page.waitForLoadState('networkidle');

  const cards = byTestId(page, PRICING_CARD);
  await expect(
    cards,
    'expected one pricing-card per product tier (one-shot / pro / studio)',
  ).toHaveCount(EXPECTED_PRICING_CARDS);

  // Every card must expose its checkout CTA. We assert presence + that the CTA
  // is enabled/clickable — NOT its price. The button label is product copy; we
  // only verify it does NOT itself assert a dollar amount as the headline CTA
  // (the contract: never assert dollar amounts; the pivot is in flux).
  const buttons = byTestId(page, CHECKOUT_BUTTON);
  await expect(buttons).toHaveCount(EXPECTED_PRICING_CARDS);

  for (let i = 0; i < EXPECTED_PRICING_CARDS; i++) {
    const card = cards.nth(i);
    const cta = card.getByTestId(CHECKOUT_BUTTON);
    await expect(cta, `pricing-card #${i} is missing its checkout CTA`).toBeVisible();
    await expect(cta, `pricing-card #${i} checkout CTA is not actionable`).toBeEnabled();

    const ctaLabel = (await cta.textContent())?.trim() ?? '';
    expect(
      ctaLabel.length,
      `pricing-card #${i} checkout CTA has no label`,
    ).toBeGreaterThan(0);
    // Negative guard: the CTA itself must not be a bare price (we assert tier
    // behaviour / CTA presence only, never a dollar amount — May-2026 pivot).
    expect(
      DOLLAR_AMOUNT.test(ctaLabel),
      `pricing-card #${i} CTA label "${ctaLabel}" looks like a dollar amount — ` +
        `do not assert amounts (May-2026 pricing pivot in flux)`,
    ).toBe(false);
  }
});

// ── 🟡 checkout/success renders the entitlement confirmation ─────────────────
// The page renders purely from searchParams (src/app/[locale]/checkout/success
// → reads searchParams.test / searchParams.tier). A direct visit with the
// exact query the bypass would have redirected to reproduces the post-upgrade
// confirmation WITHOUT needing the server-side bypass to have executed — this
// is the genuinely-reachable slice of the bypass success outcome.
for (const tier of ['one-shot', 'pro', 'studio'] as const) {
  test(`@functional checkout/success renders the confirmation for tier "${tier}" (test bypass return)`, async ({
    page,
  }) => {
    const resp = await page.goto(`/en/checkout/success?test=true&tier=${tier}`);
    expect(resp?.status(), 'checkout/success did not return 200').toBe(200);
    await page.waitForLoadState('networkidle');

    const card = byTestId(page, CHECKOUT_SUCCESS);
    await expect(card, 'checkout/success confirmation card not rendered').toBeVisible();

    // Test-mode badge proves the test=true branch (no real charge) rendered.
    await expect(
      card.getByText(/test mode/i),
      'test-mode "no charge" badge missing on a ?test=true return',
    ).toBeVisible();

    // The tier label is rendered ("<Tier> activated") — assert the activation
    // heading exists; do NOT assert any price/amount (May-2026 pivot).
    await expect(
      card.getByRole('heading', { level: 1 }),
      'activation heading missing on checkout/success',
    ).toBeVisible();

    // Recovery affordances must be present so a successfully-upgraded user is
    // not stranded on the confirmation page.
    await expect(card.getByRole('link', { name: /dashboard/i })).toBeVisible();
  });
}

// ── 🔴 Payments disabled → 404, surfaced gracefully in the UI (no crash) ─────
test.describe('payments-disabled checkout (no PAYMENT_TEST_FLOW, Stripe unconfigured)', () => {
  // Needs a real authenticated session so the request reaches the route's
  // post-tier-validation branch the way a real user would. Seeds its OWN
  // dedicated unique-email user (TIER-ISOLATION RULE) and tears it down in
  // afterAll — never a shared/global user.
  let seeded: SeededAuth;

  test.beforeAll(async () => {
    seeded = await seedAuthUser({
      email: uniqueEmail('checkout-disabled'),
      tier: 'free',
      emailVerified: true,
    });
  });

  test.afterAll(async () => {
    if (seeded) await seeded.cleanup();
  });

  test('@critical authenticated checkout with payments disabled → 404 surfaced gracefully (no crash, tier unchanged)', async ({
    browser,
    baseURL,
  }) => {
    // Build the authenticated context HERE with the real seeded token — a
    // file-level test.use({ storageState }) is evaluated at collection time,
    // before beforeAll, so the token is not yet known there (same rationale as
    // probe.spec.ts / auth.a11y.spec.ts).
    const context = await browser.newContext({
      baseURL: baseURL ?? 'http://localhost:3000',
      storageState: {
        cookies: [
          {
            name: 'next-auth.session-token',
            value: seeded.sessionToken,
            domain: 'localhost',
            path: '/',
            expires: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
    });
    const page = await context.newPage();

    // A crash would manifest as an uncaught page exception / the React tree
    // unmounting (white screen). Capture pageerror unfiltered — an uncaught
    // exception here is always a real crash, never benign noise.
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    try {
      await page.goto('/en/pricing');
      await page.waitForLoadState('networkidle');

      // Drive the real checkout-button → confirm UI for the first tier card.
      // With NO PAYMENT_TEST_FLOW and Stripe unconfigured (the running dev
      // server's real state), POST /api/v1/checkout returns the route's
      // payments-disabled 404 branch.
      const firstCard = byTestId(page, PRICING_CARD).first();
      await firstCard.getByTestId(CHECKOUT_BUTTON).click();

      const modal = byTestId(page, CHECKOUT_MODAL);
      await expect(modal, 'checkout confirm modal did not open').toBeVisible();

      // Assert the underlying route really is the 404 payments-disabled branch
      // (status + the canonical not-enabled error body) by observing the
      // request the confirm button makes — proves we exercised the genuine
      // payments-disabled path, not the bypass.
      const [checkoutResponse] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/checkout') && r.request().method() === 'POST',
        ),
        modal.getByTestId(CHECKOUT_CONFIRM).click(),
      ]);
      expect(
        checkoutResponse.status(),
        'expected the payments-disabled 404 branch (no flag, Stripe unconfigured)',
      ).toBe(404);

      // GRACEFUL DEGRADATION (the 🔴 contract): the UI must NOT crash. The
      // checkout-button handler sees a falsy data.url and re-enables the
      // confirm control; the modal stays mounted, the page stays alive, and no
      // uncaught exception / white screen occurs.
      await expect(
        modal,
        'modal vanished — UI did not handle the 404 gracefully',
      ).toBeVisible();
      await expect(
        modal.getByTestId(CHECKOUT_CONFIRM),
        'confirm control did not recover (stuck busy) after the 404 — not graceful',
      ).toBeEnabled();
      // Page chrome is still rendered → no white-screen crash.
      await expect(page.locator('body')).toBeVisible();
      await expect(byTestId(page, PRICING_CARD).first()).toBeVisible();
      expect(
        pageErrors,
        `payments-disabled checkout caused an uncaught page error (a crash): ${JSON.stringify(
          pageErrors,
        )}`,
      ).toEqual([]);

      // The seeded user's tier MUST be unchanged — the payments-disabled path
      // performs no mutation. Read it back through a real server route the way
      // probe.spec.ts does (GET /api/v1/me/credits → getCurrentUser +
      // prisma.user.findUnique on the seeded row).
      const creditsRes = await page.request.get('/api/v1/me/credits');
      expect(
        creditsRes.status(),
        `GET /api/v1/me/credits returned ${creditsRes.status()} (expected 2xx)`,
      ).toBeGreaterThanOrEqual(200);
      expect(creditsRes.status()).toBeLessThan(300);
      const credits = (await creditsRes.json()) as { tier?: string };
      expect(
        credits.tier,
        'tier changed on a payments-disabled checkout — the 404 path must not mutate',
      ).toBe('free');
    } finally {
      await context.close();
    }
  });
});
