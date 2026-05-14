import { Nav } from '@/components/nav';
import { ScanProgress } from './scan-progress';

interface Props {
  params: { id: string };
  searchParams: { url?: string; variant?: string };
}

export default function ScanPage({ params, searchParams }: Props) {
  const scanUrl = searchParams.url ? decodeURIComponent(searchParams.url) : params.id;
  const rawVariant = (searchParams.variant ?? 'A').toUpperCase();
  const initialVariant = rawVariant === 'B' || rawVariant === 'C' ? rawVariant : 'A';
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Nav />
      <div style={{ paddingTop: 56 }}>
        <ScanProgress scanId={params.id} scanUrl={scanUrl} initialVariant={initialVariant} />
      </div>
    </div>
  );
}
