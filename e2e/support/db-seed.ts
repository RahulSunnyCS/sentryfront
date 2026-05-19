/**
 * Database seeding helpers for general-purpose VibeSafe E2E tests.
 *
 * Mirrors the Prisma-client-against-DEV_DATABASE_URL pattern established in
 * e2e/support/perf-db-seed.ts.  Coexists by domain: all exported names here
 * are distinct from the names exported by perf-db-seed.ts (which exports
 * seedFastCruxScan, seedSlowCruxScan, seedUnavailableScan, seedZeroScoreScan,
 * seedPreChangeScan, seedPartialBlobScan, seedDesktopScan, SeededScan,
 * METRICS_* constants).
 *
 * This file owns the following domains:
 *  - Full multi-domain completed-scan reports (Security + Performance +
 *    Accessibility + SEO + optional P5 Compliance findings).
 *  - User-owned scan lists for dashboard pagination tests.
 *  - DomainVerification rows for verify / active-test flows.
 *  - Scan lifecycle states: RUNNING (with ScanEvent progress rows), TIMEOUT
 *    (partial findings persisted), COMPLETED.
 *
 * Required env var:
 *   DEV_DATABASE_URL — path to the SQLite e2e.db (e.g. file:./e2e.db).
 *   Supplied automatically by playwright.config.ts webServer.env.
 *
 * Design decisions:
 *  - Every seeder creates its own Prisma client instance (same as
 *    perf-db-seed.ts) so callers can use these helpers in isolation from
 *    globalSetup without sharing client state across tests.
 *  - Every seeder returns cleanup() which deletes exactly the rows it created.
 *    The Prisma Cascade (onDelete: Cascade) on Finding, ScanEvent, and
 *    FindingDisposition means deleting the parent Scan removes all children,
 *    so cleanup() only needs to delete the top-level entity in most cases.
 *  - The userId-scoped vs anonymous distinction is documented in each seeder
 *    and summarised in the module-level comment below.
 *
 * userId-scoped vs anonymous seeding:
 *  - userId-scoped: Scan.userId = providedUserId.  The dashboard query
 *    (lib/dashboard-queries.ts listUserScans / getDashboardStats) filters by
 *    `where: { userId }`.  A row with a matching userId will appear in the
 *    user's dashboard and pass the canViewScan() ownership check, making it
 *    suitable for authenticated-user flows (dashboard, owned report page).
 *  - anonymous: Scan.userId = null.  The canViewScan() helper in
 *    lib/report-access.ts returns true for userId=null rows regardless of
 *    session cookie, so the report page renders without an auth gate (albeit
 *    with the LoginGateModal blur overlay for unauthenticated visitors).
 *    The row will NOT appear in any user's dashboard.  Use this variant when
 *    testing the public report page or any flow that must work without a
 *    logged-in session.
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

// ── Prisma client factory ────────────────────────────────────────────────────

// Point Prisma at the same e2e.db file used by the dev server launched by
// playwright.config.ts.  The DEV_DATABASE_URL env var is set in
// webServer.env so both processes share the same SQLite file.
const E2E_DB_URL = process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db';

function makeClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: E2E_DB_URL } },
    // Silence the Prisma startup banner and query logs in test output.
    log: [],
  });
}

// ── Shared return type ───────────────────────────────────────────────────────

/**
 * Returned by every seeder.  `id` is the primary key of the top-level entity
 * (Scan.id or DomainVerification.id).  cleanup() deletes exactly the rows
 * this call inserted — call it in afterEach.
 */
