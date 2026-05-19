/**
 * Wave-2 🔴 — PAYMENT_TEST_FLOW bypass *tier-mutation outcomes* (T-09).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THESE 🔴 CASES ARE VITEST AND NOT PLAYWRIGHT E2E (read this first)
 * ─────────────────────────────────────────────────────────────────────────────
 * The qa-checklist "Payments — Checkout" section lists five 🔴 @critical
 * outcomes that depend on the PAYMENT_TEST_FLOW bypass branch in
 * src/app/api/v1/checkout/route.ts actually executing:
 *
 *   1. one-shot bypass → tier 'one-shot' + activeTestCredits +1
 *   2. pro bypass      → tier 'pro' + credits +5, one-time (NOT a subscription)
 *   3. studio bypass   → tier 'studio', credits NOT incremented (subscription)
 *   4. unauthenticated checkout POST → 401
 *   5. payments-disabled → 404            ← covered at E2E (genuinely reachable)
 *
 * Cases 1–4 require `PAYMENT_TEST_FLOW=true` to be set IN THE SERVER PROCESS
 * for that specific request. The Playwright suite runs a SINGLE shared
 * `npm run dev` server (playwright.config.ts `webServer`, "non-hermetic" by
 * design). A process-level env var cannot be set per-test on one shared
 * long-lived server — every spec would see the same value, and the constraint
 * memo + Phase-1 C4 decision explicitly forbid setting PAYMENT_TEST_FLOW
 * globally on that server (it would make the *production-guard* regression and
 * every other tier-sensitive spec run under a tier-mutating bypass). This is
 * the EXACT same architectural impossibility T-01's
 * payment-test-flow-guard.test.ts already resolved by asserting at the Vitest
 * integration layer instead of E2E — these outcome cases follow that
 * established, accepted precedent.
 *
 * Therefore the bypass tier-mutation @critical outcomes (1–4) are pinned HERE,
 * at the Vitest integration layer: `process.env.PAYMENT_TEST_FLOW` is set
 * per-test (and restored in afterEach) against the real route handler with
 * mocked auth + Prisma, so the exact `prisma.user.update` shape the bypass
 * writes is asserted deterministically and Stripe is never touched.
 *
 * Layer split (which qa-checklist 🔴 case is asserted where):
 *   • #1 one-shot +1 credit            → VITEST (this file)
 *   • #2 pro +5 one-time, no sub       → VITEST (this file)
 *   • #3 studio subscription, +0 credits → VITEST (this file)
 *   • #4 unauthenticated → 401         → VITEST (this file; the 401 only exists
 *                                        INSIDE the flag branch, so it is only
 *                                        reachable with the flag set per-test)
 *   • #5 payments-disabled → 404 (UI)  → E2E (e2e/checkout.spec.ts) — genuinely
 *                                        reachable: no flag, Stripe unconfigured
 *                                        is the running server's real state.
 *
 * MOCK-THEN-IMPORT pattern copied verbatim from the T-01 sibling
 * payment-test-flow-guard.test.ts: mocked @/lib/prisma, @/lib/auth/helpers,
 * @/lib/logger, and an INERT @/lib/stripe/client stub (the route imports it at
 * module load — never let the import reach real Stripe; Pricing constraint
 * memo: never hit real Stripe).
 *
 * studio invariant note: prisma/schema.prisma's User model has only `tier` and
 * `activeTestCredits` — there is NO subscription column. "studio = a
 * subscription" is therefore asserted as the observable invariant the route
 * actually produces: tier === 'studio' AND activeTestCredits is left
 * unchanged (CREDITS_BY_TIER.studio === 0, so the route omits the credit
 * increment entirely). Asserting the absence of the increment IS the
 * "no one-time credits / it is the subscription tier" guarantee given the
 * schema. Dollar amounts are never asserted (May-2026 pricing pivot).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Module mocks (identical wiring to the T-01 sibling spec) ─────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/helpers', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Stripe client is not exercised by these tests, but the route imports it at
// module load — provide inert stubs so the import resolves without touching
// real Stripe (Pricing constraint memo: never hit real Stripe).
vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(),
  STRIPE_PRICES: { oneShot: '', proMonthly: '', studioMonthly: '' },
  isStripeEnabled: vi.fn().mockReturnValue(false),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { POST } from '@/app/api/v1/checkout/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// process.env.NODE_ENV is read-only in the Node types; mutate via a cast so we
// can simulate a non-production environment without fighting the type system
// (identical helper to the T-01 sibling spec).
function setNodeEnv(value: string) {
  (process.env as Record<string, string>).NODE_ENV = value;
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_PAYMENT_TEST_FLOW = process.env.PAYMENT_TEST_FLOW;

/**
 * Mocked auth user returned by getCurrentUser() for the authenticated cases.
 * A stable id lets us assert the exact `where` clause of prisma.user.update.
 */
const SEEDED_USER = {
  id: 'user-t09-bypass',
  email: 'bypass@example.com',
  tier: 'free',
} as Awaited<ReturnType<typeof getCurrentUser>>;

