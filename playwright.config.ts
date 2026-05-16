import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for VibeSafe.
 *
 * Design notes:
 *  - Non-hermetic: tests hit the real /api/v1/scans endpoint (no route stubs).
 *  - reuseExistingServer: false so Playwright always owns the dev server,
 *    ensuring the hermetic env vars (e2e.db, high rate-limit cap) take effect
 *    rather than inheriting a stray dev session's state.
 *  - RATE_LIMIT_PER_HOUR=100000 prevents 429 responses when multiple tests
 *    submit scans; the real rate-limiter counts Scan rows per IP/hour (default
 *    10), which a modest suite would exhaust immediately.
 *  - webServer.timeout of 180000 ms is generous because 'npm run dev'
 *    runs prisma generate + db push before next dev on first run.
 *  - workers: 1 prevents concurrent scans from racing on the shared e2e.db
 *    and keeps server load predictable for the non-hermetic scan flow.
 *  - Single chromium project only (the plan defers a second browser to a
 *    future sprint per decision D2 / R3).
 */
export default defineConfig({
  testDir: './e2e',

  // Fail fast in CI if a test has .only left in — never in local runs.
  forbidOnly: !!process.env.CI,

  // One retry in CI (flake buffer for the non-hermetic scan flow).
  // Zero locally so failures surface immediately.
  retries: process.env.CI ? 1 : 0,

  // Serial execution prevents concurrent real scans from racing on e2e.db
  // and hitting the real rate-limiter simultaneously.
  workers: 1,

  // List gives a readable terminal stream; html gives a browsable artifact
  // uploaded by CI. open:'never' prevents the report opening a browser in CI.
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',

    // Capture a trace on the first retry so failing CI runs have a
    // diagnostic artifact without recording traces on every green run.
    trace: 'on-first-retry',

    // Generous timeouts for the non-hermetic flow: the dev server must finish
    // prisma generate + db push, Next.js must compile, and the real scans
    // API must respond — all of this happens before navigation resolves.
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  // Generous per-test timeout: a real /api/v1/scans POST + URL navigation
  // to the scan page needs the server fully warm. 120 s matches the hard
  // SCAN_TIMEOUT_MS cap, though individual tests don't await scan completion.
  timeout: 120_000,

  // How long expect() will poll before failing — longer than default (5 s)
  // because the real dev server may be under load during the scan.
  expect: { timeout: 15_000 },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',

    // Always start a fresh server so the hermetic env vars and e2e.db
    // take effect — a reused server might have a different env or database.
    reuseExistingServer: false,

    // 3-minute budget: prisma generate + db push + Next.js cold compile.
    timeout: 180_000,

    env: {
      // Isolated SQLite database for E2E runs; never touches vibesafe.db.
      DEV_DATABASE_URL: 'file:./e2e.db',

      // NextAuth requires a secret to sign JWTs; value is intentionally
      // labelled as non-production so it is never confused with a real secret.
      NEXTAUTH_SECRET: 'e2e-dummy-secret-not-for-production',

      NEXTAUTH_URL: 'http://localhost:3000',

      // Use NextAuth (not the Supabase stub) so getCurrentUser() works;
      // the Supabase path returns null and would make auth-gated paths fail.
      AUTH_PROVIDER: 'nextauth',

      // Raise the scan-row-per-IP/hour ceiling far above what a test suite
      // will ever reach, preventing 429 across retries or parallel specs.
      RATE_LIMIT_PER_HOUR: '100000',
    },
  },
});
