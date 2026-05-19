/**
 * Internal admin views — accessibility E2E (axe-core), R3.
 *
 * qa-checklist.md ("The internal admin views have no axe-core WCAG A/AA
 * violations in their stable state (R3)" — @functional): seed the admin user
 * (email === E2E_ADMIN_EMAIL, in webServer.env ADMIN_EMAILS), authenticate via
 * its storageState, visit each of the 6 internal routes, and for each wait for
 * networkidle + the admin view's stable rendered state (its unique <h1>) BEFORE
 * running axe. axe is scoped to the page main region, ruleset WCAG 2.0/2.1
 * A + AA.
 *
 * Single-tagged: ONE @functional test (the qa-checklist classifies this whole
 * R3 internal case as a single @functional scenario — not one tag per route).
 *
 * Allow-list: pre-existing color-contrast findings on the internal dark theme
 * are LOGGED (never silently disabled). Any non-color-contrast WCAG A/AA
 * violation fails the test. The internal admin theme is a dark, behind-auth
 * tool surface; its contrast tuning is tracked separately and must remain
 * visible in test output, hence we print every allow-listed entry rather than
 * dropping it from `withRules`/`disableRules`.
 *
 * Admin-user isolation: the admin user is created in THIS file's beforeAll and
 * destroyed in THIS file's afterAll — never a global seed (a persistent admin
 * row widens the privileged surface for the whole run). The seeded Scan row for
 * /internal/scans/[id] is likewise owned by this file's hooks.
 */

import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import AxeBuilder from '@axe-core/playwright';
import {
  seedAdminUser,
  authStorageState,
  type SeededAuth,
  type StorageState,
} from './support/auth-seed';

// WCAG 2.0/2.1 Level A + AA — the ruleset the qa-checklist mandates.
const WCAG_A_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Documented allow-list: only color-contrast is tolerated, and every tolerated
// occurrence is logged below (never silently disabled). Anything else is a hard
// failure.
const ALLOW_LISTED_RULES = new Set(['color-contrast']);

let scanId = '';

interface InternalRoute {
  name: string;
  path: () => string;
  /** The unique <h1> the admin view renders — its stable-state anchor. */
  heading: string;
}

const ROUTES: InternalRoute[] = [
  { name: 'fp-rates', path: () => '/internal/fp-rates', heading: 'FP rates' },
  { name: 'features', path: () => '/internal/features', heading: 'Feature flags' },
  { name: 'users', path: () => '/internal/users', heading: 'Users' },
  { name: 'dispositions', path: () => '/internal/dispositions', heading: 'Dispositions' },
  { name: 'cron', path: () => '/internal/cron', heading: 'Cron' },
  { name: 'scans/[id]', path: () => `/internal/scans/${scanId}`, heading: 'Scan' },
];

let adminSeed: SeededAuth;
let adminStorageState: StorageState;
let scanCleanup: (() => Promise<void>) | null = null;

const E2E_DB_URL = process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db';

test.beforeAll(async () => {
  adminSeed = await seedAdminUser();
  adminStorageState = authStorageState(adminSeed.sessionToken);

  // One Scan row so /internal/scans/[id] reaches its stable admin view (the
  // page calls notFound() for a missing id, which would redirect away and make
  // the axe scan meaningless). Owned by this file's hooks only.
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DB_URL } }, log: [] });
  const scan = await prisma.scan.create({
    data: {
      targetUrl: 'https://internal-a11y-spec.example.com',
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
  if (scanCleanup) await scanCleanup();
  if (adminSeed) await adminSeed.cleanup();
});

// The admin session cookie authenticates every navigation in this file.
test.use({ storageState: () => adminStorageState });

test('@functional internal admin views have no non-allow-listed WCAG A/AA axe violations', async ({
  page,
}) => {
  // Accumulate findings across all 6 views so one test reports the full
  // picture (single-tagged per qa-checklist) instead of failing on the first.
  const hardViolations: string[] = [];
  const allowListedLog: string[] = [];

  for (const route of ROUTES) {
    await page.goto(route.path(), { waitUntil: 'networkidle' });

    // STABLE STATE: do not run axe until the admin view's own <h1> is visible.
    // The internal layout (requireAdminOrNotFound) + the view's client render
    // must both have settled; the heading is the same anchor the functional
    // spec asserts, so "stable" means the same thing in both files.
    await expect(
      page.getByRole('heading', { level: 1, name: route.heading, exact: true }),
    ).toBeVisible();

    // Scope axe to the page main region (the internal layout renders the view
    // inside <main>; `role=main` is the landmark). Scoping keeps the scan on
    // the admin content under test, consistent with the qa-checklist wording
    // ("scoped to the page main region").
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(WCAG_A_AA_TAGS)
      .analyze();

    for (const v of results.violations) {
      const nodeInfo = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(', '))
        .join(' | ');
      const line = `/internal/${route.name} :: [${v.impact ?? 'n/a'}] ${v.id}: ${v.description} — nodes: ${nodeInfo}`;
      if (ALLOW_LISTED_RULES.has(v.id)) {
        // Logged, never silently disabled (binding R3 rule).
        allowListedLog.push(line);
      } else {
        hardViolations.push(line);
      }
    }
  }

  // Surface the allow-listed (color-contrast) findings in test output so they
  // stay visible and tracked — they are tolerated, not hidden.
  if (allowListedLog.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[internal.a11y] ${allowListedLog.length} allow-listed (color-contrast) finding(s) — tolerated, tracked separately:\n` +
        allowListedLog.join('\n'),
    );
  }

  expect(
    hardViolations,
    `Found ${hardViolations.length} non-allow-listed WCAG A/AA axe violation(s) across the internal admin views:\n` +
      hardViolations.join('\n'),
  ).toHaveLength(0);
});
