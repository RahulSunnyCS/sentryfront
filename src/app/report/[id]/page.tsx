import { Nav } from '@/components/nav';
import { ReportView } from './report-view';
import { prisma } from '@/lib/prisma';
import { BAD_SCAN } from '@/lib/data';
import type { ScanData, ScanSummary, Finding, Grade, ScanStatus } from '@/types';

interface Props {
  params: { id: string };
  searchParams: { url?: string };
}

async function getReportData(id: string): Promise<ScanData> {
  if (id === 'demo') return BAD_SCAN;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { findings: true },
  });

  if (!scan) throw new Error('Report not found.');

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
    fixManual: JSON.parse(f.fixManual) as string[],
    fixAiPrompt: f.fixAiPrompt,
  }));

  return {
    id: scan.id,
    url: scan.targetUrl,
    grade: (scan.grade ?? 'F') as Grade,
    score: scan.score ?? 0,
    stack: scan.stack ?? 'Unknown',
    date: new Date(scan.startedAt).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    }),
    duration: scan.completedAt
      ? `${Math.round((new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000)}s`
      : '—',
    status: scan.status as ScanStatus,
    summary: scan.summary ? (JSON.parse(scan.summary) as ScanSummary) : { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
    moduleResults: {},
    findings,
  };
}

export default async function ReportPage({ params, searchParams }: Props) {
  let scanData: ScanData | null = null;
  let fetchError: string | null = null;

  try {
    scanData = await getReportData(params.id);
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Failed to load report.';
  }

  if (fetchError || !scanData) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
        <Nav />
        <div style={{
          paddingTop: 56, display: 'flex', alignItems: 'center',
          justifyContent: 'center', minHeight: 'calc(100vh - 56px)',
        }}>
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {fetchError ?? 'Report not found.'}
            </p>
            <a href="/" style={{
              display: 'inline-block', padding: '10px 20px', borderRadius: 8,
              backgroundColor: 'var(--accent)', color: '#fff', textDecoration: 'none',
              fontSize: 14, fontWeight: 600,
            }}>
              Start a new scan
            </a>
          </div>
        </div>
      </div>
    );
  }

  const scanUrl = searchParams.url ? decodeURIComponent(searchParams.url) : scanData.url;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav showReportActions scanUrl={scanUrl} scanId={params.id} />
      <div style={{ paddingTop: 56 }}>
        <ReportView scanData={scanData} />
      </div>
    </div>
  );
}
