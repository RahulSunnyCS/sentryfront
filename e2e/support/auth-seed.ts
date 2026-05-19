/**
 * Authentication seeding helpers for the VibeSafe E2E suite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS / HOW AUTH WORKS HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * NextAuth in this app uses the PrismaAdapter **database** session strategy
 * (see src/lib/auth/nextauth-config.ts: `session.strategy = 'database'`).
 *
 *   • There is NO JWT. The session cookie is an opaque random string that is
 *     looked up in the `Session` table on every request. We therefore MUST NOT
 *     import `next-auth/jwt` or mint a JWT — that would be a token NextAuth
 *     never reads. Authentication is established purely by:
 *       1. a `Session` row whose `sessionToken` column holds a random string, and
 *       2. a browser cookie whose VALUE is byte-identical to that same column.
 *
 *   • Cookie name: `next-auth.session-token`. The playwright dev server runs
 *     over http (NEXTAUTH_URL is http://localhost:3000), so NextAuth uses the
 *     UNPREFIXED cookie name — NOT `__Secure-next-auth.session-token`. The
 *     `__Secure-` prefix is only used when the connection is https. This mirrors
 *     the exact branch in src/lib/auth/session.ts `establishSession`.
 *
 * This file is consumed only by the Playwright Node process (specs + their
 * before/after hooks). It deliberately does NOT use the `@/lib/prisma`
 * singleton — that singleton is wired for the Next.js server runtime. Like
 * e2e/support/perf-db-seed.ts, we instantiate a Prisma client pointed at the
 * same e2e SQLite file the dev server uses (DEV_DATABASE_URL from
 * playwright.config.ts webServer.env), so rows we insert here are immediately
 * visible to the server-side NextAuth session lookup.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE COOKIE == ROW CONTRACT (read this before touching anything)
 * ─────────────────────────────────────────────────────────────────────────────
 * Because the strategy is "database", the ONLY thing that authenticates a
 * request is: cookie value  ===  Session.sessionToken (the exact column value
 * of a non-expired row whose userId points at a real User). There is no
 * signature, no claims, no expiry encoded in the cookie itself — the server
 * trusts the row. Consequences this module guarantees:
 *
 *   1. `seedAuthUser()` generates ONE random `sessionToken`, writes it into the
 *      `Session` row, and returns that exact string. `authStorageState()` puts
 *      that exact string into the cookie value. If these two ever diverge the
 *      user is silently anonymous and tests fail confusingly — so the token is
 *      produced once and threaded through, never regenerated.
 *   2. The token only needs to be cryptographically random + unique (a unique
 *      constraint exists on Session.sessionToken). It need NOT reproduce
 *      establishSession's exact `randomUUID()+randomBytes(16)` format — the
 *      server never parses it, it only does an equality lookup.
 *   3. `Session.expires` must be in the future or NextAuth treats the session
 *      as expired. We set it to now + 30 days to match nextauth-config maxAge.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TIER-ISOLATION RULE (binding — see pipeline constraint memo)
 * ─────────────────────────────────────────────────────────────────────────────
 * The NextAuth `session` callback RE-READS `User.tier` from the database on
 * EVERY request (nextauth-config.ts callbacks.session → prisma.user.findUnique).
 * Separately, the checkout test-flow bypass MUTATES `User.tier` in place
 * (src/app/api/v1/checkout/route.ts → prisma.user.update).
 *
 * Therefore a single shared global user is unsafe: one spec upgrading a tier
 * (or asserting a tier boundary) would leak into every other spec, and parallel
 * workers would race on the same row. The rule, enforced by ergonomics here:
 *
 *   ► Every tier-sensitive or tier-mutating spec MUST seed its OWN user with a
 *     UNIQUE email, inside that spec, and clean it up in that spec. Never a
 *     shared/global seeded auth user.
 *
 * `seedAuthUser()` requires an explicit `email` and defaults to `tier: 'free'`,
 * and `uniqueEmail()` is provided so a spec can trivially mint a collision-free
 * address per test. Cleanup deletes the Session first, then the User, so no
 * orphaned auth rows survive between specs.
 */

