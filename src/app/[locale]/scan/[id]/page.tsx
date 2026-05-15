import { cookies } from 'next/headers';
import { Nav } from '@/components/nav';
import { ScanProgress } from './scan-progress';

interface Props {
  params: { id: string };
  searchParams: { url?: string; filename?: string; platform?: string; variant?: string };
}

export default function ScanPage({ params, searchParams }: Props) {
  const isMobile = searchParams.platform === 'apk' || searchParams.platform === 'ipa';
  const scanUrl = isMobile
    ? (searchParams.filename ? decodeURIComponent(searchParams.filename) : params.id)
    : (searchParams.url ? decodeURIComponent(searchParams.url) : params.id);
  const platform = isMobile ? (searchParams.platform as 'apk' | 'ipa') : undefined;
  const rawVariant = searchParams.variant?.toUpperCase();
  let initialVariant: 'A' | 'C';
  if (rawVariant === 'A' || rawVariant === 'C') {
    initialVariant = rawVariant;
  } else {
    // Round-robin: alternate A ↔ C across scans so no two consecutive
    // scans share a theme. Falls back to A on first ever scan.
    const last = cookies().get('sentry:lastScanVariant')?.value;
    initialVariant = last === 'A' ? 'C' : 'A';
  }
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <ScanProgress scanId={params.id} scanUrl={scanUrl} initialVariant={initialVariant} platform={platform} />
      </div>
    </div>
  );
}
