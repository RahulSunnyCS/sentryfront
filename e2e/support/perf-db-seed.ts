/**
 * Database seeding helpers for performance-report E2E tests.
 *
 * Writes scan rows directly to the e2e.db SQLite file using the Prisma client.
 * The e2e.db path must match playwright.config.ts webServer env DEV_DATABASE_URL.
 *
 * Design:
 *  - Each helper function is self-contained: it inserts one Scan row and returns
 *    the generated CUID. Tests call cleanup() in afterEach to remove the row.
 *  - userId is always null (anonymous scan) so canViewScan() returns true without
 *    a session cookie — the report page renders (blurred, with modal overlay, but
 *    the HTML is present for selector assertions).
 *  - We point Prisma at the same e2e.db that the dev server uses, so rows inserted
 *    here are immediately visible via the Next.js server-side Prisma queries that
 *    power the report page.
 *
 * Required env vars (all supplied by playwright.config.ts webServer.env):
 *   DEV_DATABASE_URL — path to the SQLite e2e.db (e.g. file:./e2e.db)
 */

import { PrismaClient } from '@prisma/client';

// Point Prisma at the e2e database — the same file used by the dev server
// launched by playwright.config.ts.  The env var is set in webServer.env so
// the dev server writes to it; we must read the same file here.
const E2E_DB_URL =
  process.env['DEV_DATABASE_URL'] ?? 'file:./e2e.db';

/** Singleton Prisma client for the e2e database */
function makeClient() {
  return new PrismaClient({
    datasources: { db: { url: E2E_DB_URL } },
    // Suppress the Prisma banner in test output
    log: [],
  });
}

// ── Shape constants ──────────────────────────────────────────────────────────

/** Canonical new-format metrics blob (lab run, FAST CrUX field data). */
export const METRICS_FAST_CRUX = JSON.stringify({
  lcp: 1800,
  fcp: 900,
  cls: 0.02,
  tbt: 150,
  ttfb: 600,
  scoreSource: 'lab',
  fieldDataVerdict: 'FAST',
  fieldData: {
    overallCategory: 'FAST',
    lcp: { percentile: 1900, category: 'FAST', distributions: [] },
    inp: null,
    cls: null,
    fcp: { percentile: 900, category: 'FAST', distributions: [] },
    ttfb: null,
  },
  bestPracticesScore: 92,
  bestPracticesGrade: 'A',
});

/** Metrics blob where real users are SLOW and lab score is high enough to show the banner. */
export const METRICS_SLOW_CRUX = JSON.stringify({
  lcp: 4200,
  fcp: 2800,
  cls: 0.20,
  tbt: 650,
  ttfb: 1200,
  scoreSource: 'lab',
  fieldDataVerdict: 'SLOW',
  fieldData: {
    overallCategory: 'SLOW',
    lcp: { percentile: 6000, category: 'SLOW', distributions: [] },
    inp: null,
    cls: null,
    fcp: null,
    ttfb: null,
  },
  bestPracticesScore: 72,
  bestPracticesGrade: 'C',
});

/** Metrics blob for UNAVAILABLE path (PSI failed). */
export const METRICS_UNAVAILABLE = JSON.stringify({
  scoreSource: 'unavailable',
  lcp: null,
  fcp: null,
  cls: null,
  tbt: null,
  ttfb: null,
});

/** Metrics blob where performanceScore is 0 (real worst-case score). */
export const METRICS_SCORE_ZERO = JSON.stringify({
  lcp: 15000,
  fcp: 12000,
  cls: 1.2,
  tbt: 8000,
  ttfb: 4000,
  scoreSource: 'lab',
  bestPracticesScore: 50,
  bestPracticesGrade: 'D',
});

/** Pre-change blob (no scoreSource, no fieldData) — back-compat test. */
export const METRICS_PRE_CHANGE = JSON.stringify({
  lcp: 2400,
  fcp: 1200,
  cls: 0.05,
  tbt: 300,
  ttfb: 800,
});

/** New-code partial blob (fieldData present but no scoreSource key). */
export const METRICS_PARTIAL_NO_SCORE_SOURCE = JSON.stringify({
  lcp: 2000,
  fcp: 1100,
  cls: 0.04,
  tbt: 200,
  ttfb: 700,
  fieldDataVerdict: 'AVERAGE',
  fieldData: {
    overallCategory: 'AVERAGE',
    lcp: { percentile: 2200, category: 'AVERAGE', distributions: [] },
    inp: null,
    cls: null,
    fcp: null,
    ttfb: null,
  },
});