import { randomUUID, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { BrowserContext } from '@playwright/test';

/**
 * The Playwright storage-state object shape. Derived from the installed
 * Playwright version's `BrowserContext.storageState()` return type so it can
 * never drift from what `browser.newContext({ storageState })` accepts. This is
 * exactly what `playwright.config.ts` / a spec passes as `storageState`.
 */
export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/**
 * Canonical admin email for E2E. This MUST match an entry in `ADMIN_EMAILS`
 * supplied via playwright.config.ts `webServer.env` — `isAdminUser()` does an
 * exact, case-sensitive membership check against that comma-separated list, and
 * non-admins receive a 404 (existence-hiding), not a 403, so a mismatch makes
 * admin specs fail as "page not found" with no obvious cause.
 *
 * Changing this constant WITHOUT changing webServer.env (and vice versa) breaks
 * every admin spec. Keep the two in lockstep.
 */
export const E2E_ADMIN_EMAIL = 'e2e-admin@vibesafe.test';

// Point Prisma at the e2e database — the same SQLite file the dev server
// launched by playwright.config.ts writes to. The env var is set in
// webServer.env; we must read the identical file or seeded sessions are
// invisible to the server-side NextAuth lookup. Mirrors perf-db-seed.ts.
const E2E_DB_URL = process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db';

function makeClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: E2E_DB_URL } },
    // Suppress the Prisma banner in test output.
    log: [],
  });
}