describe('checkout POST — PAYMENT_TEST_FLOW bypass tier-mutation outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Bypass requires (a) the flag set and (b) NOT production. Both are set
    // PER-TEST here (never globally) — the env restore in afterEach guarantees
    // no leak into the rest of the run (vitest.setup.ts pins NODE_ENV='test').
    setNodeEnv('development');
    process.env.PAYMENT_TEST_FLOW = 'true';
  });

  afterEach(() => {
    // Restore env so we never leak the bypass flag / NODE_ENV into other
    // suites — exactly the discipline the T-01 sibling spec uses.
    setNodeEnv(ORIGINAL_NODE_ENV ?? 'test');
    if (ORIGINAL_PAYMENT_TEST_FLOW === undefined) {
      delete process.env.PAYMENT_TEST_FLOW;
    } else {
      process.env.PAYMENT_TEST_FLOW = ORIGINAL_PAYMENT_TEST_FLOW;
    }
  });

  // qa-checklist 🔴 #1: "The one-shot bypass grants exactly one credit"
  it('@critical one-shot bypass → tier "one-shot" + activeTestCredits increment +1', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SEEDED_USER);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({ tier: 'one-shot' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sessionId).toBe('test_flow');

    // CREDITS_BY_TIER['one-shot'] === 1 (read from the route's real constant —
    // route.ts line 11). The route writes the tier AND increments credits by
    // exactly that amount on the authenticated seeded user. Asserting the full
    // call shape pins both "tier becomes one-shot" and "+1 credit".
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: SEEDED_USER!.id },
      data: { tier: 'one-shot', activeTestCredits: { increment: 1 } },
    });

    // No dollar amount is asserted anywhere (May-2026 pricing pivot).
  });

  // qa-checklist 🔴 #2: "The pro bypass grants five one-time credits and does
  // NOT create a subscription"
  it('@critical pro bypass → tier "pro" + credits +5 as a one-time grant (NOT a subscription)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SEEDED_USER);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({ tier: 'pro' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sessionId).toBe('test_flow');

    // CREDITS_BY_TIER.pro === 5 (route.ts line 11). The bypass branch performs
    // a SINGLE prisma.user.update writing tier + a one-time +5 credit
    // increment. "Not a subscription" is asserted structurally: the bypass
    // never calls Stripe (mode 'subscription' lives only in the real Stripe
    // branch, which is unreachable here), and the only state change is the
    // one-time activeTestCredits increment below — there is no recurring /
    // subscription field written.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: SEEDED_USER!.id },
      data: { tier: 'pro', activeTestCredits: { increment: 5 } },
    });

    // Defensive: the written data must NOT carry any recurring/subscription
    // marker — the pro grant is strictly a one-time credit top-up.
    const writtenData = vi.mocked(prisma.user.update).mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(writtenData).not.toHaveProperty('subscription');
    expect(writtenData).not.toHaveProperty('stripeSubscriptionId');
  });

  // qa-checklist 🔴 #3: "The studio bypass creates a subscription and grants
  // zero one-time credits"
  it('@critical studio bypass → tier "studio" (subscription) + activeTestCredits NOT incremented', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SEEDED_USER);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({ tier: 'studio' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sessionId).toBe('test_flow');

    // CREDITS_BY_TIER.studio === 0 (route.ts line 11) — Monitor is the
    // subscription tier, so the route omits the credit increment ENTIRELY
    // (`...(credits > 0 && { activeTestCredits: { increment } })`). With no
    // subscription column in prisma/schema.prisma's User model, the observable
    // "studio = subscription, not a one-time credit grant" invariant is:
    //   tier === 'studio'  AND  activeTestCredits is left untouched.
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: SEEDED_USER!.id },
      data: { tier: 'studio' },
    });

    // Explicitly assert the credit field was NOT written in any form — this is
    // the concrete "+0 one-time credits" guarantee given the schema shape.
    const writtenData = vi.mocked(prisma.user.update).mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(writtenData).not.toHaveProperty('activeTestCredits');
  });

  // qa-checklist 🔴 #4: "An unauthenticated checkout request is rejected with
  // 401". The 401 branch only exists INSIDE the PAYMENT_TEST_FLOW block
  // (route.ts ~L64) — it is therefore only reachable with the flag set, which
  // is precisely why this case is asserted here (per-test env) and not E2E.
  it('@critical unauthenticated + bypass flag → 401, no tier/credit mutation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST(makeRequest({ tier: 'pro' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Sign in to use the test bypass.');

    // No user mutation may occur on the unauthenticated path — no tier change,
    // no credit change anywhere (qa-checklist "Fail if ... any user/tier
    // mutation occurs").
    expect(prisma.user.update).not.toHaveBeenCalled();

    // The response must not leak a granted entitlement.
    expect(json).not.toHaveProperty('sessionId');
    expect(json).not.toHaveProperty('url');
    expect(json).not.toHaveProperty('tier');
  });
});
