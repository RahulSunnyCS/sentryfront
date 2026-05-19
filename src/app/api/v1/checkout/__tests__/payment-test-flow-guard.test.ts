/**
 * Regression guard for the PAYMENT_TEST_FLOW production bypass (T-01, Wave-0).
 *
 * PAYMENT_TEST_FLOW=true grants a paid tier without charging. It is a
 * dev/staging-only convenience and MUST be impossible to exploit in
 * production. These tests pin the security-critical contract:
 *
 *  1. NODE_ENV=production + PAYMENT_TEST_FLOW=true → 404, and the request is
 *     rejected BEFORE any auth lookup (getCurrentUser) or DB write
 *     (prisma.user.update). The response body must not leak the bypass —
 *     it is byte-identical to the ordinary "payments not enabled" 404 and
 *     carries no tier / sessionId / url payload.
 *  2. Non-production + PAYMENT_TEST_FLOW=true + authenticated → the dev
 *     bypass still works (tier update happens, sessionId 'test_flow').
 *  3. Non-production + PAYMENT_TEST_FLOW=true + unauthenticated → 401
 *     (unchanged behaviour).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Module mocks ─────────────────────────────────────────────────────────────

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
// can simulate each environment without fighting the type system.
function setNodeEnv(value: string) {
  (process.env as Record<string, string>).NODE_ENV = value;
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_PAYMENT_TEST_FLOW = process.env.PAYMENT_TEST_FLOW;

describe('checkout POST — PAYMENT_TEST_FLOW production guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore env so we never leak state into other suites (vitest.setup.ts
    // sets NODE_ENV='test' for the rest of the run).
    setNodeEnv(ORIGINAL_NODE_ENV ?? 'test');
    if (ORIGINAL_PAYMENT_TEST_FLOW === undefined) {
      delete process.env.PAYMENT_TEST_FLOW;
    } else {
      process.env.PAYMENT_TEST_FLOW = ORIGINAL_PAYMENT_TEST_FLOW;
    }
  });

  it('production + PAYMENT_TEST_FLOW=true → 404, no auth lookup, no DB write, no leak', async () => {
    setNodeEnv('production');
    process.env.PAYMENT_TEST_FLOW = 'true';

    const res = await POST(makeRequest({ tier: 'pro' }));
    const json = await res.json();

    // Same status as the ordinary "payments not enabled" 404.
    expect(res.status).toBe(404);

    // The bypass must be short-circuited BEFORE any auth lookup or DB write —
    // verified by behaviour here, and by code position in route.ts (the guard
    // is the first statement inside the PAYMENT_TEST_FLOW block).
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();

    // The response must not leak that a bypass exists: no tier / sessionId /
    // url, and the error string is identical to the payments-disabled branch.
    expect(json).not.toHaveProperty('sessionId');
    expect(json).not.toHaveProperty('url');
    expect(json).not.toHaveProperty('tier');
    expect(json.error).toBe(
      'Payments are not enabled. Set STRIPE_ENABLED=true and configure Stripe credentials, or set PAYMENT_TEST_FLOW=true in dev.',
    );
  });

  it('non-production + PAYMENT_TEST_FLOW=true + authenticated → dev bypass still works', async () => {
    setNodeEnv('development');
    process.env.PAYMENT_TEST_FLOW = 'true';
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'dev@example.com',
      tier: 'free',
    } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await POST(makeRequest({ tier: 'pro' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sessionId).toBe('test_flow');

    // Regression guard: the tier update must still happen in dev. pro = +5
    // one-time DAST credits (not a subscription) per the pricing context.
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tier: 'pro', activeTestCredits: { increment: 5 } },
    });
  });

  it('non-production + PAYMENT_TEST_FLOW=true + unauthenticated → 401 unchanged', async () => {
    setNodeEnv('development');
    process.env.PAYMENT_TEST_FLOW = 'true';
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await POST(makeRequest({ tier: 'one-shot' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('Sign in to use the test bypass.');
    // No tier was granted — the unauthenticated path must not write to the DB.
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
