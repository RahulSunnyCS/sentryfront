/**
 * Internal admin routes — existence-hiding + admin access E2E (×6 pages).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE NON-ADMIN 404 TEST USES A *VALID AUTHENTICATED* SESSION (load-bearing)
 * ─────────────────────────────────────────────────────────────────────────────
 * The security property under test is EXISTENCE-HIDING, not merely "auth is
 * required". An anonymous 404 only proves "you must be logged in" — it does not
 * prove the route is hidden from a real, logged-in attacker who simply is not on
 * the admin allow-list. The dangerous, realistic adversary is an authenticated
 * non-admin user. If `/internal/*` answered that user with 403 (or any response
 * that differs from a genuinely non-existent path), it would *confirm the route
 * exists* and leak the admin surface. So the LOAD-BEARING assertion seeds a
 * real User + Session row (a valid `next-auth.session-token` cookie that
 * `getCurrentUser()` resolves to a real user) whose email is deliberately NOT
 * in ADMIN_EMAILS, and proves that user's experience is byte-indistinguishable
 * from requesting a route that does not exist at all. The anonymous case is
 * also asserted, but only as a weaker corroborating check.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GROUNDED MECHANISM (read src/lib/auth/helpers.ts + src/app/not-found.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 *   • Every page under /internal is gated by `requireAdminOrNotFound()` in
 *     src/app/internal/layout.tsx. middleware EXCLUDES /internal (matcher
 *     `(?!...|internal|...)`), so gating is ENTIRELY at the layout, not the
 *     middleware.
 *   • `requireAdminOrNotFound()` (helpers.ts:130) calls Next.js `notFound()`
 *     for a non-admin — the SAME primitive a genuinely missing route triggers.
 *   • `/internal` is NOT under `[locale]`, so the nearest not-found boundary is
 *     the ROOT src/app/not-found.tsx, which is `redirect('/')`. `/` is then
 *     rewritten by next-intl (localePrefix:'always', defaultLocale:'en') to
 *     `/en` — the public landing page.
 *   • Therefore a non-admin (valid session OR anonymous) AND a deliberately
 *     non-existent `/internal/<random>` path ALL resolve to the IDENTICAL
 *     observable outcome: a server redirect that ends on the `/en` landing
 *     page, with NO admin markup and NO 403 anywhere. That equivalence — not a
 *     bare status code — is what proves existence-hiding here, and it is
 *     derived from the actual code path, not guessed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN-USER ISOLATION (binding constraint memo)
 * ─────────────────────────────────────────────────────────────────────────────
 * The admin user (email === E2E_ADMIN_EMAIL, matching ADMIN_EMAILS in
 * playwright.config.ts webServer.env) and the dedicated non-admin user are BOTH
 * created in THIS file's `beforeAll` and destroyed in THIS file's `afterAll`.
 * Neither is a global seed: a persistent admin row widens the privileged
 * surface for the whole run. Each carries its own distinct storageState
 * (distinct session cookie); the seeded Scan row used by /internal/scans/[id]
 * is also created/torn down here.
 */

import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  seedAdminUser,
  seedAuthUser,
  authStorageState,
  uniqueEmail,
  E2E_ADMIN_EMAIL,
  type SeededAuth,
  type StorageState,
} from './support/auth-seed';

// ── The six internal routes under test ───────────────────────────────────────
// scans/[id] needs a real Scan id; it is filled in beforeAll after the row is
// seeded. The other five are static paths. Each entry carries the unique <h1>
// its admin view renders (users-view.tsx:69, cron-view.tsx:51, etc.) so the
// admin-path test can assert the *correct* view rendered, and the
// existence-hiding test can assert that heading is ABSENT for a non-admin.
interface InternalRoute {
  /** Stable label for test titles. */
  name: string;
  /** Path builder — scans/[id] depends on the seeded scan id. */
  path: () => string;
  /** The exact <h1> text the admin view renders (case-sensitive in product). */
  heading: string;
}

// scanId is assigned in beforeAll; the closure reads it lazily so the array can
// be declared at module scope while the id is only known after seeding.
let scanId = '';

const ROUTES: InternalRoute[] = [
  { name: 'users', path: () => '/internal/users', heading: 'Users' },
  { name: 'cron', path: () => '/internal/cron', heading: 'Cron' },
  { name: 'features', path: () => '/internal/features', heading: 'Feature flags' },
  { name: 'fp-rates', path: () => '/internal/fp-rates', heading: 'FP rates' },
  { name: 'dispositions', path: () => '/internal/dispositions', heading: 'Dispositions' },
  { name: 'scans/[id]', path: () => `/internal/scans/${scanId}`, heading: 'Scan' },
];

