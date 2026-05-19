/**
 * Wave-2 🔴 — Authentication pages E2E (T-08).
 *
 * Covers the QA-checklist Authentication cases:
 *   • Login    : valid-creds → authenticated redirect (🔴), bad-creds error
 *                state (🔴), in-flight/loading (🟡), empty form renders
 *                credential + OAuth options (🟡), OAuth buttons present
 *                (🟢, bounded — see "OAuth popup: bounded coverage" below).
 *   • Signup   : new email → account created + routed to verify (🔴),
 *                duplicate email rejected cleanly (🟡), first-load fields (🟢).
 *   • Verify   : email-verification token marks the account verified (🔴),
 *                invalid/garbage token does NOT verify (🟡); the domain-
 *                ownership /verify page renders its entry form for an
 *                authenticated user (🟡).
 *   • Verify-email-sent : confirmation guidance + resend control (🟡).
 *   • OAuth popups : /auth/popup-start and /auth/popup-callback render
 *                without an unhandled exception (🟢, bounded).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATE × DISPLAY MATRIX (login + signup)
 *   login  — error:  🔴 invalid credentials  → "Signing in with wrong creds…"
 *            success:🔴 valid credentials    → "Signing in with valid creds…"
 *            loading:🟡 submit in-flight     → "login form shows in-flight…"
 *            empty:  🟡 initial unfilled form→ "empty login form renders…"
 *            partial:🟢 OAuth buttons render → "OAuth provider buttons…"
 *   signup — success:🔴 new account          → "Submitting the signup form…"
 *            error:  🟡 duplicate email      → "already-registered email…"
 *            empty:  🟢 first-load fields    → "signup page renders all fields"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REAL-CREDENTIALS LOGIN — how it is seeded and asserted
 * ─────────────────────────────────────────────────────────────────────────────
 * The credentials sign-in path is POST /api/auth/login (login-card.tsx
 * handleEmail → fetch('/api/auth/login')). That route does
 * prisma.user.findUnique({ where:{ email } }) then verifyPassword(plain,
 * user.passwordHash) (src/app/api/auth/login/route.ts + src/lib/auth/
 * password.ts). On success it calls establishSession() and the client does
 * window.location.href = callbackUrl (default '/dashboard').
 *
 * e2e/support/auth-seed.ts `seedAuthUser()` creates the User + a Session row
 * but does NOT set `passwordHash` — and auth-seed.ts is out of this task's
 * scope (cannot be modified). So to drive a *real* credentials sign-in we:
 *
 *   1. seedAuthUser({ email, emailVerified:true }) — creates the User row
 *      (and a Session we do not use for this flow).
 *   2. Attach a `passwordHash` to that exact user via a Prisma client this
 *      spec owns (pointed at the same DEV_DATABASE_URL the dev server uses —
 *      the identical approach auth-seed.ts/perf-db-seed.ts document, because
 *      the @/lib/prisma singleton is wired for the Next runtime, not this
 *      Node process). The hash is produced by hashScrypt() below, which
 *      reproduces src/lib/auth/password.ts EXACTLY (scheme 'scrypt', N=16384,
 *      16-byte salt, 64-byte key, format `scrypt$N$saltHex$hashHex`). This is
 *      grounded in the real source, not guessed — verifyPassword() splits on
 *      '$', checks parts[0]==='scrypt', and scrypt-derives with the stored
 *      salt, so a hash in this exact shape is what the server will accept.
 *   3. Drive the real login form (no request stubbing — Gate-1 D1) and assert
 *      the browser leaves /login for the authenticated area AND a
 *      next-auth.session-token cookie is set (the establishSession contract).
 *
 * The bad-creds case reuses the same seeded user but submits a wrong password,
 * asserting the inline error renders, the URL stays on /login, and NO session
 * cookie is set.
 *
 * Every auth-sensitive case seeds its OWN unique-email user (uniqueEmail())
 * and tears it down in afterAll (TIER-ISOLATION RULE, auth-seed.ts). Cleanup
 * deletes Session+User; this spec's own Prisma client only ever runs an
 * update on the already-seeded row and is disconnected in afterAll.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OAUTH POPUP: BOUNDED / PARTIAL COVERAGE (documented per task output_format)
 * ─────────────────────────────────────────────────────────────────────────────
 * The GitHub/Google buttons open /auth/popup-start which calls NextAuth
 * signIn('github'|'google') → an EXTERNAL identity-provider redirect
 * (github.com / accounts.google.com). That round-trip cannot be driven E2E
 * without either real third-party credentials or faking a provider — and the
 * task contract explicitly forbids faking an OAuth provider. So OAuth coverage
 * is intentionally bounded to the in-app contract only:
 *   • the provider buttons render and are enabled on /login (mechanism), and
 *   • /auth/popup-start and /auth/popup-callback render without an unhandled
 *     exception (the pages either redirect to the external IdP or, opened
 *     directly with no opener, fall through to /login or /dashboard — we
 *     assert no pageerror, not the external hand-off).
 * The external IdP authentication itself is documented partial coverage.
 */

