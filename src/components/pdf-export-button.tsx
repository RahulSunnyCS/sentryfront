'use client';

import { useState } from 'react';
import { useFeature } from '@/lib/client-features';

interface Props {
  scanId: string;
}

export function PdfExportButton({ scanId }: Props) {
  const pdfEnabled = useFeature('pdfExport');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pdfEnabled) {
    return null; // Hide button if PDF export is disabled
  }

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/scans/${scanId}/pdf`, {
        method: 'GET', // Changed from POST to GET
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'PDF generation failed' }));
        throw new Error(body.error || 'PDF generation failed');
      }

      // Download PDF directly (it's a blob/buffer response)
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      // iOS Safari <14 ignores <a download> and opens PDFs in-page,
      // which feels broken (the click looks like nothing happened).
      // Detect it and fall back to opening the blob in a new tab so
      // the user can use the native "Save to Files" affordance.
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
      const isOldIOS = isIOS && /OS (?:1[0-3]|[1-9])_/.test(ua);
      if (isOldIOS) {
        window.open(url, '_blank');
        // Revoke after a short delay so the new tab has time to load it.
        setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `vibesafe-report-${scanId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={loading}
        style={{
          padding: '8px 16px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          backgroundColor: loading ? 'var(--surface)' : 'var(--accent)',
          color: loading ? 'var(--text-secondary)' : '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {loading ? 'Generating PDF...' : '📄 Download PDF'}
      </button>

      {error && (
        <p style={{ fontSize: 12, color: '#e53e3e', marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