// A path that is GUARANTEED not to resolve to any real page — the control for
// the existence-hiding parity assertion. Same /internal/ prefix so it traverses
// the identical not-found boundary chain as a gated route.
const NONEXISTENT_INTERNAL = `/internal/${randomUUID()}-does-not-exist`;

// ── Shared state owned ENTIRELY by this file's before/after hooks ─────────────
let adminSeed: SeededAuth;
let nonAdminSeed: SeededAuth;
let adminStorageState: StorageState;
let nonAdminStorageState: StorageState;
let scanCleanup: (() => Promise<void>) | null = null;

// Like auth-seed.ts / perf-db-seed.ts, the Playwright Node process talks to the
// same e2e SQLite file the dev server uses (DEV_DATABASE_URL from
// webServer.env). We do NOT import the @/lib/prisma singleton (server-runtime
// wired). A throwaway client seeds the one Scan row /internal/scans/[id] needs.
const E2E_DB_URL = process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db';

test.beforeAll(async () => {
  // Admin user: email is FORCED to E2E_ADMIN_EMAIL by seedAdminUser (it accepts
  // no email param). That constant is kept in lockstep with ADMIN_EMAILS in
  // playwright.config.ts webServer.env (set by T-03), so isAdminUser() returns
  // true and the layout renders instead of 404'ing.
  adminSeed = await seedAdminUser();
  adminStorageState = authStorageState(adminSeed.sessionToken);

  // Dedicated non-admin: a UNIQUE email that is NOT in ADMIN_EMAILS. uniqueEmail
  // guarantees it cannot collide with the admin or any other spec's user even
  // across parallel workers. This is a fully valid authenticated session — the
  // whole point of the load-bearing test.
  nonAdminSeed = await seedAuthUser({ email: uniqueEmail('internal-nonadmin') });
  nonAdminStorageState = authStorageState(nonAdminSeed.sessionToken);

  // Seed ONE Scan row so /internal/scans/[id] has a real id to load. The admin
  // page only selects id/targetUrl/status/tier/userId/grade/score/dates, so a
  // minimal row is sufficient. userId left null (anonymous scan) — admin view
  // does not require ownership. Created and torn down here, never globally.
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DB_URL } }, log: [] });
  const scan = await prisma.scan.create({
    data: {
      targetUrl: 'https://internal-spec.example.com',
      status: 'COMPLETED',
      tier: 'free',
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  scanId = scan.id;
  scanCleanup = async () => {
    await prisma.scan.deleteMany({ where: { id: scan.id } });
    await prisma.$disconnect();
  };
});

test.afterAll(async () => {
  // Tear everything down in this file — admin user, non-admin user, seeded
  // Scan. Each is idempotent (deleteMany), so a partial prior failure cannot
  // wedge cleanup. Nothing this spec created survives the run.
  if (scanCleanup) await scanCleanup();
  if (nonAdminSeed) await nonAdminSeed.cleanup();
  if (adminSeed) await adminSeed.cleanup();
});

/**
 * Navigate and return the final HTTP status + a normalized "is this the public
 * landing, not an admin view?" snapshot. Used to prove parity between the
 * non-admin, anonymous, and non-existent cases.
 *
 * We assert on:
 *   • the final URL after the server redirect chain (must end on /en, the
 *     landing — NOT /internal/*),
 *   • the top-level navigation response status (a 2xx for the FINAL document
 *     after redirects; Next's notFound→redirect('/')→/en yields a normal 200
 *     landing page, never a 403),
 *   • absence of the route's admin <h1> and of the admin chrome.
 */
async function snapshotAfterNav(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  // page.goto resolves with the response for the FINAL navigation after
  // redirects. The landing page is a normal 200; the security property is that
  // it is NOT 403 and NOT the admin 200 view.
  const status = response?.status() ?? 0;
  const finalUrl = new URL(page.url()).pathname;
  // The public landing hero submit control is the stable anchor that proves we
  // actually landed on /en (same anchor landing.spec.ts uses).
  const onLanding =
    /\/[a-z]{2}\/?$/.test(finalUrl) &&
    (await page.locator('[data-testid="hero-scan-submit"]').count()) > 0;
  return { status, finalUrl, onLanding };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LOAD-BEARING: an authenticated NON-admin (valid session) is existence-
// hidden on every internal route — indistinguishable from a non-existent route,
// never a 403, never the admin content.
// (qa-checklist: "An authenticated non-admin gets 404 (not 403) on every
// internal route" — @critical)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('@critical internal routes are existence-hidden from a valid non-admin session', () => {
  // The non-admin's valid session cookie is applied for this whole block.
  test.use({ storageState: () => nonAdminStorageState });

  for (const route of ROUTES) {
    test(`non-admin sees no admin content on /internal/${route.name}`, async ({ page }) => {
      const real = await snapshotAfterNav(page, route.path());

      // 1) NOT the admin view: the route's unique <h1> must be absent.
      await expect(
        page.getByRole('heading', { level: 1, name: route.heading, exact: true }),
      ).toHaveCount(0);
      // 2) NOT a 403 and NOT admin chrome: the internal layout banner ("VibeSafe
      //    · Internal") and the admin email must never appear for a non-admin.
      await expect(page.getByText('VibeSafe · Internal')).toHaveCount(0);
      await expect(page.getByText(E2E_ADMIN_EMAIL)).toHaveCount(0);
      // 3) Existence-hidden: redirected to the public landing, NOT left on an
      //    /internal/* URL, and the final document is a normal landing 200 —
      //    never a 403 (a 403 would itself confirm the route exists).
      expect(real.finalUrl).not.toMatch(/^\/internal\//);
      expect(real.onLanding).toBe(true);
      expect(real.status).not.toBe(403);

      // 4) PARITY (the actual security guarantee): the valid non-admin's
      //    outcome must be byte-equivalent to requesting a route that does not
      //    exist at all under the same /internal/ prefix. Same status, same
      //    final landing URL — the server gives the attacker zero signal that
      //    /internal/<route> exists while /internal/<garbage> does not.
      const ghost = await snapshotAfterNav(page, NONEXISTENT_INTERNAL);
      expect(real.status).toBe(ghost.status);
      expect(real.finalUrl).toBe(ghost.finalUrl);
      expect(real.onLanding).toBe(ghost.onLanding);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟡 Corroborating: an anonymous visitor is also existence-hidden (never the
// admin content). Weaker than the authenticated-non-admin case above.
// (qa-checklist: "An unauthenticated visitor cannot see internal routes" —
// @functional)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('@functional internal routes are existence-hidden from an anonymous visitor', () => {
  // No storageState → genuinely anonymous (getCurrentUser() returns null).
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of ROUTES) {
    test(`anonymous sees no admin content on /internal/${route.name}`, async ({ page }) => {
      const real = await snapshotAfterNav(page, route.path());

      await expect(
        page.getByRole('heading', { level: 1, name: route.heading, exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText('VibeSafe · Internal')).toHaveCount(0);
      expect(real.finalUrl).not.toMatch(/^\/internal\//);
      expect(real.status).not.toBe(403);

      // Parity with a non-existent route holds for the anonymous case too.
      const ghost = await snapshotAfterNav(page, NONEXISTENT_INTERNAL);
      expect(real.status).toBe(ghost.status);
      expect(real.finalUrl).toBe(ghost.finalUrl);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Admin path: the seeded admin (email === E2E_ADMIN_EMAIL, in ADMIN_EMAILS)
// gets 200 + the correct admin view on every internal route.
// (qa-checklist: "An admin user can load every internal route" — @critical)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('@critical an admin can load every internal route', () => {
  test.use({ storageState: () => adminStorageState });

  for (const route of ROUTES) {
    test(`admin loads /internal/${route.name}`, async ({ page }) => {
      const response = await page.goto(route.path(), { waitUntil: 'networkidle' });

      // The document itself is a 200 (admin allowed), and the URL stays on the
      // internal route — NOT redirected to the landing.
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toMatch(/^\/internal\//);

      // The route's own unique <h1> renders (proves the CORRECT view, not just
      // any 200), and the admin chrome from layout.tsx renders with the admin
      // email — content only an authorized admin ever sees.
      await expect(
        page.getByRole('heading', { level: 1, name: route.heading, exact: true }),
      ).toBeVisible();
      await expect(page.getByText('VibeSafe · Internal')).toBeVisible();
      await expect(page.getByText(E2E_ADMIN_EMAIL)).toBeVisible();
    });
  }
});
