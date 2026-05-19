/**
 * Wave-1 PROBE — the gating self-test for the entire E2E suite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Every Wave-2/3 spec assumes three things are simultaneously true of the
 * running dev server that playwright.config.ts `webServer` launched:
 *
 *   (i)   the server resolved its auth provider to **nextauth** (not the
 *         Supabase stub, which returns null for every user — see
 *         src/lib/auth/helpers.ts getCurrentUserSupabase / features.ts
 *         authConfig.provider default of 'supabase');
 *   (ii)  a DB-session seeded by e2e/support/auth-seed.ts actually
 *         authenticates a request end-to-end (the cookie==row contract holds
 *         through real server code: middleware → getCurrentUser →
 *         getServerSession → Prisma session lookup);
 *   (iii) a real write here (Prisma insert in auth-seed) round-trips back out
 *         through a server route that does its OWN Prisma read of the same row
 *         — i.e. both processes are pointed at the SAME e2e SQLite file with a
 *         schema whose datasource provider matches the client.
 *
 * If any of these is false, dozens of downstream auth/tier specs fail with
 * confusing, misleading symptoms (silent anonymous sessions, blanket
 * redirects, "user not found"). This probe fails FIRST and LOUDLY so the
 * cause is unambiguous before the suite spends time on noise.
 *
 * It is intentionally self-contained: it seeds its OWN dedicated user with a
 * unique email and tears it down in afterAll (the TIER-ISOLATION RULE in
 * auth-seed.ts — never a shared/global probe user).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A PrismaClientInitializationError IS A HARD STOP (NOT A RETRY)
 * ─────────────────────────────────────────────────────────────────────────────
 * PrismaClientInitializationError is the error CLASS Prisma throws when the
 * client cannot even establish a connection / the engine cannot start —
 * classically because the schema's `datasource` provider does not match the
 * database the URL points at (e.g. schema.prisma left on `postgresql` while
 * DEV_DATABASE_URL is a SQLite `file:` URL, or vice-versa). This is a
 * provider/datasource MISCONFIGURATION, not a transient or data-dependent
 * fault:
 *
 *   • It is deterministic. Re-running the exact same request reproduces it
 *     identically — a retry budget can only burn time, never recover.
 *   • It is a precondition failure, not a feature failure. The thing under
 *     test (auth, a route) never even got to run; "fixing the test" or
 *     re-seeding cannot help — the environment itself is wrong.
 *   • Continuing risks acting against the WRONG database. globalSetup hard-
 *     fails if schema.prisma is not SQLite, but a provider/datasource mismatch
 *     that slips past (concurrent prod run clobbering the file, a db-config.js
 *     regression) must STOP the human, not be silently retried into a
 *     possibly-production datasource.
 *
 * So this probe distinguishes by error CLASS (instanceof, plus a constructor-
 * name fallback for any duplicate-module-instance edge), NOT by matching a
 * message substring (messages are localized/versioned and brittle). On a
 * PrismaClientInitializationError it throws a single explicit
 * "Wave-1 PROBE: provider/datasource mismatch — STOP, surface to user"
 * failure and does not retry. Every OTHER non-2xx is an ordinary DIRECT
 * failure that goes through normal Phase-6 regression triage.
 */

import { test, expect, type APIResponse } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { seedAuthUser, authStorageState, uniqueEmail, type SeededAuth } from './support/auth-seed';

// AR-H1 (mirrors landing.spec.ts): known-harmless dev-mode console noise that
// must not flip this @critical probe red. The pageerror check below stays
// strict and unfiltered — a real uncaught exception always means a breakage.
const BENIGN_CONSOLE = [
  '[Fast Refresh]',
  'ResizeObserver loop',
  'Download the React DevTools',
  'Warning:',
];

function isBenignConsoleMessage(text: string): boolean {
  return BENIGN_CONSOLE.some((pattern) => text.includes(pattern));
}

/**
 * True when `err` is Prisma's client-initialization error CLASS.
 *
 * We check `instanceof` first (the correct, message-agnostic test) and fall
 * back to the constructor name only to stay robust if two copies of
 * @prisma/client ever load in this process (a known dual-instance footgun
 * that breaks instanceof). We deliberately do NOT inspect the message string
 * — message text is localized/versioned and is exactly the brittle match the
 * task contract forbids.
 */
