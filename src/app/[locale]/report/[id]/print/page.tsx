import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BAD_SCAN, GOOD_SCAN } from '@/lib/data';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth/helpers';
import { canViewScan } from '@/lib/report-access';
import type { Finding, Grade, ScanData, ScanStatus, ScanSummary } from '@/types';
import { PrintReport } from './print-report';
import './print.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Report — VibeSafe',
  robots: { index: false, follow: false },
};

interface Props {
  params: { id: string };
}

interface LoaderResult {
  scanData: ScanData;
  scanId: string;
  userEmail: string | null;
  startedAtIso: string;
  completedAtIso: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
}

async function loadScan(id: string): Promise<LoaderResult | { error: 'not_found' | 'unauthorized' | 'running' }> {
  // Demo IDs bypass auth so the marketing/preview flow still works.
  if (id === 'demo' || id === 'demo-bad') {
    return {
      scanData: BAD_SCAN,
      scanId: id,
      userEmail: null,
      startedAtIso: new Date().toISOString(),
      completedAtIso: new Date().toISOString(),
      performanceScore: null,
      accessibilityScore: null,
      seoScore: null,
    };
  }
  if (id === 'demo-good') {
    return {
      scanData: GOOD_SCAN,
      scanId: id,
      userEmail: null,
      startedAtIso: new Date().toISOString(),
      completedAtIso: new Date().toISOString(),
      performanceScore: null,
      accessibilityScore: null,
      seoScore: null,
    };
  }

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: {
      findings: true,
      user: { select: { email: true, tier: true } },
    },
  });

  if (!scan) return { error: 'not_found' };

  const user = await getCurrentUser();
  if (isAuthEnabled() && !canViewScan(scan, user)) {
    return { error: 'not_found' };
  }

  if (scan.status !== 'COMPLETED') {
    return { error: 'running' };
  }

  const findings: Finding[] = scan.findings.map((f) => ({
    id: f.id,
    module: f.moduleId,
    severity: f.severity as Finding['severity'],
    category: f.category,
    title: f.title,
    location: f.location,
    evidence: f.evidence,
    explanation: f.explanation,
    impact: f.impact,
    fixManual: parseJsonArray(f.fixManual),
    fixAiPrompt: f.fixAiPrompt,
  }));

  const performanceScore = scan.performanceScore ?? null;
  const accessibilityScore = scan.accessibilityScore ?? null;
  const seoScore = scan.seoScore ?? null;

  const startedAtIso = new Date(scan.startedAt).toISOString();
  const completedAtIso = scan.completedAt
    ? new Date(scan.completedAt).toISOString()
    : startedAtIso;
  const durationSeconds = scan.completedAt
    ? Math.max(
        0,
        Math.round((new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000),
      )
    : 0;

  const scanData: ScanData = {
    id: scan.id,
    url: scan.targetUrl,
    grade: (scan.grade ?? 'F') as Grade,
    score: scan.score ?? 0,
    stack: scan.stack ?? 'Unknown',
    date: new Date(scan.startedAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    duration: durationSeconds > 0 ? `${durationSeconds}s` : '—',
    status: scan.status as ScanStatus,
    summary: scan.summary
      ? (JSON.parse(scan.summary) as ScanSummary)
      : { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
    moduleResults: {},
    findings,
  };

  return {
    scanData,
    scanId: scan.id,
    userEmail: scan.user?.email ?? null,
    startedAtIso,
    completedAtIso,
    performanceScore,
    accessibilityScore,
    seoScore,
  };
}

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function StatusPage() {
  return (
    <div data-print-doc>
      <div className="status-card">
        <h1>Scan still running</h1>
        <p>
          The scan you requested hasn&apos;t finished yet. The PDF will be
          available once it completes — refresh in a few seconds.
        </p>
        <a href="/dashboard">Back to dashboard</a>
      </div>
    </div>
  );
}

export default async function PrintReportPage({ params }: Props) {
  const result = await loadScan(params.id);

  if ('error' in result) {
    if (result.error === 'running') return <StatusPage />;
    notFound();
  }

  const reportId = `rpt_${result.scanId.slice(0, 8)}`;
  const issuedAtIso = result.completedAtIso;
  const validUntilIso = new Date(
    new Date(result.completedAtIso).getTime() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString();

  return (
    <PrintReport
      scanData={result.scanData}
      scanId={result.scanId}
      reportId={reportId}
      preparedFor={result.userEmail}
      issuedAtIso={issuedAtIso}
      validUntilIso={validUntilIso}
      performanceScore={result.performanceScore}
      accessibilityScore={result.accessibilityScore}
      seoScore={result.seoScore}
    />
  );
}
