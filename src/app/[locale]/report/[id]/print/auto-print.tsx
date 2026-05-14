'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Props {
  filename: string;
}

export function AutoPrint({ filename }: Props) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.documentElement.setAttribute('data-print-doc', 'true');
    const originalTitle = document.title;
    document.title = filename;

    return () => {
      document.title = originalTitle;
    };
  }, [filename]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (searchParams?.get('print') !== 'auto') return;

    // Give the browser one frame to lay out everything before the dialog opens.
    const id = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(id);
  }, [searchParams]);

  return (
    <button
      type="button"
      className="print-cta"
      onClick={() => window.print()}
      aria-label="Open the print dialog"
    >
      🖨 Print / Save as PDF
    </button>
  );
}
