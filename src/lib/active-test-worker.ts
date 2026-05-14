/**
 * Active-test stub worker.
 *
 * Real attack probes (SQLi, XSS, fuzz, auth-bypass, CORS) are Phase 5 territory.
 * This worker exists so Phase 2 can wire the full /start → /progress → /results
 * contract against a realistic event timeline. It does NOT send any probes,
 * does NOT generate findings, and clearly logs that it is a stub at every step.
 */

import { prisma } from './prisma';
import { publishEvent } from './events';
import { logger } from './logger';

export const SUPPORTED_TESTS = ['sqli', 'xss', 'fuzz', 'auth', 'cors'] as const;
export type ActiveTestKey = (typeof SUPPORTED_TESTS)[number];

const PROBE_LABELS: Record<ActiveTestKey, string> = {
  sqli: 'SQL & NoSQL injection probes',
  xss: 'Cross-site scripting payloads',
  fuzz: 'API endpoint fuzzing',
  auth: 'Authentication bypass attempts',
  cors: 'CORS misconfiguration checks',
};

const PROBE_DURATION_MS: Record<ActiveTestKey, number> = {
  sqli: 2200,
  xss: 1800,
  fuzz: 2600,
  auth: 1500,
  cors: 1200,
};

export function estimateSeconds(tests: ActiveTestKey[]): number {
  const total = tests.reduce((sum, k) => sum + (PROBE_DURATION_MS[k] ?? 1500), 0);
  return Math.max(5, Math.ceil(total / 1000) + 2);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function runActiveTest(scanId: string, tests: ActiveTestKey[]): Promise<void> {
  logger.info('[active-test stub] starting', { scanId, tests });

  try {
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'RUNNING' },
    });

    await publishEvent(scanId, 'scan_started', {
      scan_id: scanId,
      tests,
      total: tests.length,
    });

    for (let i = 0; i < tests.length; i++) {
      const probe = tests[i];
      await publishEvent(scanId, 'probe_started', {
        scan_id: scanId,
        probe,
        label: PROBE_LABELS[probe],
        index: i,
        total: tests.length,
      });

      await sleep(PROBE_DURATION_MS[probe] ?? 1500);

      await publishEvent(scanId, 'probe_complete', {
        scan_id: scanId,
        probe,
        label: PROBE_LABELS[probe],
        findings: 0,
        index: i,
        total: tests.length,
      });
    }

    const existing = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { summary: true },
    });
    const summaryBase: Record<string, unknown> = existing?.summary
      ? (JSON.parse(existing.summary) as Record<string, unknown>)
      : {};

    const finalSummary = {
      ...summaryBase,
      mode: 'active',
      tests,
      passed: tests,
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        summary: JSON.stringify(finalSummary),
      },
    });

    await publishEvent(scanId, 'scan_complete', {
      scan_id: scanId,
      findings: 0,
      passed: tests.length,
    });

    logger.info('[active-test stub] complete', { scanId });
  } catch (err) {
    logger.error('[active-test stub] failed', { scanId }, err as Error);
    await prisma.scan
      .update({ where: { id: scanId }, data: { status: 'FAILED' } })
      .catch(() => {});
    await publishEvent(scanId, 'scan_failed', { scan_id: scanId }).catch(() => {});
  }
}

export interface ActiveTestSummary {
  mode: 'active';
  tests: ActiveTestKey[];
  passed?: ActiveTestKey[];
  idempotencyKey?: string;
  CRITICAL?: number;
  HIGH?: number;
  MEDIUM?: number;
  LOW?: number;
  INFO?: number;
}

export function parseActiveTestSummary(summary: string | null): ActiveTestSummary | null {
  if (!summary) return null;
  try {
    const parsed = JSON.parse(summary) as Record<string, unknown>;
    if (parsed.mode !== 'active') return null;
    return parsed as unknown as ActiveTestSummary;
  } catch {
    return null;
  }
}

export function isSupportedTest(key: string): key is ActiveTestKey {
  return (SUPPORTED_TESTS as readonly string[]).includes(key);
}
