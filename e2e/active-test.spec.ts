/**
 * Wave-2 🔴 — Active-Test (DAST) tier-gating, both directions, at BOTH layers
 * (T-10).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE PROVES (post-T-19 — the two-layer tier gate now EXISTS)
 * ─────────────────────────────────────────────────────────────────────────────
 * T-19 (committed) added the previously-missing tier gate to the active DAST
 * surface. There are TWO enforcement layers and this spec asserts BOTH against
 * the real running server (never a guess — every assertion is grounded in the
 * shipped code read at authoring time):
 *
 *   LAYER 1 — UI (server component): src/app/[locale]/active-test/page.tsx.
 *     When auth + tier-gating are both active, a user BELOW the required
 *     'one-shot' tier is server-rendered the ActiveTestUpgradePrompt
 *     (data-testid="active-test-upgrade-prompt", containing a Link to
 *     /pricing) INSTEAD of <ActiveTestFlow>. An entitled user (one-shot / pro
 *     / studio) gets <ActiveTestFlow> — Step 1 with its domain input + the
 *     "Continue" control. The required minimum tier is owned by hasTier
 *     (src/lib/auth/helpers.ts: hierarchy free < one-shot < pro < studio); this
 *     spec never re-encodes the hierarchy, it asserts the OBSERVED behaviour.
 *
 *   LAYER 2 — API (authoritative, defense-in-depth): POST
 *     /api/v1/active-test/start/route.ts. Order of gates in the route (read at
 *     authoring time, asserted here in that exact order):
 *       1. no session            → 401 { error }
 *       2. tier-gated (free)     → 403 { code: 'TIER_REQUIRED' }   ← BEFORE any
 *                                   domain / verification / scan work
 *       3. entitled, domain not  → 403 { code: 'DOMAIN_NOT_VERIFIED' }
 *          verified
 *       4. entitled + a verified → proceeds (201; a scan row is created — we
 *          DomainVerification     assert the gate cleared, NOT a real DAST run;
 *                                  the worker is a Phase-2 stub that sends no
 *                                  payloads, see active-test-flow.tsx Step 3
 *                                  "Phase 2 stub" notice).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GROUNDED ENVIRONMENT ASSUMPTION (why the gate is ACTIVE in the e2e server)
 * ─────────────────────────────────────────────────────────────────────────────
 * The gate is conditional on isAuthEnabled() && isTierGatingEnabled().
 *   • src/lib/features.ts: `tierGating` and `auth` both default to `true`.
 *   • playwright.config.ts webServer.env does NOT set FEATURES, so the JSON
 *     override is empty and both flags stay at their `true` defaults.
 *   • webServer.env sets AUTH_PROVIDER='nextauth' (so getCurrentUser() really
 *     resolves the seeded DB session — auth is not the Supabase stub).
 * Therefore both the page gate and the API gate are LIVE for this suite. If a
 * future change sets FEATURES to disable tierGating in the e2e env, the gate
 * becomes a no-op and the "free is blocked" assertions would (correctly) fail —
 * surfacing that the gate was turned off, which is the desired signal, not a
 * flaky test. This assumption is documented rather than silently relied upon.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TIER-ISOLATION (binding — see auth-seed.ts TIER-ISOLATION RULE)
 * ─────────────────────────────────────────────────────────────────────────────
 * The NextAuth session callback re-reads User.tier from the DB every request,
 * so a shared user is unsafe. EVERY case below seeds its OWN dedicated
 * unique-email user at the required tier and tears it down in afterAll. The
 * tier hierarchy is asserted BOTH DIRECTIONS: free (below threshold) is blocked
 * at both layers; one-shot / pro / studio (at/above threshold) all reach the
 * surface at both layers — a higher tier never loses a lower tier's
 * entitlement (monotonic free → one-shot → pro → studio).
 *
 * No real Stripe is touched, no dollar amount is asserted (May-2026 pivot),
 * and /api/v1/scans is never called — the active-test start API uses its own
 * worker (a Phase-2 stub) and we assert only that the tier+verification gates
 * cleared, never a terminal scan state.
 */

import { test, expect, type Browser } from '@playwright/test';
import {
  seedAuthUser,
  uniqueEmail,
  authStorageState,
  type SeededAuth,
} from './support/auth-seed';
import { seedDomainVerification, type SeededEntity } from './support/db-seed';
import { ACTIVE_TEST_DOMAIN_INPUT, ACTIVE_TEST_STEP1_CONTINUE, byTestId } from './support/selectors';

// The active-test page route (en locale; active-test is a protected segment so
// the middleware would redirect an anonymous visitor — every case here is
// authenticated via a seeded DB session).
const ACTIVE_TEST_PATH = '/en/active-test';
const ACTIVE_TEST_START_API = '/api/v1/active-test/start';