import { test, expect, type Page } from '@playwright/test';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCb } from 'crypto';
import { promisify } from 'util';
import {
  seedAuthUser,
  uniqueEmail,
  type SeededAuth,
} from './support/auth-seed';
import {
  LOGIN_FORM,
  LOGIN_EMAIL_INPUT,
  LOGIN_PASSWORD_INPUT,
  LOGIN_SUBMIT,
  LOGIN_ERROR,
  SIGNUP_FORM,
  SIGNUP_EMAIL_INPUT,
  SIGNUP_PASSWORD_INPUT,
  SIGNUP_NAME_INPUT,
  SIGNUP_SUBMIT,
  SIGNUP_ERROR,
  VERIFY_DOMAIN_FORM,
  VERIFY_DOMAIN_INPUT,
  VERIFY_DOMAIN_SUBMIT,
  RESEND_VERIFICATION_BUTTON,
  byTestId,
} from './support/selectors';

// ── AR-H1: known-harmless dev-mode console noise (mirrors landing.spec.ts /
// probe.spec.ts — copied inline by project convention, not shared). The
// pageerror (uncaught exception) check stays strict and unfiltered.
const BENIGN_CONSOLE = [
  '[Fast Refresh]',
  'ResizeObserver loop',
  'Download the React DevTools',
  'Warning:',
];

function isBenignConsoleMessage(text: string): boolean {
  return BENIGN_CONSOLE.some((pattern) => text.includes(pattern));
}

// ── Prisma-init hard-stop (mirrors probe.spec.ts) ───────────────────────────
// A PrismaClientInitializationError is a deterministic provider/datasource
// misconfiguration, never a transient fault — surface it loudly, never retry.
function isPrismaInitError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { constructor?: { name?: string } }).constructor?.name ===
      'PrismaClientInitializationError'
  );
}

async function hardStopOnPrismaInit<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (err) {
    if (isPrismaInitError(err)) {
      throw new Error(
        'auth.spec: provider/datasource mismatch — STOP, surface to user. ' +
          'A PrismaClientInitializationError means Prisma could not initialise ' +
          '(schema.prisma datasource provider vs the DB URL). Deterministic — ' +
          'retrying cannot recover it and risks the wrong database. Do NOT retry. ' +
          `Original error: ${(err as Error)?.message ?? String(err)}`,
      );
    }
    throw err;
  }
}

// ── scrypt hashing — reproduces src/lib/auth/password.ts EXACTLY ────────────
// Scheme/params are copied from password.ts so verifyPassword() (which splits
// on '$', requires parts[0] === 'scrypt', and scrypt-derives KEY_LEN bytes
// with the stored salt) accepts the hash we store. Changing any constant here
// breaks the real-credentials assertion — keep it byte-aligned with the source.
const scryptAsync = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_SCHEME = 'scrypt';
const SCRYPT_N = 16384;
const SCRYPT_KEY_LEN = 64;
const SCRYPT_SALT_BYTES = 16;

