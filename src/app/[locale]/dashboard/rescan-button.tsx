'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

interface Props {
  url: string;
  labels: { rescan: string; rescanError: string };
}

export function RescanButton({ url, labels }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRescan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? labels.rescanError);
        return;
      }
      const data = (await res.json()) as { id: string };
      router.push(`/scan/${data.id}` as Parameters<typeof router.push>[0]);
    } catch {
      setError(labels.rescanError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <button
        type="button"
        onClick={handleRescan}
        disabled={loading}
        style={{
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: 'transparent',
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '…' : `↺ ${labels.rescan}`}
      </button>
      {error && (
        <span style={{ fontSize: 'var(--fs-xs)', color: '#DC2626' }}>{error}</span>
      )}
    </span>
  );
}
