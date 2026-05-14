'use client';

import { useState } from 'react';
import { useFeature } from '@/lib/client-features';

interface Props {
  scanId: string;
}

export function PdfExportButton({ scanId }: Props) {
  const pdfEnabled = useFeature('pdfExport');
  const [printing, setPrinting] = useState(false);

  if (!pdfEnabled) {
    return null;
  }

  const handlePrint = () => {
    setPrinting(true);

    const originalTitle = document.title;
    let hostname = scanId;
    try {
      const url = document.querySelector<HTMLElement>('[data-scan-url]')?.dataset.scanUrl;
      if (url) hostname = new URL(url).hostname;
    } catch {
      // ignore — fall back to scanId
    }
    const date = new Date().toISOString().split('T')[0];
    document.title = `vibesafe-${hostname}-${date}`;

    const restore = () => {
      document.title = originalTitle;
      setPrinting(false);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    window.print();

    // Safari/Firefox sometimes fail to fire afterprint reliably.
    setTimeout(restore, 1000);
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={printing}
      className="no-print"
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        backgroundColor: printing ? 'var(--surface)' : 'var(--accent)',
        color: printing ? 'var(--text-secondary)' : '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: printing ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {printing ? 'Opening print…' : '📄 Download PDF'}
    </button>
  );
}