// data-testid of the server-rendered upgrade prompt T-19 added in
// src/app/[locale]/active-test/page.tsx (the <section> shown INSTEAD of the
// DAST wizard for below-tier users). It is an existing, shipped product
// testid. It is referenced as an inline literal here ONLY because
// e2e/support/** (selectors.ts) is in this task's files_forbidden scope — the
// "no inline literals" architecture memo governs NEW testids the suite owns
// and adds to product code; this testid already ships in product code from
// T-19 and the single-home file is out of scope for T-10. Documented so a
// later task can centralise it into selectors.ts in one edit.
const UPGRADE_PROMPT_TESTID = 'active-test-upgrade-prompt';

// Tier matrix. 'free' is BELOW the 'one-shot' threshold (blocked). one-shot /
// pro / studio are AT/ABOVE it (allowed). Asserting all three "allowed" tiers
// proves the hierarchy is monotonic (a higher tier never loses a lower tier's
// entitlement), not just that one arbitrary paid tier works.
const ENTITLED_TIERS = ['one-shot', 'pro', 'studio'] as const;

// A domain that passes normalizeDomain() in src/lib/verify-domain.ts (bare,
// lowercase, valid TLD — DOMAIN_REGEX). Used for the API verified/unverified
// cases. It is never actually contacted: the active-test worker is a Phase-2
// stub (active-test-flow.tsx Step 3 "Phase 2 stub" notice) that sends no
// payloads to the domain.
const TEST_DOMAIN = 'dast-e2e-example.com';

// A supported test key (src/lib/active-test-worker.ts SUPPORTED_TESTS) so the
// route's "select at least one supported test" 400 branch is not what we hit —
// we want to reach (and assert on) the tier / verification 403 gates.
const SUPPORTED_TEST = 'sqli';