function isPrismaInitError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { constructor?: { name?: string } }).constructor?.name ===
      'PrismaClientInitializationError'
  );
}

/**
 * Wrap any probe step so that a Prisma client-init failure becomes the single
 * explicit HARD-STOP message and is never retried, while every other error
 * propagates unchanged as an ordinary DIRECT failure.
 */
async function hardStopOnPrismaInit<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (err) {
    if (isPrismaInitError(err)) {
      throw new Error(
        'Wave-1 PROBE: provider/datasource mismatch — STOP, surface to user. ' +
          'A PrismaClientInitializationError means the running server (or this ' +
          'seeder) could not initialise Prisma — almost always the ' +
          'schema.prisma datasource provider does not match the database the ' +
          'URL points at. This is deterministic; retrying cannot recover it ' +
          'and risks acting against the wrong database. Do NOT retry. ' +
          `Original error: ${(err as Error)?.message ?? String(err)}`,
      );
    }
    throw err;
  }
}

// This probe seeds its OWN dedicated user (unique email) — never a shared one
// (TIER-ISOLATION RULE, auth-seed.ts). afterAll guarantees teardown even when
// an assertion fails mid-test.
let seeded: SeededAuth;

test.beforeAll(async () => {
  // The Prisma write happens HERE (auth-seed → prisma.user.create +
  // session.create). If the seeder itself cannot init Prisma, that is the
  // same provider/datasource hard-stop class — surface it identically rather
  // than letting it look like a generic beforeAll crash.
  seeded = await hardStopOnPrismaInit(() =>
    seedAuthUser({ email: uniqueEmail('probe'), tier: 'free' }),
  );
});

test.afterAll(async () => {
  // Idempotent (deleteMany) — safe even if beforeAll failed before assigning.
  if (seeded) await seeded.cleanup();
});

// NOTE on storageState: the seeded sessionToken is only known AFTER beforeAll
// runs, but a file-level `test.use({ storageState })` is evaluated at
// collection time (before beforeAll) — and authStorageState() throws on an
// empty token by design. So we deliberately do NOT use a file-level
// test.use; instead the test builds its own browser context with
// authStorageState(seeded.sessionToken) once the real token exists. This is
// the contract's "apply authStorageState" step, done at the only point the
// token is available, keeping the cookie==row contract exact.

