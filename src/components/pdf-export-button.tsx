'use client';

import { useState } from 'react';
import { useFeature } from '@/lib/client-features';

interface Props {
  scanId: string;
}

export function PdfExportButton({ scanId }: Props) {
  const pdfEnabled = useFeature('pdfExport');
  const [opening, setOpening] = useState(false);

  if (!pdfEnabled) {
    return null;
  }

  const handleClick = () => {
    setOpening(true);
    const url = `/report/${scanId}/print?print=auto`;
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      // Popup blocked — fall back to navigating the current tab.
      window.location.href = url;
      return;
    }
    // Reset the button quickly so users can re-open if they accidentally close
    // the new tab.
    window.setTimeout(() => setOpening(false), 600);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={opening}
      className="no-print"
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        backgroundColor: opening ? 'var(--surface)' : 'var(--accent)',
        color: opening ? 'var(--text-secondary)' : '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: opening ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {opening ? 'Opening…' : '📄 Download PDF'}
    </button>
  );
}