/** Metrics with desktop sub-object (feature flag ON scenario). */
export const METRICS_WITH_DESKTOP = JSON.stringify({
  lcp: 2500,
  fcp: 1400,
  cls: 0.06,
  tbt: 300,
  ttfb: 800,
  scoreSource: 'lab',
  bestPracticesScore: 85,
  bestPracticesGrade: 'B',
  desktop: {
    score: 88,
    grade: 'B',
    scoreSource: 'lab',
    metrics: { lcp: 1200, fcp: 700, cls: 0.05, tbt: 100, ttfb: 200 },
  },
});

// ── Seed functions ───────────────────────────────────────────────────────────

export interface SeededScan {
  id: string;
  cleanup: () => Promise<void>;
}

/** Shared base data for all seeded scans */
const BASE_SCAN = {
  targetUrl: 'https://e2e-test.example.com',
  status: 'COMPLETED',
  grade: 'B',
  score: 72.0,
  stack: 'Next.js',
  summary: JSON.stringify({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 1, INFO: 0 }),
  userId: null as string | null,
  requesterIp: '127.0.0.1',
};

/** Insert a completed scan with lab metrics and FAST CrUX field data. */
export async function seedFastCruxScan(): Promise<SeededScan> {
  const prisma = makeClient();
  const scan = await prisma.scan.create({
    data: {
      ...BASE_SCAN,
      performanceGrade: 'A',
      performanceScore: 92.0,
      performanceMetrics: METRICS_FAST_CRUX,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  return {
    id: scan.id,
    cleanup: async () => {
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}

/** Insert a completed scan with SLOW CrUX field data (triggers the slow banner). */
export async function seedSlowCruxScan(): Promise<SeededScan> {
  const prisma = makeClient();
  const scan = await prisma.scan.create({
    data: {
      ...BASE_SCAN,
      performanceGrade: 'C',
      performanceScore: 58.0,
      performanceMetrics: METRICS_SLOW_CRUX,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  return {
    id: scan.id,
    cleanup: async () => {
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}

/** Insert a completed scan in the UNAVAILABLE state (PSI failed). */
export async function seedUnavailableScan(): Promise<SeededScan> {
  const prisma = makeClient();
  const scan = await prisma.scan.create({
    data: {
      ...BASE_SCAN,
      // Null grade/score signals UNAVAILABLE to the report page
      performanceGrade: 'N/A',
      performanceScore: null,
      performanceMetrics: METRICS_UNAVAILABLE,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  return {
    id: scan.id,
    cleanup: async () => {
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}

/** Insert a completed scan with performanceScore = 0 (real worst-case lab score). */
export async function seedZeroScoreScan(): Promise<SeededScan> {
  const prisma = makeClient();
  const scan = await prisma.scan.create({
    data: {
      ...BASE_SCAN,
      performanceGrade: 'F',
      performanceScore: 0.0,
      performanceMetrics: METRICS_SCORE_ZERO,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  return {
    id: scan.id,
    cleanup: async () => {
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}

/** Insert a scan whose performanceMetrics matches the pre-change shape (back-compat). */
export async function seedPreChangeScan(): Promise<SeededScan> {
  const prisma = makeClient();
  const scan = await prisma.scan.create({
    data: {
      ...BASE_SCAN,
      performanceGrade: 'B',
      performanceScore: 80.0,
      performanceMetrics: METRICS_PRE_CHANGE,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  return {
    id: scan.id,
    cleanup: async () => {
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}

/** Insert a scan with a new-code partial blob (fieldData present, scoreSource absent). */
export async function seedPartialBlobScan(): Promise<SeededScan> {
  const prisma = makeClient();
  const scan = await prisma.scan.create({
    data: {
      ...BASE_SCAN,
      performanceGrade: 'B',
      performanceScore: 82.0,
      performanceMetrics: METRICS_PARTIAL_NO_SCORE_SOURCE,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  return {
    id: scan.id,
    cleanup: async () => {
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}

/** Insert a scan with desktop sub-object in performanceMetrics. */
export async function seedDesktopScan(): Promise<SeededScan> {
  const prisma = makeClient();
  const scan = await prisma.scan.create({
    data: {
      ...BASE_SCAN,
      performanceGrade: 'B',
      performanceScore: 77.0,
      performanceMetrics: METRICS_WITH_DESKTOP,
    } as Parameters<typeof prisma.scan.create>[0]['data'],
  });
  return {
    id: scan.id,
    cleanup: async () => {
      await prisma.scan.delete({ where: { id: scan.id } });
      await prisma.$disconnect();
    },
  };
}