/** Open an authenticated page+context for `seeded`; caller closes the context. */
async function authedPage(browser: Browser, baseURL: string | undefined, seeded: SeededAuth) {
  // authStorageState() is the single-home cookie constructor from auth-seed.ts.
  // We call it here at runtime (inside authedPage, invoked from the test body)
  // rather than at file-level test.use() — the seeded token is only available
  // after beforeAll, not at collection time. browser.newContext() accepts the
  // StorageState return value directly.
  const context = await browser.newContext({
    baseURL: baseURL ?? 'http://localhost:3000',
    storageState: authStorageState(seeded.sessionToken),
  });
  const page = await context.newPage();
  return { context, page };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LAYER 1 (UI) — free is BLOCKED: upgrade prompt, NOT the DAST wizard
//    qa-checklist: "A free-tier user is blocked from the active-test surface"
// ─────────────────────────────────────────────────────────────────────────────
test.describe('active-test tier gate — free user blocked (UI layer)', () => {
  let seeded: SeededAuth;

  test.beforeAll(async () => {
    seeded = await seedAuthUser({ email: uniqueEmail('active-free-ui'), tier: 'free' });
  });

  test.afterAll(async () => {
    if (seeded) await seeded.cleanup();
  });

  test('@critical a free user sees the upgrade prompt (with a /pricing CTA) and NOT the DAST wizard', async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await authedPage(browser, baseURL, seeded);
    try {
      const resp = await page.goto(ACTIVE_TEST_PATH);
      // Authenticated → must NOT be middleware-redirected to login, and the
      // page itself must render (200), not a 404/500/crash (the 🔴 contract:
      // blocked gracefully, not an error page).
      expect(page.url(), 'authenticated free user was redirected to login').not.toMatch(
        /\/login/,
      );
      expect(resp?.status(), 'active-test page did not render 200 for a free user').toBe(200);
      await page.waitForLoadState('networkidle');

      // The upgrade prompt IS shown...
      const prompt = byTestId(page, UPGRADE_PROMPT_TESTID);
      await expect(prompt, 'free user did not get the ActiveTestUpgradePrompt').toBeVisible();
      // ...with a CTA Link to /pricing (the upgrade path). next-intl prefixes
      // the locale, so match the href ending in /pricing.
      const pricingCta = prompt.getByRole('link', { name: /plan|upgrade/i });
      await expect(pricingCta, 'upgrade prompt has no upgrade CTA').toBeVisible();
      await expect(pricingCta).toHaveAttribute('href', /\/pricing$/);

      // ...and the DAST wizard / its first step is ABSENT (the gate swapped
      // <ActiveTestFlow> out entirely — the domain input + Continue control
      // that only the wizard renders must not exist).
      await expect(
        byTestId(page, ACTIVE_TEST_DOMAIN_INPUT),
        'DAST wizard domain input is present for a free user — gate not applied',
      ).toHaveCount(0);
      await expect(
        byTestId(page, ACTIVE_TEST_STEP1_CONTINUE),
        'DAST wizard Continue control is present for a free user — gate not applied',
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LAYER 1 (UI) — entitled tiers ALLOWED, BOTH directions / monotonic
//    qa-checklist: "An entitled tier user can reach the active-test surface"
//                + "The tier hierarchy free→one-shot→pro→studio gates
//                   monotonically"
// One dedicated unique-email user PER tier (own seed + afterAll cleanup); each
// asserts the wizard renders and the upgrade prompt does NOT — proving a higher
// tier never loses the lower tier's entitlement.
// ─────────────────────────────────────────────────────────────────────────────
for (const tier of ENTITLED_TIERS) {
  test.describe(`active-test tier gate — entitled tier "${tier}" allowed (UI layer)`, () => {
    let seeded: SeededAuth;

    test.beforeAll(async () => {
      seeded = await seedAuthUser({ email: uniqueEmail(`active-${tier}-ui`), tier });
    });

    test.afterAll(async () => {
      if (seeded) await seeded.cleanup();
    });

    test(`@critical a "${tier}" user reaches the DAST wizard (no upgrade prompt)`, async ({
      browser,
      baseURL,
    }) => {
      const { context, page } = await authedPage(browser, baseURL, seeded);
      try {
        const resp = await page.goto(ACTIVE_TEST_PATH);
        expect(page.url(), `entitled "${tier}" user redirected to login`).not.toMatch(/\/login/);
        expect(resp?.status(), `active-test page not 200 for "${tier}"`).toBe(200);
        await page.waitForLoadState('networkidle');

        // The DAST wizard (ActiveTestFlow Step 1) IS rendered for an entitled
        // tier — its domain input + Continue advance control are present.
        await expect(
          byTestId(page, ACTIVE_TEST_DOMAIN_INPUT),
          `DAST wizard not rendered for entitled tier "${tier}" — wrongly blocked`,
        ).toBeVisible();
        await expect(byTestId(page, ACTIVE_TEST_STEP1_CONTINUE)).toBeVisible();

        // ...and the below-tier upgrade prompt is NOT shown (the inverse half
        // of the both-directions assertion).
        await expect(
          byTestId(page, UPGRADE_PROMPT_TESTID),
          `upgrade prompt shown for entitled tier "${tier}" — gate inverted`,
        ).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LAYER 2 (API) — free is BLOCKED by the authoritative gate, BEFORE domain
//    checks. qa-checklist: "A free-tier user is blocked from the active-test
//    surface" — the authoritative half (a free user must not be able to
//    *trigger* a DAST run even if they bypass the UI).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('active-test tier gate — free user blocked (API layer, authoritative)', () => {
  let seeded: SeededAuth;
  // A free user could, in principle, also have a verified domain. We seed one
  // to PROVE the tier gate fires FIRST (403 TIER_REQUIRED), before the
  // domain-verification gate — i.e. the authoritative gate is the tier check,
  // exactly as ordered in route.ts (tier gate at L28, domain check at L66).
  let domainVerification: SeededEntity;

  test.beforeAll(async () => {
    seeded = await seedAuthUser({ email: uniqueEmail('active-free-api'), tier: 'free' });
    domainVerification = await seedDomainVerification({
      userId: seeded.user.id,
      domain: TEST_DOMAIN,
      preVerified: true,
    });
  });

  test.afterAll(async () => {
    if (domainVerification) await domainVerification.cleanup();
    if (seeded) await seeded.cleanup();
  });

  test('@critical POST start as a free user → 403 TIER_REQUIRED, before any domain work', async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await authedPage(browser, baseURL, seeded);
    try {
      const res = await page.request.post(ACTIVE_TEST_START_API, {
        // A valid, verified domain + a supported test on purpose: if the tier
        // gate did NOT run first, this would clear the domain gate and create a
        // scan. A 403 TIER_REQUIRED proves the tier gate short-circuits FIRST.
        data: { domain: TEST_DOMAIN, tests: [SUPPORTED_TEST] },
      });
      expect(
        res.status(),
        'free user was not blocked by the authoritative tier gate (expected 403)',
      ).toBe(403);
      const body = (await res.json()) as { code?: string; error?: string };
      expect(
        body.code,
        'free-user 403 is not the tier gate (expected code TIER_REQUIRED, not DOMAIN_NOT_VERIFIED)',
      ).toBe('TIER_REQUIRED');
    } finally {
      await context.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LAYER 2 (API) — entitled tiers PASS the tier gate, BOTH directions.
//    Then the domain-verification gate (qa-checklist 🟡 "An entitled user with
//    no verified domain cannot launch an intrusive scan") still applies:
//      • entitled + NO verified domain → 403 DOMAIN_NOT_VERIFIED (tier gate
//        passed — proven by the code being DOMAIN_NOT_VERIFIED, not
//        TIER_REQUIRED)
//      • entitled + a seeded preVerified DomainVerification → BOTH 403 gates
//        clear (status is NOT 401/403; a scan row is created — we assert the
//        gate cleared, never await a real DAST run)
// ─────────────────────────────────────────────────────────────────────────────
for (const tier of ENTITLED_TIERS) {
  test.describe(`active-test tier gate — entitled tier "${tier}" passes (API layer)`, () => {
    let seeded: SeededAuth;
    let domainVerification: SeededEntity;

    test.beforeAll(async () => {
      seeded = await seedAuthUser({ email: uniqueEmail(`active-${tier}-api`), tier });
      // preVerified so the verified-domain branch of this describe can clear
      // the second 403 gate. The unverified case below does NOT use it (it
      // posts a *different* domain that has no verification row).
      domainVerification = await seedDomainVerification({
        userId: seeded.user.id,
        domain: TEST_DOMAIN,
        preVerified: true,
      });
    });

    test.afterAll(async () => {
      if (domainVerification) await domainVerification.cleanup();
      if (seeded) await seeded.cleanup();
    });

    test(`@critical "${tier}" passes the tier gate; unverified domain → 403 DOMAIN_NOT_VERIFIED`, async ({
      browser,
      baseURL,
    }) => {
      const { context, page } = await authedPage(browser, baseURL, seeded);
      try {
        // Post a domain this user has NO verification row for. The tier gate
        // (first) must PASS for an entitled tier, so the request falls through
        // to the domain-verification gate and returns DOMAIN_NOT_VERIFIED —
        // NOT TIER_REQUIRED. That single assertion proves BOTH: (a) the tier
        // gate let an entitled tier through, and (b) the domain gate still
        // protects against unverified targets.
        const res = await page.request.post(ACTIVE_TEST_START_API, {
          data: { domain: 'unverified-dast-e2e.com', tests: [SUPPORTED_TEST] },
        });
        expect(
          res.status(),
          `entitled "${tier}" + unverified domain expected the domain gate (403)`,
        ).toBe(403);
        const body = (await res.json()) as { code?: string };
        expect(
          body.code,
          `entitled "${tier}" was blocked by the TIER gate (should have passed it — ` +
            `expected DOMAIN_NOT_VERIFIED, got ${body.code})`,
        ).toBe('DOMAIN_NOT_VERIFIED');
      } finally {
        await context.close();
      }
    });

    test(`@critical "${tier}" with a verified domain clears BOTH 403 gates`, async ({
      browser,
      baseURL,
    }) => {
      const { context, page } = await authedPage(browser, baseURL, seeded);
      try {
        // Same entitled user, but now the domain HAS a seeded preVerified
        // DomainVerification row (beforeAll). Both the tier gate and the
        // domain-verification gate must clear. We assert ONLY that neither 403
        // gate fired (and it is not a 401) — we deliberately do NOT await a
        // terminal DAST state: the worker is a Phase-2 stub that sends no
        // payloads, and the qa-checklist forbids triggering a real scan. A
        // successful pass-through creates a QUEUED scan row → 201.
        const res = await page.request.post(ACTIVE_TEST_START_API, {
          data: { domain: TEST_DOMAIN, tests: [SUPPORTED_TEST] },
        });
        const status = res.status();
        // The two gates we are proving cleared return 401 (no session) and 403
        // (TIER_REQUIRED / DOMAIN_NOT_VERIFIED). None of those may occur here.
        expect(
          status,
          `verified entitled "${tier}" was blocked (status ${status}); ` +
            `expected both 403 gates + the 401 gate to clear`,
        ).not.toBe(401);
        expect(status, `verified entitled "${tier}" hit a 403 gate`).not.toBe(403);
        // Positive confirmation the request fell all the way through the gates:
        // the route creates the scan and returns 201 with a scan_id.
        expect(
          status,
          `expected 201 (scan created — gates cleared) for verified "${tier}", got ${status}`,
        ).toBe(201);
        const body = (await res.json()) as { scan_id?: string; code?: string };
        expect(
          body.code,
          `a gate code is present after a supposed pass-through for "${tier}": ${body.code}`,
        ).toBeUndefined();
        expect(
          body.scan_id,
          `no scan_id returned — the request did not clear both gates for "${tier}"`,
        ).toBeTruthy();
      } finally {
        await context.close();
      }
    });
  });
}
