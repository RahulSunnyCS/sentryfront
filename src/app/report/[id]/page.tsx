import { Nav } from '@/components/nav';
import { ReportView } from './report-view';
import { getScan } from '@/lib/api';

interface Props {
  params: { id: string };
  searchParams: { url?: string };
}

export default async function ReportPage({ params, searchParams }: Props) {
  let scanData = null;
  let fetchError: string | null = null;

  try {
    scanData = await getScan(params.id);
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
      <Nav showReportActions scanUrl={scanUrl} />
      <div style={{ paddingTop: 56 }}>
        <ReportView scanData={scanData} />
      </div>
    </div>
  );
}