/**
 * Mint a collision-free, human-readable email so each spec/worker seeds its own
 * isolated User (see TIER-ISOLATION RULE above). `randomUUID()` guarantees
 * uniqueness even across parallel Playwright workers hitting the same DB.
 *
 * @param prefix optional label to make failures readable, e.g. uniqueEmail('checkout-pro').
 */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${randomUUID()}@vibesafe.test`;
}

/** A user known to NextAuth's session callback (a subset of the Prisma User). */
export interface SeededAuthUser {
  id: string;
  email: string;
  tier: string;
}

export interface SeededAuth {
  /** The created User row (id/email/tier). */
  user: SeededAuthUser;
  /**
   * The random session token. This EXACT string is both the
   * `Session.sessionToken` column value AND the cookie value produced by
   * `authStorageState()` — see THE COOKIE == ROW CONTRACT above.
   */
  sessionToken: string;
  /** Deletes the Session row, then the User row, then disconnects. */
  cleanup: () => Promise<void>;
}

export interface SeedAuthUserOpts {
  /**
   * REQUIRED and should be unique per spec. Use `uniqueEmail()`. An explicit
   * email (no default) is intentional friction so callers cannot accidentally
   * share one global user across tier-sensitive specs.
   */
  email: string;
  /**
   * Product tier on the User row. Defaults to 'free'. The NextAuth session
   * callback re-reads this from the DB every request, so the seeded value is
   * authoritative for tier-gating assertions.
   */
  tier?: string;
  /** Mark the email as verified (skips the verification gate). Default true. */
  emailVerified?: boolean;
}

/**
 * Seed an authenticated user for E2E: one `User` row + one non-expired
 * `Session` row whose `sessionToken` is a fresh cryptographically-random
 * string. Returns the user, that exact token, and a `cleanup()`.
 *
 * Pair the returned `sessionToken` with `authStorageState()` to get a logged-in
 * Playwright context. The token is generated ONCE here and threaded out — never
 * regenerate it, or the cookie==row contract breaks (the user goes anonymous).
 *
 * @example
 *   let seeded: SeededAuth;
 *   test.beforeAll(async () => {
 *     seeded = await seedAuthUser({ email: uniqueEmail('dashboard'), tier: 'pro' });
 *   });
 *   test.afterAll(() => seeded.cleanup());
 *   test.use({ storageState: authStorageState(seeded.sessionToken) });
 */
export async function seedAuthUser(opts: SeedAuthUserOpts): Promise<SeededAuth> {
  const { email, tier = 'free', emailVerified = true } = opts;

  if (!email || !email.includes('@')) {
    // Fail loudly at seed time rather than producing a confusing anonymous
    // session later — an empty/invalid email almost always means a spec forgot
    // to call uniqueEmail().
    throw new Error(
      `seedAuthUser: a unique, valid email is required (got ${JSON.stringify(email)}). ` +
        `Use uniqueEmail() so each tier-sensitive spec gets its own isolated user.`,
    );
  }

  const prisma = makeClient();

  // Cryptographically-random + unique. The server never parses this string; it
  // only does an equality lookup against Session.sessionToken. Combining
  // randomUUID with extra random bytes makes accidental collisions impossible
  // even across parallel workers (the column also has a UNIQUE constraint).
  const sessionToken = `${randomUUID()}${randomBytes(24).toString('hex')}`;

  // Must be in the future or NextAuth treats the session as expired. 30 days
  // matches nextauth-config.ts `session.maxAge` and establishSession.
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      tier,
      // A DateTime (truthy) marks the email verified; null leaves it unverified.
      emailVerified: emailVerified ? new Date() : null,
    },
    select: { id: true, email: true, tier: true },
  });

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  return {
    user: {
      id: user.id,
      // email is `String?` in Prisma; we always set it above, so coerce for
      // the non-null SeededAuthUser contract.
      email: user.email ?? email,
      tier: user.tier,
    },
    sessionToken,
    cleanup: async () => {
      // Order matters: Session has an FK to User (onDelete: Cascade would also
      // work, but we delete explicitly so cleanup is correct even if the schema
      // relation changes). deleteMany is idempotent — safe if a prior cleanup
      // or a cascade already removed rows.
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
      await prisma.$disconnect();
    },
  };
}

/**
 * Seed the **admin** user for E2E.
 *
 * ⚠️ ADMIN ISOLATION RULE (enforced here by JSDoc + a runtime guard):
 *   • The admin email is FORCED to `E2E_ADMIN_EMAIL`
 *     ('e2e-admin@vibesafe.test'). It MUST equal an entry in `ADMIN_EMAILS`
 *     from playwright.config.ts webServer.env, or every admin route returns 404
 *     (non-admins are existence-hidden, not 403'd).
 *   • Admin user creation/teardown belongs ONLY in the admin spec file's
 *     `beforeAll`/`afterAll`. Do NOT call this from a global setup/seed: a
 *     persistent admin user widens the privileged surface for the entire run
 *     and is a security smell. One file owns it; that file tears it down.
 *
 * Returns the same shape as `seedAuthUser` (pair with `authStorageState()`).
 *
 * @param opts optional `tier` (defaults 'studio' — the highest, so admin specs
 *             never trip an unrelated tier gate). `email` is intentionally NOT
 *             accepted: it is always `E2E_ADMIN_EMAIL`.
 */
export async function seedAdminUser(opts: { tier?: string } = {}): Promise<SeededAuth> {
  // Runtime note + guard: this helper exists so the admin email cannot be
  // typo'd or accidentally varied per spec. There is no parameter to override
  // it — the constant is the single source of truth, kept in lockstep with
  // ADMIN_EMAILS in webServer.env.
  return seedAuthUser({
    email: E2E_ADMIN_EMAIL,
    tier: opts.tier ?? 'studio',
    emailVerified: true,
  });
}

/**
 * Build a Playwright `storageState` that authenticates requests as the user who
 * owns `sessionToken`.
 *
 * Pass the EXACT `sessionToken` returned by `seedAuthUser()` /
 * `seedAdminUser()`. The cookie value is set to that string verbatim — see THE
 * COOKIE == ROW CONTRACT. Cookie attributes mirror what NextAuth itself sets
 * over http (src/lib/auth/session.ts):
 *   • name   : `next-auth.session-token` (UNPREFIXED — NEXTAUTH_URL is http;
 *              the `__Secure-` prefix is https-only and would be ignored/dropped)
 *   • domain : localhost (the dev server host)
 *   • path   : '/'
 *   • httpOnly / sameSite=Lax / secure=false : matches the http dev cookie
 *
 * @example
 *   test.use({ storageState: authStorageState(seeded.sessionToken) });
 */
export function authStorageState(sessionToken: string): StorageState {
  if (!sessionToken) {
    throw new Error(
      'authStorageState: sessionToken is empty. Pass the exact token from ' +
        'seedAuthUser()/seedAdminUser() — the cookie value must equal the ' +
        'Session.sessionToken row value or the request is anonymous.',
    );
  }

  // Expire the cookie ~30 days out (Unix seconds, as Playwright requires) so it
  // is sent for the whole run. Server-side expiry is still governed by the
  // Session.expires DB column — this is just the browser-side lifetime.
  const expiresUnixSeconds = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);

  return {
    cookies: [
      {
        name: 'next-auth.session-token',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        expires: expiresUnixSeconds,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  };
}
