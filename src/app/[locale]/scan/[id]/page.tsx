import { cookies } from 'next/headers';
import { Nav } from '@/components/nav';
import { ScanProgress } from './scan-progress';

interface Props {
  params: { id: string };
  searchParams: { url?: string; variant?: string };
}

export default function ScanPage({ params, searchParams }: Props) {
  const scanUrl = searchParams.url ? decodeURIComponent(searchParams.url) : params.id;
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
        <ScanProgress scanId={params.id} scanUrl={scanUrl} initialVariant={initialVariant} />
      </div>
    </div>
  );
}