// ── The probe ──────────────────────────────────────────────────────────────
test('@critical Wave-1 PROBE: auth provider + seeded session + DB round-trip', async ({
  browser,
  baseURL,
}) => {
  // storageState passed to test.use() is evaluated at collection time, before
  // beforeAll runs, so the seeded token is not yet known there. We therefore
  // build a fresh context HERE with the real token (now available) instead of
  // relying on the file-level test.use placeholder. This keeps the
  // cookie==row contract intact: the cookie value is the exact token the
  // Session row holds.
  const context = await browser.newContext({
    baseURL: baseURL ?? 'http://localhost:3000',
    storageState: authStorageState(seeded.sessionToken),
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  // Unfiltered on purpose (AR-H1): an uncaught exception is always real.
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    // ── Assertion (i): the RUNNING SERVER resolved auth provider === 'nextauth'
    //
    // getFeatureStatus() (src/lib/features.ts) carries
    // `auth.provider = authConfig.provider`, but it is NOT exposed by ANY API
    // route (verified: /api/health publishes feature *flags* and db type, not
    // the provider string; no other route returns it). The authoritative
    // OBSERVABLE provider signal the running server exposes is the NextAuth
    // catch-all route itself: src/app/api/auth/[...nextauth]/route.ts gates its
    // handler on `authConfig.provider === 'nextauth'` and, when the provider is
    // anything else, returns HTTP 503 with an explicit
    // "NextAuth is not enabled" body. So GET /api/auth/session:
    //   • provider !== 'nextauth'  → 503 (the disabledResponse() branch)
    //   • provider === 'nextauth'  → real NextAuth handler runs → 200, and
    //     because our seeded cookie is attached, the body is the populated
    //     authenticated session ({ user: { email, ... }, expires }).
    // A populated, non-503 session body therefore proves, through real server
    // code, that the running server's provider is 'nextauth'.
    const sessionRes: APIResponse = await hardStopOnPrismaInit(() =>
      page.request.get('/api/auth/session'),
    );
    expect(
      sessionRes.status(),
      `GET /api/auth/session returned ${sessionRes.status()}. A 503 here means ` +
        `the running server did NOT resolve auth provider 'nextauth' (the ` +
        `[...nextauth] route's disabled branch). Check AUTH_PROVIDER in ` +
        `playwright.config.ts webServer.env.`,
    ).not.toBe(503);
    expect(sessionRes.ok()).toBe(true);
    const session = (await sessionRes.json()) as { user?: { email?: string } };
    expect(
      session?.user?.email,
      'GET /api/auth/session returned 200 but with an empty/anonymous body. ' +
        'The seeded DB session was not honoured by server-side NextAuth — ' +
        'the cookie==row contract or the session lookup is broken.',
    ).toBe(seeded.user.email);

    // ── Assertion (ii): getCurrentUser() resolves through a REAL protected route
    //
    // /{locale}/dashboard is middleware-protected (segment 'dashboard') and
    // its server component calls getCurrentUser(): a null user redirects to
    // /{locale}/login?next=/dashboard, an unverified user redirects to
    // /{locale}/verify-email-sent. Our seeded user has emailVerified set
    // (auth-seed default true), so a correctly-authenticated request must
    // land on the real dashboard and NOT either redirect target. We assert on
    // the final URL + structural markers (primary nav + an <h1>) rather than
    // translated copy or a data-testid (none exists for the dashboard and the
    // selectors file is out of this task's scope), mirroring the locale-
    // agnostic structural style of landing.spec.ts.
    await hardStopOnPrismaInit(() => page.goto('/en/dashboard'));
    await expect(
      page,
      'Navigating /en/dashboard did not stay on the dashboard — a redirect to ' +
        '/login means getCurrentUser() returned null (seeded session not ' +
        'authenticating), a redirect to /verify-email-sent means the seeded ' +
        'user looked unverified.',
    ).toHaveURL(/\/en\/dashboard\/?$/);
    expect(page.url(), 'Redirected to the login page — seeded session not honoured.').not.toMatch(
      /\/login/,
    );
    await expect(page.getByRole('navigation', { name: /primary/i })).toBeVisible();
    await expect(
      page.locator('h1'),
      'Authenticated dashboard <h1> not rendered — the protected view did not load.',
    ).toBeVisible();

    // ── Assertion (iii): a real DB write+read round-trips through the server
    //
    // The write happened in beforeAll (auth-seed → prisma.user.create). This
    // reads it back out through a SEPARATE server process: GET
    // /api/v1/me/credits calls getCurrentUser() then does its OWN
    // prisma.user.findUnique({ where: { id: user.id } }) on the seeded row and
    // returns 2xx { tier, ... }. A 2xx here proves BOTH processes share the
    // same e2e SQLite file AND the schema's datasource provider matches the
    // client (otherwise this is exactly where a PrismaClientInitializationError
    // surfaces — hence the hard-stop wrapper). 401 here would mean auth did
    // not resolve (ordinary DIRECT failure); a Prisma-init class error is the
    // hard stop.
    const creditsRes: APIResponse = await hardStopOnPrismaInit(() =>
      page.request.get('/api/v1/me/credits'),
    );
    expect(
      creditsRes.status(),
      `GET /api/v1/me/credits returned ${creditsRes.status()} (expected 2xx). ` +
        `401 → auth did not resolve through the server; 404 → seeded user row ` +
        `not visible to the server's Prisma client (different DB file?).`,
    ).toBeGreaterThanOrEqual(200);
    expect(creditsRes.status()).toBeLessThan(300);
    const credits = (await creditsRes.json()) as { tier?: string };
    expect(
      credits.tier,
      'me/credits returned 2xx but the tier did not match the seeded user — ' +
        'the server read a different/forged row than the one seeded.',
    ).toBe(seeded.user.tier);

    // Dev-mode console/page hygiene, same discipline as landing.spec.ts.
    const unexpectedConsoleErrors = consoleErrors.filter((m) => !isBenignConsoleMessage(m));
    expect(
      unexpectedConsoleErrors,
      `Unexpected console errors during probe: ${JSON.stringify(unexpectedConsoleErrors)}`,
    ).toEqual([]);
    expect(
      pageErrors,
      `Unexpected page errors during probe: ${JSON.stringify(pageErrors)}`,
    ).toEqual([]);
  } finally {
    await context.close();
  }
});