export interface SeededEntity {
  id: string;
  cleanup: () => Promise<void>;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Canonical severity summary for a completed scan with a mix of issues. */
const COMPLETED_SUMMARY = JSON.stringify({
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
});

/** Summary for a scan that is still running — no findings yet. */
const RUNNING_SUMMARY = JSON.stringify({
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0,
  INFO: 0,
});

/** Partial findings summary for a TIMEOUT scan. */
const TIMEOUT_SUMMARY = JSON.stringify({
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 1,
  LOW: 0,
  INFO: 0,
});

/**
 * Minimal performance metrics JSON that matches the shape expected by the
 * report page performance section (lab source, no CrUX field data).
 * Uses 'lab' scoreSource and includes bestPracticesScore so the grade
 * section renders. Kept intentionally minimal — this file's concern is
 * cross-domain report coverage, not performance edge-cases (those live in
 * perf-db-seed.ts).
 */
const PERF_METRICS = JSON.stringify({
  lcp: 2400,
  fcp: 1200,
  cls: 0.05,
  tbt: 300,
  ttfb: 800,
  scoreSource: 'lab',
  bestPracticesScore: 85,
  bestPracticesGrade: 'B',
});

/**
 * Accessibility metrics blob used for the report page accessibility section.
 * Represents a scan that found two WCAG violations.
 */
const A11Y_METRICS = JSON.stringify({
  violations: [
    { id: 'color-contrast', impact: 'serious', description: 'Elements must have sufficient color contrast', nodes: 3 },
    { id: 'image-alt', impact: 'critical', description: 'Images must have alternate text', nodes: 1 },
  ],
  passes: 42,
  incomplete: 2,
});

/**
 * SEO metrics blob used for the report page SEO section.
 */
const SEO_METRICS = JSON.stringify({
  issues: [
    { type: 'missing-og-image', severity: 'MEDIUM', title: 'Missing Open Graph image tag' },
    { type: 'duplicate-meta-description', severity: 'LOW', title: 'Duplicate meta description detected' },
  ],
  mobileScore: 88,
  aiDiscoverable: true,
});

/**
 * Build a minimal valid Finding data object for a given phase module.
 * The fixManual field is stored as a JSON string in the DB (Prisma maps
 * it from the String column).
 */
function makeFinding(opts: {
  moduleId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  title: string;
  confidence?: 'high' | 'medium' | 'low';
}) {
  return {
    moduleId: opts.moduleId,
    severity: opts.severity,
    category: opts.category,
    title: opts.title,
    location: 'https://e2e-seed.example.com',
    evidence: `Seed evidence for ${opts.moduleId}`,
    explanation: `Seed explanation for finding: ${opts.title}`,
    impact: 'E2E seed row — not a real finding.',
    // fixManual is stored as a JSON string (String column in Prisma schema).
    fixManual: JSON.stringify([`Seed fix step for ${opts.moduleId}`]),
    fixAiPrompt: `Seed AI prompt for ${opts.moduleId}`,
    ...(opts.confidence !== undefined ? { confidence: opts.confidence } : {}),
  };
}

// ── seedCompletedScan ────────────────────────────────────────────────────────

export interface SeedCompletedScanOptions {
  /**
   * When provided the Scan row is owned by this user (Scan.userId = userId).
   * When omitted or explicitly null, the row is anonymous (Scan.userId = null)
   * — suitable for the public report page which does not require a session.
   */
  userId?: string | null;
  /**
   * When true, also creates P5 Compliance findings alongside Security,
   * Performance, Accessibility, and SEO findings.
   * Default: false.
   */
  includeCompliance?: boolean;
}

/**
 * Seeds a completed, multi-domain scan covering all four primary scan
 * domains (Security, Performance, Accessibility, SEO) plus optionally
 * P5 Compliance findings.
 *
 * userId-scoped vs anonymous:
 *  - userId provided → Scan.userId = userId (owned row; appears in dashboard).
 *  - userId null / omitted → Scan.userId = null (anonymous; visible on public
 *    report page without a session, but not in any user's dashboard).
 *
 * Returns { id: scanId, cleanup }.  cleanup() deletes the Scan row; Cascade
 * removes all Finding children automatically.
 */
export async function seedCompletedScan(
  opts: SeedCompletedScanOptions = {},
): Promise<SeededEntity> {
  const prisma = makeClient();
  const userId = opts.userId ?? null;
  const includeCompliance = opts.includeCompliance ?? false;

  const now = new Date();

  const scan = await prisma.scan.create({
    data: {
      targetUrl: 'https://e2e-seed.example.com',
      status: 'COMPLETED',
      // Security domain grades
      grade: 'C',
      score: 72.0,
      // Performance domain
      performanceGrade: 'B',
      performanceScore: 84.0,
      performanceMetrics: PERF_METRICS,
      // Accessibility domain
      accessibilityGrade: 'B',
      accessibilityScore: 82.0,
      accessibilityMetrics: A11Y_METRICS,
      // SEO domain
      seoGrade: 'A',
      seoScore: 91.0,
      seoMetrics: SEO_METRICS,
      stack: 'Next.js',
      summary: COMPLETED_SUMMARY,
      userId,
      requesterIp: '127.0.0.1',
      startedAt: new Date(now.getTime() - 45_000), // started 45 s ago
      completedAt: now,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });

  // Security (P1) findings — one per severity band to populate the full
  // severity-summary component.
  const securityFindings = [
    makeFinding({ moduleId: 'P1-01', severity: 'CRITICAL', category: 'Client-Side Secret Exposure', title: 'Seed: API key exposed in JS bundle', confidence: 'high' }),
    makeFinding({ moduleId: 'P1-03', severity: 'HIGH',     category: 'Security Headers',            title: 'Seed: Content-Security-Policy missing' }),
    makeFinding({ moduleId: 'P1-05', severity: 'HIGH',     category: 'Cookie & Storage',            title: 'Seed: Session cookie lacks Secure flag' }),
    makeFinding({ moduleId: 'P1-07', severity: 'MEDIUM',   category: 'CORS Configuration',          title: 'Seed: CORS allows wildcard origin' }),
    makeFinding({ moduleId: 'P1-08', severity: 'MEDIUM',   category: 'Mixed Content',               title: 'Seed: HTTP resource loaded on HTTPS page' }),
    makeFinding({ moduleId: 'P1-10', severity: 'MEDIUM',   category: 'DNS & Email Security',        title: 'Seed: SPF record missing' }),
    makeFinding({ moduleId: 'P1-14', severity: 'LOW',      category: 'robots.txt & Sitemap',        title: 'Seed: Sitemap not declared in robots.txt' }),
    makeFinding({ moduleId: 'P1-15', severity: 'LOW',      category: 'Cache Configuration',         title: 'Seed: Cache-Control header absent on API response' }),
    makeFinding({ moduleId: 'P1-19', severity: 'INFO',     category: 'DOM XSS Surface',             title: 'Seed: Low-risk DOM sink detected' }),
  ];

  // Accessibility (P3) findings
  const a11yFindings = [
    makeFinding({ moduleId: 'P3-01', severity: 'HIGH',   category: 'WCAG Violations', title: 'Seed: Insufficient color contrast ratio' }),
    makeFinding({ moduleId: 'P3-02', severity: 'MEDIUM', category: 'WCAG Violations', title: 'Seed: Image missing alt text' }),
  ];

  // SEO (P4) findings
  const seoFindings = [
    makeFinding({ moduleId: 'P4-01', severity: 'MEDIUM', category: 'SEO Meta', title: 'Seed: Missing Open Graph image' }),
    makeFinding({ moduleId: 'P4-02', severity: 'LOW',    category: 'SEO Meta', title: 'Seed: Duplicate meta description' }),
  ];

  // P5 Compliance findings (optional)
  const complianceFindings = includeCompliance
    ? [
        makeFinding({ moduleId: 'P5-01', severity: 'MEDIUM', category: 'Cookie Consent',           title: 'Seed: No cookie consent banner detected' }),
        makeFinding({ moduleId: 'P5-02', severity: 'LOW',    category: 'Privacy Policy',            title: 'Seed: Privacy policy link not found' }),
        makeFinding({ moduleId: 'P5-05', severity: 'INFO',   category: 'Third-Party Data Sharing',  title: 'Seed: Third-party analytics script detected' }),
      ]
    : [];

  const allFindings = [
    ...securityFindings,
    ...a11yFindings,
    ...seoFindings,
    ...complianceFindings,
  ];

  // Insert all findings in a single createMany call for efficiency.
  await prisma.finding.createMany({
    data: allFindings.map((f) => ({ scanId: scan.id, ...f })),
  });

  return {
    id: scan.id,
    cleanup: async () => {
      // Deleting the Scan cascades to Finding (onDelete: Cascade in schema).
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}

// ── seedUserWithScans ────────────────────────────────────────────────────────

export interface SeedUserWithScansOptions {
  /** The user who will own all created Scan rows. */
  userId: string;
  /**
   * Number of Scan rows to create.  May be 0 (tests the empty-dashboard
   * state) or any positive integer (tests populated + pagination states).
   */
  count: number;
}

/**
 * Seeds `count` Scan rows owned by `userId`, all in COMPLETED status,
 * staggered 1 second apart (oldest first) so cursor-based pagination tests
 * can assert deterministic ordering.
 *
 * These rows satisfy `listUserScans(userId, ...)` in lib/dashboard-queries.ts
 * because every row has Scan.userId = userId.
 *
 * Returns { id: userId (not a scan id — multiple scans), cleanup }.
 * cleanup() deletes all seeded Scan rows for this userId whose targetUrl
 * matches the seed sentinel so it does not accidentally remove real rows that
 * share the same userId.
 */
export async function seedUserWithScans(
  opts: SeedUserWithScansOptions,
): Promise<SeededEntity> {
  const prisma = makeClient();
  // Sentinel URL prefix identifies rows as owned by this seeder; cleanup()
  // deletes only rows with this targetUrl to avoid clobbering other seed data.
  const SEED_URL = 'https://e2e-seed-dashboard.example.com';

  const scanIds: string[] = [];

  for (let i = 0; i < opts.count; i++) {
    // Stagger startedAt by 1 s per row so date-desc ordering is deterministic.
    const startedAt = new Date(Date.now() - (opts.count - i) * 1_000);
    const scan = await prisma.scan.create({
      data: {
        targetUrl: `${SEED_URL}/page-${i + 1}`,
        status: 'COMPLETED',
        grade: (['A', 'B', 'C', 'D', 'F'] as const)[i % 5],
        score: 90 - i * 10 > 0 ? 90 - i * 10 : 10,
        stack: 'Next.js',
        summary: COMPLETED_SUMMARY,
        userId: opts.userId,
        requesterIp: '127.0.0.1',
        startedAt,
        completedAt: new Date(startedAt.getTime() + 30_000),
      } as Parameters<typeof prisma.scan.create>[0]['data'],
    });
    scanIds.push(scan.id);
  }

  return {
    // Expose the first scan id (or empty string for count=0) as a
    // representative id for callers that need one.
    id: scanIds[0] ?? '',
    cleanup: async () => {
      if (scanIds.length > 0) {
        await prisma.scan.deleteMany({ where: { id: { in: scanIds } } });
      }
      await prisma.$disconnect();
    },
  };
}

// ── seedDomainVerification ───────────────────────────────────────────────────

export interface SeedDomainVerificationOptions {
  /** The user who owns the domain verification record. */
  userId: string;
  /** Bare domain (e.g. 'example.com'), no protocol or trailing slash. */
  domain: string;
  /**
   * When true the verifiedAt timestamp is set to now, simulating a domain
   * that has already been verified.  Default: false (pending verification).
   */
  preVerified?: boolean;
}

/**
 * Seeds a DomainVerification row for `userId`/`domain`.
 *
 * The token is a random 12-byte hex string matching the format generated by
 * lib/verify-domain.ts generateToken().  When preVerified is true, verifiedAt
 * is set so the active-test flow treats the domain as already verified.
 *
 * Returns { id: domainVerificationId, cleanup }.  cleanup() deletes the row.
 */
export async function seedDomainVerification(
  opts: SeedDomainVerificationOptions,
): Promise<SeededEntity> {
  const prisma = makeClient();

  // Generate a random token matching lib/verify-domain.ts TOKEN_BYTES = 12.
  const token = randomBytes(12).toString('hex');

  const record = await prisma.domainVerification.create({
    data: {
      userId: opts.userId,
      domain: opts.domain,
      method: 'dns_txt',
      token,
      verifiedAt: opts.preVerified ? new Date() : null,
    },
  });

  return {
    id: record.id,
    cleanup: async () => {
      await prisma.domainVerification.delete({ where: { id: record.id } });
      await prisma.$disconnect();
    },
  };
}

// ── seedScanLifecycle ────────────────────────────────────────────────────────

export type ScanLifecycleState = 'RUNNING' | 'TIMEOUT' | 'COMPLETED';

export interface SeedScanLifecycleOptions {
  /**
   * The user who will own the Scan row (Scan.userId = userId).
   * Required — lifecycle tests exercise user-owned flows.
   */
  userId: string;
  /**
   * Which lifecycle state to seed:
   *  'RUNNING'   — status=RUNNING with ScanEvent progress rows; no findings.
   *  'TIMEOUT'   — status=TIMEOUT with partial findings persisted.
   *  'COMPLETED' — status=COMPLETED with full findings and grades.
   */
  state: ScanLifecycleState;
}

/**
 * Seeds a Scan in a specific lifecycle state for the given user.
 *
 * IMPORTANT: This seeder inserts database rows directly.  It NEVER calls
 * /api/v1/scans or any HTTP endpoint.  This is intentional — it lets tests
 * assert on states (RUNNING, TIMEOUT) that are hard to reproduce reliably
 * via real API calls in a non-hermetic environment.
 *
 * RUNNING state:
 *   Creates a Scan with status='RUNNING' and three ScanEvent rows simulating
 *   the SSE progress events emitted by scan-worker.ts:
 *     1. scan_started   — payload includes targetUrl
 *     2. module_complete — payload from a hypothetical P1-01 run
 *     3. scan_progress   — payload with a percentage estimate
 *   No findings are created (mirrors the real in-flight state).
 *
 * TIMEOUT state:
 *   Creates a Scan with status='TIMEOUT' and a partial set of findings
 *   (HIGH + MEDIUM) plus a 'scan_timeout' ScanEvent — mirrors how
 *   scan-worker.ts persists partial findings and emits the timeout event.
 *
 * COMPLETED state:
 *   Delegates to seedCompletedScan({ userId }) to produce a fully populated
 *   completed scan owned by the user.
 *
 * Returns { id: scanId, cleanup }.  cleanup() deletes the Scan row; Cascade
 * removes ScanEvent and Finding children automatically.
 */
export async function seedScanLifecycle(
  opts: SeedScanLifecycleOptions,
): Promise<SeededEntity> {
  if (opts.state === 'COMPLETED') {
    // Reuse seedCompletedScan to avoid duplicating the findings logic.
    return seedCompletedScan({ userId: opts.userId });
  }

  const prisma = makeClient();
  const now = new Date();

  if (opts.state === 'RUNNING') {
    const scan = await prisma.scan.create({
      data: {
        targetUrl: 'https://e2e-seed-lifecycle.example.com',
        status: 'RUNNING',
        // No grade/score yet — the scan is still in progress.
        grade: null,
        score: null,
        stack: null,
        summary: RUNNING_SUMMARY,
        userId: opts.userId,
        requesterIp: '127.0.0.1',
        startedAt: new Date(now.getTime() - 10_000), // started 10 s ago
        completedAt: null,
      } as Parameters<typeof prisma.scan.create>[0]['data'],
    });

    // Seed ScanEvent progress rows that mirror what scan-worker.ts emits.
    // ScanEvent.id is autoincrement — Prisma does not support createMany for
    // autoincrement PKs in SQLite with returning, so we use individual creates.
    await prisma.scanEvent.create({
      data: {
        scanId: scan.id,
        eventType: 'scan_started',
        payload: JSON.stringify({ targetUrl: 'https://e2e-seed-lifecycle.example.com' }),
      },
    });
    await prisma.scanEvent.create({
      data: {
        scanId: scan.id,
        eventType: 'module_complete',
        payload: JSON.stringify({ moduleId: 'P1-01', findingCount: 0 }),
      },
    });
    await prisma.scanEvent.create({
      data: {
        scanId: scan.id,
        eventType: 'scan_progress',
        payload: JSON.stringify({ percent: 35, message: 'Security modules running…' }),
      },
    });

    return {
      id: scan.id,
      cleanup: async () => {
        // Cascade deletes ScanEvent rows along with the parent Scan.
        await prisma.scan.delete({ where: { id: scan.id } });
        await prisma.$disconnect();
      },
    };
  }

  // state === 'TIMEOUT'
  const scan = await prisma.scan.create({
    data: {
      targetUrl: 'https://e2e-seed-lifecycle.example.com',
      status: 'TIMEOUT',
      // Partial grades: only security partially scanned before timeout.
      grade: null,
      score: null,
      stack: 'Unknown',
      summary: TIMEOUT_SUMMARY,
      userId: opts.userId,
      requesterIp: '127.0.0.1',
      startedAt: new Date(now.getTime() - 120_000), // hit the 120 s limit
      completedAt: now,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });

  // Partial findings — only those modules that completed before the timeout.
  await prisma.finding.createMany({
    data: [
      {
        scanId: scan.id,
        ...makeFinding({
          moduleId: 'P1-03',
          severity: 'HIGH',
          category: 'Security Headers',
          title: 'Seed (partial/TIMEOUT): Content-Security-Policy missing',
        }),
      },
      {
        scanId: scan.id,
        ...makeFinding({
          moduleId: 'P1-07',
          severity: 'MEDIUM',
          category: 'CORS Configuration',
          title: 'Seed (partial/TIMEOUT): CORS wildcard origin allowed',
        }),
      },
    ],
  });

  // The 'scan_timeout' event mirrors what scan-worker.ts publishes.
  await prisma.scanEvent.create({
    data: {
      scanId: scan.id,
      eventType: 'scan_timeout',
      payload: JSON.stringify({ message: 'Scan exceeded the 120 s hard timeout.', partialFindings: 2 }),
    },
  });

  return {
    id: scan.id,
    cleanup: async () => {
      // Cascade deletes Finding and ScanEvent children.
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}
