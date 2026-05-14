import { prisma } from './prisma';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DashboardStats {
  totalScans: number;
  criticalIssues: number;
  avgGrade: Grade | null;
  monitoredSites: number;
  trends: {
    totalScans: string | null;
    criticalIssues: string | null;
    avgGrade: string | null;
    monitoredSites: string | null;
  };
}

export interface ScanListItem {
  id: string;
  url: string;
  grade: Grade | null;
  score: number | null;
  critical: number;
  high: number;
  medium: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface ScanListResult {
  items: ScanListItem[];
  nextCursor: string | null;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

function scoreToGrade(score: number | null): Grade | null {
  if (score === null) return null;
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function parseSeverityCounts(summary: string | null): {
  critical: number;
  high: number;
  medium: number;
} {
  if (!summary) return { critical: 0, high: 0, medium: 0 };
  try {
    const parsed = JSON.parse(summary) as Record<string, unknown>;
    const n = (k: string) => {
      const v = parsed[k];
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    };
    return { critical: n('CRITICAL'), high: n('HIGH'), medium: n('MEDIUM') };
  } catch {
    return { critical: 0, high: 0, medium: 0 };
  }
}

function encodeCursor(scan: { startedAt: Date; id: string }): string {
  return Buffer.from(`${scan.startedAt.toISOString()}|${scan.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { startedAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const sep = decoded.indexOf('|');
    if (sep === -1) return null;
    const iso = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    const startedAt = new Date(iso);
    if (Number.isNaN(startedAt.getTime()) || !id) return null;
    return { startedAt, id };
  } catch {
    return null;
  }
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [totalScans, completedScans, distinctSites] = await Promise.all([
    prisma.scan.count({ where: { userId } }),
    prisma.scan.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { score: true, summary: true },
    }),
    prisma.scan.findMany({
      where: { userId },
      select: { targetUrl: true },
      distinct: ['targetUrl'],
    }),
  ]);

  let criticalIssues = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  for (const scan of completedScans) {
    criticalIssues += parseSeverityCounts(scan.summary).critical;
    if (typeof scan.score === 'number') {
      scoreSum += scan.score;
      scoreCount += 1;
    }
  }
  const avgScore = scoreCount > 0 ? scoreSum / scoreCount : null;
  const avgGrade = scoreToGrade(avgScore);

  return {
    totalScans,
    criticalIssues,
    avgGrade,
    monitoredSites: distinctSites.length,
    trends: {
      totalScans: null,
      criticalIssues:
        criticalIssues > 0 ? 'Require immediate attention' : totalScans > 0 ? 'All clear' : null,
      avgGrade: null,
      monitoredSites: null,
    },
  };
}

export async function listUserScans(
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<ScanListResult> {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursorPayload = opts.cursor ? decodeCursor(opts.cursor) : null;

  const rows = await prisma.scan.findMany({
    where: {
      userId,
      ...(cursorPayload && {
        OR: [
          { startedAt: { lt: cursorPayload.startedAt } },
          { startedAt: cursorPayload.startedAt, id: { lt: cursorPayload.id } },
        ],
      }),
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      targetUrl: true,
      status: true,
      grade: true,
      score: true,
      summary: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(visible[visible.length - 1]) : null;

  const items: ScanListItem[] = visible.map((row) => {
    const sev = parseSeverityCounts(row.summary);
    return {
      id: row.id,
      url: row.targetUrl,
      grade: (row.grade as Grade | null) ?? null,
      score: row.score,
      critical: sev.critical,
      high: sev.high,
      medium: sev.medium,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  });

  return { items, nextCursor };
}