async function hashScrypt(plain: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await scryptAsync(plain, salt, SCRYPT_KEY_LEN);
  return `${SCRYPT_SCHEME}$${SCRYPT_N}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

// One Prisma client owned by THIS spec, pointed at the same e2e SQLite file
// the dev server writes to (DEV_DATABASE_URL from playwright.config.ts
// webServer.env). The @/lib/prisma singleton is wired for the Next runtime,
// not this Node process — auth-seed.ts/perf-db-seed.ts document the same
// dedicated-client approach. Used ONLY to attach a passwordHash to an
// already-seeded user; disconnected in afterAll.
const E2E_DB_URL = process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db';
let specPrisma: PrismaClient | null = null;

function getSpecPrisma(): PrismaClient {
  if (!specPrisma) {
    specPrisma = new PrismaClient({
      datasources: { db: { url: E2E_DB_URL } },
      log: [],
    });
  }
  return specPrisma;
}

/** True when a next-auth.session-token cookie is present in the context. */
async function hasSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((c) => c.name === 'next-auth.session-token' && c.value.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Login — real credentials (own seeded user, scrypt-hashed password)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Authentication — Login (credentials)', () => {
  // This describe owns ONE dedicated unique-email user that has a known
  // password. Both the success and bad-creds tests reuse it (same user, the
  // only variable is the submitted password) and it is torn down in afterAll.
  const PASSWORD = 'Correct-Horse-Battery-9';
  let seeded: SeededAuth;

  test.beforeAll(async () => {
    // 1. seed the User row (+ an unused Session) with a unique email.
    seeded = await hardStopOnPrismaInit(() =>
      seedAuthUser({ email: uniqueEmail('login-creds'), emailVerified: true }),
    );
    // 2. attach a scrypt passwordHash (the seeder does not set one) so the
    //    real /api/auth/login route can verify it. Grounded in password.ts.
    const passwordHash = await hashScrypt(PASSWORD);
    await hardStopOnPrismaInit(() =>
      getSpecPrisma().user.update({
        where: { id: seeded.user.id },
        data: { passwordHash },
      }),
    );
  });

  test.afterAll(async () => {
    // Idempotent — safe if beforeAll failed before assigning `seeded`.
    if (seeded) await seeded.cleanup();
    if (specPrisma) {
      await specPrisma.$disconnect();
      specPrisma = null;
    }
  });

  // 🔴 success state — valid credentials land on an authenticated destination.
  test('@critical Signing in with valid credentials lands on an authenticated destination', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/en/login');
    await expect(byTestId(page, LOGIN_FORM)).toBeVisible();

    // No request stubbing (Gate-1 D1) — drive the real credentials form.
    await byTestId(page, LOGIN_EMAIL_INPUT).fill(seeded.user.email);
    await byTestId(page, LOGIN_PASSWORD_INPUT).fill(PASSWORD);
    await byTestId(page, LOGIN_SUBMIT).click();

    // login-card.tsx on a 2xx does window.location.href = callbackUrl
    // (sanitizeCallback() defaults to '/dashboard'; next-intl prefixes /en).
    // We assert we LEFT /login and a session cookie exists rather than
    // coupling to the dashboard's translated copy.
    await page.waitForURL(/\/en\/(dashboard|verify-email-sent)\/?/);
    expect(page.url(), 'Still on /login — valid credentials did not sign in.').not.toMatch(
      /\/login/,
    );
    expect(
      await hasSessionCookie(page),
      'No next-auth.session-token cookie after a successful credentials login.',
    ).toBe(true);

    const unexpected = consoleErrors.filter((m) => !isBenignConsoleMessage(m));
    expect(unexpected, `Unexpected console errors: ${JSON.stringify(unexpected)}`).toEqual([]);
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  // 🔴 error state — wrong credentials show an error and do NOT authenticate.
  test('@critical Signing in with wrong credentials shows an error and does not authenticate', async ({
    page,
  }) => {
    await page.goto('/en/login');
    await expect(byTestId(page, LOGIN_FORM)).toBeVisible();

    await byTestId(page, LOGIN_EMAIL_INPUT).fill(seeded.user.email);
    // Correct email, deliberately wrong password — the route returns 401 and
    // login-card.tsx renders the inline data-testid="login-error" alert.
    await byTestId(page, LOGIN_PASSWORD_INPUT).fill('definitely-not-the-password');
    await byTestId(page, LOGIN_SUBMIT).click();

    const err = byTestId(page, LOGIN_ERROR);
    await expect(err).toBeVisible();
    await expect(err).toHaveAttribute('role', 'alert');

    // Stays on /login, no authenticated redirect, no session established.
    await expect(page).toHaveURL(/\/en\/login\/?/);
    expect(
      await hasSessionCookie(page),
      'A session cookie was set despite invalid credentials.',
    ).toBe(false);
  });

  // 🟡 loading state — the submit control is busy/disabled while in flight.
  test('@functional The login form shows an in-flight state while submitting', async ({
    page,
  }) => {
    await page.goto('/en/login');
    await expect(byTestId(page, LOGIN_FORM)).toBeVisible();

    await byTestId(page, LOGIN_EMAIL_INPUT).fill(seeded.user.email);
    await byTestId(page, LOGIN_PASSWORD_INPUT).fill(PASSWORD);

    const submit = byTestId(page, LOGIN_SUBMIT);
    // login-card.tsx sets loading='email' synchronously in handleEmail before
    // the await, which disables the submit (disabled={loading !== null}). The
    // navigation only happens AFTER the fetch resolves, so the disabled state
    // is observable in the in-flight window. We do not stub the request
    // (Gate-1 D1); a real successful login then navigates away, which is fine.
    await submit.click();
    await expect(submit).toBeDisabled();
  });

  // 🟡 empty state — fresh form renders credential fields + OAuth buttons.
  test('@functional The empty login form renders both credential and OAuth options', async ({
    page,
  }) => {
    await page.goto('/en/login');

    await expect(byTestId(page, LOGIN_FORM)).toBeVisible();
    await expect(byTestId(page, LOGIN_EMAIL_INPUT)).toBeVisible();
    await expect(byTestId(page, LOGIN_PASSWORD_INPUT)).toBeVisible();
    await expect(byTestId(page, LOGIN_SUBMIT)).toBeVisible();

    // OAuth: the GitHub button is always a real <button> (login-card.tsx
    // GithubButton). Google renders either the GSI iframe (clientId set) or a
    // fallback <button>; in the e2e env NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset
    // so the FallbackGoogleButton renders. Both carry a Continue-with label.
    await expect(
      page.getByRole('button', { name: /github/i }),
      'GitHub OAuth button missing on the login form.',
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /google/i }),
      'Google OAuth button missing on the login form.',
    ).toBeVisible();
  });

  // 🟢 partial state — OAuth provider buttons present + clickable (bounded:
  // the external IdP redirect is NOT exercised — documented partial coverage).
  test('@non-blocker OAuth provider buttons are present and enabled (mechanism only)', async ({
    page,
  }) => {
    await page.goto('/en/login');
    const github = page.getByRole('button', { name: /github/i });
    const google = page.getByRole('button', { name: /google/i });
    await expect(github).toBeVisible();
    await expect(github).toBeEnabled();
    await expect(google).toBeVisible();
    await expect(google).toBeEnabled();
    // Intentionally NOT clicked: clicking opens a popup to /auth/popup-start
    // which redirects to the EXTERNAL provider (github.com / google). Driving
    // that needs real IdP creds or a faked provider — the task forbids faking
    // a provider, so this is bounded to presence + enabled (mechanism only).
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Signup — own unique-email users, cleaned up
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Authentication — Signup', () => {
  // The "new email" success test creates a user through the REAL signup API
  // (no seeding), so it must clean up the row it creates. The duplicate-email
  // test seeds a user up-front then tries to re-register the same email.
  const createdEmails: string[] = [];
  let dupSeeded: SeededAuth | null = null;

  test.afterAll(async () => {
    // Delete any users the signup flow created (Session first via the unique
    // sessionToken FK, then the User). Uses this spec's own Prisma client.
    if (createdEmails.length > 0) {
      const prisma = getSpecPrisma();
      for (const email of createdEmails) {
        const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (u) {
          await prisma.session.deleteMany({ where: { userId: u.id } });
          await prisma.verificationToken.deleteMany({ where: { identifier: email } });
          await prisma.user.deleteMany({ where: { id: u.id } });
        }
      }
    }
    if (dupSeeded) await dupSeeded.cleanup();
    if (specPrisma) {
      await specPrisma.$disconnect();
      specPrisma = null;
    }
  });

  // 🔴 success state — a new email creates an account and routes to verify.
  test('@critical Submitting the signup form for a new email creates an account and routes to verification', async ({
    page,
  }) => {
    const email = uniqueEmail('signup-new');
    // Register for cleanup BEFORE the action so an assertion failure mid-test
    // still tears the row down in afterAll.
    createdEmails.push(email);

    await page.goto('/en/signup');
    await expect(byTestId(page, SIGNUP_FORM)).toBeVisible();

    await byTestId(page, SIGNUP_NAME_INPUT).fill('E2E New User');
    await byTestId(page, SIGNUP_EMAIL_INPUT).fill(email);
    await byTestId(page, SIGNUP_PASSWORD_INPUT).fill('Brand-New-Pass-9');
    await byTestId(page, SIGNUP_SUBMIT).click();

    // signup-card.tsx on a 2xx does router.push(`/verify-email-sent?email=...`)
    // (next-intl prefixes /en). The page itself then guards on auth — the
    // signup route establishes a session, so it should land there.
    await page.waitForURL(/\/en\/verify-email-sent/);

    // The account row must actually exist (the real DB write, not just a UI
    // route change). Read it back through this spec's Prisma client.
    const created = await hardStopOnPrismaInit(() =>
      getSpecPrisma().user.findUnique({ where: { email }, select: { id: true } }),
    );
    expect(created, `No User row created for ${email} after signup.`).not.toBeNull();
  });

  // 🟡 error state — an already-registered email is rejected cleanly.
  test('@functional Signing up with an already-registered email is rejected cleanly', async ({
    page,
  }) => {
    // Seed a user that already owns this email, then try to sign up with it.
    const email = uniqueEmail('signup-dup');
    dupSeeded = await hardStopOnPrismaInit(() =>
      seedAuthUser({ email, emailVerified: true }),
    );

    await page.goto('/en/signup');
    await expect(byTestId(page, SIGNUP_FORM)).toBeVisible();

    await byTestId(page, SIGNUP_EMAIL_INPUT).fill(email);
    await byTestId(page, SIGNUP_PASSWORD_INPUT).fill('Another-Pass-9');
    await byTestId(page, SIGNUP_SUBMIT).click();

    // The signup route returns 409 for an existing email; signup-card.tsx
    // renders the inline data-testid="signup-error" alert and stays put.
    const err = byTestId(page, SIGNUP_ERROR);
    await expect(err).toBeVisible();
    await expect(err).toHaveAttribute('role', 'alert');
    await expect(page).toHaveURL(/\/en\/signup\/?/);

    // No DUPLICATE row created — exactly one user owns this email.
    const matches = await getSpecPrisma().user.findMany({
      where: { email },
      select: { id: true },
    });
    expect(matches.length, `Expected exactly one user for ${email}, got ${matches.length}.`).toBe(
      1,
    );
  });

  // 🟢 first-load — all required fields render with no console error.
  test('@non-blocker The signup page renders all required fields on first load', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/en/signup');
    await expect(byTestId(page, SIGNUP_FORM)).toBeVisible();
    await expect(byTestId(page, SIGNUP_EMAIL_INPUT)).toBeVisible();
    await expect(byTestId(page, SIGNUP_PASSWORD_INPUT)).toBeVisible();
    await expect(byTestId(page, SIGNUP_SUBMIT)).toBeVisible();

    const unexpected = consoleErrors.filter((m) => !isBenignConsoleMessage(m));
    expect(unexpected, `Unexpected console errors on /en/signup: ${JSON.stringify(unexpected)}`).toEqual(
      [],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verify — email-verification token route + domain-ownership /verify page
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Authentication — Verify', () => {
  // Email verification is the GET /api/auth/verify-email?token=... route: it
  // looks up a VerificationToken, marks User.emailVerified, deletes the token,
  // and redirects to /dashboard?verified=1 (src/app/api/auth/verify-email/
  // route.ts). The /{locale}/verify PAGE is a DIFFERENT thing — domain
  // ownership for DAST — so the "account verified" QA case maps to the token
  // route, and the /verify page case asserts the domain-entry form renders.
  let seeded: SeededAuth;
  const VERIFY_TOKEN = `e2e-verify-tok-${Math.random().toString(36).slice(2)}${Date.now()}`;

  test.beforeAll(async () => {
    // Seed an UNVERIFIED user (emailVerified:false) plus a matching, non-
    // expired VerificationToken keyed by the user's email (the route looks the
    // user up by token.identifier === email).
    seeded = await hardStopOnPrismaInit(() =>
      seedAuthUser({ email: uniqueEmail('verify'), emailVerified: false }),
    );
    await hardStopOnPrismaInit(() =>
      getSpecPrisma().verificationToken.create({
        data: {
          identifier: seeded.user.email,
          token: VERIFY_TOKEN,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }),
    );
  });

  test.afterAll(async () => {
    // Token may already be gone (the success test consumes it) — deleteMany is
    // idempotent. Then the seeded user.
    if (specPrisma) {
      await specPrisma.verificationToken
        .deleteMany({ where: { identifier: seeded?.user.email ?? '' } })
        .catch(() => {});
    }
    if (seeded) await seeded.cleanup();
    if (specPrisma) {
      await specPrisma.$disconnect();
      specPrisma = null;
    }
  });

  // 🔴 a valid token verifies the account.
  test('@critical Visiting the verify link with a valid token verifies the account', async ({
    page,
  }) => {
    // The route is GET with a redirect to /dashboard?verified=1 on success.
    await page.goto(`/api/auth/verify-email?token=${VERIFY_TOKEN}`);

    // Followed redirect lands on the dashboard with the verified marker. The
    // exact destination is asserted loosely (query may carry verified=1).
    await page.waitForURL(/\/(dashboard|login)/);
    expect(page.url(), 'Valid token did not redirect to the verified dashboard.').toMatch(
      /verified=1|\/dashboard/,
    );

    // The authoritative check: User.emailVerified is now set in the DB and the
    // one-time token was consumed (deleted).
    const user = await hardStopOnPrismaInit(() =>
      getSpecPrisma().user.findUnique({
        where: { id: seeded.user.id },
        select: { emailVerified: true },
      }),
    );
    expect(user?.emailVerified, 'User.emailVerified was not set by a valid token.').not.toBeNull();

    const tok = await getSpecPrisma().verificationToken.findUnique({
      where: { token: VERIFY_TOKEN },
    });
    expect(tok, 'The one-time verification token was not consumed.').toBeNull();
  });

  // 🟡 a garbage/invalid token does NOT verify and shows an error path.
  test('@functional Visiting verify with an invalid token shows an error state, not success', async ({
    page,
  }) => {
    // Seed a separate unverified user so this assertion is independent of the
    // success test's ordering.
    const badUser = await hardStopOnPrismaInit(() =>
      seedAuthUser({ email: uniqueEmail('verify-bad'), emailVerified: false }),
    );
    try {
      await page.goto('/api/auth/verify-email?token=this-token-does-not-exist');
      // The route redirects unknown tokens to /login?error=invalid-link.
      await page.waitForURL(/\/login\?error=invalid-link/);

      const stillUnverified = await hardStopOnPrismaInit(() =>
        getSpecPrisma().user.findUnique({
          where: { id: badUser.user.id },
          select: { emailVerified: true },
        }),
      );
      expect(
        stillUnverified?.emailVerified,
        'A bogus token must NOT mark any account verified.',
      ).toBeNull();
    } finally {
      await badUser.cleanup();
    }
  });

  // 🟡 the domain-ownership /verify page renders for an authenticated user.
  test('@functional The domain-ownership verify page renders its entry form for an authenticated user', async ({
    browser,
    baseURL,
  }) => {
    // /{locale}/verify requires auth (redirects to /login otherwise) and, with
    // no ?domain=, renders the DomainEntry form (data-testid="verify-domain-
    // form"). We must authenticate with the seeded session — built HERE with
    // the real token (collection-time test.use can't see it; same pattern as
    // probe.spec.ts).
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
    try {
      await page.goto('/en/verify');
      // Authenticated → not redirected to login; the domain-entry form shows.
      expect(page.url(), 'Authenticated /verify redirected to login.').not.toMatch(/\/login/);
      await expect(byTestId(page, VERIFY_DOMAIN_FORM)).toBeVisible();
      await expect(byTestId(page, VERIFY_DOMAIN_INPUT)).toBeVisible();
      await expect(byTestId(page, VERIFY_DOMAIN_SUBMIT)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verify-email-sent — confirmation guidance + resend control
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Authentication — Verify-email-sent', () => {
  // The page redirects to /login if unauthenticated and to /dashboard if the
  // user is already verified, so it is only reachable by an authenticated,
  // UNVERIFIED user. Seed exactly that.
  let seeded: SeededAuth;

  test.beforeAll(async () => {
    seeded = await hardStopOnPrismaInit(() =>
      seedAuthUser({ email: uniqueEmail('verify-sent'), emailVerified: false }),
    );
  });

  test.afterAll(async () => {
    if (seeded) await seeded.cleanup();
  });

  // 🟡 confirmation guidance + the resend control render.
  test('@functional The verify-email-sent page renders confirmation guidance', async ({
    browser,
    baseURL,
  }) => {
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
    try {
      await page.goto('/en/verify-email-sent');
      // Not bounced to login (authenticated) and not to dashboard (unverified).
      expect(page.url(), 'verify-email-sent redirected away — auth/verified gate.').toMatch(
        /\/en\/verify-email-sent/,
      );
      // Structural assertions (the page copy is not i18n-keyed here — it is
      // literal English in the component — so heading + the resend control by
      // its stable testid is the locale-robust check).
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(byTestId(page, RESEND_VERIFICATION_BUTTON)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OAuth popup pages — bounded coverage (render without unhandled exception)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Authentication — OAuth popup pages (bounded)', () => {
  // BOUNDED / PARTIAL by design (see file header): /auth/popup-start calls
  // NextAuth signIn() → an EXTERNAL IdP redirect; /auth/popup-callback
  // postMessages an opener then window.close()s, or (no opener) redirects to
  // /dashboard. We do NOT fake a provider (task forbids it) and cannot drive
  // the external round-trip, so we only assert the pages mount without an
  // unhandled JS exception — the documented partial coverage per R8.
  test('@non-blocker The OAuth popup-start and popup-callback pages load without crashing', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    // Unfiltered on purpose (AR-H1): an uncaught exception is always real.
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // popup-start with no provider param: PopupStartInner defaults to 'github'
    // and calls signIn('github') → a navigation toward the external provider.
    // We assert the page itself did not throw an uncaught exception while
    // rendering; we deliberately do NOT follow/await the external IdP.
    await page.goto('/auth/popup-start', { waitUntil: 'domcontentloaded' });
    // The "Redirecting…" shell renders before any external navigation.
    await expect(page.getByText(/redirecting/i)).toBeVisible();

    // popup-callback opened directly (no window.opener): its effect falls
    // through to window.location.href = '/dashboard' (which, unauthenticated,
    // the middleware redirects to /en/login). Either way: no uncaught error.
    await page.goto('/auth/popup-callback', { waitUntil: 'domcontentloaded' });
    // Give the client effect a tick to run; then assert no pageerror fired.
    await page.waitForLoadState('networkidle').catch(() => {});

    expect(
      pageErrors,
      `OAuth popup pages threw an uncaught exception: ${JSON.stringify(pageErrors)}`,
    ).toEqual([]);
  });
});
